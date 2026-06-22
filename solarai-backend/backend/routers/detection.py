from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse
import os

router = APIRouter()

# In-memory job store — use Redis/Celery in production
detection_jobs: dict = {}


@router.post("/upload", summary="Upload GeoTIFF satellite image for AI detection")
async def detect_from_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Sentinel-2 GeoTIFF"),
    state: str = Form(..., description="State name for this image"),
):
    if not file.filename.lower().endswith((".tif", ".tiff")):
        return JSONResponse(status_code=400, content={"error": "Only GeoTIFF files accepted"})

    job_id = f"job_{state.lower().replace(' ', '_')}_{os.urandom(4).hex()}"
    detection_jobs[job_id] = {
        "status":   "queued",
        "state":    state,
        "progress": 0,
        "filename": file.filename,
    }

    os.makedirs("/data/satellite", exist_ok=True)
    tmp_path = f"/data/satellite/{job_id}.tif"
    with open(tmp_path, "wb") as f:
        content = await file.read()
        f.write(content)

    background_tasks.add_task(_run_detection_job, job_id, tmp_path, state)

    return {
        "job_id":   job_id,
        "status":   "queued",
        "message":  f"Detection started for {state}. Poll /api/detect/status/{job_id}",
    }


@router.get("/status/{job_id}", summary="Poll detection job status")
async def get_detection_status(job_id: str):
    job = detection_jobs.get(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "Job not found"})
    return job


@router.get("/jobs", summary="List all detection jobs")
async def list_jobs():
    return {"jobs": list(detection_jobs.values())}


async def _run_detection_job(job_id: str, tif_path: str, state: str):
    """Runs SegFormer detection in the background and saves results to PostGIS."""
    try:
        detection_jobs[job_id]["status"]   = "running"
        detection_jobs[job_id]["progress"] = 10

        from ai.segformer import detect_solar_panels
        result = await detect_solar_panels(tif_path, state)

        detection_jobs[job_id]["status"]   = "completed"
        detection_jobs[job_id]["progress"] = 100
        detection_jobs[job_id]["result"]   = result

    except Exception as exc:
        detection_jobs[job_id]["status"] = "failed"
        detection_jobs[job_id]["error"]  = str(exc)

    finally:
        if os.path.exists(tif_path):
            os.remove(tif_path)
