import { useState, useEffect } from 'react';
import { X, Layers } from 'lucide-react';
import { usePortfolioStore } from '../stores/portfolioStore';

function TaxLotsModal({ isOpen, onClose, portfolioId, symbol }) {
  const fetchTaxLots = usePortfolioStore((state) => state.fetchTaxLots);
  const [taxLots, setTaxLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && portfolioId && symbol) {
      loadTaxLots();
    }
  }, [isOpen, portfolioId, symbol]);

  const loadTaxLots = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTaxLots(portfolioId, symbol);
      setTaxLots(data);
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

  const calculateHoldingPeriod = (purchaseDate) => {
    const days = Math.floor((new Date() - new Date(purchaseDate)) / (1000 * 60 * 60 * 24));
    if (days < 365) {
      return { days, isLongTerm: false, label: `${days} days (Short-term)` };
    }
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    return {
      days,
      isLongTerm: true,
      label: `${years}y ${remainingDays}d (Long-term)`
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" data-testid="tax-lots-modal">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-brand" />
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                Tax Lots for {symbol}
              </h2>
              <p className="text-sm text-text-secondary">
                Sorted by purchase date (FIFO order)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-card-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(80vh-120px)]">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">
              Loading tax lots...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-loss">
              {error}
            </div>
          ) : taxLots.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              No tax lots found for {symbol}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-table-header sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    Purchase Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                    Shares
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                    Cost/Share
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                    Cost Basis
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                    Holding Period
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {taxLots.map((lot, index) => {
                  const holdingPeriod = calculateHoldingPeriod(lot.purchase_date);
                  const costBasis = lot.shares_remaining * lot.cost_per_share;

                  return (
                    <tr key={lot.id || index} className="hover:bg-card-hover" data-testid={`tax-lot-row-${index}`}>
                      <td className="px-4 py-3 text-text-primary">
                        {formatDate(lot.purchase_date)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {lot.shares_remaining.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatCurrency(lot.cost_per_share)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary font-medium">
                        {formatCurrency(costBasis)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${holdingPeriod.isLongTerm ? 'text-gain' : 'text-text-secondary'}`}>
                          {holdingPeriod.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-table-header">
                <tr>
                  <td className="px-4 py-3 text-text-secondary font-medium">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary font-bold">
                    {taxLots.reduce((sum, lot) => sum + lot.shares_remaining, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-text-primary font-bold">
                    {formatCurrency(taxLots.reduce((sum, lot) => sum + (lot.shares_remaining * lot.cost_per_share), 0))}
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

export default TaxLotsModal;
