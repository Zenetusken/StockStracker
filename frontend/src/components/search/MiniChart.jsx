import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useChartStore } from '../../stores/chartStore';

/**
 * MiniChart Component
 * A compact sparkline area chart for search preview panels.
 * Shows 5-day price history in a minimal, clean design.
 */

const CHART_COLORS = {
  positive: {
    line: '#2E9E6B',
    topColor: 'rgba(46, 158, 107, 0.3)',
    bottomColor: 'rgba(46, 158, 107, 0.0)',
  },
  negative: {
    line: '#C45C4A',
    topColor: 'rgba(196, 92, 74, 0.3)',
    bottomColor: 'rgba(196, 92, 74, 0.0)',
  },
};

function MiniChart({ symbol, height = 80 }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [priceDirection, setPriceDirection] = useState('positive');

  // Get fetchCandles from chartStore
  const fetchCandles = useChartStore((state) => state.fetchCandles);

  useEffect(() => {
    let isActive = true;
    let chartInstance = null;

    const loadChart = async () => {
      const container = chartContainerRef.current;
      if (!container || !symbol) return;

      try {
        setLoading(true);
        setError(null);

        // Calculate 5-day range
        const now = Math.floor(Date.now() / 1000);
        const dayInSeconds = 86400;
        const from = now - (5 * dayInSeconds);
        const to = now;

        // Fetch candle data (hourly for 5 days) using chartStore with LRU caching
        const result = await fetchCandles(symbol, '60', from, to);

        if (!isActive) return;

        const data = result?.data;

        if (!data || data.s !== 'ok' || !data.t || data.t.length === 0) {
          throw new Error('No data');
        }

        // Transform data to line chart format
        const chartData = data.t.map((timestamp, i) => ({
          time: timestamp,
          value: data.c[i],
        }));

        // Determine price direction (first vs last)
        const firstPrice = chartData[0]?.value;
        const lastPrice = chartData[chartData.length - 1]?.value;
        const direction = lastPrice >= firstPrice ? 'positive' : 'negative';
        setPriceDirection(direction);

        if (!isActive || !container) return;

        // Wait for container to have dimensions
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (!isActive) return;

        const width = container.clientWidth || 200;

        // Create minimal chart
        chartInstance = createChart(container, {
          width,
          height,
          layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor: 'transparent',
          },
          grid: {
            vertLines: { visible: false },
            horzLines: { visible: false },
          },
          crosshair: {
            mode: 0, // Disabled
          },
          rightPriceScale: {
            visible: false,
          },
          leftPriceScale: {
            visible: false,
          },
          timeScale: {
            visible: false,
          },
          handleScroll: false,
          handleScale: false,
        });

        chartRef.current = chartInstance;

        // Add area series with color based on direction
        const colors = CHART_COLORS[direction];
        const series = chartInstance.addAreaSeries({
          topColor: colors.topColor,
          bottomColor: colors.bottomColor,
          lineColor: colors.line,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        series.setData(chartData);
        chartInstance.timeScale().fitContent();

        setLoading(false);
      } catch (err) {
        if (isActive) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadChart();

    return () => {
      isActive = false;
      if (chartInstance) {
        try {
          chartInstance.remove();
        } catch {
          // Ignore cleanup errors
        }
      }
      chartRef.current = null;
    };
  }, [symbol, height, fetchCandles]);

  // Handle resize
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !chartRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: entry.contentRect.width });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="relative w-full" style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse bg-line-light rounded w-full h-full" />
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">
          No chart data
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}

export default MiniChart;
