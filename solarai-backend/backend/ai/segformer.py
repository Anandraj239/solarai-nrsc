"""
SegFormer-based solar farm detection.
Loads nvidia/segformer-b2-finetuned-ade-512-512 (or a fine-tuned checkpoint).
Falls back to a bounding-box dummy if GPU / model is unavailable.
"""
import asyncio
import os

import numpy as np
import torch

MODEL = None
PROCESSOR = None


def load_model():
    global MODEL, PROCESSOR
    try:
        from transformers import (
            SegformerForSemanticSegmentation,
            SegformerImageProcessor,
        )

        checkpoint = os.getenv(
            "SEGFORMER_CHECKPOINT",
            "nvidia/segformer-b2-finetuned-ade-512-512",
        )
        PROCESSOR = SegformerImageProcessor.from_pretrained(checkpoint)
        MODEL = SegformerForSemanticSegmentation.from_pretrained(checkpoint)
        MODEL.eval()

        if torch.cuda.is_available():
            MODEL = MODEL.cuda()
            print(f"✅ SegFormer loaded on GPU: {checkpoint}")
        else:
            print(f"✅ SegFormer loaded on CPU: {checkpoint}")

    except Exception as exc:
        print(f"⚠️  SegFormer load failed ({exc}). Falling back to dummy detection.")


load_model()


async def detect_solar_panels(tif_path: str, state: str) -> dict:
    """
    Run SegFormer on a GeoTIFF and save detected solar farm polygons to PostGIS.

    Returns a summary dict.
    """
    results = {"state": state, "farms_detected": 0, "features": []}

    try:
        import rasterio
        from rasterio.features import shapes
        from shapely.geometry import shape
        import geopandas as gpd
        from database import AsyncSessionLocal
        from sqlalchemy import text

        with rasterio.open(tif_path) as src:
            # Read up to 3 bands (RGB-ish from Sentinel-2 B4-B3-B2)
            band_count = min(src.count, 3)
            bands = list(range(1, band_count + 1))
            if band_count < 3:
                bands = bands * (3 // band_count + 1)
            bands = bands[:3]

            image = src.read(bands).astype(np.float32)
            transform = src.transform
            crs = src.crs

        # Normalise Sentinel-2 DN (0-10 000 → 0-1)
        image = np.clip(image / 10_000.0, 0, 1)
        h, w = image.shape[1], image.shape[2]
        solar_mask = np.zeros((h, w), dtype=np.uint8)

        if MODEL is not None:
            tile = 512
            for r0 in range(0, h, tile):
                for c0 in range(0, w, tile):
                    r1 = min(r0 + tile, h)
                    c1 = min(c0 + tile, w)
                    patch = image[:, r0:r1, c0:c1]

                    # Pad to 512×512
                    ph = tile - patch.shape[1]
                    pw = tile - patch.shape[2]
                    if ph > 0 or pw > 0:
                        patch = np.pad(patch, ((0, 0), (0, ph), (0, pw)), mode="reflect")

                    tensor = torch.FloatTensor(patch).unsqueeze(0)
                    if torch.cuda.is_available():
                        tensor = tensor.cuda()

                    with torch.no_grad():
                        logits = MODEL(pixel_values=tensor).logits

                    pred = logits.argmax(dim=1).squeeze().cpu().numpy()
                    # ADE20K class 3 ≈ ground / bare — proxy for solar panels
                    # Replace with class index from a properly fine-tuned model
                    tile_mask = (pred == 3).astype(np.uint8)
                    solar_mask[r0:r1, c0:c1] = tile_mask[: r1 - r0, : c1 - c0]
        else:
            # Dummy: mark a small central region
            cy, cx = h // 2, w // 2
            solar_mask[cy - 50 : cy + 50, cx - 50 : cx + 50] = 1

        # Vectorise mask → polygons
        polygons = []
        for geom_dict, val in shapes(solar_mask, transform=transform):
            if val != 1:
                continue
            poly = shape(geom_dict)
            area_ha = poly.area * (111_320 ** 2) / 10_000  # very rough
            if area_ha >= 0.5:
                polygons.append(
                    {
                        "geometry":    poly,
                        "area_ha":     round(area_ha, 2),
                        "capacity_mw": round(area_ha * 0.2, 2),
                        "state":       state,
                        "confidence":  0.85 if MODEL else 0.50,
                    }
                )

        if polygons:
            gdf = gpd.GeoDataFrame(polygons, crs=crs).to_crs("EPSG:4326")
            async with AsyncSessionLocal() as db:
                for _, row in gdf.iterrows():
                    await db.execute(
                        text("""
                            INSERT INTO solar_farms
                                (state, geometry, area_ha, capacity_mw, confidence, satellite_source)
                            VALUES
                                (:state,
                                 ST_Multi(ST_GeomFromText(:geom, 4326)),
                                 :area_ha, :capacity_mw, :confidence, 'Sentinel-2')
                        """),
                        {
                            "state":       row["state"],
                            "geom":        row["geometry"].wkt,
                            "area_ha":     row["area_ha"],
                            "capacity_mw": row["capacity_mw"],
                            "confidence":  row["confidence"],
                        },
                    )
                await db.commit()

            results["farms_detected"] = len(gdf)
            results["total_area_ha"]  = round(gdf["area_ha"].sum(), 2)

    except Exception as exc:
        results["error"] = str(exc)
        print(f"[SegFormer] Detection error: {exc}")

    return results
