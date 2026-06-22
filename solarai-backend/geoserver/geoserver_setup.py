"""
Auto-configure GeoServer with PostGIS datastore and publish solar layers.
Run once after GeoServer starts:  python geoserver/geoserver_setup.py
"""
import requests, time

GEOSERVER_URL = "http://localhost:8080/geoserver"
AUTH    = ("admin", "geoserver_admin_2024")
HEADERS = {"Content-Type": "application/json"}


def wait_for_geoserver(timeout=150):
    print("Waiting for GeoServer to start…")
    for _ in range(timeout // 5):
        try:
            r = requests.get(f"{GEOSERVER_URL}/web/", timeout=5)
            if r.status_code == 200:
                print("✅ GeoServer is ready")
                return
        except Exception:
            pass
        time.sleep(5)
    raise RuntimeError("GeoServer did not start in time")


def create_workspace():
    r = requests.post(
        f"{GEOSERVER_URL}/rest/workspaces",
        json={"workspace": {"name": "solarai"}},
        auth=AUTH, headers=HEADERS,
    )
    print("Workspace:", "created" if r.status_code == 201 else "already exists")


def create_postgis_store():
    data = {
        "dataStore": {
            "name": "solarai_postgis",
            "type": "PostGIS",
            "connectionParameters": {
                "entry": [
                    {"@key": "host",        "$": "postgis"},
                    {"@key": "port",        "$": "5432"},
                    {"@key": "database",    "$": "solardb"},
                    {"@key": "user",        "$": "solarai"},
                    {"@key": "passwd",      "$": "solarai_secret_2024"},
                    {"@key": "dbtype",      "$": "postgis"},
                    {"@key": "schema",      "$": "public"},
                    {"@key": "Loose bbox",  "$": "true"},
                    {"@key": "fetch size",  "$": "1000"},
                ]
            },
        }
    }
    r = requests.post(
        f"{GEOSERVER_URL}/rest/workspaces/solarai/datastores",
        json=data, auth=AUTH, headers=HEADERS,
    )
    print("PostGIS store:", "connected" if r.status_code == 201 else "already exists")


def publish_layer(table: str, title: str):
    data = {
        "featureType": {
            "name":       table,
            "nativeName": table,
            "title":      title,
            "srs":        "EPSG:4326",
            "enabled":    True,
        }
    }
    r = requests.post(
        f"{GEOSERVER_URL}/rest/workspaces/solarai/datastores/solarai_postgis/featuretypes",
        json=data, auth=AUTH, headers=HEADERS,
    )
    status = "published" if r.status_code == 201 else "already exists"
    print(f"Layer '{table}': {status}")


if __name__ == "__main__":
    wait_for_geoserver()
    create_workspace()
    create_postgis_store()
    publish_layer("solar_farms",    "Solar Farms (Detected)")
    publish_layer("suitable_sites", "Suitable Sites (Recommended)")
    publish_layer("india_states",   "India States Boundary")

    print("\n🎉 GeoServer setup complete!")
    print(f"   WMS: {GEOSERVER_URL}/solarai/wms")
    print(f"   WFS: {GEOSERVER_URL}/solarai/wfs")
    print(f"   UI:  {GEOSERVER_URL}/web  (admin / geoserver_admin_2024)")
