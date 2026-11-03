// Global variables
let rawData = [];
let filteredData = [];

// D3.js chart variables
let svg, xScale, yScale, xAxis, yAxis;
const margin = { top: 60, right: 40, bottom: 80, left: 80 };
let width, height;

// DOM elements
let groupBySelect, yearSelect, jurisdictionSelect, metricSelect, methodSelect;
let chartDiv, emptyState, dataSummary, statusIndicator, statusText;

// Initialize the app
function init() {
    console.log('Initializing application...');
    
    // Initialize DOM elements
    initializeDOMElements();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize D3.js chart container
    initializeChartContainer();
    
    // Load XLSX data
    loadXLSXData();
}

// Initialize DOM elements
function initializeDOMElements() {
    groupBySelect = document.getElementById('groupBy');
    yearSelect = document.getElementById('year');
    jurisdictionSelect = document.getElementById('jurisdiction');
    metricSelect = document.getElementById('metric');
    methodSelect = document.getElementById('method');
    chartDiv = document.getElementById('chart');
    emptyState = document.getElementById('emptyState');
    dataSummary = document.getElementById('dataSummary');
    statusIndicator = document.getElementById('statusIndicator');
    statusText = document.getElementById('statusText');
    
    // Check if all elements exist
    const elements = [groupBySelect, yearSelect, jurisdictionSelect, metricSelect, methodSelect, chartDiv, emptyState, dataSummary, statusIndicator, statusText];
    const missingElements = elements.filter(el => !el);
    
    if (missingElements.length > 0) {
        console.error('Missing DOM elements:', missingElements);
        throw new Error('Required DOM elements not found');
    }
    
    console.log('All DOM elements found successfully');
}

// Initialize D3.js chart container
function initializeChartContainer() {
    // Clear any existing SVG
    d3.select(chartDiv).selectAll("svg").remove();
    
    // Get container dimensions
    width = chartDiv.clientWidth - margin.left - margin.right;
    height = 520 - margin.top - margin.bottom;
    
    // Create SVG
    svg = d3.select(chartDiv)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    console.log('D3.js chart container initialized');
}

// Set up event listeners
function setupEventListeners() {
    groupBySelect.addEventListener('change', updateChart);
    yearSelect.addEventListener('change', updateFiltersAndChart);
    jurisdictionSelect.addEventListener('change', updateFiltersAndChart);
    metricSelect.addEventListener('change', updateFiltersAndChart);
    methodSelect.addEventListener('change', updateFiltersAndChart);
    
    // Handle window resize
    window.addEventListener('resize', debounce(() => {
        initializeChartContainer();
        if (filteredData.length > 0) {
            updateChart();
        }
    }, 250));
    
    console.log('Event listeners set up');
}

// Debounce function for resize events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load XLSX data
async function loadXLSXData() {
    updateStatus('loading', 'Loading data...');
    
    try {
        console.log('Starting XLSX data load from:', CONFIG.DATA_FILE_PATH);
        
        const xlsxData = await Utils.loadXLSX(CONFIG.DATA_FILE_PATH);
        console.log('XLSX data loaded, row count:', xlsxData.length);
        
        if (xlsxData.length === 0) {
            throw new Error('No data found in XLSX file');
        }
        
        Utils.validateData(xlsxData);
        
        // Process data - ensure COUNT is numeric
        rawData = xlsxData.map((row, index) => {
            // Convert COUNT to number
            let countValue;
            if (typeof row.COUNT === 'string') {
                countValue = parseInt(row.COUNT.replace(/,/g, '')); // Remove commas from numbers like "1,000"
            } else {
                countValue = parseInt(row.COUNT);
            }
            
            if (isNaN(countValue)) {
                console.warn(`Invalid COUNT value at row ${index}:`, row.COUNT, 'Full row:', row);
                countValue = 0;
            }
            
            const processedRow = {
                YEAR: (row.YEAR || '').toString().trim(),
                JURISDICTION: (row.JURISDICTION || '').toString().trim(),
                METRIC: (row.METRIC || '').toString().trim(),
                DETECTION_METHOD: (row.DETECTION_METHOD || '').toString().trim(),
                COUNT: Math.abs(countValue) // Use absolute value
            };
            
            return processedRow;
        }).filter(row => {
            // Filter out invalid rows
            const isValid = row.YEAR && 
                           row.JURISDICTION && 
                           row.METRIC && 
                           row.DETECTION_METHOD && 
                           !isNaN(row.COUNT) && 
                           row.COUNT >= 0;
            
            if (!isValid) {
                console.warn('Filtering out invalid row:', row);
            }
            return isValid;
        });
        
        console.log('Data processing complete. Valid rows:', rawData.length);
        console.log('Sample of processed data:', rawData.slice(0, 5));
        
        if (rawData.length === 0) {
            throw new Error('No valid data found after processing. Please check your XLSX file format and data.');
        }
        
        filteredData = [...rawData];
        
        updateStatus('success', `Data loaded successfully (${rawData.length} rows)`);
        
        // Initialize filters and chart
        initializeFilters();
        updateChart();
        updateOverview();
        updateStoryboard(); // Initialize storyboard
        
    } catch (error) {
        console.error('Error loading XLSX data:', error);
        updateStatus('error', `Error: ${error.message}`);
        showEmptyState(error.message);
    }
}

// Update status indicator
function updateStatus(type, message) {
    statusIndicator.className = 'status-indicator';
    statusText.textContent = message;
    
    switch (type) {
        case 'loading':
            statusIndicator.classList.add('loading');
            break;
        case 'success':
            statusIndicator.classList.add('success');
            break;
        case 'error':
            // Keep default (gray) for errors
            break;
    }
    
    console.log(`Status: ${type} - ${message}`);
}

// Show empty state
function showEmptyState(errorMessage = '') {
    chartDiv.style.display = 'none';
    emptyState.style.display = 'block';
    emptyState.innerHTML = errorMessage 
        ? `Error loading data: ${errorMessage}<br>Please check the browser console for details.`
        : 'No data available or no rows match the current filters.';
    dataSummary.style.display = 'none';
    
    // Clear overview
    clearOverview();
}

// Initialize filter dropdowns
function initializeFilters() {
    console.log('Initializing filters with data:', rawData.length, 'rows');
    
    // Get unique values for each filter
    const years = [...new Set(rawData.map(d => d.YEAR))].sort();
    const jurisdictions = [...new Set(rawData.map(d => d.JURISDICTION))].sort();
    const metrics = [...new Set(rawData.map(d => d.METRIC))].sort();
    const methods = [...new Set(rawData.map(d => d.DETECTION_METHOD))].sort();
    
    console.log('Filter options - Years:', years, 'Jurisdictions:', jurisdictions, 'Metrics:', metrics, 'Methods:', methods);
    
    // Populate year filter
    populateSelect(yearSelect, years);
    
    // Populate jurisdiction filter
    populateSelect(jurisdictionSelect, jurisdictions);
    
    // Populate metric filter
    populateSelect(metricSelect, metrics);
    
    // Populate method filter
    populateSelect(methodSelect, methods);
    
    console.log('Filters initialized successfully');
}

// Helper function to populate select elements
function populateSelect(selectElement, options) {
    selectElement.innerHTML = '<option value="__all__">All</option>';
    options.forEach(option => {
        if (option && option !== '' && option !== 'undefined') { // Filter out empty values
            selectElement.innerHTML += `<option value="${option}">${option}</option>`;
        }
    });
}

// Update filters and chart with animation
function updateFiltersAndChart() {
    console.log('Updating filters and chart with animations...');
    
    // Apply filters
    const selectedYear = yearSelect.value;
    const selectedJurisdiction = jurisdictionSelect.value;
    const selectedMetric = metricSelect.value;
    const selectedMethod = methodSelect.value;
    
    filteredData = rawData.filter(d => {
        return (selectedYear === '__all__' || d.YEAR === selectedYear) &&
               (selectedJurisdiction === '__all__' || d.JURISDICTION === selectedJurisdiction) &&
               (selectedMetric === '__all__' || d.METRIC === selectedMetric) &&
               (selectedMethod === '__all__' || d.DETECTION_METHOD === selectedMethod);
    });
    
    console.log('Filtered data:', filteredData.length, 'rows');
    
    // Add a small delay to show the transition better
    setTimeout(() => {
        updateChart();
        updateOverview();
        updateStoryboard(); // Update storyboard with new data
    }, 50);
}

// Update the main chart with D3.js
function updateChart() {
    console.log('Updating D3.js chart with', filteredData.length, 'rows');
    
    if (!filteredData || filteredData.length === 0) {
        showEmptyState();
        return;
    }
    
    chartDiv.style.display = 'block';
    emptyState.style.display = 'none';
    dataSummary.style.display = 'flex';
    
    const groupBy = groupBySelect.value;
    
    // Group data by selected field using D3.js
    const groupedData = d3.rollup(
        filteredData,
        v => d3.sum(v, d => d.COUNT),
        d => d[groupBy] || 'Unknown'
    );
    
    // Convert to array for D3.js
    const chartData = Array.from(groupedData, ([key, value]) => ({
        category: key,
        count: value
    })).sort((a, b) => b.count - a.count); // Sort by count descending
    
    console.log('Chart data:', chartData);
    
    // Update data summary
    updateDataSummary(chartData.map(d => d.count));
    
    // Check if this is the initial load or a filter change
    const isInitialLoad = !svg.selectAll(".bar").size();
    
    if (isInitialLoad) {
        // Use entrance animation for first load
        createD3BarChart(chartData, groupBy);
    } else {
        // Use smooth transitions for filter changes
        updateChartWithTransitions(chartData, groupBy);
    }
}

// Create D3.js bar chart with animations
function createD3BarChart(data, groupBy) {
    // Clear previous chart content but keep SVG
    svg.selectAll("*").remove();
    
    // Update dimensions in case of resize
    width = chartDiv.clientWidth - margin.left - margin.right;
    height = 520 - margin.top - margin.bottom;
    
    d3.select(chartDiv).select("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    
    // Create scales
    xScale = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, width])
        .padding(0.3);
    
    yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .nice()
        .range([height, 0]);
    
    // Create axes
    xAxis = d3.axisBottom(xScale);
    yAxis = d3.axisLeft(yScale)
        .tickFormat(d => d3.format(',')(d));
    
    // Add X axis with animation
    const xAxisGroup = svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .style("opacity", 0);
    
    xAxisGroup.call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)")
        .style("fill", "#a8b0c5")
        .style("font-size", "12px");
    
    // Add Y axis with animation
    const yAxisGroup = svg.append("g")
        .attr("class", "y-axis")
        .style("opacity", 0);
    
    yAxisGroup.call(yAxis)
        .selectAll("text")
        .style("fill", "#a8b0c5")
        .style("font-size", "12px");
    
    // Add axis labels with animation
    const xAxisLabel = svg.append("text")
        .attr("class", "x-axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .text(groupBy)
        .style("fill", "#a8b0c5")
        .style("font-size", "14px")
        .style("opacity", 0);
    
    const yAxisLabel = svg.append("text")
        .attr("class", "y-axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .text("Total COUNT")
        .style("fill", "#a8b0c5")
        .style("font-size", "14px")
        .style("opacity", 0);
    
    // Add chart title with animation
    const chartTitle = svg.append("text")
        .attr("class", "chart-title")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", -20)
        .text(`Total COUNT by ${groupBy}`)
        .style("fill", "#e7ecff")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .style("opacity", 0);
    
    // Animate axes and labels
    animateAxesAndLabels(xAxisGroup, yAxisGroup, xAxisLabel, yAxisLabel, chartTitle);
    
    // Create bars with entrance animation
    createAnimatedBars(data);
    
    console.log('D3.js animated chart created successfully');
}

// Animate axes and labels
function animateAxesAndLabels(xAxisGroup, yAxisGroup, xAxisLabel, yAxisLabel, chartTitle) {
    // Animate chart title
    chartTitle.transition()
        .duration(800)
        .delay(200)
        .style("opacity", 1)
        .ease(d3.easeCubicOut);
    
    // Animate axes
    xAxisGroup.transition()
        .duration(1000)
        .delay(400)
        .style("opacity", 1)
        .ease(d3.easeCubicOut);
    
    yAxisGroup.transition()
        .duration(1000)
        .delay(400)
        .style("opacity", 1)
        .ease(d3.easeCubicOut);
    
    // Animate axis labels
    xAxisLabel.transition()
        .duration(800)
        .delay(600)
        .style("opacity", 1)
        .ease(d3.easeCubicOut);
    
    yAxisLabel.transition()
        .duration(800)
        .delay(600)
        .style("opacity", 1)
        .ease(d3.easeCubicOut);
}

// Create animated bars
function createAnimatedBars(data) {
    // Create bars with staggered entrance animation
    const bars = svg.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.category))
        .attr("y", height) // Start from bottom
        .attr("width", xScale.bandwidth())
        .attr("height", 0) // Start with zero height
        .attr("fill", CONFIG.CHART_COLORS.primary)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            // Highlight bar on hover with animation
            d3.select(this)
                .transition()
                .duration(300)
                .attr("fill", CONFIG.CHART_COLORS.secondary)
                .attr("y", yScale(d.count) - 5) // Lift slightly
                .attr("height", height - yScale(d.count) + 5);
            
            showTooltip(d);
        })
        .on("mouseout", function(event, d) {
            // Restore bar with animation
            d3.select(this)
                .transition()
                .duration(300)
                .attr("fill", CONFIG.CHART_COLORS.primary)
                .attr("y", yScale(d.count))
                .attr("height", height - yScale(d.count));
            
            removeTooltip();
        });
    
    // Animate bars growing from bottom
    bars.transition()
        .duration(1200)
        .delay((d, i) => i * 100) // Staggered delay
        .ease(d3.easeElasticOut)
        .attr("y", d => yScale(d.count))
        .attr("height", d => height - yScale(d.count));
    
    // Add value labels with animation
    const labels = svg.selectAll(".bar-label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", height) // Start from bottom
        .attr("text-anchor", "middle")
        .text(d => d3.format(',')(d.count))
        .style("fill", "#e7ecff")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("opacity", 0);
    
    // Animate labels appearing
    labels.transition()
        .duration(800)
        .delay((d, i) => i * 100 + 800) // Delay after bars
        .attr("y", d => yScale(d.count) - 8)
        .style("opacity", 1)
        .ease(d3.easeCubicOut);
}

// Show tooltip with animation
function showTooltip(d) {
    const tooltip = svg.append("g")
        .attr("class", "tooltip")
        .style("pointer-events", "none")
        .style("opacity", 0);
    
    tooltip.append("rect")
        .attr("x", xScale(d.category) + xScale.bandwidth() / 2 - 50)
        .attr("y", yScale(d.count) - 45)
        .attr("width", 100)
        .attr("height", 25)
        .attr("fill", "rgba(0, 0, 0, 0.9)")
        .attr("rx", 6)
        .attr("ry", 6);
    
    tooltip.append("text")
        .attr("x", xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", yScale(d.count) - 28)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .text(`${d.category}: ${d3.format(',')(d.count)}`);
    
    // Animate tooltip entrance
    tooltip.transition()
        .duration(300)
        .style("opacity", 1)
        .ease(d3.easeCubicOut);
}

// Remove tooltip with animation
function removeTooltip() {
    svg.selectAll(".tooltip")
        .transition()
        .duration(200)
        .style("opacity", 0)
        .remove();
}

// Smooth transition to new data
function updateChartWithTransitions(data, groupBy) {
    // Update scales with new domain
    xScale.domain(data.map(d => d.category));
    yScale.domain([0, d3.max(data, d => d.count)]).nice();
    
    // Update axes with transition
    svg.select(".x-axis")
        .transition()
        .duration(1000)
        .call(xAxis);
    
    svg.select(".y-axis")
        .transition()
        .duration(1000)
        .call(yAxis);
    
    // Update chart title
    svg.select(".chart-title")
        .transition()
        .duration(600)
        .style("opacity", 0)
        .on("end", function() {
            d3.select(this)
                .text(`Total COUNT by ${groupBy}`)
                .transition()
                .duration(600)
                .style("opacity", 1);
        });
    
    // Update bars with smooth transitions
    const bars = svg.selectAll(".bar")
        .data(data, d => d.category);
    
    // Remove old bars
    bars.exit()
        .transition()
        .duration(600)
        .attr("y", height)
        .attr("height", 0)
        .style("opacity", 0)
        .remove();
    
    // Update existing bars
    bars.transition()
        .duration(1000)
        .delay(200)
        .ease(d3.easeCubicOut)
        .attr("x", d => xScale(d.category))
        .attr("width", xScale.bandwidth())
        .attr("y", d => yScale(d.count))
        .attr("height", d => height - yScale(d.count))
        .attr("fill", CONFIG.CHART_COLORS.primary);
    
    // Add new bars with animation
    bars.enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.category))
        .attr("y", height) // Start from bottom
        .attr("width", xScale.bandwidth())
        .attr("height", 0) // Start with zero height
        .attr("fill", CONFIG.CHART_COLORS.primary)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(300)
                .attr("fill", CONFIG.CHART_COLORS.secondary)
                .attr("y", yScale(d.count) - 5)
                .attr("height", height - yScale(d.count) + 5);
            showTooltip(d);
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .transition()
                .duration(300)
                .attr("fill", CONFIG.CHART_COLORS.primary)
                .attr("y", yScale(d.count))
                .attr("height", height - yScale(d.count));
            removeTooltip();
        })
        .transition()
        .duration(1000)
        .delay((d, i) => i * 100 + 200)
        .ease(d3.easeElasticOut)
        .attr("y", d => yScale(d.count))
        .attr("height", d => height - yScale(d.count));
    
    // Update labels
    const labels = svg.selectAll(".bar-label")
        .data(data, d => d.category);
    
    // Remove old labels
    labels.exit()
        .transition()
        .duration(400)
        .style("opacity", 0)
        .remove();
    
    // Update existing labels
    labels.transition()
        .duration(800)
        .delay(400)
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.count) - 8)
        .text(d => d3.format(',')(d.count))
        .style("opacity", 1);
    
    // Add new labels
    labels.enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", height) // Start from bottom
        .attr("text-anchor", "middle")
        .text(d => d3.format(',')(d.count))
        .style("fill", "#e7ecff")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("opacity", 0)
        .transition()
        .duration(800)
        .delay((d, i) => i * 100 + 600)
        .attr("y", d => yScale(d.count) - 8)
        .style("opacity", 1)
        .ease(d3.easeCubicOut);
}

// Update data summary
function updateDataSummary(values) {
    const totalCount = values.reduce((sum, val) => sum + val, 0);
    const uniqueYears = [...new Set(filteredData.map(d => d.YEAR))].length;
    const uniqueJurisdictions = [...new Set(filteredData.map(d => d.JURISDICTION))].length;
    
    document.getElementById('summaryTotal').textContent = Utils.formatNumber(totalCount);
    document.getElementById('summaryRows').textContent = Utils.formatNumber(filteredData.length);
    document.getElementById('summaryYears').textContent = uniqueYears;
    document.getElementById('summaryJurisdictions').textContent = uniqueJurisdictions;
}

// Update overview content
function updateOverview() {
    if (!filteredData || filteredData.length === 0) {
        // Clear overview if no data
        clearOverview();
        return;
    }
    
    // Overview stats
    const totalCount = filteredData.reduce((sum, d) => sum + d.COUNT, 0);
    const uniqueYears = [...new Set(filteredData.map(d => d.YEAR))].length;
    const uniqueJurisdictions = [...new Set(filteredData.map(d => d.JURISDICTION))].length;
    const uniqueMetrics = [...new Set(filteredData.map(d => d.METRIC))].length;
    const uniqueMethods = [...new Set(filteredData.map(d => d.DETECTION_METHOD))].length;
    
    document.getElementById('sb-total').textContent = Utils.formatNumber(totalCount);
    document.getElementById('sb-rows').textContent = Utils.formatNumber(filteredData.length);
    document.getElementById('sb-years').textContent = uniqueYears;
    document.getElementById('sb-jurs').textContent = uniqueJurisdictions;
    document.getElementById('sb-metrics').textContent = uniqueMetrics;
    document.getElementById('sb-methods').textContent = uniqueMethods;
}

// Clear overview
function clearOverview() {
    document.getElementById('sb-total').textContent = '–';
    document.getElementById('sb-rows').textContent = '–';
    document.getElementById('sb-years').textContent = '–';
    document.getElementById('sb-jurs').textContent = '–';
    document.getElementById('sb-metrics').textContent = '–';
    document.getElementById('sb-methods').textContent = '–';
}

// Update storyboard with insights from the data
function updateStoryboard() {
    if (!rawData || rawData.length === 0) return;
    
    // Calculate story insights
    const breathTestsData = rawData.filter(d => d.METRIC === 'breath_tests_conducted');
    const drugTestsData = rawData.filter(d => d.METRIC === 'drug_tests_conducted');
    
    // Breath tests story
    const totalBreathTests = breathTestsData.reduce((sum, d) => sum + d.COUNT, 0);
    const breathTestsByYear = d3.rollup(breathTestsData, v => d3.sum(v, d => d.COUNT), d => d.YEAR);
    const breathTestsTrend = calculateTrend(Array.from(breathTestsByYear.values()));
    
    document.getElementById('breath-tests-story').innerHTML = 
        `Over <strong>${breathTestsByYear.size} years</strong>, <strong>${Utils.formatLargeNumber(totalBreathTests)}</strong> breath tests were conducted. ${breathTestsTrend}`;
    
    // Drug tests story
    const totalDrugTests = drugTestsData.reduce((sum, d) => sum + d.COUNT, 0);
    const drugTestsByYear = d3.rollup(drugTestsData, v => d3.sum(v, d => d.COUNT), d => d.YEAR);
    const drugTestsTrend = calculateTrend(Array.from(drugTestsByYear.values()));
    
    document.getElementById('drug-tests-story').innerHTML = 
        `<strong>${Utils.formatLargeNumber(totalDrugTests)}</strong> drug tests conducted. ${drugTestsTrend} Drug testing became more prominent after 2015.`;
    
    // Jurisdiction story
    const jurisdictionData = d3.rollup(rawData, v => d3.sum(v, d => d.COUNT), d => d.JURISDICTION);
    const sortedJurisdictions = Array.from(jurisdictionData.entries()).sort((a, b) => b[1] - a[1]);
    const topJurisdiction = sortedJurisdictions[0];
    const lowestJurisdiction = sortedJurisdictions[sortedJurisdictions.length - 1];
    
    document.getElementById('jurisdiction-story').innerHTML = 
        `<strong>${topJurisdiction[0]}</strong> leads with ${Utils.formatLargeNumber(topJurisdiction[1])} total tests, while <strong>${lowestJurisdiction[0]}</strong> has ${Utils.formatLargeNumber(lowestJurisdiction[1])}.`;
    
    // Trends story
    const yearlyData = d3.rollup(rawData, v => d3.sum(v, d => d.COUNT), d => d.YEAR);
    const sortedYears = Array.from(yearlyData.entries()).sort((a, b) => a[0] - b[0]);
    const peakYear = Array.from(yearlyData.entries()).reduce((max, curr) => curr[1] > max[1] ? curr : max);
    const recentYear = sortedYears[sortedYears.length - 1];
    
    document.getElementById('trends-story').innerHTML = 
        `Peak testing occurred in <strong>${peakYear[0]}</strong> with ${Utils.formatLargeNumber(peakYear[1])} tests. Recent data shows ${Utils.formatLargeNumber(recentYear[1])} tests in ${recentYear[0]}.`;
}

// Calculate trend direction and magnitude
function calculateTrend(values) {
    if (values.length < 2) return "Insufficient data for trend analysis.";
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = ((avgSecond - avgFirst) / avgFirst) * 100;
    
    if (Math.abs(change) < 10) return "Testing levels have remained relatively stable.";
    if (change > 20) return "Significant increase in testing over time.";
    if (change > 10) return "Moderate growth in testing volume.";
    if (change < -20) return "Substantial decrease in testing activities.";
    if (change < -10) return "Gradual decline in testing numbers.";
    
    return "Testing patterns show minor fluctuations.";
}

// Initialize the app when the page loads
window.addEventListener('DOMContentLoaded', init);