"""Celery scheduler for nightly data refresh jobs."""
from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
app = Celery("solarai", broker=REDIS_URL, backend=REDIS_URL)

app.conf.beat_schedule = {
    "refresh-suitability-nightly": {
        "task": "pipeline.scheduler.refresh_suitability",
        "schedule": 86400,  # every 24 hours
    },
}

@app.task
def refresh_suitability():
    """Nightly task: recompute suitability scores for all states."""
    print("Running nightly suitability refresh…")
    # Import inside task to avoid circular imports
    import asyncio
    from ai.suitability import calculate_suitability
    from database import AsyncSessionLocal
    PRIORITY_STATES = ["Rajasthan", "Gujarat", "Tamil Nadu", "Karnataka", "Andhra Pradesh"]
    async def run():
        async with AsyncSessionLocal() as db:
            for state in PRIORITY_STATES:
                await calculate_suitability(state, db)
                print(f"  ✅ Refreshed: {state}")
    asyncio.run(run())
