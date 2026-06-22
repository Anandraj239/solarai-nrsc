"""
Multi-criteria suitability analysis.
Scores candidate grid cells 0-1 using weighted combination of:
  - Solar irradiance     (30 %)
  - Slope                (20 %)
  - Land use type        (25 %)
  - Grid proximity       (15 %)
  - Water-body avoidance (10 %)
"""
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


LAND_WEIGHTS = {
    "wasteland":  1.00,
    "barren":     0.90,
    "scrubland":  0.85,
    "agriculture":0.50,
    "forest":     0.10,
    "urban":      0.00,
}
LAND_TYPES = list(LAND_WEIGHTS.keys())
LAND_PROBS  = [0.20, 0.25, 0.15, 0.25, 0.10, 0.05]


async def calculate_suitability(state: str, db: AsyncSession) -> list:
    """
    Generate and score candidate sites for a given state.
    Saves high-suitability sites (≥0.65) to PostGIS suitable_sites table.
    Returns the list of site dicts.
    """
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
        {"state": state},
    )
    bbox = result.fetchone()

    # Fallback bounding boxes for states without geometry loaded
    FALLBACK = {
        "rajasthan":     (69.5, 23.0, 78.2, 30.2),
        "gujarat":       (68.2, 20.1, 74.5, 24.7),
        "tamil nadu":    (76.2,  8.1, 80.4, 13.6),
        "karnataka":     (74.0, 11.6, 78.6, 18.5),
        "andhra pradesh":(76.8, 12.6, 84.7, 19.9),
        "madhya pradesh":(74.0, 21.1, 82.8, 26.9),
    }

    if not bbox or bbox.xmin is None:
        fb = FALLBACK.get(state.lower())
        if not fb:
            return []
        xmin, ymin, xmax, ymax = fb
    else:
        xmin, ymin, xmax, ymax = bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax

    rng = np.random.default_rng(seed=hash(state) % (2**32))
    sites = []

    for lat in np.arange(ymin, ymax, 0.1):
        for lon in np.arange(xmin, xmax, 0.1):

            # 1. Solar irradiance proxy (higher further south / west)
            irradiance = max(4.0, 6.5 - (lat - 23) * 0.05)
            irr_score  = min(1.0, max(0.0, (irradiance - 4.0) / 2.5))

            # 2. Slope (Gaussian, prefer flat terrain)
            slope      = abs(rng.normal(2.0, 1.8))
            slope_score = max(0.0, 1.0 - slope / 15.0)

            # 3. Land use
            land_use   = rng.choice(LAND_TYPES, p=LAND_PROBS)
            land_score = LAND_WEIGHTS[land_use]

            # 4. Grid proximity
            grid_km    = abs(rng.normal(25, 18))
            grid_score  = max(0.0, 1.0 - grid_km / 100.0)

            # 5. Water-body avoidance
            water_km    = abs(rng.normal(12, 9))
            water_score = min(1.0, water_km / 5.0)

            total = (
                irr_score   * 0.30
                + slope_score * 0.20
                + land_score  * 0.25
                + grid_score  * 0.15
                + water_score * 0.10
            )

            if total >= 0.65:
                sites.append({
                    "lat":              round(float(lat), 4),
                    "lon":              round(float(lon), 4),
                    "suitability_score": round(float(total), 3),
                    "solar_irradiance":  round(float(irradiance), 2),
                    "slope_deg":         round(float(slope), 1),
                    "land_use":          land_use,
                    "grid_distance_km":  round(float(grid_km), 1),
                    "recommended_capacity_mw": round(float(total * 50), 1),
                })

    # Persist top 500 to PostGIS
    for site in sites[:500]:
        await db.execute(
            text("""
                INSERT INTO suitable_sites
                    (state, geometry, suitability_score, solar_irradiance,
                     slope_deg, land_use, grid_distance_km, recommended_capacity_mw)
                VALUES
                    (:state, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                     :score, :irr, :slope, :land_use, :grid, :cap)
                ON CONFLICT DO NOTHING
            """),
            {
                "state":  state,
                "lat":    site["lat"],
                "lon":    site["lon"],
                "score":  site["suitability_score"],
                "irr":    site["solar_irradiance"],
                "slope":  site["slope_deg"],
                "land_use": site["land_use"],
                "grid":   site["grid_distance_km"],
                "cap":    site["recommended_capacity_mw"],
            },
        )
    await db.commit()

    return sites
