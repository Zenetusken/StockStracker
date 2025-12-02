import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useChartStore } from '../stores/chartStore';

/**
 * StockChart Component
 * Displays candlestick, line, or area charts using TradingView Lightweight Charts
 * Supports custom date range picker for flexible time period selection
 *
 * IMPORTANT: The chart background MUST be a solid color (not transparent) for visibility.
 * Using '#f9fafb' (gray-50) - very light, close to white but slightly grey.
 */

// Chart background color - MUST be solid, not transparent
// Warm cream intermediate - between page-bg (#E8E0D5) and card (#D6C7AE)
const CHART_BACKGROUND_COLOR = '#DDD3C5';

// Helper function to calculate Simple Moving Average
function calculateSMA(data, period) {
  if (!data || data.length < period) return [];

  const smaData = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const smaValue = sum / period;
    smaData.push({
      time: data[i].time,
      value: smaValue
    });
  }
  return smaData;
}

function StockChart({ symbol, chartType: initialChartType = 'candlestick', timeframe: initialTimeframe = '6M' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const smaSeriesRef = useRef(null); // Reference for SMA line series
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showIndicators, setShowIndicators] = useState(false);

  // Get preferences and actions from chartStore
  const getPreferences = useChartStore((state) => state.getPreferences);
  const setStoreTimeframe = useChartStore((state) => state.setTimeframe);
  const setStoreChartType = useChartStore((state) => state.setChartType);
  const setStoreSmaEnabled = useChartStore((state) => state.setSmaEnabled);
  const setStoreSmaPeriod = useChartStore((state) => state.setSmaPeriod);
  const fetchCandles = useChartStore((state) => state.fetchCandles);

  // Get preferences from store (handles localStorage internally)
  const preferences = getPreferences(symbol);
  const [chartType, setChartType] = useState(preferences.chartType || initialChartType);
  const [timeframe, setTimeframe] = useState(preferences.timeframe || initialTimeframe);
  const [smaEnabled, setSmaEnabled] = useState(preferences.smaEnabled || false);
  const [smaPeriod, setSmaPeriod] = useState(preferences.smaPeriod || 20);

  // Sync preferences from store when symbol changes
  useEffect(() => {
    const prefs = getPreferences(symbol);
    setTimeframe(prefs.timeframe || initialTimeframe);
    setChartType(prefs.chartType || initialChartType);
    setSmaEnabled(prefs.smaEnabled || false);
    setSmaPeriod(prefs.smaPeriod || 20);
  }, [symbol, initialTimeframe, initialChartType, getPreferences]);

  // Sync preferences to store when they change
  useEffect(() => {
    setStoreTimeframe(symbol, timeframe);
  }, [symbol, timeframe, setStoreTimeframe]);

  useEffect(() => {
    setStoreChartType(symbol, chartType);
  }, [symbol, chartType, setStoreChartType]);

  useEffect(() => {
    setStoreSmaEnabled(symbol, smaEnabled);
  }, [symbol, smaEnabled, setStoreSmaEnabled]);

  useEffect(() => {
    setStoreSmaPeriod(symbol, smaPeriod);
  }, [symbol, smaPeriod, setStoreSmaPeriod]);

  // Main chart effect with local isActive variable for proper cleanup
  useEffect(() => {
    // Local variable - each effect invocation has its own isolated isActive
    let isActive = true;
    let chartInstance = null;
    let seriesInstance = null;
    let crosshairHandler = null;
    let resizeObserver = null;

    const loadChart = async () => {
      const container = chartContainerRef.current;
      if (!container) return;

      // Wait for next frame to ensure container has dimensions
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (!isActive) return;

      // Retry if container has zero width
      let containerWidth = container.clientWidth;
      if (containerWidth === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!isActive) return;
        containerWidth = container.clientWidth;
      }

      if (containerWidth === 0) {
        setError('Chart container has no width');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Calculate date range based on timeframe or custom dates
        const now = Math.floor(Date.now() / 1000);
        const dayInSeconds = 86400;

        let from, to, resolution;

        // Check if using custom date range
        if (timeframe === 'custom' && customStartDate && customEndDate) {
          from = Math.floor(new Date(customStartDate).getTime() / 1000);
          to = Math.floor(new Date(customEndDate).getTime() / 1000);

          // Determine resolution based on date range
          const rangeDays = (to - from) / dayInSeconds;
          if (rangeDays <= 7) {
            resolution = '60'; // Hourly for week or less
          } else if (rangeDays <= 90) {
            resolution = 'D'; // Daily for up to 3 months
          } else {
            resolution = 'D'; // Daily for longer ranges
          }
        } else {
          // Use predefined timeframes
          let days;
          switch (timeframe) {
            case '1D': days = 1; resolution = '15'; break;
            case '5D': days = 5; resolution = '60'; break;
            case '1M': days = 30; resolution = 'D'; break;
            case '6M': days = 180; resolution = 'D'; break;
            case '1Y': days = 365; resolution = 'W'; break;    // Weekly for 1Y (daily only covers ~5 months)
            case '5Y': days = 1825; resolution = 'W'; break;   // Weekly for 5Y
            case 'Max': days = 7300; resolution = 'W'; break;  // Weekly for Max (~20 years)
            default: days = 180; resolution = 'D';
          }
          from = now - (days * dayInSeconds);
          to = now;
        }

        // Fetch candle data using chartStore (with LRU caching)
        const result = await fetchCandles(symbol, resolution, from, to);

        if (!isActive) return;

        const data = result?.data;

        if (!data || data.s !== 'ok' || !data.t || data.t.length === 0) {
          throw new Error('No chart data available');
        }

        // Transform data - don't filter by from/to since Yahoo Finance
        // returns data based on its own range parameter (1d, 5d, etc.)
        // which may not exactly match our calculated timestamps
        const chartData = data.t
          .map((timestamp, i) => ({
            time: timestamp,
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
          }))
          .filter(d => d.open != null && d.close != null); // Only filter out null values

        // Handle case where no valid data points exist
        if (chartData.length === 0) {
          throw new Error('No data available for selected time range');
        }

        if (!isActive || !container) return;

        // Get fresh dimensions
        const width = container.clientWidth || 800;
        const height = isFullscreen ? window.innerHeight - 150 : 500;

        // Create chart with SOLID LIGHT GRAY background
        chartInstance = createChart(container, {
          width,
          height,
          layout: {
            background: { type: 'solid', color: CHART_BACKGROUND_COLOR },
            textColor: '#374151',
          },
          grid: {
            vertLines: { color: '#d1d5db' },
            horzLines: { color: '#d1d5db' },
          },
          crosshair: { mode: 1 },
          rightPriceScale: { borderColor: '#9ca3af' },
          timeScale: {
            borderColor: '#9ca3af',
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: true,
          },
        });

        // Store in ref for external access (reset zoom, export)
        chartRef.current = chartInstance;

        // Add series based on chart type
        if (chartType === 'line') {
          seriesInstance = chartInstance.addLineSeries({
            color: '#3B82F6',
            lineWidth: 2,
          });
          seriesInstance.setData(chartData.map(d => ({ time: d.time, value: d.close })));
        } else if (chartType === 'area') {
          seriesInstance = chartInstance.addAreaSeries({
            topColor: 'rgba(59, 130, 246, 0.4)',
            bottomColor: 'rgba(59, 130, 246, 0.0)',
            lineColor: '#3B82F6',
            lineWidth: 2,
          });
          seriesInstance.setData(chartData.map(d => ({ time: d.time, value: d.close })));
        } else {
          seriesInstance = chartInstance.addCandlestickSeries({
            upColor: '#10B981',
            downColor: '#EF4444',
            borderVisible: false,
            wickUpColor: '#10B981',
            wickDownColor: '#EF4444',
          });
          seriesInstance.setData(chartData);
        }

        seriesRef.current = seriesInstance;

        // Add SMA indicator if enabled
        if (smaEnabled && smaPeriod > 0) {
          const smaData = calculateSMA(chartData, smaPeriod);
          if (smaData.length > 0) {
            const smaSeries = chartInstance.addLineSeries({
              color: '#FF6B00', // Orange color for SMA
              lineWidth: 2,
              title: `SMA(${smaPeriod})`,
              priceLineVisible: false,
              lastValueVisible: true,
            });
            smaSeries.setData(smaData);
            smaSeriesRef.current = smaSeries;
          }
        }

        // Fit content
        chartInstance.timeScale().fitContent();

        // Setup crosshair handler
        crosshairHandler = (param) => {
          if (!param.time || !param.point || !seriesInstance) {
            setTooltipData(null);
            return;
          }
          try {
            const seriesData = param.seriesData.get(seriesInstance);
            if (seriesData) {
              setTooltipData({ time: param.time, ...seriesData });
            } else {
              setTooltipData(null);
            }
          } catch {
            setTooltipData(null);
          }
        };
        chartInstance.subscribeCrosshairMove(crosshairHandler);

        // Setup resize observer
        resizeObserver = new ResizeObserver(entries => {
          if (!chartInstance || !isActive) return;
          const entry = entries[0];
          if (entry && entry.contentRect.width > 0) {
            chartInstance.applyOptions({ width: entry.contentRect.width });
          }
        });
        resizeObserver.observe(container);

        setLoading(false);
      } catch (err) {
        console.error('Chart error:', err);
        if (isActive) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadChart();

    // Consolidated cleanup function
    return () => {
      isActive = false;

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (crosshairHandler && chartInstance) {
        try {
          chartInstance.unsubscribeCrosshairMove(crosshairHandler);
        } catch {
          // Ignore
        }
      }

      if (chartInstance) {
        try {
          chartInstance.remove();
        } catch {
          // Ignore
        }
      }

      chartRef.current = null;
      seriesRef.current = null;
      smaSeriesRef.current = null;
    };
  }, [symbol, chartType, timeframe, isFullscreen, customStartDate, customEndDate, smaEnabled, smaPeriod, fetchCandles]);

  // Reset zoom handler
  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  // Fullscreen handler
  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // Export PNG handler
  const handleExportPNG = () => {
    if (!chartRef.current) return;
    try {
      const canvas = chartRef.current.takeScreenshot();
      if (canvas) {
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${symbol}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        });
      }
    } catch (err) {
      console.error('Failed to export chart:', err);
    }
  };

  // Apply custom date range handler
  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);

      if (start >= end) {
        alert('Start date must be before end date');
        return;
      }

      setTimeframe('custom');
      setShowDatePicker(false);
    } else {
      alert('Please select both start and end dates');
    }
  };

  // Escape key handler for fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  const chartContent = (
    <div
      className={`rounded-lg shadow-lg p-4 relative ${isFullscreen ? 'h-full' : ''}`}
      style={{ backgroundColor: '#DDD3C5' }}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-page-bg bg-opacity-90 rounded-lg z-10">
          <div className="animate-spin h-12 w-12 border-4 border-brand border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-page-bg bg-opacity-90 rounded-lg z-10">
          <div className="text-center">
            <p className="text-loss mb-2">Failed to load chart</p>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
        </div>
      )}

      {/* Chart Controls */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        {/* Chart Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-primary font-medium">Chart Type:</span>
          <div className="flex gap-1 bg-line rounded-lg p-1">
            {['candlestick', 'line', 'area'].map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  chartType === type
                    ? 'bg-card text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-primary font-medium">Timeframe:</span>
          <div className="flex gap-1 bg-line rounded-lg p-1">
            {['1D', '5D', '1M', '6M', '1Y', '5Y', 'Max'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-card text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tf}
              </button>
            ))}
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === 'custom'
                  ? 'bg-card text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="Custom date range"
            >
              📅
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              showIndicators || smaEnabled
                ? 'bg-brand text-white hover:bg-brand-hover'
                : 'bg-line text-text-primary hover:bg-line-light'
            }`}
            title="Technical Indicators"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Indicators
          </button>
          <button
            onClick={handleResetZoom}
            className="px-4 py-1.5 text-sm font-medium text-text-primary bg-line hover:bg-line-light rounded-lg transition-colors"
          >
            Reset Zoom
          </button>
          <button
            onClick={handleExportPNG}
            className="px-4 py-1.5 text-sm font-medium text-text-primary bg-line hover:bg-line-light rounded-lg transition-colors flex items-center gap-2"
            title="Export as PNG"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={handleToggleFullscreen}
            className="px-4 py-1.5 text-sm font-medium text-text-primary bg-line hover:bg-line-light rounded-lg transition-colors"
            title="Toggle fullscreen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Modal */}
      {showDatePicker && (
        <div className="mb-4 p-4 bg-card border border-line rounded-lg shadow-lg">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="start-date" className="text-sm font-medium text-text-primary">
                Start Date:
              </label>
              <input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-page-bg text-text-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="end-date" className="text-sm font-medium text-text-primary">
                End Date:
              </label>
              <input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-page-bg text-text-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApplyCustomRange}
                className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-hover rounded-md transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setShowDatePicker(false)}
                className="px-4 py-2 text-sm font-medium text-text-primary bg-table-header hover:bg-line rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicators Panel */}
      {showIndicators && (
        <div className="mb-4 p-4 bg-card border border-line rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Technical Indicators</h3>

          {/* SMA Indicator */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="sma-enabled"
                  checked={smaEnabled}
                  onChange={(e) => setSmaEnabled(e.target.checked)}
                  className="w-4 h-4 text-brand rounded focus:ring-2 focus:ring-brand"
                />
                <label htmlFor="sma-enabled" className="text-sm font-medium text-text-primary">
                  Simple Moving Average (SMA)
                </label>
              </div>
              {smaEnabled && (
                <div className="flex items-center gap-2">
                  <label htmlFor="sma-period" className="text-sm text-text-secondary">
                    Period:
                  </label>
                  <select
                    id="sma-period"
                    value={smaPeriod}
                    onChange={(e) => setSmaPeriod(parseInt(e.target.value))}
                    className="px-3 py-1.5 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-page-bg text-text-primary"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={200}>200</option>
                  </select>
                </div>
              )}
            </div>
            {smaEnabled && (
              <div className="text-xs text-text-muted pl-7">
                Displays a {smaPeriod}-period moving average line on the chart (orange line)
              </div>
            )}
          </div>

          {/* Close button */}
          <div className="mt-4 pt-4 border-t border-line">
            <button
              onClick={() => setShowIndicators(false)}
              className="w-full px-4 py-2 text-sm font-medium text-text-primary bg-table-header hover:bg-line rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Crosshair Tooltip */}
      {tooltipData && (
        <div className="absolute top-20 left-4 bg-card border border-line rounded-lg p-3 shadow-lg z-20 pointer-events-none">
          <div className="text-xs space-y-1">
            <div className="font-semibold text-text-primary mb-2">
              {new Date(typeof tooltipData.time === 'number' ? tooltipData.time * 1000 : tooltipData.time).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: (timeframe === '1D' || timeframe === '5D') ? 'numeric' : undefined,
                minute: (timeframe === '1D' || timeframe === '5D') ? 'numeric' : undefined,
              })}
            </div>
            {tooltipData.open !== undefined && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">Open:</span>
                  <span className="font-medium text-text-primary">${tooltipData.open.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">High:</span>
                  <span className="font-medium text-gain">${tooltipData.high.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">Low:</span>
                  <span className="font-medium text-loss">${tooltipData.low.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">Close:</span>
                  <span className="font-medium text-text-primary">${tooltipData.close.toFixed(2)}</span>
                </div>
              </>
            )}
            {tooltipData.value !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">Price:</span>
                <span className="font-medium text-text-primary">${tooltipData.value.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ height: isFullscreen ? `${window.innerHeight - 150}px` : '500px' }}
      />
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
        <div className="w-full h-full max-w-full max-h-full">
          {chartContent}
        </div>
      </div>
    );
  }

  return chartContent;
}

export default StockChart;
