import { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { TrendingUp } from 'lucide-react';
import { usePortfolioStore } from '../stores/portfolioStore';

const PERIODS = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' }
];

function PortfolioValueChart({ portfolioId }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const fetchValueHistory = usePortfolioStore((state) => state.fetchValueHistory);

  const [period, setPeriod] = useState('1M');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ history: [], currentValue: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchValueHistory(portfolioId, period);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, period, fetchValueHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af'
      },
      grid: {
        vertLines: { color: 'rgba(156, 163, 175, 0.1)' },
        horzLines: { color: 'rgba(156, 163, 175, 0.1)' }
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      rightPriceScale: {
        borderVisible: false
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false
      },
      crosshair: {
        horzLine: {
          visible: true,
          labelVisible: true
        },
        vertLine: {
          visible: true,
          labelVisible: true
        }
      }
    });

    // Create area series
    const areaSeries = chart.addAreaSeries({
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.3)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01
      }
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data when data changes
  useEffect(() => {
    if (!seriesRef.current || !data.history || data.history.length === 0) return;

    const chartData = data.history.map(item => ({
      time: item.time,
      value: item.value
    }));

    seriesRef.current.setData(chartData);
    chartRef.current?.timeScale().fitContent();
  }, [data.history]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="bg-card rounded-lg border border-line p-6" data-testid="portfolio-value-chart">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand" />
          <h3 className="text-lg font-semibold text-text-primary">Portfolio Value</h3>
        </div>
        <div className="flex items-center gap-1 bg-page-bg rounded-lg p-1" data-testid="period-selector">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              data-testid={`period-${p.value}`}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === p.value
                  ? 'bg-brand text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current Value */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-text-primary" data-testid="current-value">
          {formatCurrency(data.currentValue || 0)}
        </div>
        <div className="text-sm text-text-secondary">Current Portfolio Value</div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50 z-10">
            <div className="text-text-secondary">Loading chart...</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50 z-10">
            <div className="text-loss">{error}</div>
          </div>
        )}
        <div
          ref={chartContainerRef}
          data-testid="chart-container"
          className="w-full"
          style={{ height: '300px' }}
        />
        {!loading && !error && data.history.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-text-secondary text-center">
              <p>No historical data available</p>
              <p className="text-sm">Add transactions to see portfolio value over time</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PortfolioValueChart;
