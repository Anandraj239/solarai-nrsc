from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db

router = APIRouter()


@router.get("/", summary="Get suitable sites for new solar farms")
async def get_suitable_sites(
    state: str     = Query(None),
    min_score: float = Query(0.6, ge=0, le=1, description="Minimum suitability score 0-1"),
    bbox: str      = Query(None),
    limit: int     = Query(2000, le=5000),
    db: AsyncSession = Depends(get_db),
):
    """Returns orange-dot locations — AI-recommended sites for new solar farms."""
    query = """
        SELECT id, state, district,
               suitability_score, solar_irradiance,
               slope_deg, land_use, grid_distance_km,
               recommended_capacity_mw,
               ST_AsGeoJSON(geometry)::json AS geometry
        FROM suitable_sites
        WHERE suitability_score >= :min_score
    """
    params: dict = {"min_score": min_score, "limit": limit}

    if state:
        query += " AND LOWER(TRIM(state)) = LOWER(TRIM(:state))"
        params["state"] = state

    if bbox:
        xmin, ymin, xmax, ymax = map(float, bbox.split(","))
        query += " AND ST_Intersects(geometry, ST_MakeEnvelope(:xmin,:ymin,:xmax,:ymax,4326))"
        params.update({"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax})

    query += " ORDER BY suitability_score DESC LIMIT :limit"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    features = [
        {
            "type": "Feature",
            "geometry": row.geometry,
            "properties": {
                "id":                       row.id,
                "state":                    row.state,
                "district":                 row.district,
                "suitability_score":        row.suitability_score,
                "solar_irradiance":         row.solar_irradiance,
                "slope_deg":                row.slope_deg,
                "land_use":                 row.land_use,
                "grid_distance_km":         row.grid_distance_km,
                "recommended_capacity_mw":  row.recommended_capacity_mw,
                "type":  "suitable",
                "color": "orange",
            },
        }
        for row in rows
    ]

    return {"type": "FeatureCollection", "features": features, "total": len(features)}
