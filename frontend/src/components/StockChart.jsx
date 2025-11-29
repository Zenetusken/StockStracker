import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * StockChart Component
 * Displays candlestick, line, or area charts using TradingView Lightweight Charts
 *
 * IMPORTANT: The chart background MUST be a solid color (not transparent) for visibility.
 * Using '#f9fafb' (gray-50) - very light, close to white but slightly grey.
 */

// Chart background color - MUST be solid, not transparent
// Using #f9fafb (gray-50) - very light, close to white but slightly grey
const CHART_BACKGROUND_COLOR = '#f9fafb';

function StockChart({ symbol, chartType: initialChartType = 'candlestick', timeframe: initialTimeframe = '6M' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState(initialChartType);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [tooltipData, setTooltipData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

        // Calculate date range based on timeframe
        const now = Math.floor(Date.now() / 1000);
        const dayInSeconds = 86400;

        let days, resolution;
        switch (timeframe) {
          case '1D': days = 1; resolution = '15'; break;
          case '5D': days = 5; resolution = '60'; break;
          case '1M': days = 30; resolution = 'D'; break;
          case '6M': days = 180; resolution = 'D'; break;
          case '1Y': days = 365; resolution = 'D'; break;
          case '5Y': days = 1825; resolution = 'D'; break; // 5 years
          case 'Max': days = 7300; resolution = 'W'; break; // ~20 years, weekly candles
          default: days = 180; resolution = 'D';
        }

        const from = now - (days * dayInSeconds);

        // Fetch candle data
        const response = await fetch(
          `http://localhost:3001/api/quotes/${symbol}/candles?resolution=${resolution}&from=${from}&to=${now}`,
          { credentials: 'include' }
        );

        if (!isActive) return;

        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }

        const data = await response.json();

        if (!data || data.s !== 'ok' || !data.t || data.t.length === 0) {
          throw new Error('No chart data available');
        }

        // Transform data
        const chartData = data.t.map((timestamp, i) => ({
          time: timestamp,
          open: data.o[i],
          high: data.h[i],
          low: data.l[i],
          close: data.c[i],
        }));

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
    };
  }, [symbol, chartType, timeframe, isFullscreen]);

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
    <div className={`bg-gray-50 rounded-lg shadow-lg p-4 relative ${isFullscreen ? 'h-full' : ''}`}>
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-lg z-10">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-lg z-10">
          <div className="text-center">
            <p className="text-red-600 mb-2">Failed to load chart</p>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      )}

      {/* Chart Controls */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        {/* Chart Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 font-medium">Chart Type:</span>
          <div className="flex gap-1 bg-gray-300 rounded-lg p-1">
            {['candlestick', 'line', 'area'].map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  chartType === type
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 font-medium">Timeframe:</span>
          <div className="flex gap-1 bg-gray-300 rounded-lg p-1">
            {['1D', '5D', '1M', '6M', '1Y', '5Y', 'Max'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleResetZoom}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-gray-300 hover:bg-gray-400 rounded-lg transition-colors"
          >
            Reset Zoom
          </button>
          <button
            onClick={handleExportPNG}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-gray-300 hover:bg-gray-400 rounded-lg transition-colors flex items-center gap-2"
            title="Export as PNG"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={handleToggleFullscreen}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-gray-300 hover:bg-gray-400 rounded-lg transition-colors"
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

      {/* Crosshair Tooltip */}
      {tooltipData && (
        <div className="absolute top-20 left-4 bg-white border border-gray-300 rounded-lg p-3 shadow-lg z-20 pointer-events-none">
          <div className="text-xs space-y-1">
            <div className="font-semibold text-gray-900 mb-2">
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
                  <span className="text-gray-500">Open:</span>
                  <span className="font-medium text-gray-900">${tooltipData.open.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">High:</span>
                  <span className="font-medium text-green-600">${tooltipData.high.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Low:</span>
                  <span className="font-medium text-red-600">${tooltipData.low.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Close:</span>
                  <span className="font-medium text-gray-900">${tooltipData.close.toFixed(2)}</span>
                </div>
              </>
            )}
            {tooltipData.value !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Price:</span>
                <span className="font-medium text-gray-900">${tooltipData.value.toFixed(2)}</span>
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
