import { useState } from 'react';
import { X, Briefcase } from 'lucide-react';
import { usePortfolioStore } from '../stores/portfolioStore';

function NewPortfolioModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cashBalance, setCashBalance] = useState('10000');
  const [isPaperTrading, setIsPaperTrading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createPortfolio = usePortfolioStore((state) => state.createPortfolio);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Portfolio name is required');
      return;
    }

    const parsedCash = parseFloat(cashBalance) || 0;
    if (parsedCash < 0) {
      setError('Cash balance cannot be negative');
      return;
    }

    setIsSubmitting(true);

    try {
      const portfolio = await createPortfolio(
        name.trim(),
        description.trim(),
        parsedCash,
        isPaperTrading
      );
      setName('');
      setDescription('');
      setCashBalance('10000');
      setIsPaperTrading(true);
      onSuccess?.(portfolio);
      onClose();
    } catch (err) {
      console.error('Error creating portfolio:', err);
      setError(err.message || 'Failed to create portfolio. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setCashBalance('10000');
    setIsPaperTrading(true);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-text-primary">
            Create New Portfolio
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

          {/* Name Input */}
          <div>
            <label
              htmlFor="portfolio-name"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Portfolio Name *
            </label>
            <input
              id="portfolio-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Growth Portfolio"
              className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>

          {/* Description Input */}
          <div>
            <label
              htmlFor="portfolio-description"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Description
            </label>
            <textarea
              id="portfolio-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your portfolio strategy..."
              rows={3}
              className="w-full px-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>

          {/* Cash Balance Input */}
          <div>
            <label
              htmlFor="portfolio-cash"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Initial Cash Balance
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                $
              </span>
              <input
                id="portfolio-cash"
                type="number"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
                placeholder="10000"
                min="0"
                step="0.01"
                className="w-full pl-7 pr-3 py-2 border border-line rounded-lg bg-page-bg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Enter the starting cash amount for this portfolio
            </p>
          </div>

          {/* Paper Trading Checkbox */}
          <div className="flex items-start gap-3">
            <input
              id="portfolio-paper-trading"
              type="checkbox"
              checked={isPaperTrading}
              onChange={(e) => setIsPaperTrading(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-line focus:ring-2 focus:ring-brand"
            />
            <label
              htmlFor="portfolio-paper-trading"
              className="text-sm text-text-primary"
            >
              <span className="font-medium">Paper Trading</span>
              <p className="text-text-muted mt-0.5">
                Track simulated trades without real money. Great for learning and testing strategies.
              </p>
            </label>
          </div>

          {/* Preview */}
          <div className="p-4 bg-table-header rounded-lg">
            <p className="text-xs font-medium text-text-secondary mb-2">
              Preview
            </p>
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-brand" />
              <div className="flex-1">
                <span className="text-text-primary font-medium">
                  {name || 'Portfolio Name'}
                </span>
                <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                  <span>${parseFloat(cashBalance || 0).toLocaleString()}</span>
                  {isPaperTrading && (
                    <span className="px-1.5 py-0.5 bg-brand/10 text-brand rounded">
                      Paper Trading
                    </span>
                  )}
                </div>
              </div>
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
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewPortfolioModal;
