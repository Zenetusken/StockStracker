import { useMemo } from 'react';
import { DollarSign, Calendar, TrendingUp } from 'lucide-react';

function DividendIncome({ transactions }) {
  // Calculate dividend income from transactions
  const dividendData = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        total: 0,
        ytd: 0,
        bySymbol: [],
        byMonth: []
      };
    }

    const currentYear = new Date().getFullYear();
    const dividendTxs = transactions.filter(tx => tx.type === 'dividend');

    // Calculate totals
    const total = dividendTxs.reduce((sum, tx) => sum + (tx.shares * tx.price), 0);
    const ytd = dividendTxs
      .filter(tx => new Date(tx.executed_at).getFullYear() === currentYear)
      .reduce((sum, tx) => sum + (tx.shares * tx.price), 0);

    // Group by symbol
    const symbolMap = {};
    dividendTxs.forEach(tx => {
      const amount = tx.shares * tx.price;
      if (!symbolMap[tx.symbol]) {
        symbolMap[tx.symbol] = { symbol: tx.symbol, total: 0, count: 0 };
      }
      symbolMap[tx.symbol].total += amount;
      symbolMap[tx.symbol].count += 1;
    });

    const bySymbol = Object.values(symbolMap).sort((a, b) => b.total - a.total);

    // Group by month (last 12 months)
    const monthMap = {};
    dividendTxs.forEach(tx => {
      const date = new Date(tx.executed_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = tx.shares * tx.price;
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { month: monthKey, total: 0 };
      }
      monthMap[monthKey].total += amount;
    });

    const byMonth = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return {
      total,
      ytd,
      bySymbol,
      byMonth
    };
  }, [transactions]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-card rounded-lg border border-line p-6" data-testid="dividend-income">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="w-5 h-5 text-gain" />
        <h3 className="text-lg font-semibold text-text-primary">Dividend Income</h3>
      </div>

      {dividendData.total === 0 ? (
        <div className="text-center py-6 text-text-secondary">
          No dividend income recorded yet
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Total Dividends */}
            <div className="p-4 bg-page-bg rounded-lg" data-testid="total-dividends">
              <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                <TrendingUp className="w-3 h-3" />
                Total Dividends
              </div>
              <div className="text-xl font-bold text-gain">
                {formatCurrency(dividendData.total)}
              </div>
            </div>

            {/* YTD Dividends */}
            <div className="p-4 bg-page-bg rounded-lg" data-testid="ytd-dividends">
              <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                <Calendar className="w-3 h-3" />
                YTD Dividends
              </div>
              <div className="text-xl font-bold text-gain">
                {formatCurrency(dividendData.ytd)}
              </div>
            </div>
          </div>

          {/* Breakdown by Symbol */}
          {dividendData.bySymbol.length > 0 && (
            <div data-testid="dividend-by-symbol">
              <h4 className="text-sm font-medium text-text-secondary mb-3">By Symbol</h4>
              <div className="space-y-2">
                {dividendData.bySymbol.slice(0, 5).map(item => (
                  <div
                    key={item.symbol}
                    className="flex items-center justify-between p-2 bg-page-bg rounded"
                    data-testid={`dividend-symbol-${item.symbol}`}
                  >
                    <div>
                      <span className="text-text-primary font-medium">{item.symbol}</span>
                      <span className="text-text-muted text-xs ml-2">
                        ({item.count} payment{item.count > 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="text-gain font-medium">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Trend (simple bar representation) */}
          {dividendData.byMonth.length > 0 && (
            <div data-testid="dividend-by-month">
              <h4 className="text-sm font-medium text-text-secondary mb-3">Monthly Trend</h4>
              <div className="flex items-end gap-1 h-16">
                {dividendData.byMonth.map(item => {
                  const maxVal = Math.max(...dividendData.byMonth.map(m => m.total));
                  const heightPercent = maxVal > 0 ? (item.total / maxVal) * 100 : 0;
                  return (
                    <div
                      key={item.month}
                      className="flex-1 flex flex-col items-center"
                      data-testid={`dividend-month-${item.month}`}
                    >
                      <div
                        className="w-full bg-gain rounded-t"
                        style={{ height: `${heightPercent}%`, minHeight: item.total > 0 ? '4px' : '0' }}
                        title={`${formatMonth(item.month)}: ${formatCurrency(item.total)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-text-muted mt-1">
                {dividendData.byMonth.length > 0 && (
                  <>
                    <span>{formatMonth(dividendData.byMonth[0].month)}</span>
                    <span>{formatMonth(dividendData.byMonth[dividendData.byMonth.length - 1].month)}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DividendIncome;
