// Global variables
let map = null;
let geojsonData = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"jurisdiction": "ACT"}, "geometry": {"type": "Polygon", "coordinates": [[[[149.0, -35.5], [149.5, -35.5], [149.5, -35.0], [149.0, -35.0], [149.0, -35.5]]]]}}, {"type": "Feature", "properties": {"jurisdiction": "NSW"}, "geometry": {"type": "Polygon", "coordinates": [[[[150.5, -34.0], [151.5, -34.0], [151.5, -33.5], [150.5, -33.5], [150.5, -34.0]]]]}}, {"type": "Feature", "properties": {"jurisdiction": "NT"}, "geometry": {"type": "Polygon", "coordinates": [[[[131.0, -19.5], [132.0, -19.5], [132.0, -19.0], [131.0, -19.0], [131.0, -19.5]]]]}}, {"type": "Feature", "properties": {"jurisdiction": "QLD"}, "geometry": {"type": "Polygon", "coordinates": [[[[145.5, -20.0], [146.5, -20.0], [146.5, -19.5], [145.5, -19.5], [145.5, -20.0]]]]}}, {"type": "Feature", "properties": {"jurisdiction": "SA"}, "geometry": {"type": "Polygon", "coordinates": [[[[138.0, -30.0], [139.0, -30.0], [139.0, -29.5], [138.0, -29.5], [138.0, -30.0]]]]}}, {"type": "Feature", "properties": {"jurisdiction": "TAS"}, "geometry": {"type": "Polygon", "coordinates": [[[[147.0, -42.0], [148.0, -42.0], [148.0, -41.5], [147.0, -41.5], [147.0, -42.0]]]]}}, {"type": "Feature", "properties": {"jurisdiction": "VIC"}, "geometry": {"type": "Polygon", "coordinates": [[[[144.0, -37.5], [145.0, -37.5], [145.0, -37.0], [144.0, -37.0], [144.0, -37.5]]]]}}, {"type": "Feature", "properties": {"jurisdiction": "WA"}, "geometry": {"type": "Polygon", "coordinates": [[[[116.0, -33.5], [117.0, -33.5], [117.0, -33.0], [116.0, -33.0], [116.0, -33.5]]]]}}]};

let rawMapData = [];
let filteredMapData = [];

// Configuration
const MAP_CONFIG = {
  DATA_FILE_PATHS: [
    'data/police_enforcement_2024_positive_drug_tests.xlsx',
    'police_enforcement_2024_positive_drug_tests.xlsx',
    '../data/police_enforcement_2024_positive_drug_tests.xlsx'
  ],
  COLORS: {
    background: '#141a2f',
    stroke: '#fff',
    hover: '#ff6347',
    highlight: '#ffd700',
    noData: '#f0f0f0'
  }
};

// Initialize the map
function initMap() {
    console.log('Initializing choropleth map...');

    // Load data first
    loadMapData().then(() => {
        // Initialize the map
        map = L.map('mapContainer').setView([-25.2744, 133.7751], 4);

        // Tile layer for the map background
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Initialize filters
        initializeMapFilters();

        // Render the choropleth map
        renderChoropleth();

        console.log('Choropleth map initialized successfully');
    }).catch(error => {
        console.error('Error initializing map:', error);
        // Fallback to static data
        filteredMapData = [
            {"JURISDICTION":"ACT","COUNT":5595,"FINES":0},
            {"JURISDICTION":"NSW","COUNT":169885,"FINES":27605},
            {"JURISDICTION":"NT","COUNT":6001,"FINES":1353},
            {"JURISDICTION":"QLD","COUNT":118070,"FINES":0},
            {"JURISDICTION":"SA","COUNT":67688,"FINES":6355},
            {"JURISDICTION":"TAS","COUNT":28796,"FINES":0},
            {"JURISDICTION":"VIC","COUNT":103902,"FINES":0},
            {"JURISDICTION":"WA","COUNT":79521,"FINES":0}
        ];
        initializeMapFilters();
        renderChoropleth();
    });
}

// Load map data
async function loadMapData() {
    for (const filePath of MAP_CONFIG.DATA_FILE_PATHS) {
        try {
            console.log(`Loading data from: ${filePath}`);
            const response = await fetch(filePath);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            console.log('Raw data loaded:', jsonData.length, 'rows');

            // Process data
            rawMapData = jsonData.map(d => {
                let countValue = 0;
                if (d.COUNT !== undefined) {
                    if (typeof d.COUNT === 'string') {
                        countValue = parseInt(d.COUNT.replace(/,/g, '')) || 0;
                    } else {
                        countValue = parseInt(d.COUNT) || 0;
                    }
                }

                return {
                    YEAR: (d.YEAR || '').toString().trim(),
                    JURISDICTION: (d.JURISDICTION || '').toString().trim(),
                    METRIC: (d.METRIC || '').toString().trim(),
                    DETECTION_METHOD: (d.DETECTION_METHOD || '').toString().trim(),
                    COUNT: Math.abs(countValue)
                };
            }).filter(d => {
                return d.YEAR && d.JURISDICTION && d.METRIC && d.DETECTION_METHOD && !isNaN(d.COUNT) && d.COUNT > 0;
            });

            if (rawMapData.length === 0) {
                throw new Error('No valid data found');
            }

            filteredMapData = [...rawMapData];
            console.log('Map data processed successfully:', rawMapData.length, 'rows');
            return;

        } catch (error) {
            console.warn(`Failed from ${filePath}:`, error.message);
            continue;
        }
    }

    throw new Error('Could not load data from any path');
}

// Initialize map filters
function initializeMapFilters() {
    if (!rawMapData.length) return;

    const years = [...new Set(rawMapData.map(d => d.YEAR))].sort();
    const jurisdictions = [...new Set(rawMapData.map(d => d.JURISDICTION))].sort();
    const metrics = [...new Set(rawMapData.map(d => d.METRIC))].sort();
    const methods = [...new Set(rawMapData.map(d => d.DETECTION_METHOD))].sort();

    populateSelect('mapYear', years);
    populateSelect('mapJurisdiction', jurisdictions);
    populateSelect('mapMetric', metrics);
    populateSelect('mapDetectionMethod', methods);

    // Set default metric
    const metricSelect = document.getElementById('mapMetric');
    if (metricSelect) {
        metricSelect.value = 'Positive Drug Tests';
    }

    // Add event listeners
    document.getElementById('mapYear').addEventListener('change', updateMapFilters);
    document.getElementById('mapJurisdiction').addEventListener('change', updateMapFilters);
    document.getElementById('mapMetric').addEventListener('change', updateMapFilters);
    document.getElementById('mapDetectionMethod').addEventListener('change', updateMapFilters);
}

// Update map filters
function updateMapFilters() {
    const selectedYear = document.getElementById('mapYear').value;
    const selectedJurisdiction = document.getElementById('mapJurisdiction').value;
    const selectedMetric = document.getElementById('mapMetric').value;
    const selectedMethod = document.getElementById('mapDetectionMethod').value;

    filteredMapData = rawMapData.filter(d => {
        return (selectedYear === '__all__' || d.YEAR === selectedYear) &&
               (selectedJurisdiction === '__all__' || d.JURISDICTION === selectedJurisdiction) &&
               (selectedMetric === '__all__' || d.METRIC === selectedMetric) &&
               (selectedMethod === '__all__' || d.DETECTION_METHOD === selectedMethod);
    });

    console.log('Map filters updated:', filteredMapData.length, 'rows');
    renderChoropleth();
}

// Render choropleth map
function renderChoropleth() {
    if (!map) return;

    // Clear existing layers except tile layer
    map.eachLayer(layer => {
        if (!(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });

    if (filteredMapData.length === 0) {
        console.warn('No data to display on map');
        return;
    }

    // Calculate data by jurisdiction
    const dataByJurisdiction = calculateJurisdictionData();

    // Find the jurisdiction with the highest value for highlighting (across all jurisdictions, not just filtered)
    const topJurisdiction = findTopJurisdiction();

    // Color scale for the choropleth map
    const values = Object.values(dataByJurisdiction).map(d => d.value).filter(v => v > 0);
    const maxValue = values.length > 0 ? Math.max(...values) : 0;

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxValue]);

    // Function to style the GeoJSON data based on the COUNT value
    function style(feature) {
        const jurisdiction = feature.properties.jurisdiction;
        const data = dataByJurisdiction[jurisdiction];
        const isTop = jurisdiction === topJurisdiction;

        let color = MAP_CONFIG.COLORS.noData;
        if (data && data.value > 0) {
            color = colorScale(data.value);
        }

        return {
            fillColor: color,
            weight: isTop ? 3 : 2,
            opacity: 1,
            color: isTop ? MAP_CONFIG.COLORS.highlight : MAP_CONFIG.COLORS.stroke,
            dashArray: isTop ? '5, 5' : '3',
            fillOpacity: 0.7
        };
    }

    // Function to add popup when hovering over a state
    function onEachFeature(feature, layer) {
        const jurisdiction = feature.properties.jurisdiction;
        const data = dataByJurisdiction[jurisdiction];
        const selectedMetric = document.getElementById('mapMetric').value;

        let valueText = 'No Data';
        if (data) {
            if (selectedMetric.includes('Positive') || selectedMetric.includes('positive')) {
                valueText = `Positive Drug Tests: ${formatNumber(data.value)}`;
            } else if (selectedMetric.includes('conducted') || selectedMetric.includes('Conducted')) {
                valueText = `Drug Tests Conducted: ${formatNumber(data.value)}`;
            } else {
                valueText = `${selectedMetric}: ${formatNumber(data.value)}`;
            }
        }

        const isTop = jurisdiction === topJurisdiction;
        const highlightText = isTop ? ' ⭐ HIGHEST' : '';

        const popupContent = `<strong>${jurisdiction}${highlightText}</strong><br>${valueText}`;
        layer.bindPopup(popupContent);

        // Add hover effects
        layer.on('mouseover', function() {
            this.setStyle({
                weight: isTop ? 4 : 3,
                fillOpacity: 0.9
            });
        });

        layer.on('mouseout', function() {
            this.setStyle({
                weight: isTop ? 3 : 2,
                fillOpacity: 0.7
            });
        });
    }

    // Adding the GeoJSON layer to the map
    L.geoJSON(geojsonData, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);

    // Add legend
    addLegend(colorScale, maxValue, topJurisdiction);

    console.log('Choropleth map rendered with filters and highlighting');
}

// Calculate data for each jurisdiction
function calculateJurisdictionData() {
    const dataByJurisdiction = {};

    // Initialize with all jurisdictions from GeoJSON
    geojsonData.features.forEach(feature => {
        const jurisdiction = feature.properties.jurisdiction;
        dataByJurisdiction[jurisdiction] = {
            name: jurisdiction,
            value: 0,
            count: 0
        };
    });

    // Aggregate data
    filteredMapData.forEach(d => {
        if (dataByJurisdiction[d.JURISDICTION]) {
            dataByJurisdiction[d.JURISDICTION].count += d.COUNT;
            dataByJurisdiction[d.JURISDICTION].value += d.COUNT;
        }
    });

    return dataByJurisdiction;
}

// Find the jurisdiction with the highest value for highlighting (across all jurisdictions, not just filtered)
function findTopJurisdiction() {
    if (!rawMapData.length) return null;

    const selectedMetric = document.getElementById('mapMetric').value;
    const selectedMethod = document.getElementById('mapDetectionMethod').value;

    // Filter data by current metric and method, but include all jurisdictions and years
    const relevantData = rawMapData.filter(d => {
        return (selectedMetric === '__all__' || d.METRIC === selectedMetric) &&
               (selectedMethod === '__all__' || d.DETECTION_METHOD === selectedMethod);
    });

    // Aggregate by jurisdiction
    const jurisdictionTotals = {};
    relevantData.forEach(d => {
        if (!jurisdictionTotals[d.JURISDICTION]) {
            jurisdictionTotals[d.JURISDICTION] = 0;
        }
        jurisdictionTotals[d.JURISDICTION] += d.COUNT;
    });

    // Find the jurisdiction with the highest total
    let maxValue = 0;
    let topJurisdiction = null;

    Object.keys(jurisdictionTotals).forEach(jurisdiction => {
        if (jurisdictionTotals[jurisdiction] > maxValue) {
            maxValue = jurisdictionTotals[jurisdiction];
            topJurisdiction = jurisdiction;
        }
    });

    console.log('Top jurisdiction for', selectedMetric, 'and', selectedMethod, ':', topJurisdiction, 'with value:', maxValue);
    return topJurisdiction;
}

// Add legend to the map
function addLegend(colorScale, maxValue, topJurisdiction) {
    // Remove existing legend
    map.eachLayer(layer => {
        if (layer instanceof L.Control && layer.options.position === 'bottomright') {
            map.removeControl(layer);
        }
    });

    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'legend');
        const grades = [0, Math.round(maxValue * 0.25), Math.round(maxValue * 0.5), Math.round(maxValue * 0.75), maxValue];
        const labels = [];

        grades.forEach(function(grade, index) {
            labels.push(
                '<i style="background:' + colorScale(grade) + '"></i>' +
                (grades[index] || '0') + (grades[index + 1] ? ' &ndash; ' + grades[index + 1] : '+')
            );
        });

        const selectedMetric = document.getElementById('mapMetric').value;
        const metricLabel = selectedMetric.includes('Positive') ? 'Positive Drug Tests' :
                           selectedMetric.includes('conducted') ? 'Drug Tests Conducted' : selectedMetric;

        div.innerHTML = `<div style="font-weight: bold; margin-bottom: 8px;">${metricLabel}</div>` +
                       `<div style="font-size: 11px; margin-bottom: 8px; color: gold;">⭐ ${topJurisdiction} - HIGHEST</div>` +
                       labels.join('<br>');
        return div;
    };
    legend.addTo(map);
}

// Helper functions
function populateSelect(selectId, options) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    selectElement.innerHTML = '<option value="__all__">All</option>';
    options.forEach(option => {
        if (option && option !== '' && option !== 'undefined') {
            selectElement.innerHTML += `<option value="${option}">${option}</option>`;
        }
    });
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(Math.round(num));
}
