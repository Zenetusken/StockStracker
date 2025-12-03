import { useState } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { usePortfolioStore } from '../stores/portfolioStore';

function AddTransactionModal({ isOpen, onClose, portfolioId, portfolioCash = 0, onSuccess }) {
  const [type, setType] = useState('buy');
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('0');
  const [executedAt, setExecutedAt] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addTransaction = usePortfolioStore((state) => state.addTransaction);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }

    const parsedShares = parseFloat(shares);
    if (!parsedShares || parsedShares <= 0) {
      setError('Shares must be greater than 0');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (!parsedPrice || parsedPrice < 0) {
      setError('Price must be a valid positive number');
      return;
    }

    const parsedFees = parseFloat(fees) || 0;
    if (parsedFees < 0) {
      setError('Fees cannot be negative');
      return;
    }

    // Check cash balance for buy transactions
    const totalCost = (parsedShares * parsedPrice) + parsedFees;
    if (type === 'buy' && totalCost > portfolioCash) {
      setError(`Insufficient cash. Required: $${totalCost.toFixed(2)}, Available: $${portfolioCash.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await addTransaction(portfolioId, {
        symbol: symbol.trim().toUpperCase(),
        type,
        shares: parsedShares,
        price: parsedPrice,
        fees: parsedFees,
        notes: notes.trim() || null,
        executed_at: executedAt ? new Date(executedAt).toISOString() : null
      });

      // Reset form
      setType('buy');
      setSymbol('');
      setShares('');
      setPrice('');
      setFees('0');
      setExecutedAt(new Date().toISOString().split('T')[0]);
      setNotes('');

      onSuccess?.(result);
      onClose();
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(err.message || 'Failed to add transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setType('buy');
    setSymbol('');
    setShares('');
    setPrice('');
    setFees('0');
    setExecutedAt(new Date().toISOString().split('T')[0]);
    setNotes('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const totalCost = (parseFloat(shares) || 0) * (parseFloat(price) || 0) + (parseFloat(fees) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-text-primary">
            Add Transaction
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-card-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg">
              <p className="text-sm text-loss">{error}</p>
            </div>
          )}

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Transaction Type *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('buy')}
                data-testid="type-buy"
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  type === 'buy'
                    ? 'border-gain bg-gain/10 text-gain'
                    : 'border-line bg-page-bg text-text-secondary hover:bg-card-hover'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Buy
              </button>
              <button
                type="button"
                onClick={() => setType('sell')}
                data-testid="type-sell"
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  type === 'sell'
                    ? 'border-loss bg-loss/10 text-loss'
                    : 'border-line bg-page-bg text-text-secondary hover:bg-card-hover'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Sell
              </button>
            </div>
          </div>

          {/* Symbol Input */}
          <div>
            <label
              htmlFor="tx-symbol"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Symbol *
            </label>
            <input
              id="tx-symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand uppercase"
              autoFocus
            />
          </div>

          {/* Shares and Price - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tx-shares"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Shares *
              </label>
              <input
                id="tx-shares"
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="10"
                min="0.001"
                step="any"
                className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label
                htmlFor="tx-price"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Price per Share *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  $
                </span>
                <input
                  id="tx-price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="150.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          {/* Date Input */}
          <div>
            <label
              htmlFor="tx-date"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Date
            </label>
            <input
              id="tx-date"
              type="date"
              value={executedAt}
              onChange={(e) => setExecutedAt(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Fees Input */}
          <div>
            <label
              htmlFor="tx-fees"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Fees
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                $
              </span>
              <input
                id="tx-fees"
                type="number"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full pl-7 pr-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label
              htmlFor="tx-notes"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Notes
            </label>
            <textarea
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this transaction..."
              rows={2}
              className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>

          {/* Summary */}
          <div className="p-4 bg-table-header rounded-lg">
            <p className="text-xs font-medium text-text-secondary mb-2">
              Transaction Summary
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Type:</span>
                <span className={`font-medium ${type === 'buy' ? 'text-gain' : 'text-loss'}`}>
                  {type.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Symbol:</span>
                <span className="text-text-primary font-medium">
                  {symbol || '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total:</span>
                <span className="text-text-primary font-medium">
                  ${totalCost.toFixed(2)}
                </span>
              </div>
              {type === 'buy' && (
                <div className="flex justify-between text-sm pt-2 border-t border-line">
                  <span className="text-text-secondary">Cash Available:</span>
                  <span className={`font-medium ${portfolioCash >= totalCost ? 'text-gain' : 'text-loss'}`}>
                    ${portfolioCash.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-text-primary bg-page-bg border border-line rounded-lg hover:bg-table-header transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="submit-transaction"
              className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                type === 'buy'
                  ? 'bg-gain hover:bg-gain/90'
                  : 'bg-loss hover:bg-loss/90'
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : `${type === 'buy' ? 'Buy' : 'Sell'} Shares`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddTransactionModal;
