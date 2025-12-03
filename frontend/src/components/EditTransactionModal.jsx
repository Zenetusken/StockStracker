import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { usePortfolioStore } from '../stores/portfolioStore';

function EditTransactionModal({ isOpen, transaction, portfolioId, onClose, onSuccess }) {
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [fees, setFees] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateTransaction = usePortfolioStore((state) => state.updateTransaction);

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction) {
      setPrice(transaction.price?.toString() || '');
      setShares(transaction.shares?.toString() || '');
      setFees(transaction.fees?.toString() || '0');
      setNotes(transaction.notes || '');
      setError('');
    }
  }, [transaction]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedPrice = parseFloat(price);
    if (!parsedPrice || parsedPrice < 0) {
      setError('Price must be a valid positive number');
      return;
    }

    const parsedShares = parseFloat(shares);
    if (!parsedShares || parsedShares <= 0) {
      setError('Shares must be greater than 0');
      return;
    }

    const parsedFees = parseFloat(fees) || 0;
    if (parsedFees < 0) {
      setError('Fees cannot be negative');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateTransaction(portfolioId, transaction.id, {
        price: parsedPrice,
        shares: parsedShares,
        fees: parsedFees,
        notes: notes.trim() || null
      });

      onSuccess?.();
    } catch (err) {
      console.error('Error updating transaction:', err);
      setError(err.message || 'Failed to update transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-text-primary">
            Edit Transaction
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-card-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg">
              <p className="text-sm text-loss">{error}</p>
            </div>
          )}

          {/* Transaction Info (Read-only) */}
          <div className="p-4 bg-table-header rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">Type:</span>
              <span className={`font-medium ${
                transaction.type === 'buy' ? 'text-gain' :
                transaction.type === 'dividend' ? 'text-brand' :
                'text-loss'
              }`}>
                {transaction.type?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Symbol:</span>
              <span className="text-text-primary font-medium">{transaction.symbol}</span>
            </div>
          </div>

          {/* Shares Input */}
          <div>
            <label
              htmlFor="edit-shares"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Shares
            </label>
            <input
              id="edit-shares"
              data-testid="edit-shares"
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              min="0.001"
              step="any"
              className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Price Input */}
          <div>
            <label
              htmlFor="edit-price"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                $
              </span>
              <input
                id="edit-price"
                data-testid="edit-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
                className="w-full pl-7 pr-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {/* Fees Input */}
          <div>
            <label
              htmlFor="edit-fees"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Fees
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                $
              </span>
              <input
                id="edit-fees"
                data-testid="edit-fees"
                type="number"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                min="0"
                step="0.01"
                className="w-full pl-7 pr-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label
              htmlFor="edit-notes"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Notes
            </label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-text-primary bg-page-bg border border-line rounded-lg hover:bg-table-header transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="submit-edit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditTransactionModal;
