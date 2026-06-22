"""Bhuvan WMS/WFS data fetch from NRSC."""
import httpx

BHUVAN_WMS = "https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms"

async def fetch_lulc(bbox: list, layer: str = "lulc50k_1112") -> bytes:
    """Fetch LULC raster from Bhuvan WMS for a bounding box."""
    xmin, ymin, xmax, ymax = bbox
    params = {
        "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap",
        "LAYERS": layer, "BBOX": f"{xmin},{ymin},{xmax},{ymax}",
        "WIDTH": 1024, "HEIGHT": 1024, "FORMAT": "image/geotiff", "SRS": "EPSG:4326",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(BHUVAN_WMS, params=params)
            r.raise_for_status()
            return r.content
    except Exception as e:
        print(f"Bhuvan WMS error: {e}")
        return b""
