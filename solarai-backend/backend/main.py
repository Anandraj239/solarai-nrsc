from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from database import create_tables
from routers import solar_farms, suitable_sites, detection, states


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(
    title="SolarAI NRSC/ISRO API",
    description="Bhuvan-style GIS backend for solar farm detection and site suitability analysis across India.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(solar_farms.router,    prefix="/api/solar-farms",    tags=["Solar Farms"])
app.include_router(suitable_sites.router, prefix="/api/suitable-sites", tags=["Suitable Sites"])
app.include_router(detection.router,      prefix="/api/detect",         tags=["AI Detection"])
app.include_router(states.router,         prefix="/api/states",         tags=["States"])


@app.get("/")
async def root():
    return {
        "message": "SolarAI NRSC/ISRO API is running",
        "docs": "/docs",
        "redoc": "/redoc",
        "version": "1.0.0",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "SolarAI Backend"}
