from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db

router = APIRouter()


@router.get("/", summary="Get solar farms — filtered by state or bounding box")
async def get_solar_farms(
    state: str = Query(None, description="State name e.g. Rajasthan"),
    bbox: str  = Query(None, description="xmin,ymin,xmax,ymax"),
    limit: int = Query(5000, le=10000),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns GeoJSON FeatureCollection of detected solar farms.
    - state param → case-insensitive exact match (FIXES THE FILTER BUG)
    - bbox param  → spatial envelope query
    - neither     → paginated all-India data
    """
    query = """
        SELECT id, name, state, district,
               area_ha, capacity_mw, confidence,
               satellite_source, detected_date,
               ST_AsGeoJSON(geometry)::json AS geometry
        FROM solar_farms
        WHERE 1=1
    """
    params: dict = {}

    if state:
        # Case-insensitive, whitespace-trimmed exact match
        query += " AND LOWER(TRIM(state)) = LOWER(TRIM(:state))"
        params["state"] = state

    elif bbox:
        try:
            xmin, ymin, xmax, ymax = map(float, bbox.split(","))
        except ValueError:
            raise HTTPException(400, "Invalid bbox. Use: xmin,ymin,xmax,ymax")
        query += """
            AND ST_Intersects(
                geometry,
                ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
            )
        """
        params.update({"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax})

    query += " ORDER BY area_ha DESC NULLS LAST LIMIT :limit OFFSET :offset"
    params["limit"]  = limit
    params["offset"] = offset

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    features = [
        {
            "type": "Feature",
            "geometry": row.geometry,
            "properties": {
                "id":               row.id,
                "name":             row.name,
                "state":            row.state,
                "district":         row.district,
                "area_ha":          row.area_ha,
                "capacity_mw":      row.capacity_mw,
                "confidence":       row.confidence,
                "satellite_source": row.satellite_source,
                "detected_date":    str(row.detected_date) if row.detected_date else None,
                "type":             "existing",
                "color":            "green",
            },
        }
        for row in rows
    ]

    return {
        "type":           "FeatureCollection",
        "features":       features,
        "total":          len(features),
        "filter_applied": {"state": state, "bbox": bbox},
    }


@router.get("/summary", summary="State-wise farm count + capacity")
async def get_summary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT state,
               COUNT(*) AS farm_count,
               ROUND(SUM(area_ha)::numeric, 2) AS total_area_ha,
               ROUND(SUM(capacity_mw)::numeric, 2) AS total_capacity_mw
        FROM solar_farms
        GROUP BY state
        ORDER BY total_capacity_mw DESC NULLS LAST
    """))
    return {
        "summary": [
            {
                "state":            r.state,
                "farm_count":       r.farm_count,
                "total_area_ha":    float(r.total_area_ha or 0),
                "total_capacity_mw": float(r.total_capacity_mw or 0),
            }
            for r in result.fetchall()
        ]
    }


@router.get("/{farm_id}", summary="Single solar farm by ID")
async def get_solar_farm(farm_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT *, ST_AsGeoJSON(geometry)::json AS geom FROM solar_farms WHERE id = :id"),
        {"id": farm_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "Solar farm not found")
    return {
        "type": "Feature",
        "geometry": row.geom,
        "properties": {k: v for k, v in row._mapping.items() if k not in ("geometry", "geom")},
    }
