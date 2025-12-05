import { useState, useEffect, useMemo } from 'react';
import { PieChart as PieChartIcon, LayoutGrid, Building2 } from 'lucide-react';
import api from '../api/client';

// Color palette for pie slices
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

// Sector color mapping for consistent coloring
const SECTOR_COLORS = {
  'Technology': '#3b82f6',
  'Healthcare': '#10b981',
  'Financial Services': '#f59e0b',
  'Consumer Cyclical': '#ef4444',
  'Communication Services': '#8b5cf6',
  'Consumer Defensive': '#ec4899',
  'Energy': '#06b6d4',
  'Industrials': '#84cc16',
  'Basic Materials': '#f97316',
  'Real Estate': '#6366f1',
  'Utilities': '#14b8a6',
  'Other': '#6b7280',
  'Cash': '#9ca3af',
};

function AllocationPieChart({ holdings, totalValue, cashBalance }) {
  const [viewMode, setViewMode] = useState('holding'); // 'holding' or 'sector'
  const [sectorData, setSectorData] = useState({});
  const [loadingSectors, setLoadingSectors] = useState(false);

  // Fetch sector data for holdings
  // N5 fix: sectorData intentionally excluded from deps - used only to check what's missing
  // Adding it would create infinite loop since the effect updates sectorData
  useEffect(() => {
    const fetchSectorData = async () => {
      if (holdings.length === 0) return;

      const symbols = holdings.map(h => h.symbol);

      // Check if we already have all the data
      const missingSymbols = symbols.filter(s => !sectorData[s]);
      if (missingSymbols.length === 0) return;

      setLoadingSectors(true);
      try {
        const profiles = await api.post('/quotes/profiles', { symbols: missingSymbols });
        setSectorData(prev => ({ ...prev, ...profiles }));
      } catch (err) {
        console.error('Failed to fetch sector data:', err);
      } finally {
        setLoadingSectors(false);
      }
    };

    fetchSectorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  // Calculate allocation data by holding
  const holdingData = useMemo(() => {
    const data = [];

    // Add holdings
    holdings.forEach((holding, index) => {
      const value = holding.marketValue || (holding.total_shares * (holding.currentPrice || holding.average_cost));
      const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;
      data.push({
        name: holding.symbol,
        value,
        percentage,
        color: COLORS[index % COLORS.length]
      });
    });

    // Add cash if significant
    if (cashBalance > 0 && totalValue > 0) {
      const cashPercentage = (cashBalance / totalValue) * 100;
      data.push({
        name: 'Cash',
        value: cashBalance,
        percentage: cashPercentage,
        color: '#6b7280' // gray
      });
    }

    // Sort by value descending
    return data.sort((a, b) => b.value - a.value);
  }, [holdings, totalValue, cashBalance]);

  // Calculate allocation data by sector
  const sectorChartData = useMemo(() => {
    const sectorTotals = {};

    // Group holdings by sector
    holdings.forEach((holding) => {
      const value = holding.marketValue || (holding.total_shares * (holding.currentPrice || holding.average_cost));
      const profile = sectorData[holding.symbol];
      const sector = profile?.finnhubIndustry || profile?.sector || 'Other';

      if (!sectorTotals[sector]) {
        sectorTotals[sector] = { value: 0, symbols: [] };
      }
      sectorTotals[sector].value += value;
      sectorTotals[sector].symbols.push(holding.symbol);
    });

    // Add cash
    if (cashBalance > 0 && totalValue > 0) {
      sectorTotals['Cash'] = { value: cashBalance, symbols: [] };
    }

    // Convert to chart data
    const data = Object.entries(sectorTotals).map(([sector, { value, symbols }]) => ({
      name: sector,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      color: SECTOR_COLORS[sector] || COLORS[Object.keys(sectorTotals).indexOf(sector) % COLORS.length],
      symbols
    }));

    // Sort by value descending
    return data.sort((a, b) => b.value - a.value);
  }, [holdings, totalValue, cashBalance, sectorData]);

  // Select chart data based on view mode
  const chartData = viewMode === 'sector' ? sectorChartData : holdingData;

  // Generate SVG path for each slice
  const generatePieSlices = () => {
    if (chartData.length === 0) return [];

    const slices = [];
    let currentAngle = -90; // Start from top

    chartData.forEach((item, index) => {
      const angle = (item.percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      // Convert angles to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Calculate path coordinates
      const cx = 100;
      const cy = 100;
      const r = 80;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      // Handle full circle case
      let path;
      if (chartData.length === 1) {
        path = `
          M ${cx} ${cy - r}
          A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}
          Z
        `;
      } else {
        path = `
          M ${cx} ${cy}
          L ${x1} ${y1}
          A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}
          Z
        `;
      }

      slices.push({
        ...item,
        path,
        index
      });

      currentAngle = endAngle;
    });

    return slices;
  };

  const slices = generatePieSlices();

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="bg-card rounded-lg border border-line p-6" data-testid="allocation-pie-chart">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-brand" />
          <h3 className="text-lg font-semibold text-text-primary">Allocation</h3>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-page-bg rounded-lg p-1" data-testid="allocation-view-toggle">
          <button
            onClick={() => setViewMode('holding')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'holding'
                ? 'bg-card text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="view-by-holding"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>By Holding</span>
          </button>
          <button
            onClick={() => setViewMode('sector')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'sector'
                ? 'bg-card text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="view-by-sector"
          >
            <Building2 className="w-4 h-4" />
            <span>By Sector</span>
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          No holdings to display
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Pie Chart SVG */}
          <div className="flex-shrink-0 relative" data-testid="pie-chart-svg">
            {loadingSectors && viewMode === 'sector' && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80 rounded-full">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
              </div>
            )}
            <svg width="200" height="200" viewBox="0 0 200 200">
              {slices.map((slice) => (
                <path
                  key={slice.name}
                  d={slice.path}
                  fill={slice.color}
                  stroke="var(--color-card)"
                  strokeWidth="2"
                  data-testid={`pie-slice-${slice.name}`}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <title>{`${slice.name}: ${slice.percentage.toFixed(1)}%`}</title>
                </path>
              ))}
              {/* Center circle for donut effect */}
              <circle cx="100" cy="100" r="50" fill="var(--color-card)" />
              <text
                x="100"
                y="95"
                textAnchor="middle"
                className="fill-text-secondary text-xs"
              >
                Total
              </text>
              <text
                x="100"
                y="115"
                textAnchor="middle"
                className="fill-text-primary text-sm font-bold"
              >
                {formatCurrency(totalValue)}
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-grow w-full" data-testid="pie-chart-legend">
            <div className="grid grid-cols-1 gap-2">
              {chartData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-card-hover transition-colors"
                  data-testid={`legend-item-${item.name}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <span className="text-text-primary font-medium">{item.name}</span>
                      {viewMode === 'sector' && item.symbols && item.symbols.length > 0 && (
                        <div className="text-xs text-text-secondary">
                          {item.symbols.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-text-secondary text-sm">
                      {formatCurrency(item.value)}
                    </span>
                    <span className="text-text-primary font-medium w-16 text-right" data-testid={`allocation-${item.name}`}>
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllocationPieChart;
