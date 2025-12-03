import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react';
import { usePortfolioStore } from '../stores/portfolioStore';

function LotSalesModal({ isOpen, onClose, portfolioId }) {
  const fetchLotSales = usePortfolioStore((state) => state.fetchLotSales);
  const [data, setData] = useState({ lotSales: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [symbolFilter, setSymbolFilter] = useState('');

  useEffect(() => {
    if (isOpen && portfolioId) {
      loadLotSales();
    }
  }, [isOpen, portfolioId, yearFilter, symbolFilter]);

  const loadLotSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLotSales(
        portfolioId,
        yearFilter || null,
        symbolFilter || null
      );
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get unique years from lot sales for filter dropdown
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y.toString());
    }
    return years;
  };

  // Get unique symbols from lot sales
  const getSymbolOptions = () => {
    const symbols = [...new Set(data.lotSales.map(sale => sale.symbol))];
    return symbols.sort();
  };

  if (!isOpen) return null;

  const { summary } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden" data-testid="lot-sales-modal">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10">
              <TrendingUp className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                Realized Gains Report
              </h2>
              <p className="text-sm text-text-secondary">
                Short-term vs Long-term Capital Gains
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-card-hover rounded transition-colors"
            data-testid="close-lot-sales-modal"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-line bg-page-bg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-secondary" />
              <span className="text-sm text-text-secondary">Filters:</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-secondary" />
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-1.5 text-sm bg-card border border-line rounded-md text-text-primary"
                data-testid="year-filter"
              >
                <option value="">All Years</option>
                {getYearOptions().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value.toUpperCase())}
                placeholder="Symbol"
                className="w-24 px-3 py-1.5 text-sm bg-card border border-line rounded-md text-text-primary placeholder:text-text-secondary"
                data-testid="symbol-filter"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {!loading && !error && (
          <div className="px-6 py-4 border-b border-line">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-page-bg" data-testid="total-gain-card">
                <div className="text-xs text-text-secondary uppercase mb-1">Total Realized</div>
                <div className={`text-lg font-bold ${summary.totalRealizedGain >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {formatCurrency(summary.totalRealizedGain || 0)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-page-bg" data-testid="short-term-card">
                <div className="text-xs text-text-secondary uppercase mb-1">Short-Term (&lt;1yr)</div>
                <div className={`text-lg font-bold ${summary.totalShortTerm >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {formatCurrency(summary.totalShortTerm || 0)}
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Gains: {formatCurrency(summary.shortTermGain || 0)} / Losses: {formatCurrency(summary.shortTermLoss || 0)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-page-bg" data-testid="long-term-card">
                <div className="text-xs text-text-secondary uppercase mb-1">Long-Term (&gt;1yr)</div>
                <div className={`text-lg font-bold ${summary.totalLongTerm >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {formatCurrency(summary.totalLongTerm || 0)}
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Gains: {formatCurrency(summary.longTermGain || 0)} / Losses: {formatCurrency(summary.longTermLoss || 0)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-page-bg">
                <div className="text-xs text-text-secondary uppercase mb-1">Sales Count</div>
                <div className="text-lg font-bold text-text-primary">
                  {data.lotSales.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-auto max-h-[calc(90vh-350px)]">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">
              Loading lot sales...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-loss">
              {error}
            </div>
          ) : data.lotSales.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              No realized gains found for the selected period.
              <br />
              <span className="text-sm">Sell some holdings to see realized gains here.</span>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-table-header sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    Symbol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    Sale Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    Purchase Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                    Shares
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                    Cost Basis
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                    Sale Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                    Realized Gain
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">
                    Term
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.lotSales.map((sale, index) => {
                  const costBasis = sale.shares_sold * sale.cost_per_share;
                  const proceeds = sale.shares_sold * sale.sale_price;

                  return (
                    <tr key={sale.id || index} className="hover:bg-card-hover" data-testid={`lot-sale-row-${index}`}>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {sale.symbol}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDate(sale.sale_date)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDate(sale.lot_purchase_date)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {sale.shares_sold.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatCurrency(costBasis)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {formatCurrency(proceeds)}
                      </td>
                      <td className="px-4 py-3 text-right" data-testid="realized-gain">
                        <span className={`font-medium ${sale.realized_gain >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {sale.realized_gain >= 0 ? '+' : ''}{formatCurrency(sale.realized_gain)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" data-testid="term-type">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          sale.is_short_term
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {sale.is_short_term ? 'Short-term' : 'Long-term'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-table-header">
                <tr>
                  <td colSpan="6" className="px-4 py-3 text-right text-text-secondary font-medium">
                    Total Realized Gain/Loss:
                  </td>
                  <td className="px-4 py-3 text-right" data-testid="total-realized">
                    <span className={`font-bold ${summary.totalRealizedGain >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {summary.totalRealizedGain >= 0 ? '+' : ''}{formatCurrency(summary.totalRealizedGain || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default LotSalesModal;
