from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db

router = APIRouter()


@router.get("/", summary="All Indian states + UTs for dropdown filter")
async def get_states(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT name, code FROM india_states ORDER BY name")
    )
    return {"states": [{"name": r.name, "code": r.code} for r in result.fetchall()]}


@router.get("/{state_name}/bbox", summary="Bounding box of a state — for auto-zoom")
async def get_state_bbox(state_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT
                ST_XMin(ST_Extent(geometry)) AS xmin,
                ST_YMin(ST_Extent(geometry)) AS ymin,
                ST_XMax(ST_Extent(geometry)) AS xmax,
                ST_YMax(ST_Extent(geometry)) AS ymax
            FROM india_states
            WHERE LOWER(name) = LOWER(:state)
        """),
        {"state": state_name},
    )
    row = result.fetchone()
    if not row or row.xmin is None:
        # Fall back to approximate bounding boxes for common states
        FALLBACK_BBOX = {
            "rajasthan": [69.5, 23.0, 78.2, 30.2],
            "gujarat":   [68.2, 20.1, 74.5, 24.7],
            "tamil nadu":[76.2,  8.1, 80.4, 13.6],
            "karnataka": [74.0, 11.6, 78.6, 18.5],
            "maharashtra":[72.6, 15.6, 80.9, 22.0],
            "andhra pradesh":[76.8, 12.6, 84.7, 19.9],
            "madhya pradesh":[74.0, 21.1, 82.8, 26.9],
            "telangana": [77.2, 15.8, 81.4, 19.9],
        }
        bbox = FALLBACK_BBOX.get(state_name.lower())
        return {"state": state_name, "bbox": bbox}

    return {
        "state": state_name,
        "bbox":  [row.xmin, row.ymin, row.xmax, row.ymax],
    }


@router.get("/{state_name}/stats", summary="Farm stats for a single state")
async def get_state_stats(state_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT
                COUNT(*)                               AS farm_count,
                COALESCE(SUM(area_ha), 0)              AS total_area_ha,
                COALESCE(SUM(capacity_mw), 0)          AS total_capacity_mw,
                COALESCE(AVG(confidence), 0)           AS avg_confidence
            FROM solar_farms
            WHERE LOWER(TRIM(state)) = LOWER(TRIM(:state))
        """),
        {"state": state_name},
    )
    row = result.fetchone()
    return {
        "state":             state_name,
        "farm_count":        row.farm_count,
        "total_area_ha":     round(float(row.total_area_ha), 2),
        "total_capacity_mw": round(float(row.total_capacity_mw), 2),
        "avg_confidence":    round(float(row.avg_confidence), 3),
    }
