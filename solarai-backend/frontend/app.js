/**
 * SolarAI Frontend — Fixed + Backend-Connected Version
 * Connects to FastAPI backend at API_BASE
 * Falls back to static GeoJSON data when backend is unavailable
 */

// ── Configuration ─────────────────────────────────────────────────────────────
const API_BASE      = "http://localhost:8000/api";
const BACKEND_ALIVE = checkBackend();   // async, resolves to true/false

// ── Map Init (free tiles — no API key) ────────────────────────────────────────
const map = L.map("map", { zoomControl: true }).setView([20.5937, 78.9629], 5);

const streetLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap contributors", maxZoom: 19 }
).addTo(map);

const satelliteLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "© Esri World Imagery", maxZoom: 18 }
);

const cartoLight = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  { attribution: "© CARTO | © OpenStreetMap", maxZoom: 19, subdomains: "abcd" }
);

L.control.layers(
  { "Street Map": streetLayer, "Satellite (Esri)": satelliteLayer, "Carto Voyager": cartoLight },
  {}
).addTo(map);

// ── Layer Groups ───────────────────────────────────────────────────────────────
const farmLayer = L.layerGroup().addTo(map);
const siteLayer = L.layerGroup().addTo(map);

// ── Backend Health Check ───────────────────────────────────────────────────────
async function checkBackend() {
  try {
    const r = await fetch(`${API_BASE.replace("/api", "")}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

// ── Populate State Dropdown ────────────────────────────────────────────────────
async function loadStates() {
  const select = document.getElementById("state-select");
  if (!select) return;

  const alive = await BACKEND_ALIVE;

  if (alive) {
    try {
      const res  = await fetch(`${API_BASE}/states/`);
      const data = await res.json();
      select.innerHTML = '<option value="all">🇮🇳 All India</option>';
      data.states.forEach(s => {
        const opt = document.createElement("option");
        opt.value       = s.name;
        opt.textContent = s.name;
        select.appendChild(opt);
      });
      return;
    } catch { /* fall through to static list */ }
  }

  // Static fallback
  const STATES = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
    "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
    "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
    "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
    "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
    "Delhi","Jammu and Kashmir","Ladakh","Puducherry"
  ];
  select.innerHTML = '<option value="all">🇮🇳 All India</option>';
  STATES.forEach(name => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = name;
    select.appendChild(opt);
  });
}

// ── Load Solar Farms (green dots) ─────────────────────────────────────────────
async function loadSolarFarms(state = null) {
  showSpinner("Loading solar farms…");
  farmLayer.clearLayers();

  try {
    const alive = await BACKEND_ALIVE;
    let features = [];

    if (alive) {
      let url = `${API_BASE}/solar-farms/?limit=5000`;
      if (state && state !== "all") url += `&state=${encodeURIComponent(state)}`;
      const res  = await fetch(url);
      const data = await res.json();
      features = data.features || [];
    } else {
      // Fallback: static window.SolarAIData
      const all = window.SolarAIData?.SOLAR_FARMS_GEOJSON?.features || [];
      features = state && state !== "all"
        ? all.filter(f => (f.properties.state || "").trim().toLowerCase() === state.trim().toLowerCase())
        : all;
    }

    features.forEach(feature => {
      const geom = feature.geometry;
      if (!geom) return;

      let latLng;
      if (geom.type === "Point") {
        latLng = [geom.coordinates[1], geom.coordinates[0]];
      } else if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
        // Use centroid of first ring
        const ring = geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0][0];
        const lats = ring.map(c => c[1]);
        const lons = ring.map(c => c[0]);
        latLng = [
          lats.reduce((a, b) => a + b, 0) / lats.length,
          lons.reduce((a, b) => a + b, 0) / lons.length,
        ];
      } else return;

      const p = feature.properties;
      L.circleMarker(latLng, {
        radius: 7, color: "#1a7a1a",
        fillColor: "#2ecc40", fillOpacity: 0.85, weight: 1.5,
      })
        .bindPopup(`
          <div style="font-family:system-ui;min-width:200px;font-size:13px">
            <b style="color:#1a7a1a">✅ Existing Solar Farm</b>
            <hr style="margin:5px 0"/>
            <b>Name:</b> ${p.name || "—"}<br/>
            <b>State:</b> ${p.state || "—"}<br/>
            <b>District:</b> ${p.district || "—"}<br/>
            <b>Area:</b> ${p.area_ha ? p.area_ha + " ha" : "—"}<br/>
            <b>Capacity:</b> ${p.capacity_mw ? p.capacity_mw + " MW" : "—"}<br/>
            <b>Confidence:</b> ${p.confidence ? (p.confidence * 100).toFixed(0) + "%" : "—"}<br/>
            <b>Source:</b> ${p.satellite_source || "Sentinel-2"}
          </div>`)
        .addTo(farmLayer);
    });

    const el = document.getElementById("farm-count");
    if (el) el.textContent = features.length;

  } catch (err) {
    showError("Failed to load solar farms: " + err.message);
  } finally {
    hideSpinner();
  }
}

// ── Load Suitable Sites (orange dots) ─────────────────────────────────────────
async function loadSuitableSites(state = null) {
  siteLayer.clearLayers();
  try {
    const alive = await BACKEND_ALIVE;
    let features = [];

    if (alive) {
      let url = `${API_BASE}/suitable-sites/?limit=2000&min_score=0.65`;
      if (state && state !== "all") url += `&state=${encodeURIComponent(state)}`;
      const res  = await fetch(url);
      const data = await res.json();
      features = data.features || [];
    } else {
      const all = window.SolarAIData?.SUITABILITY_CANDIDATES || [];
      features = state && state !== "all"
        ? all.filter(f => (f.properties?.state || f.state || "").trim().toLowerCase() === state.trim().toLowerCase())
        : all;
    }

    features.forEach(feature => {
      const geom = feature.geometry;
      if (!geom || geom.type !== "Point") return;
      const latLng = [geom.coordinates[1], geom.coordinates[0]];
      const p = feature.properties || feature;

      L.circleMarker(latLng, {
        radius: 6, color: "#cc6600",
        fillColor: "#ff851b", fillOpacity: 0.8, weight: 1.5,
      })
        .bindPopup(`
          <div style="font-family:system-ui;min-width:200px;font-size:13px">
            <b style="color:#cc6600">🟠 Recommended Site</b>
            <hr style="margin:5px 0"/>
            <b>State:</b> ${p.state || "—"}<br/>
            <b>Suitability Score:</b> ${p.suitability_score ? (p.suitability_score * 100).toFixed(0) + "%" : "—"}<br/>
            <b>Solar Irradiance:</b> ${p.solar_irradiance ? p.solar_irradiance + " kWh/m²/day" : "—"}<br/>
            <b>Slope:</b> ${p.slope_deg ? p.slope_deg + "°" : "—"}<br/>
            <b>Land Use:</b> ${p.land_use || "—"}<br/>
            <b>Grid Distance:</b> ${p.grid_distance_km ? p.grid_distance_km + " km" : "—"}<br/>
            <b>Recommended Capacity:</b> ${p.recommended_capacity_mw ? p.recommended_capacity_mw + " MW" : "—"}
          </div>`)
        .addTo(siteLayer);
    });

    const el = document.getElementById("site-count");
    if (el) el.textContent = features.length;

  } catch (err) {
    console.error("Suitable sites load failed:", err);
  }
}

// ── State Filter — auto-zoom + filter both layers ──────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("state-select");
  if (!sel) return;

  sel.addEventListener("change", async (e) => {
    const selected = e.target.value;

    if (selected && selected !== "all") {
      // Auto-zoom
      try {
        const alive = await BACKEND_ALIVE;
        if (alive) {
          const res  = await fetch(`${API_BASE}/states/${encodeURIComponent(selected)}/bbox`);
          const data = await res.json();
          if (data.bbox) {
            const [xmin, ymin, xmax, ymax] = data.bbox;
            map.fitBounds([[ymin, xmin], [ymax, xmax]], { padding: [40, 40] });
          }
        }
      } catch { /* ignore zoom errors */ }
    } else {
      map.setView([20.5937, 78.9629], 5);
    }

    const state = selected === "all" ? null : selected;
    await Promise.all([loadSolarFarms(state), loadSuitableSites(state)]);
  });
});

// ── Legend ─────────────────────────────────────────────────────────────────────
const legend = L.control({ position: "bottomright" });
legend.onAdd = () => {
  const div = L.DomUtil.create("div");
  div.style.cssText = [
    "background:white", "padding:10px 14px", "border-radius:8px",
    "box-shadow:0 2px 8px rgba(0,0,0,0.18)", "font-size:13px",
    "font-family:system-ui", "line-height:1.9", "min-width:190px",
  ].join(";");
  div.innerHTML = `
    <b style="display:block;margin-bottom:4px">Map Legend</b>
    <span style="color:#2ecc40;font-size:18px">●</span>&nbsp; Existing Solar Farm<br/>
    <span style="color:#ff851b;font-size:18px">●</span>&nbsp; Suitable Site (Recommended)
  `;
  return div;
};
legend.addTo(map);

// ── Utility ────────────────────────────────────────────────────────────────────
function showSpinner(msg = "Loading…") {
  const el = document.getElementById("spinner");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}
function hideSpinner() {
  const el = document.getElementById("spinner");
  if (el) el.style.display = "none";
}
function showError(msg) {
  console.error(msg);
  const el = document.getElementById("error-toast");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(() => el.style.display = "none", 5000);
  }
}

// ── Initialise ─────────────────────────────────────────────────────────────────
(async () => {
  await loadStates();
  await Promise.all([loadSolarFarms(), loadSuitableSites()]);
})();
