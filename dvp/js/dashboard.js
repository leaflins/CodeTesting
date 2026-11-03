// dashboard.js - Updated version with map section integration
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    
    // Section navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.dashboard-section');
    
    // Track which charts have been initialized
    const initializedCharts = {
        overview: false,
        enforcement: false,
        fines: false,
        map: false
    };

    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');
            console.log(`Switching to section: ${targetSection}`);
            
            // Update active nav button
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Show target section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `${targetSection}-section`) {
                    section.classList.add('active');
                    
                    // Initialize or refresh charts when section becomes active
                    setTimeout(() => {
                        initializeSectionCharts(targetSection);
                    }, 100);
                }
            });
        });
    });

    // Initialize charts for the active section
    function initializeSectionCharts(section) {
        console.log(`Initializing charts for: ${section}`);
        
        switch(section) {
            case 'overview':
                if (!initializedCharts.overview) {
                    console.log('Initializing overview section...');
                    // Overview doesn't have D3 charts, but you can update stats
                    if (typeof updateOverview === 'function') {
                        updateOverview();
                    } else {
                        console.log('updateOverview function not available');
                    }
                    
                    if (typeof updateStoryboard === 'function') {
                        updateStoryboard();
                    } else {
                        console.log('updateStoryboard function not available');
                    }
                    initializedCharts.overview = true;
                }
                break;
                
            case 'enforcement':
                console.log('Initializing enforcement section...');
                // Always try to initialize enforcement chart when section is activated
                setTimeout(() => {
                    if (typeof initEnforcementChart === 'function') {
                        console.log('Calling initEnforcementChart...');
                        initEnforcementChart();
                    } else if (typeof updateChart === 'function') {
                        console.log('Calling updateChart directly...');
                        updateChart();
                    } else {
                        console.error('No enforcement chart functions available');
                        // Try to load data if functions aren't available
                        if (typeof loadXLSXData === 'function') {
                            console.log('Attempting to load data...');
                            loadXLSXData();
                        }
                    }
                }, 200);
                initializedCharts.enforcement = true;
                break;
                
            case 'fines':
                console.log('Initializing fines section...');
                // Always try to initialize fines chart when section is activated
                setTimeout(() => {
                    if (typeof initFinesChart === 'function') {
                        console.log('Calling initFinesChart...');
                        initFinesChart();
                    } else if (typeof renderChart === 'function') {
                        console.log('Calling renderChart directly...');
                        renderChart();
                    } else {
                        console.error('No fines chart functions available');
                        // Try to initialize if init function exists
                        if (typeof init === 'function') {
                            console.log('Calling init for fines chart...');
                            init();
                        }
                    }
                }, 200);
                initializedCharts.fines = true;
                break;

            case 'map':
                console.log('Initializing map section...');
                // Always try to initialize map when section is activated
                setTimeout(() => {
                    if (typeof initMap === 'function') {
                        console.log('Calling initMap...');
                        initMap();
                    } else if (typeof renderMap === 'function') {
                        console.log('Calling renderMap directly...');
                        renderMap();
                    } else {
                        console.error('No map functions available');
                        // Try to initialize map data
                        console.log('Map functions not found, checking for map data...');
                        if (typeof loadMapData === 'function') {
                            console.log('Loading map data directly...');
                            loadMapData();
                        }
                    }
                }, 200);
                initializedCharts.map = true;
                break;
        }
    }

    // Quick filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.id === 'resetFilters') {
                // Reset all filters
                document.getElementById('year').value = '__all__';
                document.getElementById('jurisdiction').value = '__all__';
                document.getElementById('metric').value = '__all__';
                document.getElementById('method').value = '__all__';
                
                // Trigger filter update
                if (typeof updateFiltersAndChart === 'function') {
                    updateFiltersAndChart();
                } else {
                    console.error('updateFiltersAndChart function not available');
                }
            } else {
                // Apply specific filter
                const filterType = this.getAttribute('data-filter');
                const filterValue = this.getAttribute('data-value');
                
                // Find and set the corresponding select element
                const selectElement = document.getElementById(filterType);
                if (selectElement) {
                    selectElement.value = filterValue;
                    
                    // Trigger filter update
                    if (typeof updateFiltersAndChart === 'function') {
                        updateFiltersAndChart();
                    } else {
                        console.error('updateFiltersAndChart function not available');
                    }
                }
            }
        });
    });
    
    // Refresh data button
    const refreshButton = document.getElementById('refreshData');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            console.log('Refresh button clicked');
            
            // Show loading state
            const statusIndicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');
            if (statusIndicator && statusText) {
                statusIndicator.className = 'status-indicator loading';
                statusText.textContent = 'Refreshing all data...';
            }
            
            // Reset initialization flags
            Object.keys(initializedCharts).forEach(key => {
                initializedCharts[key] = false;
            });
            
            // Reload data based on current active section
            const activeSection = document.querySelector('.nav-btn.active');
            if (activeSection) {
                const sectionName = activeSection.getAttribute('data-section');
                
                switch(sectionName) {
                    case 'overview':
                    case 'enforcement':
                        if (typeof loadXLSXData === 'function') {
                            loadXLSXData();
                        }
                        break;
                    case 'fines':
                        if (typeof loadData === 'function') {
                            loadData();
                        } else if (typeof init === 'function') {
                            init();
                        }
                        break;
                    case 'map':
                        if (typeof initMap === 'function') {
                            initMap();
                        } else if (typeof loadMapData === 'function') {
                            loadMapData();
                        }
                        break;
                }
            } else {
                // Default to loading main data
                if (typeof loadXLSXData === 'function') {
                    loadXLSXData();
                }
            }
        });
    }
    
    // Function to check if charts are ready
    function checkChartsReady() {
        console.log('Checking chart availability:');
        console.log('- initEnforcementChart:', typeof initEnforcementChart);
        console.log('- initFinesChart:', typeof initFinesChart);
        console.log('- initMap:', typeof initMap);
        console.log('- updateChart:', typeof updateChart);
        console.log('- renderChart:', typeof renderChart);
        console.log('- renderMap:', typeof renderMap);
        console.log('- loadXLSXData:', typeof loadXLSXData);
        console.log('- loadMapData:', typeof loadMapData);
    }
    
    // Initialize the first section as active
    if (sections.length > 0) {
        console.log('Setting first section as active...');
        sections[0].classList.add('active');
        
        // Check chart availability after a short delay
        setTimeout(() => {
            checkChartsReady();
            
            // Initialize charts for the first section
            initializeSectionCharts('overview');
        }, 500);
    }
    
    // Add global error handler for chart issues
    window.addEventListener('error', function(e) {
        console.error('Global error caught:', e.error);
        console.error('In file:', e.filename, 'at line:', e.lineno);
        
        // Update status to show error
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        if (statusIndicator && statusText) {
            statusIndicator.className = 'status-indicator';
            statusText.textContent = `Error: ${e.error?.message || 'Unknown error occurred'}`;
        }
        
        // If it's a chart-related error, try to reinitialize
        if (e.error && (e.error.message.includes('chart') || e.error.message.includes('render') || e.error.message.includes('map'))) {
            console.log('Chart error detected, attempting recovery...');
            
            const activeSection = document.querySelector('.nav-btn.active');
            if (activeSection) {
                const sectionName = activeSection.getAttribute('data-section');
                console.log(`Reinitializing ${sectionName} section...`);
                
                // Reset the initialization flag for this section
                initializedCharts[sectionName] = false;
                
                // Reinitialize the section
                initializeSectionCharts(sectionName);
            }
        }
    });
    
    // Handle section visibility changes for better performance
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const section = mutation.target;
                if (section.classList.contains('dashboard-section')) {
                    if (section.classList.contains('active')) {
                        // Section became active - ensure it's properly initialized
                        const sectionId = section.id.replace('-section', '');
                        if (!initializedCharts[sectionId]) {
                            console.log(`Section ${sectionId} became active but not initialized, initializing now...`);
                            initializeSectionCharts(sectionId);
                        }
                    }
                }
            }
        });
    });
    
    // Observe all dashboard sections
    sections.forEach(section => {
        observer.observe(section, { attributes: true });
    });
    
    // Add keyboard shortcuts for navigation
    document.addEventListener('keydown', function(e) {
        // Alt + Number shortcuts for navigation
        if (e.altKey && e.key >= '1' && e.key <= '4') {
            e.preventDefault();
            const sectionIndex = parseInt(e.key) - 1;
            const sectionButtons = Array.from(navButtons);
            if (sectionButtons[sectionIndex]) {
                sectionButtons[sectionIndex].click();
            }
        }
        
        // F5 or Ctrl+R to refresh data
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
            if (refreshButton) {
                refreshButton.click();
            }
        }
    });
    
    // Add resize handler for responsive charts
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const activeSection = document.querySelector('.nav-btn.active');
            if (activeSection) {
                const sectionName = activeSection.getAttribute('data-section');
                console.log(`Window resized, refreshing ${sectionName} section...`);
                
                switch(sectionName) {
                    case 'enforcement':
                        if (typeof updateChart === 'function') {
                            updateChart();
                        }
                        break;
                    case 'fines':
                        if (typeof renderChart === 'function') {
                            renderChart();
                        }
                        break;
                    case 'map':
                        if (typeof renderMap === 'function') {
                            renderMap();
                        }
                        break;
                }
            }
        }, 250);
    });
    
    // Add utility function to export current view data
    window.exportCurrentData = function() {
        const activeSection = document.querySelector('.nav-btn.active');
        if (!activeSection) return;
        
        const sectionName = activeSection.getAttribute('data-section');
        let dataToExport = null;
        let filename = 'road_safety_data';
        
        switch(sectionName) {
            case 'enforcement':
                dataToExport = filteredData || rawData;
                filename = 'enforcement_data';
                break;
            case 'fines':
                // Assuming fines data is available in line_chart.js
                if (typeof rawData !== 'undefined') {
                    dataToExport = rawData;
                    filename = 'fines_data';
                }
                break;
            case 'map':
                if (typeof filteredMapData !== 'undefined') {
                    dataToExport = filteredMapData;
                    filename = 'map_data';
                }
                break;
        }
        
        if (dataToExport && dataToExport.length > 0) {
            try {
                const csvContent = convertToCSV(dataToExport);
                downloadCSV(csvContent, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
                console.log(`Exported ${dataToExport.length} rows from ${sectionName} section`);
            } catch (error) {
                console.error('Error exporting data:', error);
                alert('Error exporting data. Check console for details.');
            }
        } else {
            alert('No data available to export from current section.');
        }
    };
    
    // Helper function to convert data to CSV
    function convertToCSV(data) {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        
        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                // Handle values that might contain commas or quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csvRows.push(values.join(','));
        }
        
        return csvRows.join('\n');
    }
    
    // Helper function to download CSV
    function downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Add export button to status card if not already present
    function addExportButton() {
        const statusCard = document.querySelector('.status-card');
        if (statusCard && !document.getElementById('exportData')) {
            const exportButton = document.createElement('button');
            exportButton.id = 'exportData';
            exportButton.className = 'refresh-btn';
            exportButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Export
            `;
            exportButton.title = 'Export current section data (Alt+E)';
            exportButton.style.marginLeft = '10px';
            exportButton.addEventListener('click', window.exportCurrentData);
            
            statusCard.querySelector('.status').insertAdjacentElement('afterend', exportButton);
        }
    }
    
    // Add keyboard shortcut for export
    
    // (Export button removed: it is no longer added to the page.)
    
    // Make initialization function available globally for debugging
    window.initializeSectionCharts = initializeSectionCharts;
    window.checkChartsReady = checkChartsReady;
    window.getInitializedCharts = () => initializedCharts;
    
    console.log('Dashboard initialization complete');
    
    // Add performance monitoring
    if (typeof PerformanceObserver !== 'undefined') {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.entryType === 'navigation') {
                    console.log('Page loaded in:', entry.loadEventEnd - entry.fetchStart, 'ms');
                }
            });
        });
        observer.observe({ entryTypes: ['navigation'] });
    }
});