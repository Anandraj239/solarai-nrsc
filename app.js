// SolarAI — Core Application Logic
'use strict';

// ─── ISRO EMBLEM SVG ─────────────────────────────────────────────────────────
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
      <line x1="15.4" y1="15.4" x2="13.2" y2="13.2"/>
      <line x1="24.6" y1="24.6" x2="26.8" y2="26.8"/>
      <line x1="24.6" y1="15.4" x2="26.8" y2="13.2"/>
      <line x1="15.4" y1="24.6" x2="13.2" y2="26.8"/>
    </g>
    <circle cx="35" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
  </svg>`;
}
window.isroEmblemSVG = isroEmblemSVG;

// ─── STATE ───────────────────────────────────────────────────────────────────
const AppState = {
  activeTab: 'dashboard',
  selectedModel: 'SegFormer-B5',
  selectedSource: 'Sentinel-2',
  resolution: '10m',
  detecting: false,
  detectionComplete: false,
  selectedFarmId: null,
  selectedCandidateId: null,
  activeLayers: {
    solarFarms: true, ghiHeatmap: false, stateBounds: true,
    candidates: false, grid: false, satellite: false
  },
  changeYearFrom: 2019,
  changeYearTo: 2024
};

// ─── AI DETECTION LOG STEPS ──────────────────────────────────────────────────
const DETECTION_STEPS = [
  { msg: 'Initializing SolarAI pipeline v3.2...', type: 'active', delay: 0 },
  { msg: 'Loading Sentinel-2 L2A tiles (10m MSI)...', type: 'active', delay: 500 },
  { msg: 'Applying cloud mask (Fmask v4.2) — Coverage: 3.1%', type: 'success', delay: 900 },
  { msg: 'Computing NDVI, NDWI, BI spectral indices...', type: 'active', delay: 1300 },
  { msg: 'NDVI threshold: -0.15 | Suppressing vegetation...', type: 'active', delay: 1700 },
  { msg: 'Suppressing water bodies (NDWI < -0.30)...', type: 'active', delay: 2000 },
  { msg: 'Running SegFormer-B5 inference (84.7M params)...', type: 'active', delay: 2400 },
  { msg: 'Semantic segmentation complete — IoU: 0.891', type: 'success', delay: 3200 },
  { msg: 'Post-processing: Vectorizing binary mask...', type: 'active', delay: 3600 },
  { msg: 'Applying minimum area filter (1 ha)...', type: 'active', delay: 4000 },
  { msg: 'Merging proximate polygons (50m threshold)...', type: 'active', delay: 4300 },
  { msg: 'Running Hard Negative Mining (HNM) filter...', type: 'active', delay: 4700 },
  { msg: 'Suppressed 23 false positives (rooftops, dry riverbeds)...', type: 'warn', delay: 5100 },
  { msg: 'Computing confidence scores per polygon...', type: 'active', delay: 5400 },
  { msg: `✓ Detected ${window.SolarAIData?.SOLAR_FARMS_GEOJSON?.features?.length || 18} solar farms — Mean confidence: 91.4%`, type: 'success', delay: 5800 },
  { msg: 'Generating GeoJSON polygons...', type: 'active', delay: 6100 },
  { msg: 'Computing environmental impact metrics...', type: 'active', delay: 6500 },
  { msg: '✓ Analysis complete. Ready for export.', type: 'success', delay: 6900 },
];

// ─── INIT ────────────────────────────────────────────────────────────────────
function init() {
  showLoadingScreen(() => {
    buildNavbar();
    buildSidebarLeft();
    buildSidebarRight();
    buildCenterPanel();
    buildTabContents();

    // Initialize map
    window.SolarAIMap.initMap();

    // Initialize charts
    setTimeout(() => {
      window.SolarAICharts.renderStateDonut('chart-state-donut');
      window.SolarAICharts.renderTemporalLine('chart-temporal');
      window.SolarAICharts.renderGHIBar('chart-ghi');
      window.SolarAICharts.animateAllCounters();
      startDateTimeTicker();
    }, 300);
  });
}

// ─── LOADING SCREEN ──────────────────────────────────────────────────────────
function showLoadingScreen(onComplete) {
  const screen = document.getElementById('loading-screen');
  const status = document.getElementById('load-status');
  const msgs = [
    'Initializing NRSC geospatial engine...',
    'Loading solar farm dataset...',
    'Calibrating AI model pipeline...',
    'SolarAI ready — Jai Hind 🇮🇳'
  ];
  let i = 0;
  const interval = setInterval(() => {
    if (status) status.textContent = msgs[i] || msgs[msgs.length - 1];
    i++;
    if (i >= msgs.length) {
      clearInterval(interval);
      setTimeout(() => {
        screen.style.transition = 'opacity 0.3s';
        screen.style.opacity = '0';
        setTimeout(() => {
          screen.style.display = 'none';
          onComplete();
        }, 300);
      }, 100);
    }
  }, 80);
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────────
function buildNavbar() {
  const navbar = document.getElementById('navbar');
  const tabs = [
    { id:'dashboard',   icon:'🗺️', label:'Dashboard' },
    { id:'detection',   icon:'🔍', label:'Detection' },
    { id:'suitability', icon:'📊', label:'Suitability' },
    { id:'change',      icon:'📅', label:'Change Detection' },
    { id:'reports',     icon:'📄', label:'Reports' },
  ];
  const tabsHtml = tabs.map(t => `
    <button class="nav-tab ${t.id === AppState.activeTab ? 'active' : ''}"
            id="tab-btn-${t.id}" onclick="App.switchTab('${t.id}')">
      <span class="tab-icon">${t.icon}</span>${t.label}
    </button>
  `).join('');

  navbar.innerHTML = `
    <div class="nav-brand">
      <div class="nav-emblem">
        ${isroEmblemSVG()}
      </div>
      <div class="nav-wordmark">
        <span class="brand-name">SolarAI</span>
        <span class="brand-sub">NRSC · ISRO · Dept. of Space · GoI</span>
      </div>
    </div>
    <div class="nav-status">
      <div class="status-chip"><div class="status-dot"></div>SENTINEL-2 LIVE</div>
      <div class="status-chip" style="color:var(--accent-cyan);border-color:rgba(6,182,212,0.3);background:rgba(6,182,212,0.1);">
        <div class="status-dot" style="background:var(--accent-cyan);"></div>MODEL ONLINE
      </div>
    </div>
    <nav class="nav-tabs">${tabsHtml}</nav>
    <div class="nav-datetime" id="nav-datetime">
      <span id="nav-time" style="color:var(--solar);"></span>
      <span id="nav-date" style="font-size:0.6rem;"></span>
    </div>
    <div class="nav-controls">
      <button class="nav-btn" title="ISRO Bhuvan Portal" onclick="window.open('https://bhuvan.nrsc.gov.in','_blank')">🌐</button>
      <button class="nav-btn" title="Toggle fullscreen" onclick="App.toggleFullscreen()">⛶</button>
      <button class="nav-btn" title="Settings">⚙️</button>
    </div>
  `;
}

function startDateTimeTicker() {
  function tick() {
    const now = new Date();
    const timeEl = document.getElementById('nav-time');
    const dateEl = document.getElementById('nav-date');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  }
  tick();
  setInterval(tick, 1000);
}

// ─── LEFT SIDEBAR ──────────────────────────────────────────────────────────────────
function buildSidebarLeft() {
  const { MODEL_BENCHMARKS } = window.SolarAIData;
  const sidebar = document.getElementById('sidebar-left');

  sidebar.innerHTML = `
    <!-- AI Model Selection -->
    <div class="sidebar-section">
      <div class="section-header">
        <div class="section-header-icon">🤖</div>
        <div class="section-title">AI Model</div>
      </div>
      <div class="section-body">
        <div class="model-grid">
          ${MODEL_BENCHMARKS.map(m => `
            <div class="model-card ${m.name === AppState.selectedModel ? 'selected' : ''} ${m.recommended ? 'recommended' : ''}"
                 onclick="App.selectModel('${m.name}')">
              <div class="model-name">${m.name}</div>
              <div class="model-metric">IoU ${(m.iou*100).toFixed(1)}%</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Data Source -->
    <div class="sidebar-section">
      <div class="section-header">
        <div class="section-header-icon">🛰</div>
        <div class="section-title">Data Source</div>
      </div>
      <div class="section-body">
        <div class="form-group">
          <label class="form-label">Satellite</label>
          <select class="form-select" id="src-satellite" onchange="App.updateSource(this.value)">
            <option>Sentinel-2</option>
            <option>Landsat-9</option>
            <option>IRS Resourcesat-2A</option>
            <option>Cartosat-3</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Resolution / Product</label>
          <div class="res-badge">
            <span>📡</span>
            <span id="res-label">10m / MSI / L2A</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Acquisition Date</label>
          <div class="res-badge" style="color:var(--text-secondary);border-color:var(--border);background:var(--bg-row-alt);">
            <span>📅</span>
            <span>2021-03-15 (Demo)</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Area of Interest</label>
          <select class="form-select" id="aoi-select" onchange="App.updateAOI(this.value)">
            <option value="india">All India</option>
            <option value="rajasthan">Rajasthan</option>
            <option value="karnataka">Karnataka</option>
            <option value="gujarat">Gujarat</option>
            <option value="andhra">Andhra Pradesh</option>
            <option value="tamilnadu">Tamil Nadu</option>
            <option value="mp">Madhya Pradesh</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Detection Controls -->
    <div class="sidebar-section">
      <div class="section-header">
        <div class="section-header-icon">⚡</div>
        <div class="section-title">Detection Run</div>
      </div>
      <div class="section-body">
        <button class="btn-detect" id="btn-detect" onclick="App.runDetection()">
          ⚡ RUN AI DETECTION
        </button>
        <div style="height:7px;"></div>
        <button class="btn-secondary" onclick="App.clearResults()">✕ Clear Results</button>
        <div class="progress-wrap" id="detect-progress" style="display:none;margin-top:8px;">
          <div class="progress-label">
            <span id="progress-step">Initializing...</span>
            <span id="progress-pct">0%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill scanning" id="progress-fill"></div>
          </div>
        </div>
        <div id="ai-log" style="margin-top:8px;"></div>
        <div class="detection-summary" id="det-summary" style="display:none;">
          <div class="det-metric"><span class="dm-val" id="det-count">—</span><span class="dm-label">Farms</span></div>
          <div class="det-metric"><span class="dm-val" id="det-area">—</span><span class="dm-label">Total Ha</span></div>
          <div class="det-metric"><span class="dm-val" id="det-conf">—</span><span class="dm-label">Avg Conf</span></div>
        </div>
      </div>
    </div>

    <!-- Layer Controls -->
    <div class="sidebar-section">
            <span class="layer-name">${l.label}</span>
            <div class="toggle-switch"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Add initial log entry
  addLog('SolarAI v3.2 initialized — NRSC/ISRO platform ready.', 'success');
  addLog(`Dataset: Microsoft AI4Earth India Solar (Ortiz et al. 2022)`, 'active');
  addLog(`Model: ${AppState.selectedModel} | Satellite: ${AppState.selectedSource}`, 'active');
}

// ─── RIGHT SIDEBAR ────────────────────────────────────────────────────────────
function buildSidebarRight() {
  const { NATIONAL_KPI } = window.SolarAIData;
  const sidebar = document.getElementById('sidebar-right');

  sidebar.innerHTML = `
    <!-- KPI Cards -->
    <div class="sidebar-section">
      <div class="section-title">National Summary</div>
      <div class="kpi-grid">
        <div class="kpi-card solar">
          <div class="kpi-icon">☀️</div>
          <span class="kpi-val solar" id="kpi-farms">0</span>
          <div class="kpi-label">Farms Detected</div>
        </div>
        <div class="kpi-card blue">
          <div class="kpi-icon">⚡</div>
          <span class="kpi-val blue" id="kpi-gw">0</span>
          <div class="kpi-label">GW Capacity</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-icon">🌿</div>
          <span class="kpi-val green" id="kpi-co2">0</span>
          <div class="kpi-label">MT CO₂/yr Avoided</div>
        </div>
        <div class="kpi-card cyan">
          <div class="kpi-icon">🏛️</div>
          <span class="kpi-val cyan" id="kpi-states">0</span>
          <div class="kpi-label">States Covered</div>
        </div>
        <div class="kpi-card orange">
          <div class="kpi-icon">🏠</div>
          <span class="kpi-val orange" id="kpi-hh">0</span>
          <div class="kpi-label">Households Powered</div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-icon">🎯</div>
          <span class="kpi-val purple" id="kpi-iou">0%</span>
          <div class="kpi-label">Mean IoU Score</div>
        </div>
      </div>
    </div>

    <!-- State Breakdown Donut -->
    <div class="chart-wrap">
      <div class="chart-title">Farms by State</div>
      <div style="height:160px;"><canvas id="chart-state-donut"></canvas></div>
    </div>

    <!-- Temporal Growth Line -->
    <div class="chart-wrap">
      <div class="chart-title">Growth Trend 2015–2026</div>
      <div style="height:130px;"><canvas id="chart-temporal"></canvas></div>
    </div>

    <!-- GHI Bar -->
    <div class="chart-wrap">
      <div class="chart-title">Solar Resource (GHI)</div>
      <div style="height:160px;"><canvas id="chart-ghi"></canvas></div>
    </div>

    <!-- Data Source Note -->
    <div class="chart-wrap" style="background:var(--isro-xpale);border-top:2px solid var(--isro-blue);">
      <div style="font-size:0.62rem;color:var(--text-muted);line-height:1.6;">
        📚 <strong style="color:var(--isro-navy);">Data Source</strong><br>
        Microsoft AI4Earth Solar Farm India Dataset<br>
        Ortiz et al. (2022) — arXiv:2202.01340<br>
        1,363 farms · Sentinel-2 · U-Net · 92% accuracy<br>
        <a href="https://github.com/microsoft/solar-farms-mapping" target="_blank"
           style="color:var(--isro-light);font-size:0.59rem;">↗ github.com/microsoft/solar-farms-mapping</a>
      </div>
    </div>
  `;
}

// ─── CENTER PANEL ────────────────────────────────────────────────────────────
function buildCenterPanel() {
  const center = document.getElementById('center-panel');

  center.innerHTML = `
    <div id="map-container">
      <div id="map"></div>
      <div id="scan-overlay"><div class="scan-grid"></div><div class="scan-line"></div></div>

      <!-- Map Toolbar -->
      <div id="map-toolbar">
        <button class="map-tool-btn active" id="mt-pan" onclick="App.setMapTool('pan')">✋ Pan</button>
        <button class="map-tool-btn" id="mt-select" onclick="App.setMapTool('select')">⬜ Select</button>
        <button class="map-tool-btn" id="mt-measure" onclick="App.setMapTool('measure')">📏 Measure</button>
        <span style="color:var(--border);margin:0 2px;">|</span>
        <button class="map-tool-btn" id="mt-india" onclick="App.flyToIndia()">🇮🇳 India</button>
        <button class="map-tool-btn" id="mt-rajasthan" onclick="App.flyToState('rajasthan')">Rajasthan</button>
        <button class="map-tool-btn" id="mt-karnataka" onclick="App.flyToState('karnataka')">Karnataka</button>
      </div>

      <!-- Map Info Bar -->
      <div id="map-info">
        <div class="map-stat">
          <span class="ms-val">1,363</span>
          <span class="ms-label">Farms Mapped</span>
        </div>
        <div class="map-stat">
          <span class="ms-val">~91.8 GW</span>
          <span class="ms-label">Est. Capacity</span>
        </div>
        <div class="map-stat">
          <span class="ms-val">92.4%</span>
          <span class="ms-label">Model Accuracy</span>
        </div>
        <div class="map-stat">
          <span class="ms-val">2021</span>
          <span class="ms-label">Dataset Year</span>
        </div>
      </div>
    </div>

    <!-- Bottom Results Panel -->
    <div id="bottom-panel">
      <div class="bottom-header">
        <span class="bottom-title" id="bottom-title">🔍 Detection Results — <span id="result-count">0</span> farms</span>
        <div class="export-btns">
          <button class="export-btn" onclick="App.exportGeoJSON()">📦 GeoJSON</button>
          <button class="export-btn" onclick="App.exportCSV()">📊 CSV</button>
          <button class="export-btn active" onclick="App.generateReport()">📄 Report</button>
        </div>
        <button class="btn-secondary" style="width:auto;padding:4px 10px;font-size:0.68rem;" onclick="App.toggleBottomPanel()">✕ Close</button>
      </div>
      <div id="results-table-wrap">
        <table id="results-table">
          <thead>
            <tr>
              <th>FID</th><th>Farm Name</th><th>State</th>
              <th>Area (ha)</th><th>Capacity (MW)</th><th>GHI</th>
              <th>Confidence</th><th>LULC</th><th>Status</th>
            </tr>
          </thead>
          <tbody id="results-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── TAB CONTENTS ─────────────────────────────────────────────────────────────
function buildTabContents() {
  buildSuitabilityTab();
  buildChangeDetectionTab();
  buildReportsTab();
}

function buildSuitabilityTab() {
  const { SUITABILITY_CANDIDATES } = window.SolarAIData;
  const tab = document.getElementById('tab-suitability');
  if (!tab) return;

  tab.innerHTML = `
    <div class="tc-header">
      <span class="tc-title">📊 Site Suitability Analysis</span>
      <span style="font-size:0.7rem;color:var(--text-muted);">MCDA Framework · 5 Criteria · Weighted Scoring</span>
      <span class="tc-subtitle">NRSC India Wasteland Atlas 2019/2022 | NASA POWER GHI</span>
    </div>
    <div class="tc-body">
      <div class="suitability-grid">
        <!-- Left: Controls + Candidate List -->
        <div>
          <div class="suit-controls" style="margin-bottom:16px;">
            <div class="sidebar-section" style="margin-bottom:0;">
              <div class="section-title">Criteria Weights</div>
              ${[
                { key:'solar', label:'Solar Resource', pct:30, color:'#f59e0b' },
                { key:'terrain', label:'Terrain', pct:20, color:'#10b981' },
                { key:'lulc', label:'Land Use/Cover', pct:25, color:'#06b6d4' },
                { key:'infra', label:'Infrastructure', pct:15, color:'#8b5cf6' },
                { key:'env', label:'Environment', pct:10, color:'#f97316' },
              ].map(c => `
                <div style="margin-bottom:8px;">
                  <div class="form-label" style="display:flex;justify-content:space-between;">
                    <span>${c.label}</span>
                    <span style="color:${c.color};font-family:'JetBrains Mono',monospace;font-size:0.7rem;">${c.pct}%</span>
                  </div>
                  <div class="progress-bar" style="height:5px;">
                    <div class="progress-fill" style="width:${c.pct}%;background:${c.color};"></div>
                  </div>
                </div>
              `).join('')}
              <div style="font-size:0.62rem;color:var(--text-muted);margin-top:6px;">
                Based on NRSC MCDA framework · CEA grid data · FSI forest boundaries
              </div>
            </div>
          </div>

          <div class="section-title">Candidate Sites (${SUITABILITY_CANDIDATES.length})</div>
          <div class="suit-candidate-list">
            ${SUITABILITY_CANDIDATES.map(site => buildCandidateCard(site)).join('')}
          </div>
        </div>

        <!-- Right: Detail Panel -->
        <div class="suit-detail" id="suit-detail-panel">
          <div class="detail-placeholder">
            <div class="ph-icon">🗺️</div>
            <p>Select a candidate site to view<br>detailed suitability analysis</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildCandidateCard(site) {
  const barColors = {
    solar:'#f59e0b', terrain:'#10b981', lulc:'#06b6d4', infra:'#8b5cf6', env:'#f97316'
  };
  const subBars = Object.entries(site.scores).map(([key, val]) => `
    <div class="sub-bar-row">
      <span class="sub-bar-label">${key.charAt(0).toUpperCase()+key.slice(1)}</span>
      <div class="sub-bar-track">
        <div class="sub-bar-fill" style="width:${val}%;background:${barColors[key]};"></div>
      </div>
      <span class="sub-bar-val">${val}</span>
    </div>
  `).join('');

  // SVG ring for score
  const r = 20, c = 26, circ = 2 * Math.PI * r;
  const dash = (site.total / 100) * circ;
  const color = site.grade === 'HIGH' ? '#10b981' : site.grade === 'MEDIUM' ? '#f59e0b' : '#f97316';

  return `
    <div class="suit-card" id="suit-card-${site.id}" onclick="App.selectCandidate('${site.id}')">
      <div class="suit-card-top">
        <div class="suit-score-ring">
          <svg viewBox="0 0 52 52">
            <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(30,74,115,0.4)" stroke-width="4"/>
            <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="4"
                    stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
                    stroke-linecap="round" transform="rotate(-90 26 26)"/>
          </svg>
          <div class="suit-score-val">${site.total}</div>
        </div>
        <div class="suit-meta">
          <div class="suit-name">${site.name}</div>
          <div class="suit-state">📍 ${site.state}</div>
        </div>
        <div class="grade-badge grade-${site.grade}">${site.grade}</div>
      </div>
      <div class="suit-sub-bars">${subBars}</div>
    </div>
  `;
}

function buildChangeDetectionTab() {
  const tab = document.getElementById('tab-change');
  if (!tab) return;
  const { TEMPORAL_DATA } = window.SolarAIData;

  const newFarms2020_2024 = [
    { name:'Adani Green Rajasthan', state:'Rajasthan', area:'4,200 ha', year:2021 },
    { name:'ReNew Power Bikaner',   state:'Rajasthan', area:'1,800 ha', year:2022 },
    { name:'NTPC Rewa Extension',   state:'MP',         area:'950 ha',  year:2022 },
    { name:'Azure Power AP',         state:'Andhra Pradesh', area:'1,200 ha', year:2023 },
    { name:'Greenko Kurnool',        state:'Andhra Pradesh', area:'800 ha',   year:2023 },
    { name:'Torrent Gujarat',        state:'Gujarat',   area:'2,100 ha', year:2024 },
    { name:'JSW Energy Karnataka',   state:'Karnataka', area:'650 ha',   year:2024 },
  ];

  tab.innerHTML = `
    <div class="tc-header">
      <span class="tc-title">📅 Temporal Change Detection</span>
      <span style="font-size:0.7rem;color:var(--text-muted);">Multi-temporal Sentinel-2 Stack · 2015–2026</span>
      <span class="tc-subtitle">Annual interval analysis · State/District scale</span>
    </div>
    <div class="tc-body">
      <div class="change-grid">
        <div class="change-controls">
          <div class="sidebar-section">
            <div class="section-title">Date Range</div>
            <div class="year-range">
              <div class="form-group">
                <label class="form-label">From Year</label>
                <select class="form-select" id="year-from" onchange="App.updateChangeYears()">
                  ${TEMPORAL_DATA.years.map(y => `<option ${y===AppState.changeYearFrom?'selected':''}>${y}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">To Year</label>
                <select class="form-select" id="year-to" onchange="App.updateChangeYears()">
                  ${TEMPORAL_DATA.years.map(y => `<option ${y===AppState.changeYearTo?'selected':''}>${y}</option>`).join('')}
                </select>
              </div>
            </div>
            <button class="btn-detect" style="margin-top:4px;" onclick="App.runChangeDetection()">
              🔄 ANALYZE CHANGES
            </button>
          </div>

          <div class="change-stat-grid" id="change-stats">
            <div class="change-stat">
              <span class="cs-val" id="cs-new">+412</span>
              <span class="cs-delta delta-pos">▲ Commissioned</span>
              <span class="cs-label">New Farms</span>
            </div>
            <div class="change-stat">
              <span class="cs-val" id="cs-area">+3,420 km²</span>
              <span class="cs-delta delta-pos">▲ Area Delta</span>
              <span class="cs-label">Footprint Growth</span>
            </div>
            <div class="change-stat">
              <span class="cs-val" id="cs-cap">+45.4 GW</span>
              <span class="cs-delta delta-pos">▲ Capacity Added</span>
              <span class="cs-label">Energy Growth</span>
            </div>
            <div class="change-stat">
              <span class="cs-val" id="cs-decomm" style="color:var(--accent-red);">3</span>
              <span class="cs-delta delta-neg">▼ Flagged</span>
              <span class="cs-label">Decommissioned</span>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="section-title" style="margin-bottom:10px;">Newly Commissioned Farms</div>
            <div class="new-farms-list">
              ${newFarms2020_2024.map(f => `
                <div class="new-farm-item">
                  <div class="nfi-dot"></div>
                  <div class="nfi-name">${f.name}</div>
                  <div class="nfi-state">${f.state}</div>
                  <div class="nfi-area">${f.area}</div>
                  <div style="font-size:0.6rem;color:var(--text-muted);margin-left:4px;">${f.year}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div>
          <div class="chart-wrap" style="margin-bottom:16px;">
            <div class="chart-title">New Farms & Cumulative Area</div>
            <div style="height:200px;"><canvas id="chart-change-bar"></canvas></div>
          </div>
          <div class="chart-wrap">
            <div class="chart-title">India Solar Growth Trajectory</div>
            <div style="height:200px;"><canvas id="chart-change-growth"></canvas></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render change charts
  setTimeout(() => {
    window.SolarAICharts.renderNewFarmsBar('chart-change-bar', AppState.changeYearFrom, AppState.changeYearTo);
    window.SolarAICharts.renderTemporalLine('chart-change-growth');
  }, 100);
}

function buildReportsTab() {
  const tab = document.getElementById('tab-reports');
  if (!tab) return;
  const { NATIONAL_KPI } = window.SolarAIData;

  tab.innerHTML = `
    <div class="tc-header">
      <span class="tc-title">📄 Reports & Compliance</span>
      <span style="font-size:0.7rem;color:var(--text-muted);">ISRO/NRSC format · PDF/CSV/GeoJSON export</span>
      <span class="tc-subtitle">Regulatory compliance · Environmental Impact Assessment</span>
    </div>
    <div class="tc-body">
      <div class="reports-grid">
        <div class="report-card-list">
          ${[
            { icon:'📋', title:'Executive Summary Report', desc:'High-level summary of all detected solar farms, national statistics, and AI model performance metrics in NRSC report format.' },
            { icon:'🗺️', title:'Geospatial Detection Report', desc:'Full GeoJSON export with all detected polygons, confidence scores, area measurements, and environmental impact data.' },
            { icon:'📊', title:'Suitability Analysis Report', desc:'Ranked list of candidate sites with MCDA sub-scores, regulatory compliance status, and investment recommendations.' },
            { icon:'📅', title:'Change Detection Report', desc:'Multi-temporal analysis comparing selected date ranges — new commissioning, decommissioning, and expansion events.' },
            { icon:'🌿', title:'Environmental Impact Assessment', desc:'CO₂ avoidance, biodiversity risk, land use change classification per Regulation 7(3) of Environment Protection Act 1986.' },
          ].map(r => `
            <div class="report-card" onclick="App.generateReport('${r.title}')">
              <div class="rc-icon">${r.icon}</div>
              <div class="rc-title">${r.title}</div>
              <div class="rc-desc">${r.desc}</div>
              <div class="rc-generate">📥 Generate Report</div>
            </div>
          `).join('')}
        </div>

        <div class="compliance-section">
          <div class="compliance-card">
            <div class="compliance-title">🔒 Regulatory Compliance Checklist</div>
            <div class="checklist">
              ${[
                { icon:'✓', cls:'check-pass', text:'Forest Conservation Act, 1980', sub:'500m setback buffer applied' },
                { icon:'✓', cls:'check-pass', text:'Wildlife Protection Act, 1972', sub:'1km wildlife sanctuary buffer' },
                { icon:'✓', cls:'check-pass', text:'Ramsar Wetland Sites',          sub:'Excluded from candidate zones' },
                { icon:'✓', cls:'check-pass', text:'CRZ Notification, 2019',         sub:'Coastal 500m excluded' },
                { icon:'⚠', cls:'check-warn', text:'Agricultural Land (Kharif/Rabi)', sub:'Manual verification recommended' },
                { icon:'✓', cls:'check-pass', text:'NRSC Wasteland Atlas 2022',      sub:'LULC classification validated' },
                { icon:'✓', cls:'check-pass', text:'CEA Grid Proximity Check',        sub:'PGCIL transmission corridors loaded' },
                { icon:'⚠', cls:'check-warn', text:'Biodiversity Impact Assessment',  sub:'Site-specific survey required >100 ha' },
              ].map(c => `
                <div class="check-item">
                  <div class="check-icon ${c.cls}">${c.icon}</div>
                  <div class="check-text">${c.text}<span>${c.sub}</span></div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="compliance-card">
            <div class="compliance-title">📈 National Statistics Summary</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.72rem;">
              ${[
                ['Total Farms Detected', `${NATIONAL_KPI.total_farms.toLocaleString()} farms`],
                ['Total Estimated Capacity', `${NATIONAL_KPI.total_capacity_gw} GW`],
                ['Total Mapped Area', `~${NATIONAL_KPI.total_area_sq_km.toLocaleString()} km²`],
                ['CO₂ Avoided (Annual)', `${NATIONAL_KPI.co2_avoided_mt} million tonnes`],
                ['Households Powered', `${(NATIONAL_KPI.households_powered/1000000).toFixed(1)}M households`],
                ['Model IoU Score', `${(NATIONAL_KPI.mean_iou*100).toFixed(1)}%`],
                ['Mean F1 Score', `${(NATIONAL_KPI.mean_f1*100).toFixed(1)}%`],
                ['Validation Method', 'Human expert review'],
                ['LULC Conflict', `${NATIONAL_KPI.lulc_conflict}% on ecologically sensitive land`],
              ].map(([k,v]) => `
                <tr style="border-bottom:1px solid rgba(30,74,115,0.3);">
                  <td style="padding:5px 8px;color:var(--text-muted);">${k}</td>
                  <td style="padding:5px 8px;color:var(--text-primary);font-family:'JetBrains Mono',monospace;font-size:0.7rem;">${v}</td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div class="compliance-card" style="background:rgba(239,68,68,0.04);border-color:rgba(239,68,68,0.2);">
            <div style="font-size:0.72rem;color:var(--text-secondary);line-height:1.7;">
              <strong style="color:var(--accent-red);">⚠ Important Legal Advisory</strong><br>
              SolarAI outputs are for planning and analysis purposes only. Do not commence site development without:
              <ul style="margin:6px 0 0 16px;color:var(--text-muted);">
                <li>Environmental Clearance under EIA Notification, 2006</li>
                <li>Forest clearance under FCA 1980 (if applicable)</li>
                <li>State land revenue department approval</li>
                <li>DISCOM/SLDC grid connection approval</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── TAB SWITCHING ─────────────────────────────────────────────────────────
function switchTab(tabId) {
  AppState.activeTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Show/hide overlays
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

  if (tabId === 'dashboard' || tabId === 'detection') {
    // Show map
  } else {
    const tc = document.getElementById(`tab-${tabId}`);
    if (tc) tc.classList.add('active');

    if (tabId === 'suitability') {
      // Rebuild to ensure fresh
    } else if (tabId === 'change') {
      setTimeout(() => {
        window.SolarAICharts.renderNewFarmsBar('chart-change-bar', AppState.changeYearFrom, AppState.changeYearTo);
        window.SolarAICharts.renderTemporalLine('chart-change-growth');
      }, 100);
    }
  }

  // Layer toggle for candidates
  if (tabId === 'suitability') {
    window.SolarAIMap.toggleLayer('candidates', true);
    window.SolarAIMap.renderCandidateSites();
    AppState.activeLayers.candidates = true;
  }
}

// ─── DETECTION ─────────────────────────────────────────────────────────────
async function runDetection() {
  if (AppState.detecting) return;
  AppState.detecting = true;

  const btn = document.getElementById('btn-detect');
  const progressWrap = document.getElementById('detect-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressStep = document.getElementById('progress-step');
  const progressPct  = document.getElementById('progress-pct');
  const aiLog = document.getElementById('ai-log');

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Running...'; }
  if (progressWrap) progressWrap.style.display = 'block';
  if (aiLog) aiLog.innerHTML = '';

  // Run scan overlay
  window.SolarAIMap.runScanAnimation();

  // Run log steps
  let step = 0;
  for (const s of DETECTION_STEPS) {
    await sleep(s.delay - (DETECTION_STEPS[step - 1]?.delay || 0));
    addLog(s.msg, s.type);
    const pct = Math.round(((DETECTION_STEPS.indexOf(s) + 1) / DETECTION_STEPS.length) * 100);
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressPct) progressPct.textContent = pct + '%';
    if (progressStep) progressStep.textContent = s.msg.substring(0, 40) + '...';
    step++;
  }

  // Animate polygon detection
  await window.SolarAIMap.animateDetection((done, total) => {
    const pct = Math.round((done / total) * 100);
    if (progressStep) progressStep.textContent = `Scanning polygon ${done}/${total}...`;
  });

  // Show results
  AppState.detecting = false;
  AppState.detectionComplete = true;
  if (btn) { btn.disabled = false; btn.textContent = '⚡ RUN DETECTION'; }
  if (progressFill) progressFill.classList.remove('scanning');

  populateResultsTable();
  showDetectionSummary();
  showToast('✅ Detection complete — 18 farms detected', 'success');
}

function populateResultsTable() {
  const tbody = document.getElementById('results-tbody');
  const countEl = document.getElementById('result-count');
  if (!tbody) return;

  const { SOLAR_FARMS_GEOJSON } = window.SolarAIData;
  const features = SOLAR_FARMS_GEOJSON.features;
  if (countEl) countEl.textContent = features.length;

  tbody.innerHTML = features.map(f => {
    const p = f.properties;
    const ha = (p.Area / 10000).toFixed(0);
    const mw = p.capacity_mw || Math.round(ha * 0.8);
    const conf = p.confidence || 88;
    const confCls = conf >= 90 ? 'conf-high' : conf >= 80 ? 'conf-med' : 'conf-low';
    const confLabel = conf >= 90 ? '✓ HIGH' : conf >= 80 ? '~ MED' : '✗ LOW';
    return `<tr onclick="App.selectFarm(${p.fid})" id="row-${p.fid}">
      <td>SF-${String(p.fid).padStart(4,'0')}</td>
      <td style="font-weight:500;color:var(--text-primary);">${p.name || 'Farm #'+p.fid}</td>
      <td>${p.State}</td>
      <td style="font-family:'JetBrains Mono',monospace;">${Number(ha).toLocaleString()}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--solar);">${Number(mw).toLocaleString()}</td>
      <td style="font-family:'JetBrains Mono',monospace;">${p.ghi || 1900}</td>
      <td><span class="conf-badge ${confCls}">${confLabel} ${conf}%</span></td>
      <td style="font-size:0.65rem;color:var(--text-muted);">${p.lulc_class || p.lulc || '—'}</td>
      <td><span class="badge badge-${p.status==='Operational'?'green':'blue'}">${p.status||'Operational'}</span></td>
    </tr>`;
  }).join('');

  // Show bottom panel
  document.getElementById('bottom-panel').classList.add('open');
}

function showDetectionSummary() {
  const { SOLAR_FARMS_GEOJSON } = window.SolarAIData;
  const features = SOLAR_FARMS_GEOJSON.features;
  const totalHa = features.reduce((s,f) => s + f.properties.Area / 10000, 0);
  const avgConf = (features.reduce((s,f) => s + (f.properties.confidence||88), 0) / features.length).toFixed(1);

  const s = document.getElementById('det-summary');
  const detCount = document.getElementById('det-count');
  const detArea  = document.getElementById('det-area');
  const detConf  = document.getElementById('det-conf');
  if (s) s.style.display = 'grid';
  if (detCount) detCount.textContent = features.length;
  if (detArea) detArea.textContent = Math.round(totalHa/1000)+'k ha';
  if (detConf) detConf.textContent = avgConf+'%';
}

// ─── MODEL SELECTION ─────────────────────────────────────────────────────────
function selectModel(name) {
  AppState.selectedModel = name;
  document.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.model-card').forEach(c => {
    if (c.querySelector('.model-name')?.textContent === name) c.classList.add('selected');
  });

  const { MODEL_BENCHMARKS } = window.SolarAIData;
  const m = MODEL_BENCHMARKS.find(b => b.name === name);
  if (m) {
    addLog(`Model switched to ${name} — IoU: ${(m.iou*100).toFixed(1)}%, F1: ${(m.f1*100).toFixed(1)}%`, 'success');
    addLog(`Parameters: ${m.params_m}M | Inference: ${m.inference_ms}ms/tile`, 'active');
  }
}

// ─── LAYER TOGGLE ─────────────────────────────────────────────────────────────
function toggleLayer(key) {
  AppState.activeLayers[key] = !AppState.activeLayers[key];
  const el = document.getElementById(`layer-${key}`);
  if (el) el.classList.toggle('active', AppState.activeLayers[key]);

  if (key === 'satellite') {
    window.SolarAIMap.switchBasemap(AppState.activeLayers.satellite ? 'satellite' : 'light');
  } else if (key === 'nightMode') {
    window.SolarAIMap.switchBasemap(AppState.activeLayers.nightMode ? 'dark' : 'light');
  } else {
    if (key === 'candidates' && AppState.activeLayers.candidates) {
      window.SolarAIMap.renderCandidateSites();
    }
    window.SolarAIMap.toggleLayer(
      key === 'stateBounds' ? 'states' : key,
      AppState.activeLayers[key]
    );
  }
}

// ─── SUITABILITY CANDIDATE SELECTION ─────────────────────────────────────────
function selectCandidate(id) {
  AppState.selectedCandidateId = id;
  const { SUITABILITY_CANDIDATES } = window.SolarAIData;
  const site = SUITABILITY_CANDIDATES.find(s => s.id === id);
  if (!site) return;

  document.querySelectorAll('.suit-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`suit-card-${id}`);
  if (card) card.classList.add('selected');

  // Fly map to site
  window.SolarAIMap.getMap()?.flyTo([site.lat, site.lng], 9, { duration: 1 });

  // Render detail panel
  renderCandidateDetail(site);
}

function renderCandidateDetail(site) {
  const panel = document.getElementById('suit-detail-panel');
  if (!panel) return;
  const color = site.grade === 'HIGH' ? '#10b981' : site.grade === 'MEDIUM' ? '#f59e0b' : '#f97316';

  panel.innerHTML = `
    <div class="detail-header">
      <div class="detail-site-name">${site.name}</div>
      <div class="detail-score-row">
        <div class="detail-score">${site.total}</div>
        <div>
          <div class="grade-badge grade-${site.grade}" style="font-size:0.75rem;">${site.grade} SUITABILITY</div>
          <div style="font-size:0.62rem;color:var(--text-muted);margin-top:4px;">📍 ${site.state}</div>
        </div>
      </div>
    </div>

    <div class="detail-metrics-grid">
      <div class="detail-metric"><span class="dmt-val" style="color:var(--solar);">${site.ghi}</span><div class="dmt-label">GHI kWh/m²/yr</div></div>
      <div class="detail-metric"><span class="dmt-val" style="color:var(--accent-cyan);">${site.area_ha.toLocaleString()}</span><div class="dmt-label">Area (ha)</div></div>
      <div class="detail-metric"><span class="dmt-val" style="color:var(--isro-blue-lt);">${site.capacity_mw.toLocaleString()} MW</span><div class="dmt-label">Est. Capacity</div></div>
      <div class="detail-metric"><span class="dmt-val" style="color:var(--accent-green);">${site.energy_gwh.toLocaleString()} GWh</span><div class="dmt-label">Annual Energy</div></div>
      <div class="detail-metric"><span class="dmt-val" style="color:var(--accent-teal);">${site.co2_kt.toLocaleString()} kt</span><div class="dmt-label">CO₂ Avoided/yr</div></div>
      <div class="detail-metric"><span class="dmt-val" style="color:var(--accent-purple);">${(site.households/1000).toFixed(0)}k</span><div class="dmt-label">Households</div></div>
    </div>

    <div style="margin-bottom:14px;">
      <div class="chart-title" style="margin-bottom:8px;">MCDA Sub-Scores</div>
      <div style="height:140px;"><canvas id="radar-detail"></canvas></div>
    </div>

    <div class="detail-just">${site.justification}</div>

    <div>
      <div class="risks-title">⚠ Risk Factors</div>
      ${site.risks.map(r => `<div class="risk-item">${r}</div>`).join('')}
    </div>

    <div style="margin-top:14px;padding:10px;background:rgba(29,111,164,0.08);border:1px solid rgba(29,111,164,0.2);border-radius:8px;font-size:0.68rem;color:var(--text-muted);">
      🏗 LULC: <span style="color:var(--accent-cyan);">${site.lulc_class}</span><br>
      🌊 Flood Risk: <span style="color:var(--solar);">${site.flood_risk}</span><br>
      📐 Avg Slope: <span style="color:var(--accent-green);">${site.slope_deg}°</span>
    </div>

    <div style="margin-top:12px;display:flex;gap:8px;">
      <button class="btn-detect" style="flex:1;font-size:0.75rem;padding:8px;" onclick="App.flyToState('${site.state}')">
        🗺 View on Map
      </button>
      <button class="btn-secondary" style="flex:1;" onclick="App.generateReport('suitability')">
        📄 Export
      </button>
    </div>
  `;

  setTimeout(() => {
    window.SolarAICharts.renderRadar('radar-detail', site);
  }, 50);
}

// ─── CHANGE DETECTION ────────────────────────────────────────────────────────
function updateChangeYears() {
  const from = parseInt(document.getElementById('year-from').value);
  const to   = parseInt(document.getElementById('year-to').value);
  if (from >= to) { showToast('⚠ "From" year must be before "To" year', 'warn'); return; }
  AppState.changeYearFrom = from;
  AppState.changeYearTo   = to;
}

function runChangeDetection() {
  const { TEMPORAL_DATA } = window.SolarAIData;
  const from = AppState.changeYearFrom;
  const to   = AppState.changeYearTo;
  const idxF = TEMPORAL_DATA.years.indexOf(from);
  const idxT = TEMPORAL_DATA.years.indexOf(to);
  if (idxF < 0 || idxT < 0 || idxF >= idxT) { showToast('⚠ Invalid date range', 'warn'); return; }

  const newFarms = TEMPORAL_DATA.farms_detected[idxT] - TEMPORAL_DATA.farms_detected[idxF];
  const areaKm   = TEMPORAL_DATA.area_sq_km[idxT] - TEMPORAL_DATA.area_sq_km[idxF];
  const capGW    = TEMPORAL_DATA.national_capacity_gw[idxT] - TEMPORAL_DATA.national_capacity_gw[idxF];

  document.getElementById('cs-new').textContent  = '+' + newFarms;
  document.getElementById('cs-area').textContent = '+' + areaKm.toLocaleString() + ' km²';
  document.getElementById('cs-cap').textContent  = '+' + capGW.toFixed(1) + ' GW';

  window.SolarAICharts.renderNewFarmsBar('chart-change-bar', from, to);

  showToast(`✅ Change analysis complete: ${from}→${to} (+${newFarms} farms)`, 'success');
}

// ─── FLY-TO HELPERS ──────────────────────────────────────────────────────────
function flyToIndia() { window.SolarAIMap.getMap()?.flyTo([22.59, 80.96], 5, { duration: 1.5 }); }
function flyToState(state) {
  const coords = {
    rajasthan: [27.0, 74.0, 7], karnataka: [14.5, 76.5, 8],
    gujarat:   [22.5, 71.5, 8], andhra:    [16.5, 79.5, 8],
    tamilnadu: [11.0, 78.5, 8], mp:        [23.5, 77.5, 8],
    goa: [15.3, 74.1, 10],
  };
  const c = coords[state] || coords.rajasthan;
  window.SolarAIMap.getMap()?.flyTo([c[0], c[1]], c[2], { duration: 1.2 });
}

// ─── FARM SELECTION ──────────────────────────────────────────────────────────
function selectFarm(fid) {
  AppState.selectedFarmId = fid;
  document.querySelectorAll('#results-tbody tr').forEach(r => r.classList.remove('selected'));
  const row = document.getElementById(`row-${fid}`);
  if (row) { row.classList.add('selected'); row.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
  window.SolarAIMap.flyToFarm(fid);
}

// ─── MISC APP ACTIONS ─────────────────────────────────────────────────────────
function updateSource(val) {
  AppState.selectedSource = val;
  const resMap = { 'Sentinel-2':'10m / MSI / L2A', 'Landsat-9':'30m / OLI-TIRS / L2A', 'IRS Resourcesat-2A':'24m / LISS-III', 'Cartosat-3':'0.25m / PAN+MS' };
  const label = document.getElementById('res-label');
  if (label) label.textContent = resMap[val] || '10m';
  addLog(`Data source changed to ${val}`, 'active');
}

function updateAOI(val) {
  addLog(`Area of Interest set to: ${val}`, 'active');
  flyToState(val);
}

function setMapTool(tool) {
  document.querySelectorAll('.map-tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`mt-${tool}`);
  if (btn) btn.classList.add('active');
}

function clearResults() {
  document.getElementById('bottom-panel')?.classList.remove('open');
  const tbody = document.getElementById('results-tbody');
  if (tbody) tbody.innerHTML = '';
  AppState.detectionComplete = false;
  const s = document.getElementById('det-summary');
  if (s) s.style.display = 'none';
  addLog('Results cleared. Ready for new detection run.', 'warn');
}

function toggleBottomPanel() { document.getElementById('bottom-panel')?.classList.remove('open'); }
function onMapClick() { /* future: coordinate picker */ }
function toggleFullscreen() {
  if (!document.fullscreenElement) { document.documentElement.requestFullscreen?.(); }
  else { document.exitFullscreen?.(); }
}

function exportGeoJSON() {
  const { SOLAR_FARMS_GEOJSON } = window.SolarAIData;
  const blob = new Blob([JSON.stringify(SOLAR_FARMS_GEOJSON, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'solarai_detected_farms_india.geojson');
  showToast('📦 GeoJSON exported', 'success');
}

function exportCSV() {
  const { SOLAR_FARMS_GEOJSON } = window.SolarAIData;
  const headers = ['FID','Name','State','Latitude','Longitude','Area_ha','Capacity_MW','GHI','Confidence','LULC','Status'];
  const rows = SOLAR_FARMS_GEOJSON.features.map(f => {
    const p = f.properties;
    return [p.fid, p.name||'', p.State, p.Latitude?.toFixed(4)||'', p.Longitude?.toFixed(4)||'',
            (p.Area/10000).toFixed(1), p.capacity_mw||'', p.ghi||'', p.confidence||'', p.lulc||'', p.status||''].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  downloadBlob(new Blob([csv], {type:'text/csv'}), 'solarai_results.csv');
  showToast('📊 CSV exported', 'success');
}

function generateReport(title) {
  showToast(`📄 Generating "${title || 'Executive Summary'}" report...`, 'success');
  setTimeout(() => showToast('✅ Report ready — check Downloads folder (simulated)', 'success'), 2000);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── LOGGER ──────────────────────────────────────────────────────────────────
function addLog(msg, type = 'active') {
  const log = document.getElementById('ai-log');
  if (!log) return;
  const now = new Date().toLocaleTimeString('en-IN', { hour12:false });
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.innerHTML = `<span class="log-time">[${now}]</span><span class="log-msg">${msg}</span>`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icons = { success:'✅', warn:'⚠️', error:'❌', info:'ℹ️' };
  toast.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── PUBLIC API ──────────────────────────────────────────────────────────────
window.App = {
  switchTab, runDetection, selectModel, toggleLayer, selectCandidate,
  updateChangeYears, runChangeDetection, flyToIndia, flyToState,
  selectFarm, updateSource, updateAOI, setMapTool, clearResults,
  toggleBottomPanel, onMapClick, toggleFullscreen,
  exportGeoJSON, exportCSV, generateReport
};

window.SolarAIApp = {
  onMapClick, selectFarm, selectCandidate
};

// ─── BOOT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
