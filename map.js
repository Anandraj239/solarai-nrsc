// SolarAI — Map Module
// Leaflet.js integration with India boundaries, solar farm polygons, GHI heatmap
'use strict';

let _map = null;
let _layers = {};
let _farmPolygons = [];
let _selectedFarmId = null;

function initMap() {
  _map = L.map('map', {
    center: [22.5937, 80.9629],
    zoom: 5,
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true
  });

  // ─── BASE LAYERS ────────────────────────────────────────────────────────────
  // Light professional basemap (similar to Bhuvan/NRSC aesthetic)
  const baseLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> | SolarAI NRSC/ISRO',
    maxZoom: 19, subdomains: 'abcd'
  }).addTo(_map);

  const baseDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19, subdomains: 'abcd'
  });
  const baseSatellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles © Esri — NASA, USGS, NGA, EPA', maxZoom: 18 }
  );

  // ─── INDIA STATE BOUNDARY LAYER ─────────────────────────────────────────────
  fetch('https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson')
    .then(r => r.json())
    .then(data => {
      _layers.states = L.geoJSON(data, {
        style: {
          color: 'rgba(26,77,143,0.6)',
          weight: 1.5,
          fill: false,
          dashArray: '4,3'
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties && feature.properties.NAME_1) {
            layer.bindTooltip(feature.properties.NAME_1, {
              permanent: false,
              className: 'leaflet-tooltip-light',
              direction: 'center'
            });
          }
        }
      }).addTo(_map);
    })
    .catch(() => {
      console.warn('[SolarAI] State boundaries unavailable — continuing without overlay');
    });

  // ─── SOLAR FARM LAYER ───────────────────────────────────────────────────────
  _layers.solarFarms = L.layerGroup().addTo(_map);
  renderSolarFarms();

  // ─── GHI HEATMAP CIRCLES ────────────────────────────────────────────────────
  _layers.ghiHeatmap = L.layerGroup();
  renderGHIHeatmap();

  // ─── CANDIDATE SITES ────────────────────────────────────────────────────────
  _layers.candidates = L.layerGroup();

  // ─── GRID LINES LAYER (approximate major PGCIL corridors) ──────────────────
  _layers.grid = L.layerGroup();
  renderGridLines();

  // Store base layers for toolbar
  _layers.baseDark = baseDark;
  _layers.baseSatellite = baseSatellite;

  // ─── MAP EVENTS ─────────────────────────────────────────────────────────────
  _map.on('click', () => {
    window.SolarAIApp && window.SolarAIApp.onMapClick();
  });

  // Add custom Leaflet tooltip style
  addLeafletTooltipStyle();

  return _map;
}

function renderSolarFarms() {
  if (!_layers.solarFarms) return;
  _layers.solarFarms.clearLayers();
  _farmPolygons = [];

  const { SOLAR_FARMS_GEOJSON } = window.SolarAIData;

  SOLAR_FARMS_GEOJSON.features.forEach(feature => {
    const p = feature.properties;
    const confidence = p.confidence || 0;

    // Color based on confidence
    let fillColor, strokeColor;
    if (confidence >= 90) {
      fillColor = 'rgba(16,185,129,0.35)';
      strokeColor = '#10b981';
    } else if (confidence >= 80) {
      fillColor = 'rgba(245,158,11,0.35)';
      strokeColor = '#f59e0b';
    } else {
      fillColor = 'rgba(239,68,68,0.3)';
      strokeColor = '#ef4444';
    }

    // Add polygon
    const poly = L.geoJSON(feature, {
      style: {
        color: strokeColor, weight: 2, fillColor: fillColor,
        fillOpacity: 0.5, dashArray: null
      }
    });

    poly.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      showFarmPopup(feature, e.latlng);
      highlightFarm(p.fid);
      window.SolarAIApp && window.SolarAIApp.selectFarm(p.fid);
    });
    poly.on('mouseover', () => {
      poly.setStyle({ weight: 3, fillOpacity: 0.7 });
    });
    poly.on('mouseout', () => {
      if (_selectedFarmId !== p.fid) {
        poly.setStyle({ weight: 2, fillOpacity: 0.5 });
      }
    });

    _farmPolygons.push({ id: p.fid, layer: poly, feature });
    _layers.solarFarms.addLayer(poly);

    // Pulse marker at centroid
    const center = L.latLng(p.Latitude, p.Longitude);
    const pulseIcon = L.divIcon({
      className: '',
      html: `<div style="position:relative;width:16px;height:16px;display:flex;align-items:center;justify-content:center;">
               <div style="position:absolute;border-radius:50%;border:2px solid ${strokeColor};opacity:0.5;animation:pulse-ring 2s ease-out infinite;width:8px;height:8px;"></div>
               <div style="position:absolute;border-radius:50%;border:2px solid ${strokeColor};opacity:0.3;animation:pulse-ring 2s ease-out 0.7s infinite;width:8px;height:8px;"></div>
               <div style="width:6px;height:6px;border-radius:50%;background:${strokeColor};position:relative;z-index:1;"></div>
             </div>`,
      iconSize: [16, 16], iconAnchor: [8, 8]
    });
    const marker = L.marker(center, { icon: pulseIcon });
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      showFarmPopup(feature, center);
      highlightFarm(p.fid);
      window.SolarAIApp && window.SolarAIApp.selectFarm(p.fid);
    });
    _layers.solarFarms.addLayer(marker);
  });
}

function showFarmPopup(feature, latlng) {
  const p = feature.properties;
  const areHa = (p.Area / 10000).toFixed(0);
  const capMW = p.capacity_mw ? p.capacity_mw : (areHa * 0.8).toFixed(0);
  const ghiVal = p.ghi || 1900;
  const energyMWh = Math.round(capMW * ghiVal * 0.78 / 1000);
  const co2Mt = (capMW * ghiVal * 0.78 * 0.000716).toFixed(1);
  const conf = p.confidence || 88;
  const confClass = conf >= 90 ? '#10b981' : conf >= 80 ? '#f59e0b' : '#ef4444';
  const confText = conf >= 90 ? 'HIGH' : conf >= 80 ? 'MEDIUM' : 'LOW';
  const farmName = p.name || `Solar Farm #${p.fid}`;
  const model = p.model || 'SegFormer-B5';

  const popup = L.popup({
    className: 'solar-popup',
    maxWidth: 280,
    closeButton: true
  }).setLatLng(latlng).setContent(`
    <div class="popup-inner">
      <div class="popup-title">${farmName}</div>
      <div class="popup-state">📍 ${p.State || 'India'} &nbsp;|&nbsp; 🛰 ${model}</div>
      <div class="popup-grid">
        <div class="popup-metric">
          <div class="pm-val">${Number(areHa).toLocaleString()} ha</div>
          <div class="pm-label">Detected Area</div>
        </div>
        <div class="popup-metric">
          <div class="pm-val">${Number(capMW).toLocaleString()} MW</div>
          <div class="pm-label">Est. Capacity</div>
        </div>
        <div class="popup-metric">
          <div class="pm-val">${energyMWh.toLocaleString()} GWh</div>
          <div class="pm-label">Annual Energy</div>
        </div>
        <div class="popup-metric">
          <div class="pm-val">${co2Mt}kt</div>
          <div class="pm-label">CO₂ Avoided/yr</div>
        </div>
      </div>
      <div class="confidence-bar">
        <div class="conf-label">
          <span>Detection Confidence</span>
          <span style="color:${confClass};font-weight:600;">${conf}% — ${confText}</span>
        </div>
        <div class="progress-bar">
          <div class="conf-fill" style="width:${conf}%;background:${confClass};"></div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:0.62rem;color:var(--text-muted);">
        🌐 GHI: <span style="color:var(--solar);">${ghiVal} kWh/m²/yr</span> &nbsp;|&nbsp;
        📋 LULC: <span style="color:var(--accent-cyan);">${p.lulc_class || p.lulc || 'N/A'}</span>
      </div>
    </div>
  `).openOn(_map);
}

function highlightFarm(fid) {
  _selectedFarmId = fid;
  _farmPolygons.forEach(({ id, layer, feature }) => {
    const p = feature.properties;
    const confidence = p.confidence || 0;
    let strokeColor = confidence >= 90 ? '#10b981' : confidence >= 80 ? '#f59e0b' : '#ef4444';
    if (id === fid) {
      layer.setStyle({ weight: 4, fillOpacity: 0.8, color: '#f59e0b' });
    } else {
      layer.setStyle({ weight: 2, fillOpacity: 0.5, color: strokeColor });
    }
  });
}

function flyToFarm(fid) {
  const farm = _farmPolygons.find(f => f.id === fid);
  if (!farm) return;
  const p = farm.feature.properties;
  _map.flyTo([p.Latitude, p.Longitude], 12, { duration: 1.2 });
  setTimeout(() => showFarmPopup(farm.feature, L.latLng(p.Latitude, p.Longitude)), 1400);
  highlightFarm(fid);
}

function renderGHIHeatmap() {
  if (!_layers.ghiHeatmap) return;
  _layers.ghiHeatmap.clearLayers();
  const { GHI_ZONES } = window.SolarAIData;

  GHI_ZONES.forEach(zone => {
    const norm = (zone.ghi - 1600) / (2250 - 1600);
    const r = Math.round(255 * norm);
    const g = Math.round(100 * (1 - norm));
    const b = 0;
    const col = `rgba(${r},${g},${b},0.25)`;

    const circle = L.circle([zone.lat, zone.lng], {
      radius: zone.radius * 1000,
      color: `rgba(${r},${g},${b},0.6)`,
      fillColor: col, fillOpacity: 0.3, weight: 1, dashArray: '4,3'
    });
    circle.bindTooltip(
      `<div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:#f59e0b;">${zone.region}<br>${zone.ghi} kWh/m²/yr</div>`,
      { className: 'leaflet-tooltip-dark' }
    );
    _layers.ghiHeatmap.addLayer(circle);

    const label = L.marker([zone.lat, zone.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:rgba(${r},${g},${b},1);white-space:nowrap;text-shadow:0 0 8px rgba(0,0,0,0.9);font-weight:600;">${zone.ghi}</div>`,
        iconSize: [50, 14], iconAnchor: [25, 7]
      })
    });
    _layers.ghiHeatmap.addLayer(label);
  });
}

function renderGridLines() {
  if (!_layers.grid) return;
  _layers.grid.clearLayers();
  // Approximate major PGCIL 400kV corridors
  const corridors = [
    [[28.6, 77.2],[26.9, 75.8],[27.5, 71.9]], // Delhi-Rajasthan
    [[27.5, 71.9],[22.3, 70.8],[19.0, 73.0]], // Rajasthan-Gujarat-Mumbai
    [[22.3, 70.8],[15.1, 78.5],[9.9, 78.1]],  // Gujarat-AP-TN
    [[15.1, 78.5],[12.9, 77.6],[14.1, 77.3]], // AP-Karnataka
    [[28.6, 77.2],[25.4, 81.7],[23.1, 85.3]], // Delhi-UP-Jharkhand
    [[12.9, 77.6],[17.4, 78.5],[18.7, 79.4]], // Karnataka-Telangana
  ];
  corridors.forEach(points => {
    L.polyline(points, {
      color: 'rgba(139,92,246,0.4)',
      weight: 1.5,
      dashArray: '6,4',
      opacity: 0.7
    }).bindTooltip('PGCIL 400kV Corridor', { className: 'leaflet-tooltip-dark' })
      .addTo(_layers.grid);
  });
}

function renderCandidateSites() {
  if (!_layers.candidates) return;
  _layers.candidates.clearLayers();
  const { SUITABILITY_CANDIDATES } = window.SolarAIData;

  SUITABILITY_CANDIDATES.forEach(site => {
    const color = site.grade === 'HIGH' ? '#10b981' : site.grade === 'MEDIUM' ? '#f59e0b' : '#f97316';
    const marker = L.marker([site.lat, site.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          background:${color};border-radius:6px;padding:3px 7px;
          font-size:0.65rem;font-weight:700;color:#000;white-space:nowrap;
          box-shadow:0 0 12px ${color}80;border:1px solid ${color};
          font-family:'JetBrains Mono',monospace;
        ">${site.total}</div>`,
        iconSize: [36, 22], iconAnchor: [18, 11]
      })
    });
    marker.bindTooltip(`<div style="font-size:0.72rem;font-family:'Space Grotesk',sans-serif;color:#f0f6ff;"><strong>${site.name}</strong><br>${site.state} — Score: <span style="color:${color}">${site.total}/100</span></div>`,
      { className: 'leaflet-tooltip-dark' });
    marker.on('click', () => {
      window.SolarAIApp && window.SolarAIApp.selectCandidate(site.id);
    });
    _layers.candidates.addLayer(marker);
  });
}

function toggleLayer(layerName, visible) {
  if (!_layers[layerName]) return;
  if (visible) {
    _map.addLayer(_layers[layerName]);
  } else {
    _map.removeLayer(_layers[layerName]);
  }
}

function switchBasemap(type) {
  if (type === 'satellite') {
    _map.removeLayer(_layers.baseLight);
    _layers.baseSatellite.addTo(_map);
  } else if (type === 'dark') {
    _map.removeLayer(_layers.baseLight);
    _layers.baseDark.addTo(_map);
  } else {
    _map.removeLayer(_layers.baseDark);
    _map.removeLayer(_layers.baseSatellite);
    _layers.baseLight.addTo(_map);
  }
}

function runScanAnimation() {
  const overlay = document.getElementById('scan-overlay');
  overlay.classList.add('active');
  return new Promise(res => {
    setTimeout(() => {
      overlay.classList.remove('active');
      res();
    }, 4500);
  });
}

function addLeafletTooltipStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .leaflet-tooltip-light {
      background: rgba(255,255,255,0.97) !important;
      border: 1px solid #d0dae6 !important;
      border-radius: 5px !important;
      color: #1a2332 !important;
      font-family: 'Inter', 'Noto Sans', sans-serif !important;
      font-size: 0.7rem !important;
      box-shadow: 0 2px 10px rgba(10,45,94,0.12) !important;
      padding: 4px 9px !important;
    }
  `;
  document.head.appendChild(style);
}

// Animate scan through all polygons (detection simulation)
async function animateDetection(onProgress) {
  const polygons = _farmPolygons;
  for (let i = 0; i < polygons.length; i++) {
    const { layer, feature } = polygons[i];
    layer.setStyle({ color: '#f59e0b', weight: 3, fillOpacity: 0.8 });
    await sleep(80);
    const p = feature.properties;
    const conf = p.confidence || 88;
    const strokeColor = conf >= 90 ? '#10b981' : conf >= 80 ? '#f59e0b' : '#ef4444';
    layer.setStyle({ color: strokeColor, weight: 2, fillOpacity: 0.5 });
    onProgress && onProgress(i + 1, polygons.length);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

window.SolarAIMap = {
  initMap, renderSolarFarms, renderGHIHeatmap, renderCandidateSites,
  renderGridLines, toggleLayer, switchBasemap, flyToFarm, highlightFarm,
  runScanAnimation, animateDetection, getMap: () => _map
};
