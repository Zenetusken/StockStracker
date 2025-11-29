import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * StockChart Component
 * Displays candlestick, line, or area charts using TradingView Lightweight Charts
 */
function StockChart({ symbol, chartType: initialChartType = 'candlestick', timeframe = '6M' }) {
  const chartContainerRef = useRef(null);
  const chart = useRef(null);
  const series = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState(initialChartType);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const loadChart = async () => {
      try {
        setLoading(true);
        setError(null);

        // Calculate date range
        const now = Math.floor(Date.now() / 1000);
        const dayInSeconds = 24 * 60 * 60;
        const days = 180; // 6 months
        const from = now - (days * dayInSeconds);

        // Fetch candle data
        const response = await fetch(
          `http://localhost:3001/api/quotes/${symbol}/candles?resolution=D&from=${from}&to=${now}`,
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

        // Remove existing series if any
        if (series.current) {
          chart.current.removeSeries(series.current);
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

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
    };
  }, [symbol, chartType]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 relative">
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

      {/* Chart Type Selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Chart Type:</span>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setChartType('candlestick')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartType === 'candlestick'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Candlestick
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartType === 'line'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartType === 'area'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Area
          </button>
        </div>
      </div>

      {/* Chart Container - always rendered so ref is available */}
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ minHeight: '500px' }}
      />
    </div>
  );
}

export default StockChart;
