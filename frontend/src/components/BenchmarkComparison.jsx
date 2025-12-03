import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { useQuotes } from '../stores/quoteStore';

function BenchmarkComparison({ portfolioReturn, portfolioValue, portfolioCostBasis }) {
  const { quotes, fetchQuote } = useQuotes(['SPY']);
  const [loading, setLoading] = useState(true);

  // Fetch SPY quote on mount
  useEffect(() => {
    const loadBenchmark = async () => {
      setLoading(true);
      try {
        await fetchQuote('SPY');
      } catch (err) {
        console.error('Failed to load SPY benchmark:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBenchmark();
  }, [fetchQuote]);

  const spyQuote = quotes['SPY'];
  const spyDayChange = spyQuote?.dp || 0;

  // Calculate portfolio day change percentage
  const portfolioDayChange = portfolioCostBasis > 0
    ? ((portfolioValue - portfolioCostBasis) / portfolioCostBasis) * 100
    : 0;

  // Calculate relative performance (portfolio vs benchmark)
  const relativePerformance = portfolioDayChange - spyDayChange;

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="bg-card rounded-lg border border-line p-6" data-testid="benchmark-comparison">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Scale className="w-5 h-5 text-brand" />
        <h3 className="text-lg font-semibold text-text-primary">Benchmark Comparison</h3>
      </div>

      {loading ? (
        <div className="text-center py-4 text-text-secondary">
          Loading benchmark data...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Comparison Cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Portfolio Performance */}
            <div className="p-4 bg-page-bg rounded-lg" data-testid="portfolio-performance">
              <div className="text-xs text-text-secondary uppercase mb-1">Your Portfolio</div>
              <div className={`text-xl font-bold ${portfolioDayChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                {formatPercent(portfolioDayChange)}
              </div>
              <div className="text-xs text-text-secondary mt-1">Total Return</div>
            </div>

            {/* S&P 500 Performance */}
            <div className="p-4 bg-page-bg rounded-lg" data-testid="sp500-performance">
              <div className="text-xs text-text-secondary uppercase mb-1">S&P 500 (SPY)</div>
              <div className={`text-xl font-bold ${spyDayChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                {formatPercent(spyDayChange)}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {spyQuote ? formatCurrency(spyQuote.c) : 'N/A'}
              </div>
            </div>

            {/* Relative Performance */}
            <div className="p-4 bg-page-bg rounded-lg" data-testid="relative-performance">
              <div className="text-xs text-text-secondary uppercase mb-1">Relative</div>
              <div className={`text-xl font-bold ${relativePerformance >= 0 ? 'text-gain' : 'text-loss'}`}>
                {formatPercent(relativePerformance)}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {relativePerformance >= 0 ? 'Outperforming' : 'Underperforming'}
              </div>
            </div>
          </div>

          {/* Visual Comparison Bar */}
          <div className="mt-6" data-testid="comparison-bar">
            <div className="flex justify-between text-xs text-text-secondary mb-2">
              <span>Portfolio</span>
              <span>S&P 500</span>
            </div>
            <div className="relative h-8 bg-page-bg rounded-lg overflow-hidden">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-line" />

              {/* Portfolio bar */}
              <div
                className={`absolute top-1 bottom-1 rounded ${portfolioDayChange >= 0 ? 'bg-gain' : 'bg-loss'}`}
                style={{
                  left: portfolioDayChange >= 0 ? '50%' : `${50 + portfolioDayChange}%`,
                  width: `${Math.min(Math.abs(portfolioDayChange), 50)}%`
                }}
              />

              {/* SPY bar (shown in different shade) */}
              <div
                className={`absolute top-1 bottom-1 rounded opacity-50 ${spyDayChange >= 0 ? 'bg-brand' : 'bg-loss'}`}
                style={{
                  left: spyDayChange >= 0 ? '50%' : `${50 + spyDayChange}%`,
                  width: `${Math.min(Math.abs(spyDayChange), 50)}%`
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span className={portfolioDayChange >= 0 ? 'text-gain' : 'text-loss'}>
                {formatPercent(portfolioDayChange)}
              </span>
              <span className={spyDayChange >= 0 ? 'text-brand' : 'text-loss'}>
                {formatPercent(spyDayChange)}
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-4 p-3 bg-page-bg rounded-lg">
            <div className="flex items-center gap-2">
              {relativePerformance >= 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-gain" />
                  <span className="text-sm text-text-primary">
                    Your portfolio is <span className="text-gain font-medium">outperforming</span> the S&P 500 by {formatPercent(Math.abs(relativePerformance))}
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-loss" />
                  <span className="text-sm text-text-primary">
                    Your portfolio is <span className="text-loss font-medium">underperforming</span> the S&P 500 by {formatPercent(Math.abs(relativePerformance))}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BenchmarkComparison;
