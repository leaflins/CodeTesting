// map.js - Updated for Australian statistical areas with debug fixes
// Configuration
const MAP_CONFIG = {
  DATA_FILE_PATHS: [
    'data/police_enforcement_2024_positive_drug_tests.xlsx',
    'police_enforcement_2024_positive_drug_tests.xlsx',
    '../data/police_enforcement_2024_positive_drug_tests.xlsx'
  ],
  GEOJSON_PATHS: [
    'data/australia-regions.geojson',
    'australia-regions.geojson',
    '../data/australia-regions.geojson',
    'data/australia-states.geojson', // Fallback to states
    'australia-states.geojson'
  ],
  COLORS: {
    background: '#141a2f',
    stroke: '#fff',
    hover: '#ff6347',
    noData: '#f0f0f0'
  }
};

// Global variables
let mapData = [];
let filteredMapData = [];
let australiaRegions = null;
let chart = null;

// Australian statistical areas mapping - expanded to include more possibilities
const AUSTRALIAN_REGIONS = [
  "Major Cities of Australia",
  "Inner Regional Australia", 
  "Outer Regional Australia",
  "Remote Australia",
  "Very Remote Australia",
  "All regions",
  "NSW", "Victoria", "Queensland", "WA", "SA", "Tasmania", "ACT", "NT",
  "New South Wales", "Western Australia", "South Australia", "Australian Capital Territory", "Northern Territory",
  "Unknown"
];

// Initialize the map
async function initMap() {
  try {
    updateMapStatus('loading', 'Loading Australian regions data...');
    
    console.log('=== INITIALIZING AUSTRALIAN REGIONS CHOROPLETH MAP ===');
    
    // Load data and geography
    await Promise.all([
      loadMapData(),
      loadAustraliaRegionsGeoData()
    ]);
    
    // Initialize controls after data is loaded
    initializeMapControls();
    
    // Update overview stats
    updateMapOverviewStats();
    
    // Render the choropleth map
    renderChoropleth();
    
    updateMapStatus('success', `Australian regions map loaded with ${mapData.length} rows`);
    
  } catch (error) {
    console.error('Error initializing Australian regions map:', error);
    updateMapStatus('error', `Failed to load map: ${error.message}`);
    
    // Fallback to test data
    console.log('Using fallback data for Australian regions...');
    loadTestDataAsFallback();
    initializeMapControls();
    updateMapOverviewStats();
    renderChoropleth();
  }
}

// Load positive drug test data
async function loadMapData() {
  let lastError = null;
  
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
      
      // Debug: Check what's actually in the data
      console.log('All unique jurisdictions in data:', [...new Set(jsonData.map(d => d.JURISDICTION))]);
      console.log('All unique years in data:', [...new Set(jsonData.map(d => d.YEAR))]);
      console.log('All unique metrics in data:', [...new Set(jsonData.map(d => d.METRIC))]);
      console.log('Sample of raw data:', jsonData.slice(0, 3));
      
      // Process data - focus on JURISDICTION column which contains the regions
      mapData = jsonData.map(d => {
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
        // More flexible filtering - accept any jurisdiction that exists in data
        const hasValidData = d.YEAR && d.JURISDICTION && d.METRIC && !isNaN(d.COUNT);
        const hasCount = d.COUNT > 0;
        
        // Log what we're filtering out for debugging
        if (!hasValidData) {
          console.log('Filtering out invalid row:', d);
        }
        
        return hasValidData && hasCount;
      });
      
      if (mapData.length === 0) {
        console.warn('No valid data found. Available jurisdictions:', 
          [...new Set(jsonData.map(d => d.JURISDICTION))]);
        throw new Error('No valid data found for Australian regions');
      }
      
      filteredMapData = [...mapData];
      console.log('Australian regions data processed successfully:', mapData.length, 'rows');
      console.log('Regions found:', [...new Set(mapData.map(d => d.JURISDICTION))]);
      console.log('Years found:', [...new Set(mapData.map(d => d.YEAR))]);
      return;
      
    } catch (error) {
      console.warn(`Failed from ${filePath}:`, error.message);
      lastError = error;
      continue;
    }
  }
  
  throw lastError || new Error('Could not load data from any path');
}

// Load Australia regions GeoJSON data
async function loadAustraliaRegionsGeoData() {
  for (const geoPath of MAP_CONFIG.GEOJSON_PATHS) {
    try {
      console.log(`Loading Australia regions GeoJSON from: ${geoPath}`);
      const response = await fetch(geoPath);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const geoJson = await response.json();
      
      if (!geoJson || !geoJson.features) {
        throw new Error('Invalid GeoJSON structure');
      }
      
      console.log('Australia regions GeoJSON loaded:', geoJson.features.length, 'features');
      console.log('Available regions in GeoJSON:', geoJson.features.map(f => f.properties.code || f.properties.name));
      australiaRegions = geoJson;
      return;
      
    } catch (error) {
      console.warn(`Failed to load Australia regions GeoJSON from ${geoPath}:`, error.message);
      continue;
    }
  }
  
  // Fallback to simplified Australia regions data
  console.warn('Creating simplified Australia regions data');
  australiaRegions = createSimplifiedAustraliaRegionsData();
}

// Create simplified Australia regions data
function createSimplifiedAustraliaRegionsData() {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Major Cities of Australia", code: "Major Cities of Australia" },
        geometry: { 
          type: "MultiPolygon", 
          coordinates: [
            // Sydney, Melbourne, Brisbane, Perth, Adelaide areas
            [[[150.5, -34.0], [151.5, -34.0], [151.5, -33.5], [150.5, -33.5], [150.5, -34.0]]],
            [[[144.5, -38.0], [145.5, -38.0], [145.5, -37.5], [144.5, -37.5], [144.5, -38.0]]],
            [[[152.8, -27.8], [153.3, -27.8], [153.3, -27.2], [152.8, -27.2], [152.8, -27.8]]],
            [[[115.7, -32.2], [116.2, -32.2], [116.2, -31.7], [115.7, -31.7], [115.7, -32.2]]],
            [[[138.4, -35.2], [139.0, -35.2], [139.0, -34.7], [138.4, -34.7], [138.4, -35.2]]]
          ]
        }
      },
      {
        type: "Feature",
        properties: { name: "Inner Regional Australia", code: "Inner Regional Australia" },
        geometry: { 
          type: "MultiPolygon", 
          coordinates: [
            // Areas around major cities
            [[[149.0, -35.0], [150.5, -35.0], [150.5, -34.0], [149.0, -34.0], [149.0, -35.0]]],
            [[[145.0, -38.5], [146.5, -38.5], [146.5, -37.5], [145.0, -37.5], [145.0, -38.5]]]
          ]
        }
      },
      {
        type: "Feature",
        properties: { name: "Outer Regional Australia", code: "Outer Regional Australia" },
        geometry: { 
          type: "MultiPolygon", 
          coordinates: [
            // Further out regions
            [[[147.0, -36.0], [149.0, -36.0], [149.0, -35.0], [147.0, -35.0], [147.0, -36.0]]],
            [[[116.0, -33.0], [118.0, -33.0], [118.0, -32.0], [116.0, -32.0], [116.0, -33.0]]]
          ]
        }
      },
      {
        type: "Feature",
        properties: { name: "Remote Australia", code: "Remote Australia" },
        geometry: { 
          type: "MultiPolygon", 
          coordinates: [
            // Remote areas
            [[[120.0, -25.0], [125.0, -25.0], [125.0, -20.0], [120.0, -20.0], [120.0, -25.0]]]
          ]
        }
      },
      {
        type: "Feature",
        properties: { name: "Very Remote Australia", code: "Very Remote Australia" },
        geometry: { 
          type: "MultiPolygon", 
          coordinates: [
            // Very remote areas
            [[[125.0, -20.0], [130.0, -20.0], [130.0, -15.0], [125.0, -15.0], [125.0, -20.0]]],
            [[[130.0, -25.0], [135.0, -25.0], [135.0, -20.0], [130.0, -20.0], [130.0, -25.0]]]
          ]
        }
      }
    ]
  };
}

// Load test data as fallback with Australian regions
function loadTestDataAsFallback() {
  console.log('Loading fallback test data for Australian regions...');
  
  mapData = [];
  const regions = [
    "Major Cities of Australia",
    "Inner Regional Australia", 
    "Outer Regional Australia",
    "Remote Australia",
    "Very Remote Australia"
  ];
  
  // Generate data for 2008-2024 as requested
  const years = [];
  for (let year = 2008; year <= 2024; year++) {
    years.push(year.toString());
  }
  
  const methods = ['Roadside', 'Station', 'Mobile'];
  
  regions.forEach(region => {
    years.forEach(year => {
      methods.forEach(method => {
        // Different base counts for different regions
        const baseCount = {
          'Major Cities of Australia': 5000,
          'Inner Regional Australia': 3000,
          'Outer Regional Australia': 2000,
          'Remote Australia': 800,
          'Very Remote Australia': 400
        }[region];
        
        // Add some variation based on year (trend over time)
        const yearIndex = years.indexOf(year);
        const yearMultiplier = 0.8 + (yearIndex / years.length) * 0.4; // Increase over time
        
        const methodMultiplier = {
          'Roadside': 0.6, 'Station': 0.3, 'Mobile': 0.1
        }[method];
        
        // Add some random variation
        const randomVariation = 0.8 + Math.random() * 0.4;
        
        const count = Math.floor(baseCount * yearMultiplier * methodMultiplier * randomVariation);
        
        mapData.push({
          YEAR: year,
          JURISDICTION: region,
          METRIC: 'Positive Drug Tests',
          DETECTION_METHOD: method,
          COUNT: count
        });
      });
    });
  });
  
  filteredMapData = [...mapData];
  console.log('Australian regions fallback data created:', mapData.length, 'rows');
  console.log('Years in fallback data: 2008-2024');
}

// Update map overview statistics
function updateMapOverviewStats() {
  if (!mapData || mapData.length === 0) return;
  
  const totalRows = mapData.length;
  const totalTests = mapData.reduce((sum, d) => sum + d.COUNT, 0);
  const uniqueRegions = [...new Set(mapData.map(d => d.JURISDICTION))].length;
  const uniqueYears = [...new Set(mapData.map(d => d.YEAR))].length;
  const uniqueMethods = [...new Set(mapData.map(d => d.DETECTION_METHOD))].length;
  const avgPerRegion = Math.round(totalTests / uniqueRegions);
  
  const elements = {
    'map-data-rows': formatNumber(totalRows),
    'map-total-tests': formatNumber(totalTests),
    'map-total-jurisdictions': uniqueRegions,
    'map-total-years': uniqueYears,
    'map-total-methods': uniqueMethods,
    'map-avg-jurisdiction': formatNumber(avgPerRegion)
  };
  
  Object.keys(elements).forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = elements[id];
  });
  
  console.log(`Australian Regions Overview: ${totalRows} rows, ${totalTests} tests, ${uniqueRegions} regions, ${uniqueYears} years (${Math.min(...mapData.map(d => d.YEAR))}-${Math.max(...mapData.map(d => d.YEAR))})`);
}

// Render choropleth map for Australian regions
function renderChoropleth() {
  const container = document.getElementById('mapChart');
  if (!container) {
    console.error('Map container not found');
    return;
  }
  
  // Clear previous content
  container.innerHTML = '';
  
  if (!australiaRegions || filteredMapData.length === 0) {
    showMapEmptyState('No Australian regions data available');
    return;
  }
  
  hideMapEmptyState();
  
  // Calculate data by region
  const dataByRegion = calculateRegionData();
  
  // Set up dimensions
  const width = container.offsetWidth || 800;
  const height = Math.min(600, width * 0.6);
  
  // Create SVG
  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .style("background", MAP_CONFIG.COLORS.background)
    .style("border-radius", "8px")
    .style("display", "block");
  
  // Create projection for Australia
  const projection = d3.geoMercator()
    .center([134, -25])
    .scale(width * 0.8)
    .translate([width / 2, height / 2]);
  
  const path = d3.geoPath().projection(projection);
  
  // Calculate data values for color scale
  const dataValues = Object.values(dataByRegion).map(d => d.value).filter(v => v > 0);
  const maxValue = dataValues.length > 0 ? d3.max(dataValues) : 1;
  
  // Create color scale
  const color = d3.scaleSequential(d3.interpolateBlues)
    .domain([0, maxValue]);
  
  // Create tooltip
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "map-tooltip")
    .style("position", "absolute")
    .style("background", "rgba(0, 0, 0, 0.85)")
    .style("color", "white")
    .style("padding", "8px 12px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("z-index", "1000")
    .style("opacity", 0);
  
  // Draw map features
  const features = svg.append("g")
    .selectAll("path")
    .data(australiaRegions.features)
    .join("path")
    .attr("fill", d => {
      const region = d.properties.code || d.properties.name;
      const data = dataByRegion[region];
      return data && data.value > 0 ? color(data.value) : MAP_CONFIG.COLORS.noData;
    })
    .attr("d", path)
    .style("stroke", MAP_CONFIG.COLORS.stroke)
    .style("stroke-width", 1)
    .style("cursor", "pointer")
    .style("opacity", 0.8)
    .on("mouseover", function(event, d) {
      // Highlight feature
      d3.select(this)
        .style("opacity", 1)
        .style("stroke-width", 2);
      
      // Show tooltip
      const region = d.properties.code || d.properties.name;
      const data = dataByRegion[region];
      const selectedMetric = document.getElementById('mapMetric').value;
      
      let valueText = '';
      if (selectedMetric === 'positive_drug_tests') {
        valueText = `Positive Drug Tests: ${formatNumber(data ? data.value : 0)}`;
      } else if (selectedMetric === 'drug_tests_conducted') {
        valueText = `Drug Tests Conducted: ${formatNumber(data ? data.value : 0)}`;
      } else if (selectedMetric === 'positive_rate') {
        valueText = `Positive Rate: ${data ? data.value.toFixed(1) : 0}%`;
      }
      
      tooltip
        .html(`
          <div style="font-weight: bold; margin-bottom: 4px;">${d.properties.name}</div>
          <div>${valueText}</div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
        .style("opacity", 1);
    })
    .on("mouseout", function(event, d) {
      // Restore style
      d3.select(this)
        .style("opacity", 0.8)
        .style("stroke-width", 1);
      
      // Hide tooltip
      tooltip.style("opacity", 0);
    })
    .on("click", function(event, d) {
      const region = d.properties.code || d.properties.name;
      console.log(`Clicked on Australian region: ${region}`);
      
      // Update filter
      document.getElementById('mapJurisdiction').value = region;
      updateMapFilters();
    });
  
  // Add region labels (shorter names for better display)
  const regionLabels = {
    "Major Cities of Australia": "Major Cities",
    "Inner Regional Australia": "Inner Regional", 
    "Outer Regional Australia": "Outer Regional",
    "Remote Australia": "Remote",
    "Very Remote Australia": "Very Remote"
  };
  
  svg.append("g")
    .selectAll("text")
    .data(australiaRegions.features)
    .join("text")
    .attr("transform", d => `translate(${path.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text(d => regionLabels[d.properties.code] || d.properties.name)
    .style("fill", "#2c3e50")
    .style("font-size", "9px")
    .style("font-weight", "bold")
    .style("pointer-events", "none")
    .style("text-shadow", "1px 1px 2px rgba(255,255,255,0.8)");
  
  // Add legend
  addLegend(svg, color, maxValue, width, height);
  
  // Update data summary
  updateMapDataSummary(dataByRegion);
  
  console.log('Australian regions choropleth map rendered successfully');
}

// Calculate data for each region
function calculateRegionData() {
  const selectedMetric = document.getElementById('mapMetric').value;
  const regionData = {};
  
  // Initialize with all Australian regions from GeoJSON
  if (australiaRegions) {
    australiaRegions.features.forEach(feature => {
      const code = feature.properties.code || feature.properties.name;
      regionData[code] = {
        name: feature.properties.name,
        value: 0,
        count: 0,
        tests: 0
      };
    });
  }
  
  // Also include regions that exist in data but not in GeoJSON
  const dataRegions = [...new Set(filteredMapData.map(d => d.JURISDICTION))];
  dataRegions.forEach(region => {
    if (!regionData[region]) {
      regionData[region] = {
        name: region,
        value: 0,
        count: 0,
        tests: 0
      };
    }
  });
  
  // Aggregate data
  filteredMapData.forEach(d => {
    if (regionData[d.JURISDICTION]) {
      if (d.METRIC.includes('Positive') || d.METRIC.includes('positive')) {
        regionData[d.JURISDICTION].count += d.COUNT;
      }
      regionData[d.JURISDICTION].tests += d.COUNT;
    }
  });
  
  // Calculate final values
  Object.keys(regionData).forEach(region => {
    const data = regionData[region];
    
    if (selectedMetric === 'positive_drug_tests') {
      data.value = data.count;
    } else if (selectedMetric === 'drug_tests_conducted') {
      data.value = data.tests;
    } else if (selectedMetric === 'positive_rate') {
      data.value = data.tests > 0 ? (data.count / data.tests) * 100 : 0;
    }
  });
  
  console.log('Region data calculated:', regionData);
  return regionData;
}

// Add legend to the map
function addLegend(svg, color, maxValue, width, height) {
  const legendWidth = 200;
  const legendHeight = 10;
  const legendMargin = { top: 20, right: 30, bottom: 0, left: 0 };
  
  const legend = svg.append("g")
    .attr("transform", `translate(${width - legendWidth - legendMargin.right}, ${height - 40})`);
  
  // Legend title
  const selectedMetric = document.getElementById('mapMetric').value;
  let legendTitle = 'Positive Drug Tests';
  if (selectedMetric === 'drug_tests_conducted') legendTitle = 'Drug Tests Conducted';
  if (selectedMetric === 'positive_rate') legendTitle = 'Positive Rate (%)';
  
  legend.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("fill", "#e7ecff")
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text(legendTitle);
  
  // Legend gradient
  const defs = svg.append("defs");
  const linearGradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");
  
  linearGradient.selectAll("stop")
    .data(d3.range(0, 1.1, 0.1))
    .join("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => color(d * maxValue));
  
  // Legend rectangle
  legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)");
  
  // Legend axis
  const legendScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, legendWidth]);
  
  const legendAxis = d3.axisBottom(legendScale)
    .ticks(5)
    .tickFormat(d => selectedMetric === 'positive_rate' ? `${d}%` : formatNumber(d));
  
  legend.append("g")
    .attr("transform", `translate(0, ${legendHeight})`)
    .call(legendAxis)
    .style("color", "#e7ecff")
    .style("font-size", "10px");
}

// Update map data summary
function updateMapDataSummary(regionData) {
  const summaryContainer = document.getElementById('mapDataSummary');
  if (!summaryContainer) return;
  
  const dataValues = Object.values(regionData).map(d => d.value);
  const totalValue = d3.sum(dataValues);
  const avgValue = dataValues.length > 0 ? totalValue / dataValues.length : 0;
  const maxValue = d3.max(dataValues) || 0;
  
  const selectedMetric = document.getElementById('mapMetric').value;
  
  if (selectedMetric === 'positive_rate') {
    document.getElementById('mapTotal').textContent = `${avgValue.toFixed(1)}%`;
    document.getElementById('mapAverage').textContent = `${maxValue.toFixed(1)}%`;
  } else {
    document.getElementById('mapTotal').textContent = formatNumber(totalValue);
    document.getElementById('mapAverage').textContent = formatNumber(avgValue);
  }
  
  document.getElementById('mapJurisdictions').textContent = 
    Object.keys(regionData).filter(j => regionData[j].value > 0).length;
  
  document.getElementById('mapYears').textContent = 
    [...new Set(filteredMapData.map(d => d.YEAR))].length;
  
  summaryContainer.style.display = 'flex';
}

// Initialize map controls
function initializeMapControls() {
  if (!mapData.length) return;
  
  const years = [...new Set(mapData.map(d => d.YEAR))].sort();
  const jurisdictions = [...new Set(mapData.map(d => d.JURISDICTION))].sort();
  const methods = [...new Set(mapData.map(d => d.DETECTION_METHOD))].sort();
  
  console.log('Available Australian regions:', jurisdictions);
  console.log('Available years:', years);
  
  populateSelect(document.getElementById('mapYear'), years);
  populateSelect(document.getElementById('mapJurisdiction'), jurisdictions);
  populateSelect(document.getElementById('mapDetectionMethod'), methods);
  
  document.getElementById('mapMetric').value = 'positive_drug_tests';
  
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
  
  filteredMapData = mapData.filter(d => {
    return (selectedYear === '__all__' || d.YEAR === selectedYear) &&
           (selectedJurisdiction === '__all__' || d.JURISDICTION === selectedJurisdiction) &&
           (selectedMethod === '__all__' || d.DETECTION_METHOD === selectedMethod);
  });
  
  console.log('Australian regions filters updated:', filteredMapData.length, 'rows');
  renderChoropleth();
}

// Helper functions
function populateSelect(selectElement, options) {
  if (!selectElement) return;
  const currentValue = selectElement.value;
  selectElement.innerHTML = '<option value="__all__">All Regions</option>';
  options.forEach(option => {
    if (option && option !== '' && option !== 'undefined') {
      selectElement.innerHTML += `<option value="${option}">${option}</option>`;
    }
  });
  // Restore previous selection if possible
  if (options.includes(currentValue)) {
    selectElement.value = currentValue;
  }
}

function formatNumber(num) {
  return new Intl.NumberFormat().format(Math.round(num));
}

function updateMapStatus(type, message) {
  console.log(`Australian Regions Map Status [${type}]: ${message}`);
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  if (statusIndicator && statusText) {
    statusIndicator.className = 'status-indicator';
    statusText.textContent = message;
    
    if (type === 'loading') statusIndicator.classList.add('loading');
    if (type === 'success') statusIndicator.classList.add('success');
  }
}

function showMapEmptyState(message) {
  const emptyState = document.getElementById('mapEmptyState');
  const summaryContainer = document.getElementById('mapDataSummary');
  
  if (summaryContainer) summaryContainer.style.display = 'none';
  if (emptyState) {
    emptyState.style.display = 'block';
    emptyState.querySelector('h3').textContent = message || 'No Australian regions data to display';
  }
}

function hideMapEmptyState() {
  const emptyState = document.getElementById('mapEmptyState');
  if (emptyState) emptyState.style.display = 'none';
}

// Handle window resize
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (australiaRegions && filteredMapData.length > 0) {
      console.log('Window resized, re-rendering Australian regions map...');
      renderChoropleth();
    }
  }, 250);
});

// Make functions globally available
window.initMap = initMap;
window.renderChoropleth = renderChoropleth;
window.updateMapOverviewStats = updateMapOverviewStats;

console.log('Australian Regions Choropleth Map module loaded');