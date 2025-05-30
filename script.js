// --- START OF FILE script.js ---

// Helper functions for statistics
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
    if (data.length === 1) return 0; // StdDev of a single point is 0

    const sqDiffs = data.map(value => Math.pow(value - mean, 2));
    // For sample standard deviation, divide by (data.length - 1). For population, divide by data.length.
    // Plotly typically uses population for its internal calculations or doesn't specify,
    // for visual consistency using data.length might be fine for this tool.
    // If sample std dev is strictly needed, change to data.length - 1 (and handle data.length < 2)
    const variance = sqDiffs.reduce((sum, val) => sum + val, 0) / data.length; // Population variance
    return Math.sqrt(variance);
}

function getIQR(q1, q3) {
    if (q1 === undefined || q3 === undefined) return undefined;
    return q3 - q1;
}

function formatStatValue(value) {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    // Check if it's effectively an integer after rounding to a few decimal places
    if (Math.abs(value - Math.round(value)) < 0.0001 && Math.abs(value) < 1e6 ) { // Handle large numbers as float
        return Math.round(value).toString();
    }
    // For numbers that are small or need precision
    if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
        return parseFloat(value).toPrecision(2);
    }
    return parseFloat(value).toFixed(2);
}


function addStatisticLineShape(shapes, statValue, color, dashStyle, width,
                               histogramBinEdges, histogramCounts,
                               histogramActualYMin, histogramActualYMax,
                               numberOfBins) {
    if (statValue === undefined || width <= 0) return;

    // Do not draw if outside the actual Y range of the histogram bins
    if (statValue < histogramActualYMin || statValue > histogramActualYMax) {
        return;
    }
    
    let binIndex = -1;
    // Find which bin the statValue falls into
    for (let i = 0; i < numberOfBins; i++) {
        const lowerEdge = histogramBinEdges[i];
        const upperEdge = histogramBinEdges[i+1];
        // statValue is in [lowerEdge, upperEdge)
        if (statValue >= lowerEdge && statValue < upperEdge) {
            binIndex = i;
            break;
        }
        // Handle case where statValue is exactly the maximum Y value (upper edge of the last bin)
        if (statValue === histogramActualYMax && i === numberOfBins - 1) {
            binIndex = i;
            break;
        }
    }
    
    // If the statistic falls into a valid bin and that bin has counts
    if (binIndex !== -1 && binIndex < histogramCounts.length) {
        const countForBin = histogramCounts[binIndex];
        // Only draw the line if the bin it falls into has a non-zero count to avoid clutter
        if (countForBin > 0) {
            shapes.push({
                type: 'line',
                x0: -countForBin, // Line spans the width of the bar in that bin
                y0: statValue,
                x1: countForBin,
                y1: statValue,
                line: {
                    color: color,
                    width: width,
                    dash: dashStyle
                },
                layer: 'above' // Ensure lines are drawn on top of bars
            });
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const dataInput = document.getElementById('dataInput');
    const numBinsInput = document.getElementById('numBins');
    const chartTitleInput = document.getElementById('chartTitle');
    const yAxisMinInput = document.getElementById('yAxisMin');
    const yAxisMaxInput = document.getElementById('yAxisMax');
    const yAxisLabelInput = document.getElementById('yAxisLabel');
    const xAxisLabelInput = document.getElementById('xAxisLabel');
    const xAxisMinInput = document.getElementById('xAxisMin');
    const xAxisMaxInput = document.getElementById('xAxisMax');
    const barColorInput = document.getElementById('barColor');
    const sampleDataSelect = document.getElementById('sampleData');
    const clearDataBtn = document.getElementById('clearDataBtn');

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
    const statisticsOutputDiv = document.getElementById('statisticsOutput');

    const preGeneratedSampleData = {
        basic: "8.78, 10.87, 11.96, 10.08, 10.41, 6.59, 8.91, 7.25, 8.67, 10.12, 10.11, 6.95, 14.70, 10.95, 8.82, 11.34, 10.95, 10.14, 9.09, 9.02, 11.03, 5.05, 7.19, 14.63, 8.12, 9.98, 9.91, 14.02, 9.04, 6.05, 10.89, 14.96, 11.04, 6.42, 12.74, 12.87, 10.47, 3.95, 14.65, 9.38, 7.10, 9.39, 14.06, 12.39, 15.95, 11.95, 6.06, 12.77, 12.78, 12.03, 10.94, 9.49, 12.18, 9.18, 8.98, 7.46, 10.62, 5.36, 9.32, 7.17, 7.39, 10.01, 9.75, 1.07, 3.81, 5.67, 9.96, 13.24, 10.69, 10.30, 9.34, 10.07, 10.14, 11.91, 8.75, 10.24, 7.80, 11.81, 9.34, 13.72, 13.92, 11.48, 8.28, 7.49, 8.30, 9.56, 8.57, 4.68, 4.33, 11.76, 5.87, 8.87, 8.61, 8.39, 16.45, 9.48, 6.13, 3.31, 9.58, 11.48",
        normal: "10.1, 9.5, 11.2, 8.8, 10.5, 12.1, 9.9, 10.3, 7.5, 11.8, 10.0, 9.2, 10.8, 11.5, 8.2, 9.7, 10.6, 10.2, 9.0, 11.0, 13.0, 7.0, 10.4, 9.6, 11.3, 8.7, 10.9, 12.5, 9.3, 10.7, 8.5, 11.1, 9.8, 11.7, 8.3, 10.1, 11.9, 9.1, 12.2, 8.9, 10.5, 11.6, 9.4, 10.3, 8.6, 11.4, 12.8, 7.8, 10.7, 9.9",
        bimodal: "2, 3, 2.5, 3.5, 4, 3.2, 2.8, 1.9, 3.7, 4.1, 10, 11, 10.5, 11.5, 12, 11.2, 10.8, 9.9, 11.7, 12.1, 2.2, 3.8, 10.3, 11.9, 3.1, 2.9, 11.1, 10.1, 3.3, 10.7, 2.7, 11.3, 3.9, 10.9, 2.1, 11.6, 3.6, 10.4, 2.4, 11.8, 3.4, 10.2, 2.6, 11.4, 10.6",
        skewed_right: "1, 1.5, 2, 1.2, 1.8, 2.5, 3, 2.2, 1.3, 1.7, 2.8, 3.5, 4, 5, 4.5, 6, 3.2, 2.1, 1.6, 1.1, 2.3, 3.3, 4.2, 5.5, 7, 8, 1.4, 1.9, 2.7, 3.8, 5.2, 6.5, 9, 10, 0.8, 1.1, 12, 15",
        with_outliers: "8, 9, 8.5, 9.5, 7.5, 10, 8.2, 9.3, 8.8, 7.9, 9.1, 8.6, 9.2, 1, 25, 8.1, 9.4, 8.3, 8.9, 9.0, -2, 30, 8.7, 9.6, 7.8, 10.1, 0, 28"
    };
    
    sampleDataSelect.addEventListener('change', (event) => {
        const selectedKey = event.target.value;
        if (preGeneratedSampleData[selectedKey]) {
            dataInput.value = preGeneratedSampleData[selectedKey];
        } else if (selectedKey === "") {
            // User chose custom input, do nothing or clear input
            // dataInput.value = ""; // Optional: clear if they select "custom" after a sample
        }
    });

    clearDataBtn.addEventListener('click', () => {
        dataInput.value = "";
        sampleDataSelect.value = ""; // Reset sample selection
    });
    
    // Set default data (matches 'basic' sample if desired, or your original default)
    dataInput.value = preGeneratedSampleData.basic;
    sampleDataSelect.value = "basic"; // Sync dropdown

    function displayError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        chartDiv.innerHTML = ''; // Clear previous chart
        downloadButtonsDiv.style.display = 'none';
        statisticsOutputDiv.style.display = 'none';
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

    function calculateHistogram(data, numBins, yMinUser, yMaxUser) {
        if (data.length === 0) {
            return { counts: [], binEdges: [0,1], binCenters: [0.5], actualYMin: 0, actualYMax: 1 };
        }

        let dataMin = Math.min(...data);
        let dataMax = Math.max(...data);

        let yMin = (yMinUser !== null && yMinUser !== undefined && yMinUser !== "") ? parseFloat(yMinUser) : dataMin;
        let yMax = (yMaxUser !== null && yMaxUser !== undefined && yMaxUser !== "") ? parseFloat(yMaxUser) : dataMax;
        
        if (yMin >= yMax) {
            if (dataMin === dataMax) { 
                yMin = dataMin - 0.5;
                yMax = dataMax + 0.5;
            } else { 
                yMin = dataMin;
                yMax = dataMax;
                 if (yMin === yMax) { 
                     yMin -= 0.5;
                     yMax += 0.5;
                }
            }
        }
        
        const binWidth = (yMax - yMin) / numBins;
        if (binWidth <= 0) {
             throw new Error("无法计算有效的 bin 宽度。请检查 Y 轴范围和 Bin 数量。");
        }

        const binEdges = [];
        for (let i = 0; i <= numBins; i++) {
            binEdges.push(yMin + i * binWidth);
        }

        const counts = new Array(numBins).fill(0);
        for (const value of data) {
            if (value >= yMin && value <= yMax) {
                let binIndex = Math.floor((value - yMin) / binWidth);
                if (value === yMax) { 
                    binIndex = numBins - 1;
                }
                binIndex = Math.max(0, Math.min(binIndex, numBins - 1));
                if (binIndex >= 0 && binIndex < numBins) {
                    counts[binIndex]++;
                }
            }
        }
        
        const binCenters = binEdges.slice(0, -1).map(edge => edge + binWidth / 2);
        return { counts, binEdges, binCenters, actualYMin: yMin, actualYMax: yMax };
    }

    function displayStatistics(data) {
        const n = data.length;
        const minVal = n > 0 ? Math.min(...data) : undefined;
        const maxVal = n > 0 ? Math.max(...data) : undefined;
        const q1 = getPercentile(data, 25);
        const median = getPercentile(data, 50);
        const q3 = getPercentile(data, 75);
        const mean = getMean(data);
        const stdDev = getStdDev(data, mean);
        const iqr = getIQR(q1, q3);

        document.getElementById('statN').textContent = formatStatValue(n);
        document.getElementById('statMin').textContent = formatStatValue(minVal);
        document.getElementById('statMax').textContent = formatStatValue(maxVal);
        document.getElementById('statQ1').textContent = formatStatValue(q1);
        document.getElementById('statMedian').textContent = formatStatValue(median);
        document.getElementById('statQ3').textContent = formatStatValue(q3);
        document.getElementById('statMean').textContent = formatStatValue(mean);
        document.getElementById('statStdDev').textContent = formatStatValue(stdDev);
        document.getElementById('statIQR').textContent = formatStatValue(iqr);

        statisticsOutputDiv.style.display = 'block';
    }

    generateChartBtn.addEventListener('click', () => {
        clearError();
        const rawData = dataInput.value;
        const parsedData = parseData(rawData);

        if (parsedData.length === 0) {
            displayError("没有有效数据可供绘图。请输入数字，用换行或逗号分隔。");
            statisticsOutputDiv.style.display = 'none';
            return;
        }

        const numBins = parseInt(numBinsInput.value, 10);
        if (isNaN(numBins) || numBins <= 0) {
            displayError("Bin 数量必须是一个正整数。");
            statisticsOutputDiv.style.display = 'none';
            return;
        }

        const chartTitle = chartTitleInput.value || '离散小提琴图';
        const yAxisMin = yAxisMinInput.value;
        const yAxisMax = yAxisMaxInput.value;
        const yAxisLabel = yAxisLabelInput.value || '数值';
        const xAxisLabelText = xAxisLabelInput.value || '频数';
        const xAxisMinUser = xAxisMinInput.value !== "" ? parseFloat(xAxisMinInput.value) : undefined;
        const xAxisMaxUser = xAxisMaxInput.value !== "" ? parseFloat(xAxisMaxInput.value) : undefined;
        
        const barColorHex = barColorInput.value;
        const barOpacity = 0.7; 

        try {
            const histogramData = calculateHistogram(parsedData, numBins, yAxisMin, yAxisMax);
            const { counts, binCenters, actualYMin, actualYMax, binEdges: histoBinEdges } = histogramData;

            if (counts.length === 0 && parsedData.length > 0) {
                 displayError("计算直方图后没有得到任何数据。请检查Y轴范围设置。");
                 statisticsOutputDiv.style.display = 'none';
                 return;
            }

            const traceRight = {
                y: binCenters, x: counts, type: 'bar', orientation: 'h', name: '频数',
                marker: { color: barColorHex, opacity: barOpacity, line: { color: 'rgba(0,0,0,0.6)', width: 0.5 } },
                hoverinfo: 'y+x'
            };
            const traceLeft = {
                y: binCenters, x: counts.map(c => -c), type: 'bar', orientation: 'h', name: '频数 (镜像)',
                marker: { color: barColorHex, opacity: barOpacity, line: { color: 'rgba(0,0,0,0.6)', width: 0.5 } },
                hoverinfo: 'y+text', text: counts.map(String), showlegend: false
            };

            const maxCount = Math.max(...counts, 0);
            let xRange;
            if (xAxisMinUser !== undefined && xAxisMaxUser !== undefined && xAxisMinUser < xAxisMaxUser) {
                xRange = [xAxisMinUser, xAxisMaxUser];
            } else {
                 xRange = maxCount > 0 ? [-maxCount * 1.15, maxCount * 1.15] : [-1, 1];
            }
            
            const tickLayout = {};
            const [xMinRange, xMaxRange] = xRange;
            const maxAbsXVal = Math.max(Math.abs(xMinRange), Math.abs(xMaxRange));
            let dtick;
            if (maxAbsXVal === 0) { dtick = 1; }
            else {
                const targetNumTicksOnSide = 4; 
                const power = Math.pow(10, Math.floor(Math.log10(maxAbsXVal / targetNumTicksOnSide)));
                const mantissa = (maxAbsXVal / targetNumTicksOnSide) / power;
                if (mantissa < 1.5) dtick = 1 * power;
                else if (mantissa < 3) dtick = 2 * power;
                else if (mantissa < 7) dtick = 5 * power;
                else dtick = 10 * power;
                
                if (dtick < 1 && maxAbsXVal >= 1 && counts.every(c => Number.isInteger(c))) { dtick = 1; }
                if (dtick <= 0 && maxAbsXVal > 0) dtick = 1; 
                else if (dtick <=0 && maxAbsXVal === 0) dtick = 0.5; 
            }
            if (dtick === 0 && (xMinRange !==0 || xMaxRange !==0 )) dtick = 1; 
            else if (dtick === 0 && xMinRange === 0 && xMaxRange === 0) dtick = 0.5;

            const generatedTickVals = [];
            if (xMinRange <= 0 && xMaxRange >= 0) { generatedTickVals.push(0); } 
            if (dtick > 0) { 
                for (let v = dtick; v <= xMaxRange + 1e-9; v += dtick) { generatedTickVals.push(parseFloat(v.toPrecision(10))); if (generatedTickVals.length > 50) break; } 
                for (let v = -dtick; v >= xMinRange - 1e-9; v -= dtick) { generatedTickVals.push(parseFloat(v.toPrecision(10))); if (generatedTickVals.length > 100) break; }
            }
            tickLayout.tickvals = [...new Set(generatedTickVals)].sort((a, b) => a - b);
            
            if ((tickLayout.tickvals.length < 3 && (xMinRange !== 0 || xMaxRange !== 0)) || 
                (tickLayout.tickvals.length === 1 && tickLayout.tickvals[0] === 0 && (xMinRange !== 0 || xMaxRange !== 0))) {
                const tempTicks = [xMinRange, xMaxRange];
                if (xMinRange < 0 && xMaxRange > 0) tempTicks.push(0);
                else if (xMinRange === 0 && xMaxRange !==0) tempTicks.push(0);
                else if (xMaxRange === 0 && xMinRange !==0) tempTicks.push(0);
                tickLayout.tickvals = [...new Set(tempTicks)].map(t => parseFloat(t.toPrecision(10))).sort((a, b) => a - b);
            }
            if (xMinRange === 0 && xMaxRange === 0 && maxCount === 0 && tickLayout.tickvals.every(t => t===0) && tickLayout.tickvals.length ===1 ) { 
                tickLayout.tickvals = [-1, -0.5, 0, 0.5, 1];
                if (xRange[0] === 0 && xRange[1] === 0) xRange[1] = 1;
            }

            tickLayout.ticktext = tickLayout.tickvals.map(v => {
                const absV = Math.abs(v);
                if (absV === 0) return "0";
                let numDecimalPlaces = 0;
                if (dtick > 0 && dtick < 1) { const dtickStr = dtick.toString(); if (dtickStr.includes('.')) { numDecimalPlaces = dtickStr.split('.')[1].length; }}
                const vStr = v.toString(); if (vStr.includes('.')) { numDecimalPlaces = Math.max(numDecimalPlaces, vStr.split('.')[1].length); }
                
                if (absV < Math.pow(10, -Math.min(numDecimalPlaces,3) -1 ) && absV !==0) { return absV.toPrecision(1); }
                return absV.toFixed(Math.min(numDecimalPlaces, 3));
            });

            const shapes = [];
            const q1 = getPercentile(parsedData, 25);
            const median = getPercentile(parsedData, 50);
            const q3 = getPercentile(parsedData, 75);
            const mean = getMean(parsedData);
            let stdDev, meanMinusStdDev, meanPlusStdDev;

            if (mean !== undefined) {
                stdDev = getStdDev(parsedData, mean);
                if (stdDev !== undefined) {
                    meanMinusStdDev = mean - stdDev;
                    meanPlusStdDev = mean + stdDev;
                }
            }
            
            if (showQ1LineCheckbox.checked) addStatisticLineShape(shapes, q1, q1LineColorInput.value, 'dot', parseFloat(q1LineWidthInput.value) || 2, histoBinEdges, counts, actualYMin, actualYMax, numBins);
            if (showMedianLineCheckbox.checked) addStatisticLineShape(shapes, median, medianLineColorInput.value, 'solid', parseFloat(medianLineWidthInput.value) || 3, histoBinEdges, counts, actualYMin, actualYMax, numBins);
            if (showQ3LineCheckbox.checked) addStatisticLineShape(shapes, q3, q3LineColorInput.value, 'dot', parseFloat(q3LineWidthInput.value) || 2, histoBinEdges, counts, actualYMin, actualYMax, numBins);
            if (showMeanLineCheckbox.checked) addStatisticLineShape(shapes, mean, meanLineColorInput.value, 'dashdot', parseFloat(meanLineWidthInput.value) || 2, histoBinEdges, counts, actualYMin, actualYMax, numBins);
            if (showMeanMinusStdDevLineCheckbox.checked && meanMinusStdDev !== undefined) addStatisticLineShape(shapes, meanMinusStdDev, meanMinusStdDevLineColorInput.value, 'longdash', parseFloat(meanMinusStdDevLineWidthInput.value) || 2, histoBinEdges, counts, actualYMin, actualYMax, numBins);
            if (showMeanPlusStdDevLineCheckbox.checked && meanPlusStdDev !== undefined) addStatisticLineShape(shapes, meanPlusStdDev, meanPlusStdDevLineColorInput.value, 'longdash', parseFloat(meanPlusStdDevLineWidthInput.value) || 2, histoBinEdges, counts, actualYMin, actualYMax, numBins);

            const layout = {
                title: chartTitle,
                yaxis: { title: yAxisLabel, range: [actualYMin, actualYMax], zeroline: false },
                xaxis: {
                    title: xAxisLabelText, range: xRange, zeroline: true, zerolinecolor: '#999', zerolinewidth: 1,
                    tickvals: tickLayout.tickvals, ticktext: tickLayout.ticktext
                },
                barmode: 'overlay', bargap: 0, showlegend: false,
                plot_bgcolor: '#FFFFFF', paper_bgcolor: '#FFFFFF',
                margin: { l: 70, r: 50, b: 70, t: 80, pad: 4 },
                shapes: shapes
            };

            Plotly.newPlot(chartDiv, [traceRight, traceLeft], layout, {responsive: true, displaylogo: false});
            displayStatistics(parsedData);
            downloadButtonsDiv.style.display = 'flex';

        } catch (error) {
            displayError(`生成图表时出错: ${error.message}`);
            statisticsOutputDiv.style.display = 'none';
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
    
    // Initial chart generation with default data
    generateChartBtn.click(); 
});
// --- END OF FILE script.js ---