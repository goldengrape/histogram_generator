// --- START OF FILE script.js ---

// Helper functions for statistics (unchanged)
function getPercentile(data, percentile) {
    if (!data || data.length === 0) return undefined;
    const sortedData = [...data].sort((a, b) => a - b);
    if (sortedData.length === 1) return sortedData[0];
    const index = (percentile / 100) * (sortedData.length - 1);
    if (Number.isInteger(index)) {
        return sortedData[index];
    } else {
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        return sortedData[lower] * (upper - index) + sortedData[upper] * (index - lower);
    }
}
function getMean(data) {
    if (!data || data.length === 0) return undefined;
    return data.reduce((sum, val) => sum + val, 0) / data.length;
}
function getStdDev(data, mean) {
    if (!data || data.length === 0 || mean === undefined) return undefined;
    if (data.length === 1) return 0;
    const sqDiffs = data.map(value => Math.pow(value - mean, 2));
    const variance = sqDiffs.reduce((sum, val) => sum + val, 0) / data.length;
    return Math.sqrt(variance);
}
function getIQR(q1, q3) {
    if (q1 === undefined || q3 === undefined) return undefined;
    return q3 - q1;
}
function formatStatValue(value) {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    if (Math.abs(value - Math.round(value)) < 0.0001 && Math.abs(value) < 1e6 ) {
        return Math.round(value).toString();
    }
    if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
        return parseFloat(value).toPrecision(2);
    }
    return parseFloat(value).toFixed(2);
}

function addStatisticLineShape(shapes, statValue, color, dashStyle, width,
                               histogramBinEdges, countsForThisSide,
                               actualYMin, actualYMax, numberOfBins,
                               side 
                              ) {
    if (statValue === undefined || width <= 0) return;
    if (statValue < actualYMin || statValue > actualYMax) return;
    
    let binIndex = -1;
    for (let i = 0; i < numberOfBins; i++) {
        const lowerEdge = histogramBinEdges[i];
        const upperEdge = histogramBinEdges[i+1];
        if (statValue >= lowerEdge && statValue < upperEdge) {
            binIndex = i;
            break;
        }
        if (statValue === actualYMax && i === numberOfBins - 1) {
            binIndex = i;
            break;
        }
    }
    
    if (binIndex !== -1 && binIndex < countsForThisSide.length) {
        const countInBinForSide = countsForThisSide[binIndex];
        if (countInBinForSide > 0) {
            let xStart, xEnd;
            if (side === 'full') {
                xStart = -countInBinForSide;
                xEnd = countInBinForSide;
            } else if (side === 'left') {
                xStart = -countInBinForSide;
                xEnd = 0;
            } else { // side === 'right'
                xStart = 0;
                xEnd = countInBinForSide;
            }

            shapes.push({
                type: 'line',
                x0: xStart, y0: statValue,
                x1: xEnd,   y1: statValue,
                line: { color: color, width: width, dash: dashStyle },
                layer: 'above'
            });
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const dataInputLeftEl = document.getElementById('dataInputLeft');
    const dataInputRightEl = document.getElementById('dataInputRight');
    const numBinsInput = document.getElementById('numBins');
    const chartTitleInput = document.getElementById('chartTitle');
    const yAxisMinInput = document.getElementById('yAxisMin');
    const yAxisMaxInput = document.getElementById('yAxisMax');
    const yAxisLabelInput = document.getElementById('yAxisLabel');
    const xAxisLabelInput = document.getElementById('xAxisLabel');
    const xAxisMinInput = document.getElementById('xAxisMin');
    const xAxisMaxInput = document.getElementById('xAxisMax');
    const barColorLeftInput = document.getElementById('barColorLeft');
    const barColorRightInput = document.getElementById('barColorRight');
    const sampleDataLeftSelect = document.getElementById('sampleDataLeft');
    const sampleDataRightSelect = document.getElementById('sampleDataRight');
    const clearDataLeftBtn = document.getElementById('clearDataLeftBtn');
    const clearDataRightBtn = document.getElementById('clearDataRightBtn');

    // Statistic line controls
    const showQ1LineCheckbox = document.getElementById('showQ1Line');
    const q1LineWidthInput = document.getElementById('q1LineWidth');
    const q1LineColorInput = document.getElementById('q1LineColor');
    const showMedianLineCheckbox = document.getElementById('showMedianLine');
    const medianLineWidthInput = document.getElementById('medianLineWidth');
    const medianLineColorInput = document.getElementById('medianLineColor');
    const showQ3LineCheckbox = document.getElementById('showQ3Line');
    const q3LineWidthInput = document.getElementById('q3LineWidth');
    const q3LineColorInput = document.getElementById('q3LineColor');
    const showMeanLineCheckbox = document.getElementById('showMeanLine');
    const meanLineWidthInput = document.getElementById('meanLineWidth');
    const meanLineColorInput = document.getElementById('meanLineColor');
    const showMeanMinusStdDevLineCheckbox = document.getElementById('showMeanMinusStdDevLine');
    const meanMinusStdDevLineWidthInput = document.getElementById('meanMinusStdDevLineWidth');
    const meanMinusStdDevLineColorInput = document.getElementById('meanMinusStdDevLineColor');
    const showMeanPlusStdDevLineCheckbox = document.getElementById('showMeanPlusStdDevLine');
    const meanPlusStdDevLineWidthInput = document.getElementById('meanPlusStdDevLineWidth');
    const meanPlusStdDevLineColorInput = document.getElementById('meanPlusStdDevLineColor');

    const generateChartBtn = document.getElementById('generateChartBtn');
    const chartDiv = document.getElementById('chartDiv');
    const downloadButtonsDiv = document.querySelector('.download-buttons');
    const downloadPngBtn = document.getElementById('downloadPngBtn');
    const downloadSvgBtn = document.getElementById('downloadSvgBtn');
    const errorMessageDiv = document.getElementById('errorMessage');
    
    const statisticsOutputContainer = document.getElementById('statisticsOutputContainer');
    const statisticsOutputLeftDiv = document.getElementById('statisticsOutputLeft');
    const statisticsOutputRightDiv = document.getElementById('statisticsOutputRight');
    const statsTitleLeftEl = document.getElementById('statsTitleLeft');

    // Define sample data sets
    const preGeneratedSampleData = {
        // For Left Side
        basic: "8.78, 10.87, 11.96, 10.08, 10.41, 6.59, 8.91, 7.25, 8.67, 10.12, 10.11, 6.95, 14.70, 10.95, 8.82, 11.34, 10.95, 10.14, 9.09, 9.02, 11.03, 5.05, 7.19, 14.63, 8.12, 9.98, 9.91, 14.02, 9.04, 6.05, 10.89, 14.96, 11.04, 6.42, 12.74, 12.87, 10.47, 3.95, 14.65, 9.38, 7.10, 9.39, 14.06, 12.39, 15.95, 11.95, 6.06, 12.77, 12.78, 12.03, 10.94, 9.49, 12.18, 9.18, 8.98, 7.46, 10.62, 5.36, 9.32, 7.17, 7.39, 10.01, 9.75, 1.07, 3.81, 5.67, 9.96, 13.24, 10.69, 10.30, 9.34, 10.07, 10.14, 11.91, 8.75, 10.24, 7.80, 11.81, 9.34, 13.72, 13.92, 11.48, 8.28, 7.49, 8.30, 9.56, 8.57, 4.68, 4.33, 11.76, 5.87, 8.87, 8.61, 8.39, 16.45, 9.48, 6.13, 3.31, 9.58, 11.48",
        normal: "10.1, 9.5, 11.2, 8.8, 10.5, 12.1, 9.9, 10.3, 7.5, 11.8, 10.0, 9.2, 10.8, 11.5, 8.2, 9.7, 10.6, 10.2, 9.0, 11.0, 13.0, 7.0, 10.4, 9.6, 11.3, 8.7, 10.9, 12.5, 9.3, 10.7, 8.5, 11.1, 9.8, 11.7, 8.3, 10.1, 11.9, 9.1, 12.2, 8.9, 10.5, 11.6, 9.4, 10.3, 8.6, 11.4, 12.8, 7.8, 10.7, 9.9",
        bimodal: "2,3,2.5,3.5,4,3.2,2.8,1.9,3.7,4.1,10,11,10.5,11.5,12,11.2,10.8,9.9,11.7,12.1,2.2,3.8,10.3,11.9,3.1,2.9,11.1,10.1,3.3,10.7",
        skewed_right: "1,1.5,2,1.2,1.8,2.5,3,2.2,1.3,1.7,2.8,3.5,4,5,4.5,6,3.2,2.1,1.6,1.1,2.3,3.3,4.2,5.5,7,8,1.4,1.9,2.7,3.8,5.2,6.5,9,10",
        with_outliers: "8,9,8.5,9.5,7.5,10,8.2,9.3,8.8,7.9,9.1,8.6,9.2,1,25,8.1,9.4,8.3,8.9,9.0,-2,30,8.7,9.6",
        // For Right Side (can be same or different)
        basic_alt: "7.5, 8.2, 9.1, 10.5, 11.3, 12.0, 6.8, 9.5, 10.1, 13.5, 5.5, 14.1, 8.8, 11.9, 9.0, 10.2, 12.5, 7.1, 10.8, 11.5, 13.0, 6.0, 9.9, 12.8",
        normal_shifted: "12.1, 11.5, 13.2, 10.8, 12.5, 14.1, 11.9, 12.3, 9.5, 13.8, 12.0, 11.2, 12.8, 13.5, 10.2, 11.7, 12.6, 12.2, 11.0, 13.0, 15.0, 9.0",
        bimodal_alt: "5,6,5.5,6.5,7,6.2,5.8,4.9,6.7,7.1,13,14,13.5,14.5,15,14.2,13.8,12.9,14.7,15.1",
        skewed_left: "10,9.5,9,9.8,9.2,8.5,8,8.8,9.7,9.3,8.2,7.5,7,6,6.5,5,7.8,8.9,9.4,9.9,8.7,7.7,6.8,5.5,4,3",
        uniform: "1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15",
        empty: "" // Special key to clear input
    };
    
    sampleDataLeftSelect.addEventListener('change', (event) => {
        const selectedKey = event.target.value;
        if (preGeneratedSampleData.hasOwnProperty(selectedKey)) {
            dataInputLeftEl.value = preGeneratedSampleData[selectedKey];
        }
    });

    sampleDataRightSelect.addEventListener('change', (event) => {
        const selectedKey = event.target.value;
        if (preGeneratedSampleData.hasOwnProperty(selectedKey)) {
            dataInputRightEl.value = preGeneratedSampleData[selectedKey];
        }
    });

    clearDataLeftBtn.addEventListener('click', () => {
        dataInputLeftEl.value = "";
        sampleDataLeftSelect.value = ""; 
    });
    clearDataRightBtn.addEventListener('click', () => {
        dataInputRightEl.value = "";
        sampleDataRightSelect.value = "";
    });
    
    // Set default data for left input and sync dropdown
    dataInputLeftEl.value = preGeneratedSampleData.basic;
    sampleDataLeftSelect.value = "basic";
    // Set default color for right bar to match left bar (already done in HTML, but good practice if dynamic)
    barColorRightInput.value = barColorLeftInput.value;


    function displayError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        chartDiv.innerHTML = '';
        downloadButtonsDiv.style.display = 'none';
        statisticsOutputContainer.style.display = 'none';
    }

    function clearError() {
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.display = 'none';
    }

    function parseData(text) {
        const values = text.trim().split(/[\n,]+/)
            .map(s => s.trim())
            .filter(s => s !== "")
            .map(parseFloat)
            .filter(n => !isNaN(n));
        return values;
    }
    
    function calculateHistogramForSingleDataset(data, numBins, yMinForBins, yMaxForBins) {
        const counts = new Array(numBins).fill(0);
        const binEdges = [];
        
        if (yMaxForBins <= yMinForBins) {
            if (yMaxForBins === yMinForBins) {
                yMinForBins -= 0.5;
                yMaxForBins += 0.5;
            } else {
                 console.error("Invalid Y-axis range for histogram: yMax <= yMin.", yMinForBins, yMaxForBins);
                 throw new Error("Y轴最大值必须大于最小值。");
            }
        }
        if (numBins <= 0) throw new Error("Bin 数量必须为正。");

        const binWidth = (yMaxForBins - yMinForBins) / numBins;
        if (binWidth <= 0 || !isFinite(binWidth)) {
            console.error("Error: Bin width is zero or invalid.", yMinForBins, yMaxForBins, numBins);
            throw new Error("无法计算有效的 bin 宽度。请检查 Y 轴范围和 Bin 数量。");
        }

        for (let i = 0; i <= numBins; i++) {
            binEdges.push(yMinForBins + i * binWidth);
        }

        if (data.length > 0) {
            for (const value of data) {
                if (value >= yMinForBins && value <= yMaxForBins) {
                    let binIndex = Math.floor((value - yMinForBins) / binWidth);
                    if (value === yMaxForBins) binIndex = numBins - 1;
                    binIndex = Math.max(0, Math.min(binIndex, numBins - 1));
                    counts[binIndex]++;
                }
            }
        }
        
        const binCenters = binEdges.slice(0, -1).map(edge => edge + binWidth / 2);
        return { counts, binEdges, binCenters, actualYMin: yMinForBins, actualYMax: yMaxForBins };
    }

    function calculateStatsObject(data) {
        const stats = {n: data.length};
        if (stats.n === 0) return stats;
        stats.min = Math.min(...data);
        stats.max = Math.max(...data);
        stats.q1 = getPercentile(data, 25);
        stats.median = getPercentile(data, 50);
        stats.q3 = getPercentile(data, 75);
        stats.mean = getMean(data);
        stats.stdDev = getStdDev(data, stats.mean);
        stats.iqr = getIQR(stats.q1, stats.q3);
        if (stats.mean !== undefined && stats.stdDev !== undefined) {
            stats.meanMinusStdDev = stats.mean - stats.stdDev;
            stats.meanPlusStdDev = stats.mean + stats.stdDev;
        }
        return stats;
    }

    function displayStatistics(stats, idPrefix) {
        document.getElementById('stat' + idPrefix + 'N').textContent = formatStatValue(stats.n);
        document.getElementById('stat' + idPrefix + 'Min').textContent = formatStatValue(stats.min);
        document.getElementById('stat' + idPrefix + 'Max').textContent = formatStatValue(stats.max);
        document.getElementById('stat' + idPrefix + 'Q1').textContent = formatStatValue(stats.q1);
        document.getElementById('stat' + idPrefix + 'Median').textContent = formatStatValue(stats.median);
        document.getElementById('stat' + idPrefix + 'Q3').textContent = formatStatValue(stats.q3);
        document.getElementById('stat' + idPrefix + 'Mean').textContent = formatStatValue(stats.mean);
        document.getElementById('stat' + idPrefix + 'StdDev').textContent = formatStatValue(stats.stdDev);
        document.getElementById('stat' + idPrefix + 'IQR').textContent = formatStatValue(stats.iqr);
    }

    generateChartBtn.addEventListener('click', () => {
        clearError();
        const parsedDataLeft = parseData(dataInputLeftEl.value);
        const parsedDataRight = parseData(dataInputRightEl.value);
        const hasRightData = parsedDataRight.length > 0;

        if (parsedDataLeft.length === 0) {
            displayError("左侧数据为空或无效。请输入数字，用换行或逗号分隔。");
            return;
        }

        const numBins = parseInt(numBinsInput.value, 10);
        if (isNaN(numBins) || numBins <= 0) {
            displayError("Bin 数量必须是一个正整数。");
            return;
        }

        const yAxisMinUserStr = yAxisMinInput.value;
        const yAxisMaxUserStr = yAxisMaxInput.value;
        let finalYMin, finalYMax;
        const combinedDataForYRange = hasRightData ? [...parsedDataLeft, ...parsedDataRight] : parsedDataLeft;
        const dataMinOverall = Math.min(...combinedDataForYRange);
        const dataMaxOverall = Math.max(...combinedDataForYRange);

        finalYMin = (yAxisMinUserStr !== "" && !isNaN(parseFloat(yAxisMinUserStr))) ? parseFloat(yAxisMinUserStr) : dataMinOverall;
        finalYMax = (yAxisMaxUserStr !== "" && !isNaN(parseFloat(yAxisMaxUserStr))) ? parseFloat(yAxisMaxUserStr) : dataMaxOverall;

        if (finalYMin >= finalYMax) {
            if (dataMinOverall === dataMaxOverall) {
                finalYMin = dataMinOverall - 0.5;
                finalYMax = dataMaxOverall + 0.5;
            } else {
                finalYMin = dataMinOverall;
                finalYMax = dataMaxOverall;
                if (finalYMin === finalYMax) {
                     finalYMin -= 0.5;
                     finalYMax += 0.5;
                }
            }
        }
         if (finalYMin >= finalYMax) {
            finalYMin = (isNaN(finalYMin) ? 0 : finalYMin) - 0.5;
            finalYMax = (isNaN(finalYMax) ? 1 : finalYMax) + 0.5;
             if (finalYMin >= finalYMax) { finalYMin=0; finalYMax=1; }
        }

        try {
            const histogramDataLeft = calculateHistogramForSingleDataset(parsedDataLeft, numBins, finalYMin, finalYMax);
            let histogramDataRight;
             if (hasRightData) {
                histogramDataRight = calculateHistogramForSingleDataset(parsedDataRight, numBins, finalYMin, finalYMax);
            } else {
                histogramDataRight = { ...histogramDataLeft }; 
            }

            const countsLeft = histogramDataLeft.counts;
            const countsRight = histogramDataRight.counts;
            const binCenters = histogramDataLeft.binCenters;
            const commonBinEdges = histogramDataLeft.binEdges;
            const commonActualYMin = histogramDataLeft.actualYMin;
            const commonActualYMax = histogramDataLeft.actualYMax;

            const chartTitle = chartTitleInput.value || '离散小提琴图';
            const yAxisLabel = yAxisLabelInput.value || '数值';
            const xAxisLabelText = xAxisLabelInput.value || '频数';
            const xAxisMinUser = xAxisMinInput.value !== "" ? parseFloat(xAxisMinInput.value) : undefined;
            const xAxisMaxUser = xAxisMaxInput.value !== "" ? parseFloat(xAxisMaxInput.value) : undefined;
            
            const colorLeft = barColorLeftInput.value;
            const colorRight = hasRightData ? barColorRightInput.value : colorLeft; // Use left color if mirroring
            const barOpacity = 0.7;

            const traceLeftVis = {
                y: binCenters, x: countsLeft.map(c => -c), type: 'bar', orientation: 'h', name: '左侧频数',
                marker: { color: colorLeft, opacity: barOpacity, line: { color: 'rgba(0,0,0,0.6)', width: 0.5 } },
                hoverinfo: 'y+text', text: countsLeft.map(String)
            };
            const traceRightVis = {
                y: binCenters, x: countsRight, type: 'bar', orientation: 'h', name: hasRightData ? '右侧频数' : '频数',
                marker: { color: colorRight, opacity: barOpacity, line: { color: 'rgba(0,0,0,0.6)', width: 0.5 } },
                hoverinfo: 'y+x'
            };
            
            const maxCountLeft = Math.max(0, ...countsLeft);
            const maxCountRight = Math.max(0, ...countsRight);
            let xRange;
            if (xAxisMinUser !== undefined && xAxisMaxUser !== undefined && xAxisMinUser < xAxisMaxUser) {
                xRange = [xAxisMinUser, xAxisMaxUser];
            } else {
                const overallMaxCount = Math.max(maxCountLeft, maxCountRight);
                xRange = overallMaxCount > 0 ? [-overallMaxCount * 1.15, overallMaxCount * 1.15] : [-1, 1];
                if (hasRightData) {
                     xRange = [-maxCountLeft * 1.15, maxCountRight * 1.15];
                }
                 if (xRange[0] === 0 && xRange[1] === 0 && overallMaxCount === 0) xRange = [-1,1];
            }

            const tickLayout = {};
            const [xMinRange, xMaxRange] = xRange;
            const maxAbsXVal = Math.max(Math.abs(xMinRange), Math.abs(xMaxRange));
            let dtick;
            if (maxAbsXVal === 0 && xMinRange === 0 && xMaxRange === 0) { dtick = 0.5; } // Special case for all zero counts leading to [0,0] range
            else if (maxAbsXVal === 0) { dtick = 1; } // Should not happen if range is fixed above
            else {
                const targetNumTicksOnSide = Math.max(1, Math.min(4, Math.floor(maxAbsXVal / 2))); // Dynamic ticks
                const power = Math.pow(10, Math.floor(Math.log10(maxAbsXVal / targetNumTicksOnSide)));
                const mantissa = (maxAbsXVal / targetNumTicksOnSide) / power;
                if (mantissa < 1.5) dtick = 1 * power;
                else if (mantissa < 3) dtick = 2 * power;
                else if (mantissa < 7) dtick = 5 * power;
                else dtick = 10 * power;
                if (dtick <= 0) dtick = 1;
            }
             if (dtick < 1 && countsLeft.every(c => Number.isInteger(c)) && countsRight.every(c => Number.isInteger(c))) {
                dtick = Math.max(dtick,1); // Ensure integer ticks if counts are integers and dtick is small
            }

            const generatedTickVals = [];
            if (xMinRange <= 0 && xMaxRange >= 0) { generatedTickVals.push(0); } 
            if (dtick > 0) { 
                for (let v = dtick; v <= xMaxRange + 1e-9; v += dtick) { generatedTickVals.push(parseFloat(v.toPrecision(10))); if (generatedTickVals.length > 50) break; } 
                for (let v = -dtick; v >= xMinRange - 1e-9; v -= dtick) { generatedTickVals.push(parseFloat(v.toPrecision(10))); if (generatedTickVals.length > 100) break; }
            }
            tickLayout.tickvals = [...new Set(generatedTickVals)].sort((a, b) => a - b);
            
            if (tickLayout.tickvals.length < 2 && (xMinRange !== 0 || xMaxRange !== 0)) { // Need at least two ticks, or one if it's 0 and range covers 0
                 let tempTicks = [xMinRange, xMaxRange];
                 if (xMinRange < 0 && xMaxRange > 0 && !tempTicks.includes(0)) tempTicks.push(0);
                 tickLayout.tickvals = [...new Set(tempTicks)].map(t => parseFloat(t.toPrecision(10))).sort((a, b) => a - b);
            }
             if (xRange[0] === 0 && xRange[1] === 0 && tickLayout.tickvals.every(t => t===0) && tickLayout.tickvals.length <=1 ) {
                tickLayout.tickvals = [-1, -0.5, 0, 0.5, 1];
             }

            tickLayout.ticktext = tickLayout.tickvals.map(v => {
                const absV = Math.abs(v);
                if (v === 0) return "0"; // Handle zero explicitly
                let numDecimalPlaces = 0;
                if (dtick > 0 && dtick < 1) { const dtickStr = dtick.toString(); if (dtickStr.includes('.')) { numDecimalPlaces = dtickStr.split('.')[1].length; }}
                const vStr = v.toString(); if (vStr.includes('.')) { numDecimalPlaces = Math.max(numDecimalPlaces, vStr.split('.')[1].length); }
                
                // Avoid scientific notation for very small numbers unless necessary
                if (absV > 0 && absV < Math.pow(10, -Math.min(numDecimalPlaces, 3) -1 ) ) { return absV.toPrecision(1); }
                // Format with appropriate decimal places, ensuring very small numbers are not rounded to 0
                const fixed = parseFloat(absV.toFixed(Math.min(Math.max(numDecimalPlaces,2), 5))); // At least 2, max 5 decimals
                return fixed.toString();
            });

            const statsLeft = calculateStatsObject(parsedDataLeft);
            let statsRight = null;
            if (hasRightData) {
                statsRight = calculateStatsObject(parsedDataRight);
            }

            const shapes = [];
            const lineSide = hasRightData ? 'left' : 'full';
            
            if (showQ1LineCheckbox.checked) addStatisticLineShape(shapes, statsLeft.q1, q1LineColorInput.value, 'dot', parseFloat(q1LineWidthInput.value) || 2, commonBinEdges, countsLeft, commonActualYMin, commonActualYMax, numBins, lineSide);
            if (showMedianLineCheckbox.checked) addStatisticLineShape(shapes, statsLeft.median, medianLineColorInput.value, 'solid', parseFloat(medianLineWidthInput.value) || 3, commonBinEdges, countsLeft, commonActualYMin, commonActualYMax, numBins, lineSide);
            if (showQ3LineCheckbox.checked) addStatisticLineShape(shapes, statsLeft.q3, q3LineColorInput.value, 'dot', parseFloat(q3LineWidthInput.value) || 2, commonBinEdges, countsLeft, commonActualYMin, commonActualYMax, numBins, lineSide);
            if (showMeanLineCheckbox.checked) addStatisticLineShape(shapes, statsLeft.mean, meanLineColorInput.value, 'dashdot', parseFloat(meanLineWidthInput.value) || 2, commonBinEdges, countsLeft, commonActualYMin, commonActualYMax, numBins, lineSide);
            if (showMeanMinusStdDevLineCheckbox.checked && statsLeft.meanMinusStdDev !== undefined) addStatisticLineShape(shapes, statsLeft.meanMinusStdDev, meanMinusStdDevLineColorInput.value, 'longdash', parseFloat(meanMinusStdDevLineWidthInput.value) || 2, commonBinEdges, countsLeft, commonActualYMin, commonActualYMax, numBins, lineSide);
            if (showMeanPlusStdDevLineCheckbox.checked && statsLeft.meanPlusStdDev !== undefined) addStatisticLineShape(shapes, statsLeft.meanPlusStdDev, meanPlusStdDevLineColorInput.value, 'longdash', parseFloat(meanPlusStdDevLineWidthInput.value) || 2, commonBinEdges, countsLeft, commonActualYMin, commonActualYMax, numBins, lineSide);

            if (hasRightData && statsRight) {
                if (showQ1LineCheckbox.checked) addStatisticLineShape(shapes, statsRight.q1, q1LineColorInput.value, 'dot', parseFloat(q1LineWidthInput.value) || 2, commonBinEdges, countsRight, commonActualYMin, commonActualYMax, numBins, 'right');
                if (showMedianLineCheckbox.checked) addStatisticLineShape(shapes, statsRight.median, medianLineColorInput.value, 'solid', parseFloat(medianLineWidthInput.value) || 3, commonBinEdges, countsRight, commonActualYMin, commonActualYMax, numBins, 'right');
                if (showQ3LineCheckbox.checked) addStatisticLineShape(shapes, statsRight.q3, q3LineColorInput.value, 'dot', parseFloat(q3LineWidthInput.value) || 2, commonBinEdges, countsRight, commonActualYMin, commonActualYMax, numBins, 'right');
                if (showMeanLineCheckbox.checked) addStatisticLineShape(shapes, statsRight.mean, meanLineColorInput.value, 'dashdot', parseFloat(meanLineWidthInput.value) || 2, commonBinEdges, countsRight, commonActualYMin, commonActualYMax, numBins, 'right');
                if (showMeanMinusStdDevLineCheckbox.checked && statsRight.meanMinusStdDev !== undefined) addStatisticLineShape(shapes, statsRight.meanMinusStdDev, meanMinusStdDevLineColorInput.value, 'longdash', parseFloat(meanMinusStdDevLineWidthInput.value) || 2, commonBinEdges, countsRight, commonActualYMin, commonActualYMax, numBins, 'right');
                if (showMeanPlusStdDevLineCheckbox.checked && statsRight.meanPlusStdDev !== undefined) addStatisticLineShape(shapes, statsRight.meanPlusStdDev, meanPlusStdDevLineColorInput.value, 'longdash', parseFloat(meanPlusStdDevLineWidthInput.value) || 2, commonBinEdges, countsRight, commonActualYMin, commonActualYMax, numBins, 'right');
            }
            
            const layout = {
                title: chartTitle,
                yaxis: { title: yAxisLabel, range: [commonActualYMin, commonActualYMax], zeroline: false },
                xaxis: {
                    title: xAxisLabelText, range: xRange, zeroline: true, zerolinecolor: '#999', zerolinewidth: 1,
                    tickvals: tickLayout.tickvals, ticktext: tickLayout.ticktext
                },
                barmode: 'overlay', bargap: 0, showlegend: false,
                plot_bgcolor: '#FFFFFF', paper_bgcolor: '#FFFFFF',
                margin: { l: 70, r: 50, b: 70, t: 80, pad: 4 },
                shapes: shapes
            };

            Plotly.newPlot(chartDiv, [traceLeftVis, traceRightVis], layout, {responsive: true, displaylogo: false});
            
            displayStatistics(statsLeft, "Left");
            statisticsOutputLeftDiv.style.display = 'block'; 
            if (hasRightData && statsRight) {
                displayStatistics(statsRight, "Right");
                statisticsOutputRightDiv.style.display = 'block';
                statsTitleLeftEl.textContent = '左侧数据统计';
            } else {
                statisticsOutputRightDiv.style.display = 'none';
                statsTitleLeftEl.textContent = '数据统计信息';
            }
            statisticsOutputContainer.style.display = 'flex';
            downloadButtonsDiv.style.display = 'flex';

        } catch (error) {
            displayError(`生成图表时出错: ${error.message}`);
            statisticsOutputContainer.style.display = 'none';
            console.error("Chart generation error:", error);
        }
    });

    downloadPngBtn.addEventListener('click', () => {
        const title = chartTitleInput.value || 'discrete_violin_plot';
        const filename = title.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        Plotly.downloadImage(chartDiv, {format: 'png', width: 1000, height: 750, filename: filename});
    });

    downloadSvgBtn.addEventListener('click', () => {
        const title = chartTitleInput.value || 'discrete_violin_plot';
        const filename = title.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        Plotly.downloadImage(chartDiv, {format: 'svg', width: 1000, height: 750, filename: filename});
    });
    
    generateChartBtn.click(); 
});
// --- END OF FILE script.js ---