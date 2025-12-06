import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { usePortfolioStore } from '../stores/portfolioStore';

function DeletePortfolioModal({ portfolio, isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const deletePortfolio = usePortfolioStore((state) => state.deletePortfolio);

  const handleDelete = async () => {
    setLoading(true);
    setError('');

    try {
      await deletePortfolio(portfolio.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error deleting portfolio:', err);
      setError(err.message || 'Failed to delete portfolio');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  const isDefault = portfolio?.is_default === 1;
  const holdingsCount = portfolio?.holdings?.length || 0;
  const transactionCount = portfolio?.recent_transactions?.length || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full" data-testid="delete-portfolio-modal">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-text-primary">
            Delete Portfolio
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-text-muted hover:text-text-primary dark:hover:text-gray-300 transition-colors disabled:opacity-50"
            data-testid="close-delete-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isDefault ? (
            <>
              {/* Default portfolio warning */}
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-text-primary dark:text-gray-300 mb-2">
                    This is your default portfolio and cannot be deleted.
                  </p>
                  <p className="text-sm text-text-secondary dark:text-gray-400">
                    You can rename it or create a new portfolio instead.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Delete confirmation */}
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-loss flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-text-primary dark:text-gray-300 mb-2">
                    Are you sure you want to delete <span className="font-semibold">"{portfolio?.name}"</span>?
                  </p>
                  <p className="text-sm text-text-secondary dark:text-gray-400">
                    This will permanently remove the portfolio including:
                  </p>
                  <ul className="text-sm text-text-secondary dark:text-gray-400 mt-2 ml-4 list-disc">
                    {holdingsCount > 0 && (
                      <li>{holdingsCount} holding{holdingsCount !== 1 ? 's' : ''}</li>
                    )}
                    {transactionCount > 0 && (
                      <li>All transaction history</li>
                    )}
                    <li>Tax lot records and realized gains</li>
                  </ul>
                  <p className="text-sm text-loss mt-3 font-medium">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="mb-4 p-3 bg-loss/10 border border-loss/30 rounded-lg text-sm text-loss" data-testid="delete-error">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-text-primary dark:text-gray-300 hover:bg-table-header dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              data-testid="cancel-delete"
            >
              {isDefault ? 'Close' : 'Cancel'}
            </button>
            {!isDefault && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="confirm-delete"
              >
                {loading ? 'Deleting...' : 'Delete Portfolio'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeletePortfolioModal;
