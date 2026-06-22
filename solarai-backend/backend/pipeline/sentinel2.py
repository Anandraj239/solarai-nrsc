"""Sentinel-2 data fetch via ESA Copernicus Open Access Hub."""
import httpx, os

COPERNICUS_USER = os.getenv("COPERNICUS_USER", "")
COPERNICUS_PASS = os.getenv("COPERNICUS_PASS", "")

async def search_sentinel2(state_bbox: list, date_from: str, date_to: str, cloud_cover: int = 20) -> list:
    """Search for available Sentinel-2 scenes covering a bounding box."""
    xmin, ymin, xmax, ymax = state_bbox
    footprint = f"POLYGON(({xmin} {ymin},{xmax} {ymin},{xmax} {ymax},{xmin} {ymax},{xmin} {ymin}))"
    params = {
        "q": f'platformname:Sentinel-2 AND producttype:S2MSI2A AND cloudcoverpercentage:[0 TO {cloud_cover}] AND footprint:"Intersects({footprint})"',
        "rows": 10, "start": 0,
        "orderby": "beginposition desc",
    }
    url = "https://apihub.copernicus.eu/apihub/search"
    try:
        async with httpx.AsyncClient(auth=(COPERNICUS_USER, COPERNICUS_PASS), timeout=30) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json().get("feed", {}).get("entry", [])
    except Exception as e:
        print(f"Sentinel-2 search error: {e}")
        return []
