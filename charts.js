// SolarAI — Charts Module (Chart.js)
'use strict';

let _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#3d5068',
        font: { family: 'Inter', size: 10 },
        boxWidth: 10, padding: 10
      }
    },
    tooltip: {
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#d0dae6',
      borderWidth: 1,
      titleColor: '#0a2d5e',
      bodyColor: '#3d5068',
      padding: 10,
      cornerRadius: 6,
      titleFont: { family: 'Inter', size: 11, weight: '600' },
      bodyFont: { family: 'Roboto Mono', size: 10 }
    }
  },
  scales: {}
};

function makeScales(opts = {}) {
  return {
    x: {
      ticks: { color: '#6b7f96', font: { family: 'Inter', size: 9 } },
      grid: { color: 'rgba(208,218,230,0.6)', drawBorder: false },
      border: { color: 'rgba(208,218,230,0.6)' },
      ...opts.x
    },
    y: {
      ticks: { color: '#6b7f96', font: { family: 'Roboto Mono', size: 9 } },
      grid: { color: 'rgba(208,218,230,0.6)', drawBorder: false },
      border: { color: 'rgba(208,218,230,0.6)' },
      beginAtZero: true,
      ...opts.y
    }
  };
}

// ─── STATE DOUGHNUT CHART ─────────────────────────────────────────────────────
function renderStateDonut(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const { TEMPORAL_DATA } = window.SolarAIData;
  const data = TEMPORAL_DATA.state_breakdown_2021;
  const labels = Object.keys(data);
  const values = Object.values(data);

  const colors = [
    '#f59e0b','#3b9bd4','#10b981','#8b5cf6','#06b6d4',
    '#f97316','#ef4444','#14b8a6','#94a3b8'
  ];

  _charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + '88'),
        borderColor: colors,
        borderWidth: 1.5,
        hoverOffset: 6
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      cutout: '68%',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: {
          position: 'bottom',
          labels: {
            color: '#64748b',
            font: { family: 'Space Grotesk', size: 9 },
            boxWidth: 8, padding: 7
          }
        }
      }
    }
  });
}

// ─── TEMPORAL LINE CHART ──────────────────────────────────────────────────────
function renderTemporalLine(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const { TEMPORAL_DATA } = window.SolarAIData;

  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: TEMPORAL_DATA.years,
      datasets: [
        {
          label: 'Capacity (GW)',
          data: TEMPORAL_DATA.national_capacity_gw,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.1)',
          borderWidth: 2, fill: true, tension: 0.4,
          pointBackgroundColor: '#f59e0b',
          pointRadius: 3, pointHoverRadius: 5,
          yAxisID: 'y'
        },
        {
          label: 'Farms Detected',
          data: TEMPORAL_DATA.farms_detected,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,0.05)',
          borderWidth: 2, fill: false, tension: 0.4,
          pointBackgroundColor: '#06b6d4',
          pointRadius: 2, pointHoverRadius: 4,
          yAxisID: 'y1', borderDash: [4,3]
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: makeScales().x,
        y: {
          ...makeScales().y,
          position: 'left',
          ticks: { color: '#f59e0b', font: { family: 'JetBrains Mono', size: 9 } }
        },
        y1: {
          ...makeScales().y,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#06b6d4', font: { family: 'JetBrains Mono', size: 9 } }
        }
      }
    }
  });
}

// ─── GHI BAR CHART ───────────────────────────────────────────────────────────
function renderGHIBar(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const { GHI_ZONES } = window.SolarAIData;

  const sorted = [...GHI_ZONES].sort((a,b) => b.ghi - a.ghi);
  const labels = sorted.map(z => z.region.split('/')[0]);
  const values = sorted.map(z => z.ghi);
  const colors = values.map(v => {
    const norm = (v - 1600) / (2250 - 1600);
    const r = Math.round(255 * norm);
    const g = Math.round(100 * (1 - norm));
    return `rgba(${r},${g},0,0.75)`;
  });
  const borders = values.map(v => {
    const norm = (v - 1600) / (2250 - 1600);
    const r = Math.round(255 * norm);
    const g = Math.round(100 * (1 - norm));
    return `rgb(${r},${g},0)`;
  });

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'GHI (kWh/m²/yr)',
        data: values,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      scales: {
        x: {
          ...makeScales().x,
          min: 1500,
          ticks: {
            ...makeScales().x.ticks,
            callback: v => v.toLocaleString()
          }
        },
        y: { ...makeScales().y, grid: { display: false } }
      }
    }
  });
}

// ─── RADAR CHART (suitability sub-scores) ────────────────────────────────────
function renderRadar(canvasId, site) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const s = site.scores;
  _charts[canvasId] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Solar', 'Terrain', 'LULC', 'Infra', 'Env'],
      datasets: [{
        label: site.name,
        data: [s.solar, s.terrain, s.lulc, s.infra, s.env],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.15)',
        borderWidth: 2,
        pointBackgroundColor: '#f59e0b',
        pointRadius: 4, pointHoverRadius: 6
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { color: '#6b7f96', font: { size: 8 }, stepSize: 25, backdropColor: 'rgba(255,255,255,0.8)' },
          grid: { color: 'rgba(208,218,230,0.7)' },
          pointLabels: { color: '#3d5068', font: { family: 'Inter', size: 9 } },
          angleLines: { color: 'rgba(208,218,230,0.7)' }
        }
      }
    }
  });
}

// ─── MODEL PERFORMANCE BAR ─────────────────────────────────────────────────
function renderModelBar(canvasId) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const { MODEL_BENCHMARKS } = window.SolarAIData;

  const labels = MODEL_BENCHMARKS.map(m => m.name);
  const iou    = MODEL_BENCHMARKS.map(m => (m.iou * 100).toFixed(1));
  const f1     = MODEL_BENCHMARKS.map(m => (m.f1 * 100).toFixed(1));

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'IoU (%)',
          data: iou,
          backgroundColor: 'rgba(245,158,11,0.6)',
          borderColor: '#f59e0b', borderWidth: 1.5, borderRadius: 4
        },
        {
          label: 'F1 (%)',
          data: f1,
          backgroundColor: 'rgba(6,182,212,0.6)',
          borderColor: '#06b6d4', borderWidth: 1.5, borderRadius: 4
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: makeScales().x,
        y: { ...makeScales().y, min: 75, max: 100 }
      }
    }
  });
}

// ─── NEW FARMS PER YEAR BAR (Change Detection) ───────────────────────────────
function renderNewFarmsBar(canvasId, yearFrom, yearTo) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const { TEMPORAL_DATA } = window.SolarAIData;

  const idxFrom = TEMPORAL_DATA.years.indexOf(yearFrom);
  const idxTo   = TEMPORAL_DATA.years.indexOf(yearTo);
  if (idxFrom < 0 || idxTo < 0) return;

  const slicedYears  = TEMPORAL_DATA.years.slice(idxFrom, idxTo + 1);
  const slicedFarms  = TEMPORAL_DATA.new_farms_per_year.slice(idxFrom, idxTo + 1);
  const slicedArea   = TEMPORAL_DATA.area_sq_km.slice(idxFrom, idxTo + 1);

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: slicedYears,
      datasets: [
        {
          label: 'New Farms',
          data: slicedFarms,
          backgroundColor: 'rgba(16,185,129,0.6)',
          borderColor: '#10b981', borderWidth: 1.5, borderRadius: 4, yAxisID:'y'
        },
        {
          type: 'line',
          label: 'Cum. Area (km²)',
          data: slicedArea,
          borderColor: '#f59e0b', backgroundColor: 'transparent',
          borderWidth: 2, pointRadius: 3, tension: 0.4, yAxisID:'y1'
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: makeScales().x,
        y: { ...makeScales().y, position: 'left', ticks: { color: '#10b981', font: { family: 'JetBrains Mono', size: 9 } } },
        y1: { ...makeScales().y, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#f59e0b', font: { family: 'JetBrains Mono', size: 9 } } }
      }
    }
  });
}

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────
function animateCounter(el, target, duration = 1500, decimals = 0, suffix = '') {
  const start = performance.now();
  const startVal = 0;
  function step(ts) {
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = startVal + (target - startVal) * eased;
    el.textContent = current.toFixed(decimals).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function animateAllCounters() {
  const { NATIONAL_KPI } = window.SolarAIData;
  const counters = [
    { id: 'kpi-farms',   val: NATIONAL_KPI.total_farms,      dec: 0, suf: '' },
    { id: 'kpi-gw',      val: NATIONAL_KPI.total_capacity_gw,dec: 1, suf: '' },
    { id: 'kpi-states',  val: NATIONAL_KPI.states_covered,   dec: 0, suf: '' },
    { id: 'kpi-co2',     val: NATIONAL_KPI.co2_avoided_mt,   dec: 1, suf: '' },
    { id: 'kpi-iou',     val: NATIONAL_KPI.mean_iou * 100,   dec: 1, suf: '%' },
    { id: 'kpi-hh',      val: 87.5,                          dec: 1, suf: 'M' },
  ];
  counters.forEach(c => {
    const el = document.getElementById(c.id);
    if (el) animateCounter(el, c.val, 1800, c.dec, c.suf);
  });
}

window.SolarAICharts = {
  renderStateDonut, renderTemporalLine, renderGHIBar,
  renderRadar, renderModelBar, renderNewFarmsBar,
  animateCounter, animateAllCounters, destroyChart
};
