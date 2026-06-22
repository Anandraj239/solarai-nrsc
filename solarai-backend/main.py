"""
SolarAI NRSC/ISRO — Render-deployable FastAPI backend.
No Docker, no PostGIS required. Data is served from built-in GeoJSON.
State filtering is case-insensitive and whitespace-safe.
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json, os, math

app = FastAPI(
    title="SolarAI NRSC/ISRO API",
    description="Live backend for solar farm detection and suitability analysis across India.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load data ─────────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

with open(os.path.join(DATA_DIR, "solar_farms.geojson"), encoding="utf-8") as f:
    SOLAR_FARMS = json.load(f)["features"]

with open(os.path.join(DATA_DIR, "suitable_sites.geojson"), encoding="utf-8") as f:
    SUITABLE_SITES = json.load(f)["features"]

# ── Helpers ───────────────────────────────────────────────────────────────────
def _norm(s: str) -> str:
    return (s or "").strip().lower()

def _state_match(feature, state: str) -> bool:
    return _norm(feature.get("properties", {}).get("state", "")) == _norm(state)

def _centroid(geom: dict):
    """Return (lat, lon) centroid for any geometry type."""
    t = geom["type"]
    if t == "Point":
        return geom["coordinates"][1], geom["coordinates"][0]
    if t == "Polygon":
        ring = geom["coordinates"][0]
    elif t == "MultiPolygon":
        ring = geom["coordinates"][0][0]
    else:
        return None
    lats = [c[1] for c in ring]
    lons = [c[0] for c in ring]
    return sum(lats)/len(lats), sum(lons)/len(lons)

# Approximate state bounding boxes
STATE_BBOX = {
    "rajasthan":       [69.5, 23.0, 78.2, 30.2],
    "gujarat":         [68.2, 20.1, 74.5, 24.7],
    "tamil nadu":      [76.2,  8.1, 80.4, 13.6],
    "karnataka":       [74.0, 11.6, 78.6, 18.5],
    "maharashtra":     [72.6, 15.6, 80.9, 22.0],
    "andhra pradesh":  [76.8, 12.6, 84.7, 19.9],
    "madhya pradesh":  [74.0, 21.1, 82.8, 26.9],
    "telangana":       [77.2, 15.8, 81.4, 19.9],
    "uttar pradesh":   [77.1, 23.8, 84.6, 30.4],
    "punjab":          [73.9, 29.5, 76.9, 32.5],
    "haryana":         [74.5, 27.7, 77.6, 30.9],
    "odisha":          [81.4, 17.8, 87.5, 22.6],
    "west bengal":     [85.8, 21.5, 89.9, 27.2],
    "bihar":           [83.3, 24.3, 88.3, 27.5],
    "kerala":          [74.9,  8.3, 77.4, 12.8],
    "jharkhand":       [83.3, 21.9, 87.9, 25.3],
    "assam":           [89.7, 24.1, 96.0, 28.2],
    "himachal pradesh":[75.6, 30.4, 79.0, 33.2],
    "uttarakhand":     [77.6, 28.7, 81.1, 31.5],
    "jammu and kashmir":[73.7, 32.3, 80.4, 36.9],
    "delhi":           [76.8, 28.4, 77.3, 28.9],
    "chhattisgarh":    [80.3, 17.8, 84.4, 24.1],
    "goa":             [73.7, 14.9, 74.3, 15.8],
}

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "SolarAI NRSC/ISRO API is live", "docs": "/docs", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok", "farms": len(SOLAR_FARMS), "sites": len(SUITABLE_SITES)}

# ── Solar Farms ───────────────────────────────────────────────────────────────
@app.get("/api/solar-farms/")
def get_solar_farms(
    state: str = Query(None),
    limit: int = Query(5000, le=10000),
    offset: int = Query(0),
):
    """
    Returns GeoJSON FeatureCollection of detected solar farms.
    Filter by ?state=Rajasthan (case-insensitive, whitespace-safe).
    """
    features = SOLAR_FARMS
    if state and state.lower() != "all":
        features = [f for f in features if _state_match(f, state)]

    page = features[offset: offset + limit]
    return {
        "type": "FeatureCollection",
        "features": page,
        "total": len(page),
        "filter_applied": {"state": state},
    }

@app.get("/api/solar-farms/summary")
def get_summary():
    """State-wise farm count and total capacity."""
    summary: dict = {}
    for f in SOLAR_FARMS:
        p = f.get("properties", {})
        s = p.get("state", "Unknown")
        if s not in summary:
            summary[s] = {"state": s, "farm_count": 0, "total_area_ha": 0, "total_capacity_mw": 0}
        summary[s]["farm_count"] += 1
        summary[s]["total_area_ha"]    += p.get("area_ha", 0) or 0
        summary[s]["total_capacity_mw"] += p.get("capacity_mw", 0) or 0
    rows = sorted(summary.values(), key=lambda x: -x["total_capacity_mw"])
    return {"summary": rows}

# ── Suitable Sites ────────────────────────────────────────────────────────────
@app.get("/api/suitable-sites/")
def get_suitable_sites(
    state: str     = Query(None),
    min_score: float = Query(0.6, ge=0, le=1),
    limit: int     = Query(2000, le=5000),
):
    features = SUITABLE_SITES
    if state and state.lower() != "all":
        features = [f for f in features if _state_match(f, state)]
    features = [f for f in features
                if (f.get("properties", {}).get("suitability_score") or 0) >= min_score]
    return {"type": "FeatureCollection", "features": features[:limit], "total": len(features)}

# ── States ────────────────────────────────────────────────────────────────────
@app.get("/api/states/")
def get_states():
    """All states present in the data, plus full India list."""
    INDIA_STATES = [
        "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
        "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
        "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
        "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
        "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
        "Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh",
    ]
    return {"states": [{"name": s, "code": s[:2].upper()} for s in sorted(INDIA_STATES)]}

@app.get("/api/states/{state_name}/bbox")
def get_state_bbox(state_name: str):
    bbox = STATE_BBOX.get(_norm(state_name))
    return {"state": state_name, "bbox": bbox}

@app.get("/api/states/{state_name}/stats")
def get_state_stats(state_name: str):
    farms = [f for f in SOLAR_FARMS if _state_match(f, state_name)]
    area  = sum(f.get("properties", {}).get("area_ha", 0) or 0 for f in farms)
    cap   = sum(f.get("properties", {}).get("capacity_mw", 0) or 0 for f in farms)
    return {
        "state": state_name,
        "farm_count": len(farms),
        "total_area_ha": round(area, 2),
        "total_capacity_mw": round(cap, 2),
    }
