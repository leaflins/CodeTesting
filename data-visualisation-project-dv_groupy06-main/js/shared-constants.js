// Shared constants and configuration
const CONFIG = {
    // Update to the correct XLSX file path
    DATA_FILE_PATH: 'data/police_enforcement_2024_alcohol_drug_tests.xlsx',
    // More flexible column mapping to handle different column names
    COLUMN_MAPPING: {
        YEAR: ['YEAR', 'year', 'Year'],
        JURISDICTION: ['JURISDICTION', 'jurisdiction', 'Jurisdiction'],
        METRIC: ['METRIC', 'metric', 'Metric'],
        DETECTION_METHOD: ['DETECTION_METHOD', 'DETECTION METHOD', 'detection_method', 'Detection Method'],
        COUNT: ['COUNT', 'count', 'Count', 'COART']
    },
    DEFAULT_GROUP_BY: 'JURISDICTION',
    CHART_COLORS: {
        primary: '#5ab2ff',
        secondary: '#b983ff',
        success: '#4ade80',
        warning: '#fbbf24',
        breath: '#5ab2ff',
        drug: '#b983ff'
    }
};

// Utility functions
const Utils = {
    // Find the actual column name in the data
    findColumnName(headers, possibleNames) {
        for (const name of possibleNames) {
            if (headers.includes(name)) {
                return name;
            }
        }
        return null;
    },

    // Parse XLSX data
    parseXLSXData(workbook) {
        console.log('Available sheets:', workbook.SheetNames);
        
        // Use the first sheet by default
        const sheetName = workbook.SheetNames[0];
        console.log('Using sheet:', sheetName);
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
            throw new Error('XLSX file is empty');
        }

        // Parse headers (first row)
        const headers = jsonData[0].map(header => header ? header.toString().trim() : '');
        console.log('XLSX Headers found:', headers);

        // Map to standard column names
        const columnMapping = {};
        const standardColumns = Object.keys(CONFIG.COLUMN_MAPPING);
        
        for (const standardCol of standardColumns) {
            const actualName = this.findColumnName(headers, CONFIG.COLUMN_MAPPING[standardCol]);
            if (actualName) {
                columnMapping[standardCol] = actualName;
            } else {
                console.warn(`Column not found for: ${standardCol}. Looking for:`, CONFIG.COLUMN_MAPPING[standardCol]);
            }
        }

        console.log('Column mapping:', columnMapping);

        // Parse data rows
        const data = [];
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.length > 0) {
                const obj = {};
                standardColumns.forEach(standardCol => {
                    if (columnMapping[standardCol]) {
                        const index = headers.indexOf(columnMapping[standardCol]);
                        obj[standardCol] = row[index] ? row[index].toString().trim() : '';
                    } else {
                        obj[standardCol] = '';
                    }
                });
                data.push(obj);
            }
        }
        
        console.log('Processed data sample:', data.slice(0, 3));
        return data;
    },

    // Load XLSX file
    async loadXLSX(filePath) {
        try {
            console.log('Loading XLSX from:', filePath);
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load data file: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                throw new Error('Data file is empty');
            }
            
            console.log('XLSX loaded successfully, file size:', arrayBuffer.byteLength, 'bytes');
            
            // Parse XLSX
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            return this.parseXLSXData(workbook);
            
        } catch (error) {
            console.error('Error loading XLSX:', error);
            throw new Error(`Could not load data file: ${error.message}`);
        }
    },

    // Validate data structure
    validateData(data) {
        if (!data || data.length === 0) {
            throw new Error('No data found in file');
        }
        
        const firstRow = data[0];
        const standardColumns = Object.keys(CONFIG.COLUMN_MAPPING);
        const missingColumns = standardColumns.filter(col => 
            !firstRow.hasOwnProperty(col) || firstRow[col] === undefined
        );
        
        if (missingColumns.length > 0) {
            console.error('First row data:', firstRow);
            console.error('Missing columns:', missingColumns);
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}. Available columns: ${Object.keys(firstRow).join(', ')}`);
        }
        
        console.log('Data validation passed. Columns found:', Object.keys(firstRow));
        return true;
    },

    // Format number with commas
    formatNumber(num) {
        return parseInt(num || 0).toLocaleString();
    },

    // Format large numbers with K, M suffixes
    formatLargeNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return this.formatNumber(num);
    }
};