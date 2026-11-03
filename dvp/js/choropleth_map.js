// choropleth_map.js - Positive drug test choropleth (Leaflet + D3 colour scale)
let map = null;
let geoLayer = null;
let legendControl = null;
let rawMapData = [];
let filteredMapData = [];
let mapReady = false;
let mapLoading = false;

const MAP_CONFIG = {
  DATA_FILE_PATHS: [
    'data/police_enforcement_2024_positive_drug_tests.xlsx',
    'police_enforcement_2024_positive_drug_tests.xlsx',
    '../data/police_enforcement_2024_positive_drug_tests.xlsx'
  ],
  NO_DATA_COLOR: '#DDE3EE',
  HIGHLIGHT: '#C26A1A'
};

const MEASURE_LABELS = {
  COUNT: 'Positive drug tests',
  FINES: 'Fines',
  ARRESTS: 'Arrests',
  CHARGES: 'Charges'
};

// ---------- Setup ----------
function initMap() {
  // Called every time the Map tab is opened: only build once afterwards just resize.
  if (mapReady) {
    setTimeout(() => map.invalidateSize(), 50);
    return;
  }
  if (mapLoading) return;
  mapLoading = true;

  createMap();
  loadMapData()
    .then(() => {
      initializeMapFilters();
      mapReady = true;
      map.invalidateSize();          // re-measure the box before fitting Australia into it
      renderChoropleth(true);
    })
    .catch(err => {
      console.error('Map data error:', err);
      showMapEmpty('Could not load the data file (' + err.message +
        '). Make sure the page is served from a local web server, not opened as a file.');
    })
    .finally(() => { mapLoading = false; });
}

function createMap() {
  map = L.map('mapChart', { zoomSnap: 0.25, attributionControl: true });
  map.setView([-26, 134], 4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 10
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

async function loadMapData() {
  let lastError = null;
  for (const path of MAP_CONFIG.DATA_FILE_PATHS) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      const known = new Set(window.AUSTRALIA_STATES.features.map(f => f.properties.jurisdiction));
      const num = v => Math.abs(parseInt(String(v == null ? 0 : v).replace(/,/g, ''), 10)) || 0;

      rawMapData = rows.map(d => ({
        YEAR: String(d.YEAR == null ? '' : d.YEAR).trim(),
        JURISDICTION: String(d.JURISDICTION || '').trim().toUpperCase(),
        DETECTION_METHOD: String(d.DETECTION_METHOD || '').trim(),
        COUNT: num(d.COUNT),
        FINES: num(d.FINES),
        ARRESTS: num(d.ARRESTS),
        CHARGES: num(d.CHARGES)
      })).filter(d => d.YEAR && known.has(d.JURISDICTION));

      if (!rawMapData.length) throw new Error('no usable rows');
      filteredMapData = rawMapData.slice();
      return;
    } catch (err) {
      lastError = err;
      console.warn('Could not load ' + path + ':', err.message);
    }
  }
  throw lastError || new Error('no data file found');
}

// ---------- Filters ----------
function fillSelect(id, values, allLabel) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  const all = document.createElement('option');
  all.value = '__all__';
  all.textContent = allLabel;
  el.appendChild(all);
  values.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
  });
}

function initializeMapFilters() {
  const uniq = key => [...new Set(rawMapData.map(d => d[key]))];
  fillSelect('mapYear', uniq('YEAR').sort((a, b) => b - a), 'All Years');
  fillSelect('mapJurisdiction', uniq('JURISDICTION').sort(), 'All Jurisdictions');
  fillSelect('mapDetectionMethod', uniq('DETECTION_METHOD').sort(), 'All Methods');

  ['mapYear', 'mapJurisdiction', 'mapMetric', 'mapDetectionMethod'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onchange = updateMapFilters;   // assignment, so it never stacks up
  });
}

function updateMapFilters() {
  const val = id => document.getElementById(id).value;
  const year = val('mapYear'), jur = val('mapJurisdiction'), method = val('mapDetectionMethod');
  filteredMapData = rawMapData.filter(d =>
    (year === '__all__' || d.YEAR === year) &&
    (jur === '__all__' || d.JURISDICTION === jur) &&
    (method === '__all__' || d.DETECTION_METHOD === method));
  renderChoropleth(false);
}

// ---------- Rendering ----------
function selectedMeasure() {
  const el = document.getElementById('mapMetric');
  return el && MEASURE_LABELS[el.value] ? el.value : 'COUNT';
}

function totalsByJurisdiction(measure) {
  const totals = {};
  window.AUSTRALIA_STATES.features.forEach(f => { totals[f.properties.jurisdiction] = 0; });
  filteredMapData.forEach(d => { totals[d.JURISDICTION] += d[measure]; });
  return totals;
}

function renderChoropleth(fitToData) {
  if (!map) return;
  const measure = selectedMeasure();
  const label = MEASURE_LABELS[measure];
  const totals = totalsByJurisdiction(measure);
  const values = Object.values(totals);
  const maxValue = Math.max(0, ...values);
  const grandTotal = values.reduce((a, b) => a + b, 0);
  const top = maxValue > 0 ? Object.keys(totals).find(k => totals[k] === maxValue) : null;

  const color = d3.scaleSequentialSqrt(d3.interpolateRgb('#CFE3F6', '#1B2559')).domain([0, maxValue || 1]);

  if (geoLayer) map.removeLayer(geoLayer);
  geoLayer = L.geoJSON(window.AUSTRALIA_STATES, {
    style: f => {
      const code = f.properties.jurisdiction;
      const v = totals[code];
      return {
        fillColor: v > 0 ? color(v) : MAP_CONFIG.NO_DATA_COLOR,
        fillOpacity: 0.8,
        color: code === top ? MAP_CONFIG.HIGHLIGHT : '#ffffff',
        weight: code === top ? 3 : 1.2,
        dashArray: code === top ? '6 4' : null
      };
    },
    onEachFeature: (f, layer) => {
      const code = f.properties.jurisdiction;
      const v = totals[code];
      const share = grandTotal > 0 ? ' (' + ((v / grandTotal) * 100).toFixed(1) + '%)' : '';
      layer.bindTooltip(
        '<strong>' + code + (code === top ? ' &#11088;' : '') + '</strong><br>' +
        label + ': ' + formatNumber(v) + share,
        { sticky: true }
      );
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 1, weight: 3 }));
      layer.on('mouseout', () => geoLayer.resetStyle(layer));
    }
  }).addTo(map);

  if (fitToData) map.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });

  addLegend(color, maxValue, label, top);
  updateMapSummary(grandTotal, totals);
  grandTotal > 0 ? hideMapEmpty() : showMapEmpty();
}

function addLegend(color, maxValue, label, top) {
  if (legendControl) legendControl.remove();
  legendControl = L.control({ position: 'bottomright' });
  legendControl.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    const steps = [0, 0.25, 0.5, 0.75, 1].map(p => Math.round(maxValue * p));
    let html = '<div class="legend-heading">' + label + '</div>';
    if (top) html += '<div class="legend-top">&#11088; Highest: ' + top + '</div>';
    for (let i = 0; i < steps.length - 1; i++) {
      html += '<div><i style="background:' + color((steps[i] + steps[i + 1]) / 2) + '"></i>' +
              formatNumber(steps[i]) + ' &ndash; ' + formatNumber(steps[i + 1]) + '</div>';
    }
    html += '<div><i style="background:' + MAP_CONFIG.NO_DATA_COLOR + '"></i>No data</div>';
    div.innerHTML = html;
    return div;
  };
  legendControl.addTo(map);
}

function updateMapSummary(total, totals) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const active = Object.values(totals).filter(v => v > 0).length;
  set('mapTotal', formatNumber(total));
  set('mapJurisdictions', active);
  set('mapYears', new Set(filteredMapData.map(d => d.YEAR)).size);
  set('mapAverage', active ? formatNumber(total / active) : '0');
  const box = document.getElementById('mapDataSummary');
  if (box) box.style.display = '';
}

function showMapEmpty(message) {
  const el = document.getElementById('mapEmptyState');
  if (!el) return;
  if (message) { const p = el.querySelector('p'); if (p) p.textContent = message; }
  el.style.display = 'block';
}
function hideMapEmpty() {
  const el = document.getElementById('mapEmptyState');
  if (el) el.style.display = 'none';
}

function formatNumber(num) {
  return new Intl.NumberFormat().format(Math.round(num));
}

window.initMap = initMap;
window.renderChoropleth = renderChoropleth;

// Start the map automatically as soon as its area becomes visible (tab click OR scrolling).
// initMap() is safe to call repeatedly: it only builds the map once.
document.addEventListener('DOMContentLoaded', () => {
  const target = document.getElementById('mapChart');
  if (!target) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) initMap();
    }, { threshold: 0.1 }).observe(target);
  } else {
    initMap();
  }
});
