import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * StockChart Component
 * Displays candlestick, line, or area charts using TradingView Lightweight Charts
 */
function StockChart({ symbol, chartType: initialChartType = 'candlestick', timeframe: initialTimeframe = '6M' }) {
  const chartContainerRef = useRef(null);
  const chart = useRef(null);
  const series = useRef(null);
  const crosshairHandler = useRef(null);
  const resizeTimeout = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState(initialChartType);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [tooltipData, setTooltipData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const loadChart = async () => {
      try {
        setLoading(true);
        setError(null);

        // Calculate date range based on timeframe
        const now = Math.floor(Date.now() / 1000);
        const dayInSeconds = 24 * 60 * 60;

        let days, resolution;
        switch (timeframe) {
          case '1D':
            days = 1;
            resolution = '15'; // 15-minute candles
            break;
          case '5D':
            days = 5;
            resolution = '60'; // 1-hour candles
            break;
          case '1M':
            days = 30;
            resolution = 'D'; // Daily candles
            break;
          case '6M':
            days = 180;
            resolution = 'D';
            break;
          case '1Y':
            days = 365;
            resolution = 'D';
            break;
          default:
            days = 180;
            resolution = 'D';
        }

        const from = now - (days * dayInSeconds);

        // Fetch candle data
        const response = await fetch(
          `http://localhost:3001/api/quotes/${symbol}/candles?resolution=${resolution}&from=${from}&to=${now}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }

        const data = await response.json();

        if (!data || data.s !== 'ok' || !data.t || data.t.length === 0) {
          throw new Error('No chart data available');
        }

        // Transform data to Lightweight Charts format
        const candlestickData = [];
        for (let i = 0; i < data.t.length; i++) {
          candlestickData.push({
            time: data.t[i],
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
          });
        }

        // Create chart if it doesn't exist
        if (!chart.current) {
          chart.current = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 500,
            layout: {
              background: { color: 'transparent' },
              textColor: '#9CA3AF',
            },
            grid: {
              vertLines: { color: '#374151' },
              horzLines: { color: '#374151' },
            },
            crosshair: {
              mode: 1,
            },
            rightPriceScale: {
              borderColor: '#4B5563',
            },
            timeScale: {
              borderColor: '#4B5563',
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
        }

        // Remove existing series if any (with safety check for HMR)
        if (series.current && chart.current) {
          try {
            chart.current.removeSeries(series.current);
          } catch (e) {
            // Series may have been invalidated by HMR, ignore
          }
          series.current = null;
        }

        // Add series based on chart type
        if (chartType === 'line') {
          series.current = chart.current.addLineSeries({
            color: '#3B82F6',
            lineWidth: 2,
          });
          // For line chart, only use close prices
          const lineData = candlestickData.map(d => ({ time: d.time, value: d.close }));
          series.current.setData(lineData);
        } else if (chartType === 'area') {
          series.current = chart.current.addAreaSeries({
            topColor: 'rgba(59, 130, 246, 0.4)',
            bottomColor: 'rgba(59, 130, 246, 0.0)',
            lineColor: '#3B82F6',
            lineWidth: 2,
          });
          // For area chart, only use close prices
          const areaData = candlestickData.map(d => ({ time: d.time, value: d.close }));
          series.current.setData(areaData);
        } else {
          // Default to candlestick
          series.current = chart.current.addCandlestickSeries({
            upColor: '#10B981',
            downColor: '#EF4444',
            borderVisible: false,
            wickUpColor: '#10B981',
            wickDownColor: '#EF4444',
          });
          series.current.setData(candlestickData);
        }

        // Fit content
        chart.current.timeScale().fitContent();

        // Unsubscribe previous crosshair handler if exists
        if (crosshairHandler.current && chart.current) {
          try {
            chart.current.unsubscribeCrosshairMove(crosshairHandler.current);
          } catch (e) {
            // Ignore errors from invalid handler
          }
        }

        // Create new crosshair handler with current series reference
        const currentSeries = series.current;
        crosshairHandler.current = (param) => {
          if (!param.time || !param.point || !currentSeries) {
            setTooltipData(null);
            return;
          }

          try {
            const data = param.seriesData.get(currentSeries);
            if (data) {
              // Format the data for tooltip display
              const tooltipInfo = {
                time: param.time,
                ...data
              };
              setTooltipData(tooltipInfo);
            } else {
              setTooltipData(null);
            }
          } catch (e) {
            // Series may have been invalidated, clear tooltip
            setTooltipData(null);
          }
        };

        // Subscribe to crosshair move events for tooltip
        chart.current.subscribeCrosshairMove(crosshairHandler.current);

        setLoading(false);
      } catch (err) {
        console.error('Chart error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadChart();

    // Handle resize
    const handleResize = () => {
      if (chart.current && chartContainerRef.current) {
        chart.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup - only remove chart when component unmounts or symbol changes
    // Don't destroy chart on chartType/timeframe change, just remove series (handled above)
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [symbol, chartType, timeframe]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      // Clear any pending resize timeout
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current);
        resizeTimeout.current = null;
      }
      // Unsubscribe crosshair handler
      if (crosshairHandler.current && chart.current) {
        try {
          chart.current.unsubscribeCrosshairMove(crosshairHandler.current);
        } catch (e) {
          // Ignore
        }
        crosshairHandler.current = null;
      }
      // Remove chart
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
      series.current = null;
    };
  }, []);

  // Reset zoom handler
  const handleResetZoom = () => {
    if (chart.current) {
      chart.current.timeScale().fitContent();
    }
  };

  // Fullscreen handlers
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleExitFullscreen = () => {
    setIsFullscreen(false);
  };

  // Export chart as PNG handler
  const handleExportPNG = () => {
    if (!chart.current) return;

    try {
      // Use the built-in takeScreenshot method from Lightweight Charts
      const canvas = chart.current.takeScreenshot();

      if (canvas) {
        // Convert canvas to blob and trigger download
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            link.download = `${symbol}_${timestamp}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        });
      }
    } catch (error) {
      console.error('Failed to export chart as PNG:', error);
    }
  };

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isFullscreen]);

  // Resize chart when entering/exiting fullscreen
  useEffect(() => {
    if (chart.current && chartContainerRef.current) {
      // Clear previous timeout if any
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current);
      }
      // Small delay to allow DOM to update
      resizeTimeout.current = setTimeout(() => {
        if (chart.current && chartContainerRef.current) {
          chart.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: isFullscreen ? window.innerHeight - 150 : 500,
          });
        }
        resizeTimeout.current = null;
      }, 100);
    }
  }, [isFullscreen]);

  const chartContent = (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 relative ${isFullscreen ? 'h-full' : ''}`}>
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 rounded-lg z-10">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 rounded-lg z-10">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-2">Failed to load chart</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      )}

      {/* Chart Controls */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        {/* Chart Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Chart Type:</span>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setChartType('candlestick')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                chartType === 'candlestick'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Candlestick
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                chartType === 'line'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                chartType === 'area'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Area
            </button>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Timeframe:</span>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setTimeframe('1D')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === '1D'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              1D
            </button>
            <button
              onClick={() => setTimeframe('5D')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === '5D'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              5D
            </button>
            <button
              onClick={() => setTimeframe('1M')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === '1M'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              1M
            </button>
            <button
              onClick={() => setTimeframe('6M')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === '6M'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              6M
            </button>
            <button
              onClick={() => setTimeframe('1Y')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === '1Y'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              1Y
            </button>
          </div>
        </div>

        {/* Reset Zoom, Export, and Fullscreen Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleResetZoom}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Reset Zoom
          </button>
          <button
            onClick={handleExportPNG}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
            title="Export chart as PNG"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export PNG</span>
          </button>
          <button
            onClick={handleToggleFullscreen}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
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
        <div className="absolute top-20 left-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg z-20 pointer-events-none">
          <div className="text-xs space-y-1">
            <div className="font-semibold text-gray-900 dark:text-white mb-2">
              {new Date(typeof tooltipData.time === 'number' ? tooltipData.time * 1000 : tooltipData.time).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: tooltipData.time && (timeframe === '1D' || timeframe === '5D') ? 'numeric' : undefined,
                minute: tooltipData.time && (timeframe === '1D' || timeframe === '5D') ? 'numeric' : undefined,
              })}
            </div>
            {tooltipData.open !== undefined && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Open:</span>
                  <span className="font-medium text-gray-900 dark:text-white">${tooltipData.open.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">High:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">${tooltipData.high.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Low:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">${tooltipData.low.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Close:</span>
                  <span className="font-medium text-gray-900 dark:text-white">${tooltipData.close.toFixed(2)}</span>
                </div>
              </>
            )}
            {tooltipData.value !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-600 dark:text-gray-400">Price:</span>
                <span className="font-medium text-gray-900 dark:text-white">${tooltipData.value.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart Container - always rendered so ref is available */}
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ minHeight: isFullscreen ? `${window.innerHeight - 150}px` : '500px' }}
      />
    </div>
  );

  // Return fullscreen modal or normal chart
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
