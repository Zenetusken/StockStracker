import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * StockChart Component
 * Displays candlestick, line, or area charts using TradingView Lightweight Charts
 */
function StockChart({ symbol, chartType = 'candlestick', timeframe = '6M' }) {
  const chartContainerRef = useRef(null);
  const chart = useRef(null);
  const series = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          });
        }

        // Remove existing series if any
        if (series.current) {
          chart.current.removeSeries(series.current);
        }

        // Add candlestick series
        series.current = chart.current.addCandlestickSeries({
          upColor: '#10B981',
          downColor: '#EF4444',
          borderVisible: false,
          wickUpColor: '#10B981',
          wickDownColor: '#EF4444',
        });

        // Set data
        series.current.setData(candlestickData);

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
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-white dark:bg-gray-800 rounded-lg">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-white dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">Failed to load chart</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ minHeight: '500px' }}
      />
    </div>
  );
}

export default StockChart;
