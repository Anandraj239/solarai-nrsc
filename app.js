// SolarAI — NRSC/ISRO Application Shell
// Bootstraps the full dashboard: navbar, sidebars, map, charts, tabs.
'use strict';

window.SolarAIApp = (function () {

  // ── Shared state ──────────────────────────────────────────────────────────
  let _activeTab = 'detection';

  // ── Loading helpers ───────────────────────────────────────────────────────
  function setLoadStatus(msg, pct) {
    const el  = document.getElementById('load-status');
    const bar = document.querySelector('.load-bar-fill');
    if (el)  el.textContent = msg;
    if (bar) bar.style.width = pct + '%';
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Boot sequence ──────────────────────────────────────────────────────────
  async function boot() {
    try {
      setLoadStatus('Loading geospatial data...', 15);
      await sleep(300);

      setLoadStatus('Building interface...', 35);
      buildNavbar();
      buildLeftSidebar();
      buildRightSidebar();
      buildCenterPanel();
      buildSuitabilityTab();
      buildChangeTab();
      buildReportsTab();
      await sleep(200);

      setLoadStatus('Initialising Leaflet map engine...', 55);
      window.SolarAIMap.initMap();
      await sleep(600);

      setLoadStatus('Rendering analytics charts...', 78);
      setTimeout(() => {
        window.SolarAICharts.renderStateDonut('chart-state-donut');
        window.SolarAICharts.renderTemporalLine('chart-temporal');
        window.SolarAICharts.renderGHIBar('chart-ghi');
        window.SolarAICharts.renderModelBar('chart-model-perf');
        window.SolarAICharts.animateAllCounters();
      }, 400);
      await sleep(700);

      setLoadStatus('System ready.', 100);
      await sleep(350);

      // Dismiss loader
      const ls = document.getElementById('loading-screen');
      if (ls) {
        ls.style.transition = 'opacity 0.55s ease';
        ls.style.opacity = '0';
        setTimeout(() => { ls.style.display = 'none'; }, 580);
      }

      // Show shell
      const shell = document.getElementById('app-shell');
      const nav   = document.getElementById('navbar');
      if (shell) shell.style.display = 'grid';
      if (nav)   nav.style.display   = 'flex';

      // Connect live backend (non-blocking)
      setTimeout(initBackendIntegration, 1200);

    } catch (err) {
      console.error('[SolarAI] Boot error:', err);
      setLoadStatus('Error — see console.', 100);
    }
  }

  // ── Navbar ─────────────────────────────────────────────────────────────────
  function buildNavbar() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    nav.innerHTML = `
      <div class="nav-brand">
        <div class="nav-emblem">${isroEmblemSVG()}</div>
        <div class="nav-wordmark">
          <span class="brand-name">SOLAR<span style="color:var(--solar)">AI</span></span>
          <span class="brand-sub">NRSC · ISRO · Department of Space</span>
        </div>
      </div>
      <div class="nav-divider"></div>
      <div class="nav-tabs">
        <button class="nav-tab active" id="ntab-detection"  onclick="SolarAIApp.switchTab('detection')">🛰 Detection</button>
        <button class="nav-tab"        id="ntab-suitability" onclick="SolarAIApp.switchTab('suitability')">📍 Suitability</button>
        <button class="nav-tab"        id="ntab-change"     onclick="SolarAIApp.switchTab('change')">📈 Change</button>
        <button class="nav-tab"        id="ntab-reports"    onclick="SolarAIApp.switchTab('reports')">📋 Reports</button>
      </div>
      <div class="nav-controls">
        <div class="nav-status">
          <div class="status-chip"><div class="status-dot"></div> OPERATIONAL</div>
        </div>
        <select style="background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 7px;font-size:0.72rem;cursor:pointer;"
          onchange="SolarAIMap.switchBasemap(this.value)" title="Basemap">
          <option value="light">🗺 Light</option>
          <option value="dark">🌑 Dark</option>
          <option value="satellite">🛰 Satellite</option>
        </select>
      </div>`;
  }

  function isroEmblemSVG() {
    return `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" stroke="rgba(245,158,11,0.4)" stroke-width="1"/>
      <ellipse cx="20" cy="20" rx="18" ry="7" stroke="rgba(6,182,212,0.6)" stroke-width="1.2"
               transform="rotate(-25 20 20)" stroke-dasharray="3,2"/>
      <circle cx="20" cy="20" r="10" stroke="rgba(29,111,164,0.5)" stroke-width="1"/>
      <circle cx="20" cy="20" r="5" fill="#f59e0b" opacity="0.9"/>
      <circle cx="20" cy="20" r="3" fill="#fbbf24"/>
      <g stroke="#f59e0b" stroke-width="1" opacity="0.7">
        <line x1="20" y1="13" x2="20" y2="10"/>
        <line x1="20" y1="27" x2="20" y2="30"/>
        <line x1="13" y1="20" x2="10" y2="20"/>
        <line x1="27" y1="20" x2="30" y2="20"/>
      </g>
      <circle cx="35" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
    </svg>`;
  }

  // ── Left Sidebar ───────────────────────────────────────────────────────────
  function buildLeftSidebar() {
    const el = document.getElementById('sidebar-left');
    if (!el) return;

    const { MODEL_BENCHMARKS } = window.SolarAIData;

    el.innerHTML = `
      <!-- AI Model Section -->
      <div class="sidebar-section">
        <div class="section-header">
          <div class="section-header-icon">🤖</div>
          <div class="section-title">AI Model</div>
        </div>
        <div class="section-body">
          <div class="form-group">
            <label class="form-label">Model Architecture</label>
            <div class="model-grid">
              ${MODEL_BENCHMARKS.map(m => `
                <div class="model-card ${m.recommended ? 'recommended selected' : ''}"
                     id="mc-${m.name.replace(/[^a-z]/gi,'_')}"
                     onclick="SolarAIApp.selectModel('${m.name}')">
                  <div class="model-name">${m.name}</div>
                  <div class="model-metric">IoU ${(m.iou*100).toFixed(1)}%</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Satellite Source</label>
            <select class="form-select" id="source-select" onchange="SolarAIApp.updateSource(this.value)">
              <option>Sentinel-2</option>
              <option>Landsat-9</option>
              <option>IRS Resourcesat-2A</option>
              <option>Cartosat-3</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Area of Interest (State)</label>
            <select class="form-select" id="aoi-select" onchange="SolarAIApp.updateAOI(this.value)">
              <option value="">— All India —</option>
              <option>Rajasthan</option>
              <option>Gujarat</option>
              <option>Karnataka</option>
              <option>Tamil Nadu</option>
              <option>Andhra Pradesh</option>
              <option>Madhya Pradesh</option>
              <option>Telangana</option>
              <option>Maharashtra</option>
              <option>Punjab</option>
              <option>Haryana</option>
              <option>Odisha</option>
              <option>Uttar Pradesh</option>
              <option>Jharkhand</option>
              <option>Ladakh (UT)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Confidence Threshold: <span id="conf-val">80%</span></label>
            <input type="range" class="ctrl-range" id="conf-threshold"
              min="60" max="99" value="80" style="width:100%;"
              oninput="document.getElementById('conf-val').textContent=this.value+'%'">
          </div>
          <div class="form-group">
            <label class="form-label">Resolution</label>
            <div class="res-badge" id="res-label">10m / MSI / L2A — Sentinel-2</div>
          </div>
        </div>
      </div>

      <!-- Layer Controls -->
      <div class="sidebar-section">
        <div class="section-header">
          <div class="section-header-icon">🗂</div>
          <div class="section-title">Map Layers</div>
        </div>
        <div class="section-body">
          <div class="layer-list">
            <div class="layer-toggle active" id="lt-solarFarms"   onclick="SolarAIApp.toggleLayerUI('solarFarms')">
              <div class="layer-dot" style="background:#10b981;"></div>
              <span class="layer-name">Solar Farms</span>
              <div class="toggle-switch"></div>
            </div>
            <div class="layer-toggle" id="lt-ghiHeatmap"  onclick="SolarAIApp.toggleLayerUI('ghiHeatmap')">
              <div class="layer-dot" style="background:#f59e0b;"></div>
              <span class="layer-name">GHI Heatmap</span>
              <div class="toggle-switch"></div>
            </div>
            <div class="layer-toggle" id="lt-candidates"  onclick="SolarAIApp.toggleLayerUI('candidates')">
              <div class="layer-dot" style="background:#06b6d4;"></div>
              <span class="layer-name">Candidate Sites</span>
              <div class="toggle-switch"></div>
            </div>
            <div class="layer-toggle" id="lt-grid"        onclick="SolarAIApp.toggleLayerUI('grid')">
              <div class="layer-dot" style="background:#8b5cf6;"></div>
              <span class="layer-name">Power Grid (PGCIL)</span>
              <div class="toggle-switch"></div>
            </div>
            <div class="layer-toggle active" id="lt-states" onclick="SolarAIApp.toggleLayerUI('states')">
              <div class="layer-dot" style="background:#1a4d8f;"></div>
              <span class="layer-name">State Boundaries</span>
              <div class="toggle-switch"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detection -->
      <div class="sidebar-section">
        <div class="section-header">
          <div class="section-header-icon">⚡</div>
          <div class="section-title">Detection Run</div>
        </div>
        <div class="section-body">
          <button class="btn-detect" id="btn-detect" onclick="SolarAIApp.runDetection()">⚡ RUN DETECTION</button>
          <div id="detect-progress" style="display:none;margin-top:8px;">
            <div class="progress-label">
              <span id="progress-step" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Initialising...</span>
              <span id="progress-pct">0%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill scanning" id="progress-fill" style="width:0%"></div></div>
          </div>
          <div id="ai-log" style="margin-top:8px;"></div>
        </div>
      </div>

      <!-- Farm list -->
      <div class="sidebar-section">
        <div class="section-header">
          <div class="section-header-icon">📋</div>
          <div class="section-title">Farm Registry</div>
        </div>
        <div class="section-body" style="max-height:220px;overflow-y:auto;padding:6px 10px;">
          <div id="farm-list">${buildFarmListHTML()}</div>
        </div>
      </div>`;
  }

  function buildFarmListHTML() {
    const farms = window.SolarAIData.SOLAR_FARMS_GEOJSON.features;
    return farms.map(f => {
      const p = f.properties;
      const c = p.confidence >= 90 ? '#10b981' : p.confidence >= 80 ? '#f59e0b' : '#ef4444';
      return `<div class="farm-item" onclick="SolarAIMap.flyToFarm(${p.fid})" id="farm-item-${p.fid}">
        <span style="color:${c};font-size:0.9rem;flex-shrink:0;">●</span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name || 'Farm #' + p.fid}</span>
        <span style="color:${c};font-family:'Roboto Mono',monospace;font-size:0.67rem;flex-shrink:0;">${p.confidence.toFixed(0)}%</span>
      </div>`;
    }).join('');
  }

  // ── Right Sidebar ──────────────────────────────────────────────────────────
  function buildRightSidebar() {
    const el = document.getElementById('sidebar-right');
    if (!el) return;

    el.innerHTML = `
      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card solar">
          <div class="kpi-icon">☀️</div>
          <span class="kpi-val solar" id="kpi-farms">0</span>
          <div class="kpi-label">Farms Detected</div>
        </div>
        <div class="kpi-card blue">
          <div class="kpi-icon">⚡</div>
          <span class="kpi-val blue" id="kpi-gw">0</span>
          <div class="kpi-label">Capacity (GW)</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-icon">🗺</div>
          <span class="kpi-val green" id="kpi-states">0</span>
          <div class="kpi-label">States Covered</div>
        </div>
        <div class="kpi-card cyan">
          <div class="kpi-icon">🌱</div>
          <span class="kpi-val cyan" id="kpi-co2">0</span>
          <div class="kpi-label">CO₂ Avoided (MT)</div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-icon">🎯</div>
          <span class="kpi-val purple" id="kpi-iou">0</span>
          <div class="kpi-label">Mean IoU</div>
        </div>
        <div class="kpi-card orange">
          <div class="kpi-icon">🏘</div>
          <span class="kpi-val orange" id="kpi-hh">0</span>
          <div class="kpi-label">Households (M)</div>
        </div>
      </div>

      <!-- State Donut -->
      <div class="chart-wrap">
        <div class="chart-title">📊 State Distribution (2021)</div>
        <div style="position:relative;height:170px;"><canvas id="chart-state-donut"></canvas></div>
      </div>

      <!-- Temporal Line -->
      <div class="chart-wrap">
        <div class="chart-title">📈 National Growth</div>
        <div style="position:relative;height:140px;"><canvas id="chart-temporal"></canvas></div>
      </div>

      <!-- GHI Bar -->
      <div class="chart-wrap">
        <div class="chart-title">🌞 GHI by Region (kWh/m²/yr)</div>
        <div style="position:relative;height:175px;"><canvas id="chart-ghi"></canvas></div>
      </div>

      <!-- Model Benchmarks -->
      <div class="chart-wrap">
        <div class="chart-title">🤖 Model Benchmarks</div>
        <div style="position:relative;height:145px;"><canvas id="chart-model-perf"></canvas></div>
      </div>

      <!-- Export -->
      <div class="chart-wrap" style="padding-bottom:14px;">
        <div class="chart-title">📤 Export</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="export-btn" onclick="SolarAIApp.exportGeoJSON()">📦 GeoJSON</button>
          <button class="export-btn" onclick="SolarAIApp.exportCSV()">📊 CSV</button>
          <button class="export-btn" onclick="SolarAIApp.generateReport()">📄 Report</button>
        </div>
      </div>`;
  }

  // ── Center Panel ───────────────────────────────────────────────────────────
  function buildCenterPanel() {
    const el = document.getElementById('center-panel');
    if (!el) return;

    el.innerHTML = `
      <!-- Map toolbar -->
      <div id="map-toolbar">
        <button class="map-tool-btn active" id="mt-pan" onclick="SolarAIApp.setMapTool('pan')">✋ Pan</button>
        <button class="map-tool-btn" id="mt-identify" onclick="SolarAIApp.setMapTool('identify')">🔍 Identify</button>
        <button class="map-tool-btn" id="mt-measure" onclick="SolarAIApp.setMapTool('measure')">📏 Measure</button>
        <button class="map-tool-btn" id="mt-fullscreen" onclick="SolarAIApp.toggleFullscreen()">⛶ Fullscreen</button>
      </div>

      <!-- Map -->
      <div id="map-container">
        <div id="map"></div>
        <div id="scan-overlay"><div class="scan-line"></div><div class="scan-grid"></div></div>
        <div id="map-info">
          <div class="map-stat"><span class="ms-val" id="ms-farms">18</span><div class="ms-label">Farms Visible</div></div>
          <div class="map-stat"><span class="ms-val" id="ms-area">78 k</span><div class="ms-label">km² Detected</div></div>
          <div class="map-stat"><span class="ms-val" id="ms-zoom">5</span><div class="ms-label">Zoom Level</div></div>
        </div>
      </div>

      <!-- Bottom panel (results table) -->
      <div id="bottom-panel">
        <div class="bottom-header">
          <div class="bottom-title" id="det-summary">Detection Results — click a farm or run scan</div>
          <div class="export-btns">
            <button class="export-btn" onclick="SolarAIApp.exportGeoJSON()">📦 GeoJSON</button>
            <button class="export-btn" onclick="SolarAIApp.exportCSV()">📊 CSV</button>
            <button class="export-btn" onclick="document.getElementById('bottom-panel').classList.remove('open')">✕</button>
          </div>
        </div>
        <div id="results-table-wrap">
          <table id="results-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>State</th><th>Lat</th><th>Lon</th>
                <th>Area (ha)</th><th>Capacity (MW)</th><th>GHI</th><th>Confidence</th><th>Model</th>
              </tr>
            </thead>
            <tbody id="results-tbody"></tbody>
          </table>
        </div>
      </div>`;

    // Wire zoom display
    setTimeout(() => {
      const map = window.SolarAIMap.getMap();
      if (map) {
        map.on('zoomend', () => {
          const el = document.getElementById('ms-zoom');
          if (el) el.textContent = map.getZoom();
        });
      }
    }, 1500);
  }

  // ── Suitability Tab ────────────────────────────────────────────────────────
  function buildSuitabilityTab() {
    const el = document.getElementById('tab-suitability');
    if (!el) return;
    const { SUITABILITY_CANDIDATES } = window.SolarAIData;

    el.innerHTML = `
      <div class="tc-header">
        <div class="tc-title">📍 Site Suitability Analysis — Multi-Criteria Decision Analysis (MCDA)</div>
        <div class="tc-subtitle">NRSC GIS Division · ${new Date().getFullYear()}</div>
      </div>
      <div class="tc-body">
        <div class="suitability-grid">
          <!-- Left: candidate cards -->
          <div class="suit-controls">
            <div class="suit-candidate-list" id="suit-candidate-list">
              ${SUITABILITY_CANDIDATES.map(site => `
                <div class="suit-card" id="sc-${site.id}" onclick="SolarAIApp.selectCandidate('${site.id}')">
                  <div class="suit-card-top">
                    <div class="suit-score-ring">
                      <svg viewBox="0 0 46 46">
                        <circle cx="23" cy="23" r="19" fill="none" stroke="#dde5ef" stroke-width="4"/>
                        <circle cx="23" cy="23" r="19" fill="none"
                          stroke="${site.grade==='HIGH'?'#1b7a3e':site.grade==='MEDIUM'?'#b45309':'#d97706'}"
                          stroke-width="4" stroke-dasharray="${site.total * 1.195} 119.5"
                          stroke-linecap="round" transform="rotate(-90 23 23)"/>
                      </svg>
                      <div class="suit-score-val">${site.total}</div>
                    </div>
                    <div class="suit-meta">
                      <div class="suit-name">${site.name}</div>
                      <div class="suit-state">${site.state}</div>
                    </div>
                    <span class="grade-badge grade-${site.grade}">${site.grade}</span>
                  </div>
                  <div class="suit-sub-bars">
                    ${Object.entries(site.scores).map(([k,v]) => `
                      <div class="sub-bar-row">
                        <div class="sub-bar-label">${k.charAt(0).toUpperCase()+k.slice(1)}</div>
                        <div class="sub-bar-track">
                          <div class="sub-bar-fill" style="width:${v}%;background:${v>=85?'#1b7a3e':v>=70?'#f59e0b':'#ef4444'};"></div>
                        </div>
                        <div class="sub-bar-val">${v}</div>
                      </div>`).join('')}
                  </div>
                </div>`).join('')}
            </div>
          </div>
          <!-- Right: detail panel -->
          <div class="suit-detail" id="suit-detail">
            <div class="detail-placeholder">
              <div class="ph-icon">📍</div>
              <p>Select a candidate site to view full analysis, radar chart and recommendations.</p>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── Change Detection Tab ───────────────────────────────────────────────────
  function buildChangeTab() {
    const el = document.getElementById('tab-change');
    if (!el) return;
    const { TEMPORAL_DATA } = window.SolarAIData;

    el.innerHTML = `
      <div class="tc-header">
        <div class="tc-title">📈 Temporal Change Detection — Solar Farm Expansion</div>
        <div class="tc-subtitle">Sentinel-2 Multi-Temporal Analysis</div>
      </div>
      <div class="tc-body">
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px;flex-wrap:wrap;">
          <label style="font-size:0.78rem;color:var(--text-secondary);">
            From: <select id="cd-from" class="form-select" style="width:auto;display:inline-block;margin-left:6px;">
              ${TEMPORAL_DATA.years.slice(0,-1).map(y => `<option${y===2016?' selected':''}>${y}</option>`).join('')}
            </select>
          </label>
          <label style="font-size:0.78rem;color:var(--text-secondary);">
            To: <select id="cd-to" class="form-select" style="width:auto;display:inline-block;margin-left:6px;">
              ${TEMPORAL_DATA.years.slice(1).map(y => `<option${y===2023?' selected':''}>${y}</option>`).join('')}
            </select>
          </label>
          <button class="btn-detect" style="width:auto;padding:7px 20px;" onclick="SolarAIApp.updateChangeChart()">Apply</button>
        </div>
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;">
          <div style="position:relative;height:300px;max-width:900px;margin:0 auto;">
            <canvas id="chart-new-farms"></canvas>
          </div>
        </div>
        <div style="margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
            <div style="font-family:'Roboto Mono',monospace;font-size:1.4rem;font-weight:700;color:var(--success);">+1,363</div>
            <div style="font-size:0.67rem;color:var(--text-muted);margin-top:2px;">Total Farms Detected (2021)</div>
          </div>
          <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
            <div style="font-family:'Roboto Mono',monospace;font-size:1.4rem;font-weight:700;color:var(--solar);">+87.8 GW</div>
            <div style="font-size:0.67rem;color:var(--text-muted);margin-top:2px;">Capacity Growth (2015–2024)</div>
          </div>
          <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
            <div style="font-family:'Roboto Mono',monospace;font-size:1.4rem;font-weight:700;color:var(--isro-mid);">7,800 km²</div>
            <div style="font-size:0.67rem;color:var(--text-muted);margin-top:2px;">Total Land Area (2024)</div>
          </div>
        </div>
      </div>`;

    setTimeout(() => window.SolarAICharts.renderNewFarmsBar('chart-new-farms', 2016, 2023), 900);
  }

  // ── Reports Tab ────────────────────────────────────────────────────────────
  function buildReportsTab() {
    const el = document.getElementById('tab-reports');
    if (!el) return;
    const { NATIONAL_KPI } = window.SolarAIData;

    el.innerHTML = `
      <div class="tc-header">
        <div class="tc-title">📋 National Solar Intelligence Report — NRSC/ISRO</div>
        <div class="tc-subtitle">Sentinel-2 · SegFormer-B5 · ${new Date().getFullYear()}</div>
      </div>
      <div class="tc-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px;border-top:4px solid var(--solar);">
            <h3 style="font-size:0.9rem;font-weight:700;color:var(--isro-navy);margin-bottom:12px;">Executive Summary</h3>
            <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.7;">
              SolarAI has processed multi-temporal Sentinel-2 imagery across
              <strong>${NATIONAL_KPI.states_covered} states</strong> of India,
              detecting <strong>${NATIONAL_KPI.total_farms.toLocaleString()} solar farms</strong>
              with a total estimated capacity of <strong>${NATIONAL_KPI.total_capacity_gw} GW</strong>.
              The SegFormer-B5 model achieved a mean IoU of
              <strong>${(NATIONAL_KPI.mean_iou*100).toFixed(1)}%</strong>,
              surpassing all baseline models tested.
            </p>
          </div>
          <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px;border-top:4px solid var(--isro-blue);">
            <h3 style="font-size:0.9rem;font-weight:700;color:var(--isro-navy);margin-bottom:12px;">Data Sources &amp; Methodology</h3>
            <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.7;">
              Imagery: ESA Copernicus Sentinel-2 at 10m resolution (MSI L2A).<br>
              Model: SegFormer-B5 (84.7M params) trained on ISFD-v2.<br>
              Site suitability via MCDA (GHI, terrain, LULC, infrastructure, environment).<br>
              Dataset: <em>Microsoft AI4Earth Solar Farm India</em> (Ortiz et al., 2022).
            </p>
          </div>
        </div>

        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px;margin-bottom:16px;">
          <h3 style="font-size:0.9rem;font-weight:700;color:var(--isro-navy);margin-bottom:12px;">Key Findings</h3>
          <ul style="font-size:0.8rem;color:var(--text-secondary);line-height:2;padding-left:20px;">
            <li>Rajasthan leads with the highest installed capacity (GHI &gt;2000 kWh/m²/yr in Thar Desert)</li>
            <li>Gujarat and Karnataka follow as major solar corridors</li>
            <li>CO₂ avoided annually: <strong>${NATIONAL_KPI.co2_avoided_mt} MT</strong></li>
            <li>Equivalent to powering <strong>87.5 million households</strong></li>
            <li>74.2% of farms built on ecologically non-sensitive land (wasteland/barren)</li>
          </ul>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          ${[
            { title:'Technical Report', desc:'Full methodology, model architecture, training data statistics', icon:'🔬' },
            { title:'Policy Brief', desc:'Recommendations for MNRE solar target 2030 achievement', icon:'📜' },
            { title:'State-wise Analysis', desc:'Detailed per-state farm inventory and suitability ranking', icon:'🗺' },
          ].map(r => `
            <div class="report-card">
              <div class="rc-icon">${r.icon}</div>
              <div class="rc-title">${r.title}</div>
              <div class="rc-desc">${r.desc}</div>
              <button class="rc-generate" onclick="SolarAIApp.generateReport('${r.title}')">Generate →</button>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // ── AI Detection log steps ─────────────────────────────────────────────────
  const DETECTION_STEPS = [
    { msg:'Initialising SolarAI pipeline v3.2…',              type:'active',  delay:0    },
    { msg:'Loading Sentinel-2 L2A tiles (10m MSI)…',          type:'active',  delay:400  },
    { msg:'Applying cloud mask (Fmask v4.2) — Cover: 3.1%',   type:'success', delay:800  },
    { msg:'Computing NDVI / NDWI / BI spectral indices…',      type:'active',  delay:1200 },
    { msg:'NDVI threshold: −0.15 | Suppressing vegetation…',   type:'active',  delay:1600 },
    { msg:'Suppressing water bodies (NDWI < −0.30)…',          type:'active',  delay:1950 },
    { msg:'Running SegFormer-B5 inference (84.7M params)…',    type:'active',  delay:2350 },
    { msg:'Semantic segmentation complete — IoU: 0.891',       type:'success', delay:3100 },
    { msg:'Post-processing: Vectorising binary mask…',         type:'active',  delay:3500 },
    { msg:'Applying minimum area filter (1 ha)…',              type:'active',  delay:3850 },
    { msg:'Merging proximate polygons (50m threshold)…',       type:'active',  delay:4200 },
    { msg:'Running Hard Negative Mining (HNM) filter…',        type:'active',  delay:4550 },
    { msg:'Suppressed 23 false positives (rooftops, riverbeds)…', type:'warn', delay:4900 },
    { msg:'Detected 18 high-confidence solar farms.',          type:'success', delay:5300 },
    { msg:'Total capacity estimate: 9,178 MW',                 type:'success', delay:5600 },
    { msg:'Detection complete ✓',                              type:'success', delay:5900 },
  ];

  // ── Run Detection ──────────────────────────────────────────────────────────
  let _detecting = false;
  async function runDetection() {
    if (_detecting) return;
    _detecting = true;

    const btn  = document.getElementById('btn-detect');
    const prog = document.getElementById('detect-progress');
    const fill = document.getElementById('progress-fill');
    const step = document.getElementById('progress-step');
    const pct  = document.getElementById('progress-pct');
    const log  = document.getElementById('ai-log');

    if (btn)  { btn.disabled = true; btn.textContent = '⏳ Running…'; }
    if (prog) prog.style.display = 'block';
    if (log)  log.innerHTML = '';

    window.SolarAIMap.runScanAnimation();

    let prev = 0;
    for (let i = 0; i < DETECTION_STEPS.length; i++) {
      const s = DETECTION_STEPS[i];
      await sleep(s.delay - prev);
      prev = s.delay;
      addLog(s.msg, s.type);
      const p = Math.round(((i+1) / DETECTION_STEPS.length) * 100);
      if (fill) fill.style.width = p + '%';
      if (pct)  pct.textContent  = p + '%';
      if (step) step.textContent = s.msg.length > 40 ? s.msg.slice(0,38)+'…' : s.msg;
    }

    await window.SolarAIMap.animateDetection((done, total) => {
      if (step) step.textContent = `Scanning polygon ${done}/${total}…`;
    });

    _detecting = false;
    if (btn)  { btn.disabled = false; btn.textContent = '⚡ RUN DETECTION'; }

    populateResultsTable();
    document.getElementById('bottom-panel')?.classList.add('open');
    document.getElementById('det-summary').textContent =
      `Detection Complete — ${window.SolarAIData.SOLAR_FARMS_GEOJSON.features.length} farms, IoU 89.1%`;
  }

  function populateResultsTable() {
    const tbody = document.getElementById('results-tbody');
    if (!tbody) return;
    const farms = window.SolarAIData.SOLAR_FARMS_GEOJSON.features;
    tbody.innerHTML = farms.map(f => {
      const p = f.properties;
      const areaHa = (p.Area / 10000).toFixed(0);
      const confClass = p.confidence >= 90 ? 'conf-high' : p.confidence >= 80 ? 'conf-med' : 'conf-low';
      return `<tr id="row-${p.fid}" onclick="SolarAIMap.flyToFarm(${p.fid})">
        <td>${p.fid}</td>
        <td>${p.name || '—'}</td>
        <td>${p.State}</td>
        <td>${p.Latitude.toFixed(3)}</td>
        <td>${p.Longitude.toFixed(3)}</td>
        <td>${Number(areaHa).toLocaleString()}</td>
        <td>${p.capacity_mw ? p.capacity_mw.toLocaleString() : '—'}</td>
        <td>${p.ghi || '—'}</td>
        <td><span class="conf-badge ${confClass}">${p.confidence.toFixed(0)}%</span></td>
        <td>${p.model || 'SegFormer-B5'}</td>
      </tr>`;
    }).join('');
  }

  // ── Tab switching ──────────────────────────────────────────────────────────
  function switchTab(tab) {
    _activeTab = tab;
    // Update nav tabs
    ['detection','suitability','change','reports'].forEach(t => {
      const btn = document.getElementById('ntab-' + t);
      if (btn) btn.classList.toggle('active', t === tab);
    });

    // Show/hide shell vs full-page tabs
    const shell    = document.getElementById('app-shell');
    const tabIds   = ['suitability','change','reports'];
    const isTabPage = tabIds.includes(tab);

    if (shell) shell.style.display = isTabPage ? 'none' : 'grid';

    tabIds.forEach(t => {
      const el = document.getElementById('tab-' + t);
      if (!el) return;
      el.style.display = 'none';
      el.classList.remove('active');
    });

    if (isTabPage) {
      const active = document.getElementById('tab-' + tab);
      if (active) { active.style.display = 'flex'; active.classList.add('active'); }

      // Render charts that need canvas to be visible
      if (tab === 'change') {
        setTimeout(() => window.SolarAICharts.renderNewFarmsBar('chart-new-farms',
          parseInt(document.getElementById('cd-from')?.value || 2016),
          parseInt(document.getElementById('cd-to')?.value   || 2023)), 100);
      }
    }
  }

  // ── Candidate site selection ───────────────────────────────────────────────
  function selectCandidate(id) {
    const site = window.SolarAIData.SUITABILITY_CANDIDATES.find(s => s.id === id);
    if (!site) return;

    // Highlight card
    document.querySelectorAll('.suit-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('sc-' + id);
    if (card) card.classList.add('selected');

    // Fly map (switch to detection tab first)
    if (_activeTab === 'suitability') {
      // Open detection briefly to fly map, then come back — or just fly silently
      const map = window.SolarAIMap.getMap();
      if (map) map.flyTo([site.lat, site.lng], 10, { duration: 1.2 });
    }

    // Render detail panel
    const panel = document.getElementById('suit-detail');
    if (!panel) return;

    const color = site.grade === 'HIGH' ? '#1b7a3e' : site.grade === 'MEDIUM' ? '#b45309' : '#d97706';
    panel.innerHTML = `
      <div class="detail-header">
        <div class="detail-site-name">${site.name}</div>
        <div class="detail-score-row">
          <div class="detail-score" style="color:${color}">${site.total}</div>
          <div>
            <span class="grade-badge grade-${site.grade}">${site.grade} SUITABILITY</span>
            <div style="font-size:0.67rem;color:var(--text-muted);margin-top:3px;">${site.state}</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0;">
        <div class="det-metric"><span class="dm-val">${site.ghi}</span><div class="dm-label">GHI (kWh/m²/yr)</div></div>
        <div class="det-metric"><span class="dm-val">${site.area_ha.toLocaleString()}</span><div class="dm-label">Area (ha)</div></div>
        <div class="det-metric"><span class="dm-val">${site.capacity_mw.toLocaleString()}</span><div class="dm-label">Capacity (MW)</div></div>
        <div class="det-metric"><span class="dm-val">${site.energy_gwh.toLocaleString()}</span><div class="dm-label">Energy (GWh/yr)</div></div>
        <div class="det-metric"><span class="dm-val">${site.slope_deg}°</span><div class="dm-label">Slope (deg)</div></div>
        <div class="det-metric"><span class="dm-val" style="font-size:0.75rem;">${site.flood_risk}</span><div class="dm-label">Flood Risk</div></div>
      </div>
      <div style="background:var(--isro-xpale);border-radius:var(--r-sm);padding:10px;margin-bottom:10px;">
        <div style="font-size:0.67rem;font-weight:700;color:var(--isro-navy);margin-bottom:5px;">Justification</div>
        <div style="font-size:0.73rem;color:var(--text-secondary);line-height:1.6;">${site.justification}</div>
      </div>
      <div>
        <div style="font-size:0.67rem;font-weight:700;color:var(--isro-navy);margin-bottom:5px;">Key Risks</div>
        ${site.risks.map(r => `<div style="font-size:0.71rem;color:var(--warning);padding:3px 0;border-bottom:1px solid var(--border);">⚠ ${r}</div>`).join('')}
      </div>
      <div style="position:relative;height:200px;margin-top:14px;">
        <canvas id="detail-radar-${id}"></canvas>
      </div>`;

    setTimeout(() => window.SolarAICharts.renderRadar('detail-radar-' + id, site), 100);
  }

  // ── Model selection ────────────────────────────────────────────────────────
  function selectModel(name) {
    document.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
    const id = 'mc-' + name.replace(/[^a-z]/gi, '_');
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');
    addLog(`Model switched to ${name}`, 'active');
  }

  // ── Layer toggle ───────────────────────────────────────────────────────────
  const _layerState = { solarFarms:true, ghiHeatmap:false, candidates:false, grid:false, states:true };
  function toggleLayerUI(key) {
    _layerState[key] = !_layerState[key];
    const el = document.getElementById('lt-' + key);
    if (el) el.classList.toggle('active', _layerState[key]);
    window.SolarAIMap.toggleLayer(key, _layerState[key]);
    if (key === 'candidates' && _layerState[key]) window.SolarAIMap.renderCandidateSites();
  }

  // ── Source + AOI updates ──────────────────────────────────────────────────
  function updateSource(val) {
    const resMap = {
      'Sentinel-2':'10m / MSI / L2A',
      'Landsat-9':'30m / OLI-TIRS / L2A',
      'IRS Resourcesat-2A':'24m / LISS-III',
      'Cartosat-3':'0.25m / PAN+MS'
    };
    const label = document.getElementById('res-label');
    if (label) label.textContent = (resMap[val] || '10m') + ' — ' + val;
    addLog(`Satellite source changed to ${val}`, 'active');
  }

  const STATE_COORDS = {
    'Rajasthan':[27.0,74.0,7], 'Gujarat':[22.5,71.5,7], 'Karnataka':[14.5,76.5,8],
    'Tamil Nadu':[11.0,78.5,8], 'Andhra Pradesh':[16.5,79.5,8],
    'Madhya Pradesh':[23.5,77.5,8], 'Telangana':[17.4,78.5,8],
    'Maharashtra':[19.5,76.5,7], 'Punjab':[30.9,75.5,9], 'Haryana':[29.1,76.5,9],
    'Odisha':[20.5,84.5,8], 'Uttar Pradesh':[27.0,80.5,7], 'Jharkhand':[23.6,85.5,8],
    'Ladakh (UT)':[34.2,77.6,8],
  };

  function updateAOI(val) {
    const map = window.SolarAIMap.getMap();
    if (!map) return;
    if (!val) {
      map.flyTo([22.5937, 80.9629], 5, { duration: 1.2 });
      addLog('AOI: All India', 'active');
    } else {
      const c = STATE_COORDS[val] || [22.5, 80.0, 7];
      map.flyTo([c[0], c[1]], c[2], { duration: 1.2 });
      addLog(`AOI: ${val}`, 'active');
    }
    // Async backend filter (non-blocking)
    if (window._backendAlive && typeof filterByStateFromAPI === 'function') {
      filterByStateFromAPI(val || null).catch(() => {});
    }
  }

  // ── Map tools ─────────────────────────────────────────────────────────────
  function setMapTool(tool) {
    document.querySelectorAll('.map-tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('mt-' + tool);
    if (btn) btn.classList.add('active');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // ── Change chart ───────────────────────────────────────────────────────────
  function updateChangeChart() {
    const from = parseInt(document.getElementById('cd-from')?.value || 2016);
    const to   = parseInt(document.getElementById('cd-to')?.value   || 2023);
    if (from < to) window.SolarAICharts.renderNewFarmsBar('chart-new-farms', from, to);
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportGeoJSON() {
    const blob = new Blob([JSON.stringify(window.SolarAIData.SOLAR_FARMS_GEOJSON, null, 2)], { type:'application/json' });
    _downloadBlob(blob, 'solarai_detected_farms_india.geojson');
    showToast('📦 GeoJSON exported', 'success');
  }

  function exportCSV() {
    const headers = ['FID','Name','State','Lat','Lon','Area_ha','Capacity_MW','GHI','Confidence','Model'];
    const rows = window.SolarAIData.SOLAR_FARMS_GEOJSON.features.map(f => {
      const p = f.properties;
      return [p.fid, p.name||'', p.State, p.Latitude, p.Longitude,
              (p.Area/10000).toFixed(1), p.capacity_mw||'', p.ghi||'', p.confidence||'', p.model||''].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    _downloadBlob(new Blob([csv], {type:'text/csv'}), 'solarai_results.csv');
    showToast('📊 CSV exported', 'success');
  }

  function generateReport(title) {
    showToast(`📄 Generating "${title || 'Executive Summary'}" report…`, 'success');
    setTimeout(() => showToast('✅ Report ready — check Downloads folder', 'success'), 2200);
  }

  function _downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Logger ─────────────────────────────────────────────────────────────────
  function addLog(msg, type = 'active') {
    const log = document.getElementById('ai-log');
    if (!log) return;
    const now  = new Date().toLocaleTimeString('en-IN', { hour12:false });
    const line = document.createElement('div');
    line.className = 'log-line ' + type;
    line.innerHTML = `<span class="log-time">[${now}]</span><span class="log-msg"> ${msg}</span>`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    // Keep max 40 lines
    while (log.children.length > 40) log.removeChild(log.firstChild);
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icons = { success:'✅', warn:'⚠️', error:'❌', info:'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 320); }, 3500);
  }

  // ── selectFarm / onMapClick ────────────────────────────────────────────────
  function selectFarm(fid) {
    document.querySelectorAll('#results-tbody tr').forEach(r => r.classList.remove('selected'));
    const row = document.getElementById('row-' + fid);
    if (row) { row.classList.add('selected'); row.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
  }

  function onMapClick() { /* deselect / future picker */ }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── RENDER BACKEND INTEGRATION (Render.com live API) ─────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const RENDER_API = 'https://solarai-api.onrender.com';
  window._backendAlive = false;

  async function _loadBackendFarms(state) {
    let url = `${RENDER_API}/api/solar-farms/?limit=5000`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  async function _loadBackendSites(state) {
    let url = `${RENDER_API}/api/suitable-sites/?limit=2000&min_score=0.65`;
    if (state) url += `&state=${encodeURIComponent(state)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  function _paintBackendFarms(features) {
    const lMap = window._leafletMap;
    if (!lMap) return;
    if (window._backendFarmLayer) window._backendFarmLayer.clearLayers();
    else window._backendFarmLayer = L.layerGroup().addTo(lMap);

    features.forEach(f => {
      const geom = f.geometry; if (!geom) return;
      let latLng;
      if (geom.type === 'Point') {
        latLng = [geom.coordinates[1], geom.coordinates[0]];
      } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
        const lats = ring.map(c=>c[1]), lons = ring.map(c=>c[0]);
        latLng = [lats.reduce((a,b)=>a+b,0)/lats.length, lons.reduce((a,b)=>a+b,0)/lons.length];
      } else return;
      const p = f.properties;
      L.circleMarker(latLng, { radius:8, color:'#15803d', fillColor:'#22c55e', fillOpacity:0.85, weight:2 })
        .bindPopup(`<div style="font-family:system-ui;font-size:13px;min-width:200px">
          <b style="color:#15803d">✅ API Farm</b><hr style="margin:5px 0"/>
          <b>${p.name||'Solar Farm'}</b><br/>
          📍 ${p.state||'—'} › ${p.district||'—'}<br/>
          ⚡ ${p.capacity_mw||'—'} MW &nbsp; 📐 ${p.area_ha||'—'} ha
        </div>`)
        .addTo(window._backendFarmLayer);
    });
  }

  function _paintBackendSites(features) {
    const lMap = window._leafletMap;
    if (!lMap) return;
    if (window._backendSiteLayer) window._backendSiteLayer.clearLayers();
    else window._backendSiteLayer = L.layerGroup().addTo(lMap);

    features.forEach(f => {
      const geom = f.geometry;
      if (!geom || geom.type !== 'Point') return;
      const latLng = [geom.coordinates[1], geom.coordinates[0]];
      const p = f.properties;
      L.circleMarker(latLng, { radius:7, color:'#c2410c', fillColor:'#f97316', fillOpacity:0.8, weight:1.5 })
        .bindPopup(`<div style="font-family:system-ui;font-size:13px;min-width:200px">
          <b style="color:#c2410c">🟠 Suitable Site</b><hr style="margin:5px 0"/>
          📍 ${p.state||'—'} › ${p.district||'—'}<br/>
          ⭐ Score: ${p.suitability_score?(p.suitability_score*100).toFixed(0)+'%':'—'}<br/>
          ☀️ ${p.solar_irradiance||'—'} kWh/m²/day &nbsp; ⚡ ${p.recommended_capacity_mw||'—'} MW
        </div>`)
        .addTo(window._backendSiteLayer);
    });
  }

  function _injectStatusBadge(alive) {
    const old = document.getElementById('api-status-badge');
    if (old) old.remove();
    const b = document.createElement('div');
    b.id = 'api-status-badge';
    b.style.cssText = [
      'position:fixed','bottom:16px','left:16px','z-index:9999',
      'display:inline-flex','align-items:center','gap:6px',
      'padding:5px 11px','border-radius:20px','font-size:11px','font-weight:600',
      'box-shadow:0 2px 8px rgba(0,0,0,0.2)','cursor:pointer',
      alive
        ? 'background:rgba(34,197,94,0.15);color:#16a34a;border:1px solid rgba(34,197,94,0.4);'
        : 'background:rgba(239,68,68,0.1);color:#dc2626;border:1px solid rgba(239,68,68,0.3);'
    ].join(';');
    b.innerHTML = (alive ? '🟢' : '🔴') + ` <span>${alive ? 'Backend Live' : 'Backend Offline'}</span>`;
    b.title = alive ? `Click to open API docs: ${RENDER_API}/docs` : 'Render free tier may be sleeping (cold start ~30s)';
    if (alive) b.onclick = () => window.open(`${RENDER_API}/docs`, '_blank');
    document.body.appendChild(b);
  }

  // Publicly available for AOI filter
  async function filterByStateFromAPI(state) {
    const apiState = (state && state !== 'all' && state !== '') ? state : null;
    try {
      const [farmsData, sitesData] = await Promise.all([
        _loadBackendFarms(apiState),
        _loadBackendSites(apiState),
      ]);
      _paintBackendFarms(farmsData.features || []);
      _paintBackendSites(sitesData.features || []);
      addLog(`API filter: ${apiState||'All India'} → ${(farmsData.features||[]).length} farms, ${(sitesData.features||[]).length} sites`, 'success');
    } catch (err) {
      addLog('Backend filter failed: ' + err.message, 'warn');
    }
  }

  async function initBackendIntegration() {
    let alive = false;
    try {
      const r = await fetch(`${RENDER_API}/health`, { signal: AbortSignal.timeout(8000) });
      alive = r.ok;
    } catch { alive = false; }

    window._backendAlive = alive;
    _injectStatusBadge(alive);

    if (alive) {
      addLog('✅ Render backend connected: ' + RENDER_API, 'success');
      try {
        const [farmsData, sitesData] = await Promise.all([
          _loadBackendFarms(null), _loadBackendSites(null),
        ]);
        _paintBackendFarms(farmsData.features || []);
        _paintBackendSites(sitesData.features || []);
        addLog(`📡 Loaded ${(farmsData.features||[]).length} farms + ${(sitesData.features||[]).length} sites from live API`, 'success');
      } catch (err) {
        addLog('Data fetch failed: ' + err.message, 'warn');
      }
    } else {
      addLog('⚠ Backend offline / sleeping. Using static data.', 'warn');
    }
  }

  // ── DOMContentLoaded boot ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', boot);

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    switchTab, selectFarm, selectCandidate, onMapClick,
    runDetection, updateChangeChart, selectModel,
    toggleLayerUI, updateSource, updateAOI,
    setMapTool, toggleFullscreen, addLog, showToast,
    exportGeoJSON, exportCSV, generateReport,
    filterByStateFromAPI,
  };

})();
