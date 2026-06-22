# SolarAI NRSC/ISRO — Backend

Bhuvan-portal-style GIS backend for automated solar farm detection and site suitability analysis across India.

## Stack

| Service | Technology | Port |
|---|---|---|
| API | FastAPI + Python 3.11 | 8000 |
| Database | PostGIS 15 | 5432 |
| Map Server | GeoServer 2.24 | 8080 |
| Queue | Redis 7 | 6379 |
| Workers | Celery | — |
| AI Model | SegFormer-B5 (HuggingFace) | — |

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Start all services
```bash
cd solarai-backend
docker-compose up -d
```

### 2. Wait ~60 seconds, then configure GeoServer
```bash
pip install requests
python geoserver/geoserver_setup.py
```

### 3. Open the API docs
```
http://localhost:8000/docs
```

### 4. Open GeoServer admin
```
http://localhost:8080/geoserver/web
Username: admin
Password: geoserver_admin_2024
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/solar-farms/` | All solar farms (filter by `?state=Rajasthan`) |
| `GET /api/solar-farms/summary` | State-wise count + capacity |
| `GET /api/suitable-sites/` | Recommended sites (filter by `?state=Gujarat&min_score=0.7`) |
| `GET /api/states/` | All 36 states + UTs |
| `GET /api/states/{name}/bbox` | State bounding box for auto-zoom |
| `POST /api/detect/upload` | Upload GeoTIFF for AI detection |
| `GET /api/detect/status/{job_id}` | Poll detection job status |

## State Filter Fix

The state filter was broken because it compared raw strings.
The fix uses `LOWER(TRIM(state)) = LOWER(TRIM(:state))` in all PostGIS queries,
so "Rajasthan", "rajasthan", " Rajasthan " all match correctly.

## Frontend

The fixed `frontend/app.js` connects to this backend.
When the backend is offline it automatically falls back to the static
`window.SolarAIData` GeoJSON bundled in `data.js`.

## Folder Structure

```
solarai-backend/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py            ← FastAPI app
│   ├── database.py        ← Async PostGIS connection
│   ├── routers/
│   │   ├── solar_farms.py
│   │   ├── suitable_sites.py
│   │   ├── detection.py
│   │   └── states.py
│   ├── ai/
│   │   ├── segformer.py   ← SegFormer detection engine
│   │   └── suitability.py ← Multi-criteria analysis
│   └── sql/
│       └── init.sql       ← Schema + seed data
└── geoserver/
    └── geoserver_setup.py ← One-shot GeoServer configurator
```

## Credentials

| Service | Username | Password |
|---|---|---|
| PostGIS | solarai | solarai_secret_2024 |
| GeoServer | admin | geoserver_admin_2024 |

> ⚠️ Change these before any production deployment.
