// line_chart.js - Fixed version with proper function scope
document.addEventListener('DOMContentLoaded', function () {
    console.log('Index chart initializing...');
    
    // Configuration - UPDATED PATH
    const CONFIG = {
        // Try different possible file paths
        DATA_FILE_PATHS: [
            'data/police_enforcement_2024_fines.xlsx',
            'police_enforcement_2024_fines.xlsx',
            '../data/police_enforcement_2024_fines.xlsx'
        ],
        CHART_COLORS: {
            primary: '#5ab2ff',
            secondary: '#b983ff',
            hover: '#8ecaff',
            grid: 'rgba(255, 255, 255, 0.1)',
            areaGradient: ['#5ab2ff20', '#5ab2ff01']
        },
        ANIMATION_DURATION: 1000
    };

    // Global variables
    let rawData = [];
    let currentChartType = 'fines';

    // Initialize the chart
    async function init() {
        try {
            updateChartStatus('loading', 'Loading fines data...');
            await loadData();
        } catch (error) {
            console.error('Error initializing chart:', error);
            updateChartStatus('error', `Failed to load data: ${error.message}`);
            showEmptyState('Failed to load fines data. Please check the console for details.');
        }
    }

    // Load and process data
    async function loadData() {
        let lastError = null;
        
        // Try each possible file path
        for (const filePath of CONFIG.DATA_FILE_PATHS) {
            try {
                console.log(`Trying to load data from: ${filePath}`);
                const response = await fetch(filePath);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.arrayBuffer();
                
                if (!data || data.byteLength === 0) {
                    throw new Error('Data file is empty');
                }
                
                console.log('XLSX loaded successfully, file size:', data.byteLength, 'bytes');
                
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                console.log('Raw data loaded:', jsonData.length, 'rows');
                console.log('Sample data:', jsonData.slice(0, 2));

                // Process and validate data - REMOVED 2023-2024 FILTER
                rawData = jsonData.map(d => ({
                    YEAR: d['YEAR'] ? d['YEAR'].toString().trim() : 'Unknown',
                    JURISDICTION: d['JURISDICTION'] ? d['JURISDICTION'].toString().trim() : 'Unknown',
                    LOCATION: d['LOCATION'] ? d['LOCATION'].toString().trim() : 'Unknown',
                    AGE_GROUP: d['AGE_GROUP'] ? d['AGE_GROUP'].toString().trim() : 'Unknown',
                    METRIC: d['METRIC'] ? d['METRIC'].toString().trim() : 'Unknown',
                    DETECTION_METHOD: d['DETECTION_METHOD'] ? d['DETECTION_METHOD'].toString().trim() : 'Unknown',
                    FINES: parseNumber(d['FINES']),
                    ARRESTS: parseNumber(d['ARRESTS']),
                    CHARGES: parseNumber(d['CHARGES'])
                })).filter(d => !isNaN(d.FINES) && !isNaN(d.ARRESTS) && !isNaN(d.CHARGES));

                if (rawData.length === 0) {
                    throw new Error('No valid data found after processing');
                }

                console.log('Data processed successfully:', rawData.length, 'rows');
                updateChartStatus('success', 'Fines data loaded successfully');
                
                // Initialize controls and render chart
                initializeControls();
                renderChart();
                return; // Success - exit the loop
                
            } catch (error) {
                console.warn(`Failed to load from ${filePath}:`, error.message);
                lastError = error;
                continue; // Try next path
            }
        }
        
        // If we get here, all paths failed
        throw lastError || new Error('Could not load data from any path');
    }

    // Parse number values safely
    function parseNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        const num = typeof value === 'string' ? 
            parseFloat(value.replace(/,/g, '')) : 
            parseFloat(value);
        return isNaN(num) ? 0 : Math.abs(num);
    }

    // Initialize chart controls
    function initializeControls() {
        const container = document.getElementById('newChart').closest('.card');
        if (!container) {
            console.error('Could not find chart container');
            return;
        }

        // Create controls HTML - ADDED YEAR FILTER BACK
        const controlsHTML = `
            <div class="controls">
                <div class="control-group">
                    <label for="finesGroupBy">Group By</label>
                    <select id="finesGroupBy">
                        <option value="YEAR">Year</option>
                        <option value="JURISDICTION">Jurisdiction</option>
                        <option value="LOCATION">Location</option>
                        <option value="AGE_GROUP">Age Group</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="finesYear">Year</label>
                    <select id="finesYear">
                        <option value="__all__">All Years</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="finesJurisdiction">Jurisdiction</label>
                    <select id="finesJurisdiction">
                        <option value="__all__">All Jurisdictions</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="finesLocation">Location</label>
                    <select id="finesLocation">
                        <option value="__all__">All Locations</option>
                    </select>
                </div>
                <div class="control-group">
                    <label for="finesAgeGroup">Age Group</label>
                    <select id="finesAgeGroup">
                        <option value="__all__">All Age Groups</option>
                    </select>
                </div>
            </div>
            <div class="data-summary" id="finesDataSummary" style="display: none;"></div>
        `;
        
        // Insert controls after the header
        const header = container.querySelector('.section-header');
        if (header) {
            header.insertAdjacentHTML('afterend', controlsHTML);
            
            // Populate filter options (including year filter)
            populateFilterOptions();
            
            // Add event listeners
            document.getElementById('finesGroupBy').addEventListener('change', renderChart);
            document.getElementById('finesYear').addEventListener('change', updateFinesFiltersAndChart);
            document.getElementById('finesJurisdiction').addEventListener('change', updateFinesFiltersAndChart);
            document.getElementById('finesLocation').addEventListener('change', updateFinesFiltersAndChart);
            document.getElementById('finesAgeGroup').addEventListener('change', updateFinesFiltersAndChart);
        }
    }

    // Populate filter options (including year filter)
    function populateFilterOptions() {
        if (!rawData.length) return;

        const years = [...new Set(rawData.map(d => d.YEAR))].sort();
        const jurisdictions = [...new Set(rawData.map(d => d.JURISDICTION))].sort();
        const locations = [...new Set(rawData.map(d => d.LOCATION))].sort();
        const ageGroups = [...new Set(rawData.map(d => d.AGE_GROUP))].sort();

        populateSelect(document.getElementById('finesYear'), years);
        populateSelect(document.getElementById('finesJurisdiction'), jurisdictions);
        populateSelect(document.getElementById('finesLocation'), locations);
        populateSelect(document.getElementById('finesAgeGroup'), ageGroups);
    }

    function populateSelect(selectElement, options) {
        if (!selectElement) return;
        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="__all__">All</option>';
        options.forEach(option => {
            if (option && option !== '' && option !== 'undefined') {
                selectElement.innerHTML += `<option value="${option}">${option}</option>`;
            }
        });
        // Restore previous value if possible
        if (options.includes(currentValue)) {
            selectElement.value = currentValue;
        }
    }

    // Update filters and chart
    function updateFinesFiltersAndChart() {
        renderChart();
    }

    // Render the line chart
    function renderChart() {
        const chartDiv = document.getElementById('newChart');
        if (!chartDiv) {
            console.error('Chart div not found');
            return;
        }

        const groupBy = document.getElementById('finesGroupBy')?.value || 'YEAR';

        // Clear previous chart
        chartDiv.innerHTML = '';

        if (!rawData || rawData.length === 0) {
            showEmptyState('No fines data available');
            return;
        }

        // Apply filters (including year filter)
        const selectedYear = document.getElementById('finesYear')?.value || '__all__';
        const selectedJurisdiction = document.getElementById('finesJurisdiction')?.value || '__all__';
        const selectedLocation = document.getElementById('finesLocation')?.value || '__all__';
        const selectedAgeGroup = document.getElementById('finesAgeGroup')?.value || '__all__';

        const filteredData = rawData.filter(d => {
            return (selectedYear === '__all__' || d.YEAR === selectedYear) &&
                   (selectedJurisdiction === '__all__' || d.JURISDICTION === selectedJurisdiction) &&
                   (selectedLocation === '__all__' || d.LOCATION === selectedLocation) &&
                   (selectedAgeGroup === '__all__' || d.AGE_GROUP === selectedAgeGroup);
        });

        if (filteredData.length === 0) {
            showEmptyState('No data matches the current filters');
            return;
        }

        // Prepare data for line chart
        const chartData = prepareLineChartData(filteredData, groupBy);
        
        if (chartData.length === 0) {
            showEmptyState('No data available for current selection');
            return;
        }

        // Hide empty state and show data summary
        hideEmptyState();
        updateDataSummary(filteredData, chartData);

        // Set up dimensions
        const margin = { top: 60, right: 40, bottom: 80, left: 80 };
        const width = chartDiv.offsetWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(chartDiv)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const xScale = d3.scalePoint()
            .domain(chartData.map(d => d.category))
            .range([0, width])
            .padding(0.5);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.value)])
            .nice()
            .range([height, 0]);

        // Create line generator
        const line = d3.line()
            .x(d => xScale(d.category))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX); // Smooth curve

        // Create area generator for filled area under line
        const area = d3.area()
            .x(d => xScale(d.category))
            .y0(height)
            .y1(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        // Add gradient for area fill
        const gradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "area-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", CONFIG.CHART_COLORS.areaGradient[0]);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", CONFIG.CHART_COLORS.areaGradient[1]);

        // Add grid lines
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat("")
            )
            .style("stroke", CONFIG.CHART_COLORS.grid)
            .style("stroke-dasharray", "2,2")
            .style("opacity", 0.3);

        // Add area under the line
        svg.append("path")
            .datum(chartData)
            .attr("class", "area")
            .attr("d", area)
            .style("fill", "url(#area-gradient)")
            .style("opacity", 0)
            .transition()
            .duration(CONFIG.ANIMATION_DURATION)
            .style("opacity", 1);

        // Add the line
        const path = svg.append("path")
            .datum(chartData)
            .attr("class", "line")
            .attr("d", line)
            .style("fill", "none")
            .style("stroke", CONFIG.CHART_COLORS.primary)
            .style("stroke-width", 3)
            .style("stroke-linecap", "round")
            .style("opacity", 0);

        // Animate the line drawing
        const totalLength = path.node().getTotalLength();
        
        path.style("stroke-dasharray", totalLength + " " + totalLength)
            .style("stroke-dashoffset", totalLength)
            .transition()
            .duration(CONFIG.ANIMATION_DURATION)
            .style("stroke-dashoffset", 0)
            .style("opacity", 1);

        // Add data points (circles)
        const dots = svg.selectAll(".dot")
            .data(chartData)
            .enter()
            .append("circle")
            .attr("class", "dot")
            .attr("cx", d => xScale(d.category))
            .attr("cy", d => yScale(d.value))
            .attr("r", 5)
            .style("fill", CONFIG.CHART_COLORS.primary)
            .style("stroke", "#fff")
            .style("stroke-width", 2)
            .style("cursor", "pointer")
            .style("opacity", 0)
            .on("mouseover", function(event, d) {
                // Highlight dot
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 7)
                    .style("fill", CONFIG.CHART_COLORS.hover);

                // Show tooltip
                showTooltip(svg, event, d, xScale, yScale);
            })
            .on("mouseout", function(event, d) {
                // Restore dot
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 5)
                    .style("fill", CONFIG.CHART_COLORS.primary);

                // Remove tooltip
                removeTooltip();
            });

        // Animate dots
        dots.transition()
            .duration(CONFIG.ANIMATION_DURATION)
            .delay((d, i) => i * 100)
            .style("opacity", 1);

        // Add value labels on dots
        const labels = svg.selectAll(".value-label")
            .data(chartData)
            .enter()
            .append("text")
            .attr("class", "value-label")
            .attr("x", d => xScale(d.category))
            .attr("y", d => yScale(d.value) - 15)
            .attr("text-anchor", "middle")
            .text(d => `$${formatNumber(d.value)}`)
            .style("fill", "#e7ecff")
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("pointer-events", "none")
            .style("opacity", 0);

        // Animate labels
        labels.transition()
            .duration(CONFIG.ANIMATION_DURATION)
            .delay((d, i) => i * 100 + 400)
            .style("opacity", 1);

        // Create axes
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => d3.format(',')(d));

        // Add X axis
        const xAxisGroup = svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        xAxisGroup.selectAll('text')
            .style('fill', '#a8b0c5')
            .style('font-size', '11px');

        // Add Y axis
        svg.append('g')
            .attr('class', 'y-axis')
            .call(yAxis)
            .selectAll('text')
            .style('fill', '#a8b0c5')
            .style('font-size', '11px');

        // Add axis labels
        svg.append('text')
            .attr('class', 'x-axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', width / 2)
            .attr('y', height + margin.bottom - 10)
            .text(groupBy)
            .style('fill', '#a8b0c5')
            .style('font-size', '12px');

        svg.append('text')
            .attr('class', 'y-axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -margin.left + 15)
            .text('Total Fines ($)')
            .style('fill', '#a8b0c5')
            .style('font-size', '12px');

        // Add chart title
        svg.append('text')
            .attr('class', 'chart-title')
            .attr('text-anchor', 'middle')
            .attr('x', width / 2)
            .attr('y', -20)
            .text(`Total Fines Trend by ${groupBy}`)
            .style('fill', '#e7ecff')
            .style('font-size', '16px')
            .style('font-weight', 'bold');
    }

    // Prepare data for line chart
    function prepareLineChartData(data, groupBy) {
        const groupedData = d3.rollup(
            data,
            v => d3.sum(v, d => d.FINES),
            d => d[groupBy] || 'Unknown'
        );

        return Array.from(groupedData, ([key, value]) => ({
            category: key,
            value: value
        })).sort((a, b) => {
            // Sort by category for better line visualization
            if (groupBy === 'YEAR') {
                return a.category.localeCompare(b.category);
            }
            return b.value - a.value; // For other groupings, sort by value descending
        });
    }

    // Show tooltip
    function showTooltip(svg, event, data, xScale, yScale) {
        const tooltip = svg.append('g')
            .attr('class', 'tooltip')
            .style('pointer-events', 'none');

        const tooltipText = `${data.category}: $${formatNumber(data.value)}`;
        const textElement = tooltip.append('text')
            .text(tooltipText)
            .style('fill', 'white')
            .style('font-size', '12px')
            .style('font-weight', 'bold');

        // Get text dimensions for background
        const bbox = textElement.node().getBBox();
        
        tooltip.insert('rect', 'text')
            .attr('x', bbox.x - 8)
            .attr('y', bbox.y - 4)
            .attr('width', bbox.width + 16)
            .attr('height', bbox.height + 8)
            .attr('fill', 'rgba(0, 0, 0, 0.8)')
            .attr('rx', 4)
            .attr('ry', 4);

        // Position tooltip
        const xPos = xScale(data.category);
        const yPos = yScale(data.value) - 30;
        
        tooltip.attr('transform', `translate(${xPos},${yPos})`)
            .style('opacity', 0)
            .transition()
            .duration(300)
            .style('opacity', 1);
    }

    // Remove tooltip
    function removeTooltip() {
        d3.selectAll('.tooltip')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .remove();
    }

    // Update data summary
    function updateDataSummary(filteredData, chartData) {
        const summaryContainer = document.getElementById('finesDataSummary');
        if (!summaryContainer) return;

        const totalFines = d3.sum(chartData, d => d.value);
        const rowCount = filteredData.length;
        const uniqueYears = [...new Set(filteredData.map(d => d.YEAR))].length;
        const uniqueJurisdictions = [...new Set(filteredData.map(d => d.JURISDICTION))].length;

        summaryContainer.innerHTML = `
            <div class="summary-item">
                <div class="summary-value">$${formatNumber(totalFines)}</div>
                <div class="summary-label">Total Fines</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${formatNumber(rowCount)}</div>
                <div class="summary-label">Rows</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${uniqueYears}</div>
                <div class="summary-label">Years</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${uniqueJurisdictions}</div>
                <div class="summary-label">Jurisdictions</div>
            </div>
        `;
        summaryContainer.style.display = 'flex';
    }

    // Update chart status
    function updateChartStatus(type, message) {
        console.log(`Fines Chart Status [${type}]: ${message}`);
        // You can add visual status indicators here if needed
    }

    // Show empty state
    function showEmptyState(message) {
        const chartDiv = document.getElementById('newChart');
        const emptyState = document.getElementById('finesEmptyState');
        const summaryContainer = document.getElementById('finesDataSummary');
        
        if (summaryContainer) {
            summaryContainer.style.display = 'none';
        }
        
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.querySelector('h3').textContent = message || 'No data to display';
        } else if (chartDiv) {
            chartDiv.innerHTML = `
                <div class="empty-state" id="finesEmptyState">
                    <div class="empty-icon">💰</div>
                    <h3>${message || 'No data to display'}</h3>
                    <p>No fines data matches the current criteria.</p>
                </div>
            `;
        }
    }

    // Hide empty state
    function hideEmptyState() {
        const emptyState = document.getElementById('finesEmptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }

    // Format numbers with commas
    function formatNumber(num) {
        return new Intl.NumberFormat().format(Math.round(num));
    }

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (rawData.length > 0) {
                renderChart();
            }
        }, 250);
    });

    // Initialize the chart
    init();

    // Make functions globally available
    window.initFinesChart = function() {
        console.log('Initializing fines chart...');
        if (rawData && rawData.length > 0) {
            renderChart();
        } else {
            console.log('No data available for fines chart, loading data...');
            init();
        }
    };

    window.renderChart = renderChart;
});