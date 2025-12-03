import { useMemo } from 'react';
import { TrendingUp, ArrowUpRight } from 'lucide-react';

function TopPerformers({ holdings, limit = 5 }) {
  // Calculate and sort holdings by gain percentage (descending)
  const topPerformers = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];

    const holdingsWithGain = holdings.map(holding => {
      const currentPrice = holding.currentPrice || holding.average_cost;
      const costBasis = holding.total_shares * holding.average_cost;
      const marketValue = holding.marketValue || (holding.total_shares * currentPrice);
      const gainLoss = marketValue - costBasis;
      const gainPercent = costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0;

      return {
        ...holding,
        currentPrice,
        costBasis,
        marketValue,
        gainLoss,
        gainPercent
      };
    });

    // Sort by gain percentage descending (best performers first)
    return holdingsWithGain
      .sort((a, b) => b.gainPercent - a.gainPercent)
      .slice(0, limit);
  }, [holdings, limit]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (topPerformers.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-line p-6" data-testid="top-performers">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gain" />
          <h3 className="text-lg font-semibold text-text-primary">Top Performers</h3>
        </div>
        <div className="text-center py-6 text-text-secondary">
          No holdings to display
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-line p-6" data-testid="top-performers">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-gain" />
        <h3 className="text-lg font-semibold text-text-primary">Top Performers</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="top-performers-table">
          <thead>
            <tr className="text-xs text-text-secondary uppercase border-b border-line">
              <th className="text-left py-2 px-2">Symbol</th>
              <th className="text-right py-2 px-2">Price</th>
              <th className="text-right py-2 px-2">Gain/Loss</th>
              <th className="text-right py-2 px-2">Return</th>
            </tr>
          </thead>
          <tbody>
            {topPerformers.map((holding, index) => (
              <tr
                key={holding.symbol}
                className="border-b border-line/50 hover:bg-card-hover transition-colors"
                data-testid={`top-performer-row-${index}`}
              >
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-medium">{holding.symbol}</span>
                    <ArrowUpRight className="w-3 h-3 text-gain" />
                  </div>
                </td>
                <td className="text-right py-3 px-2 text-text-primary">
                  {formatCurrency(holding.currentPrice)}
                </td>
                <td className={`text-right py-3 px-2 ${holding.gainLoss >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {formatCurrency(holding.gainLoss)}
                </td>
                <td className={`text-right py-3 px-2 font-medium ${holding.gainPercent >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {formatPercent(holding.gainPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TopPerformers;
