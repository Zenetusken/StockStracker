import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, X, TrendingUp, TrendingDown, Percent, CheckCircle, XCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { useAlertStore } from '../stores/alertStore';

function Alerts() {
  const { alerts, loading, error, fetchAlerts, createAlert, deleteAlert, toggleAlert, clearError } = useAlertStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    type: 'price_above',
    target_price: '',
    is_recurring: false
  });
  const [formError, setFormError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validate
    if (!formData.symbol.trim()) {
      setFormError('Symbol is required');
      return;
    }
    if (!formData.target_price || isNaN(parseFloat(formData.target_price))) {
      setFormError('Valid target price is required');
      return;
    }

    try {
      await createAlert({
        symbol: formData.symbol.toUpperCase(),
        name: formData.name || undefined,
        type: formData.type,
        target_price: parseFloat(formData.target_price),
        is_recurring: formData.is_recurring
      });
      setShowCreateModal(false);
      setFormData({
        symbol: '',
        name: '',
        type: 'price_above',
        target_price: '',
        is_recurring: false
      });
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAlert(id);
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'price_above':
        return <TrendingUp className="w-4 h-4 text-gain" />;
      case 'price_below':
        return <TrendingDown className="w-4 h-4 text-loss" />;
      case 'percent_change':
        return <Percent className="w-4 h-4 text-brand" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'price_above':
        return 'Price Above';
      case 'price_below':
        return 'Price Below';
      case 'percent_change':
        return 'Percent Change';
      default:
        return type;
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto" data-testid="alerts-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-brand" />
            <h1 className="text-2xl font-bold text-text-primary">Price Alerts</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            data-testid="new-alert-button"
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Alert
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-loss/10 border border-loss/20 rounded-lg text-loss flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Alerts List */}
        <div className="bg-card rounded-lg border border-line" data-testid="alerts-list">
          {loading && alerts.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              No alerts yet. Create one to get notified when prices hit your targets.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
                  data-testid={`alert-item-${alert.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-page-bg rounded-lg">
                      {getTypeIcon(alert.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{alert.symbol}</span>
                        <span className="text-xs px-2 py-0.5 bg-page-bg rounded text-text-secondary">
                          {getTypeLabel(alert.type)}
                        </span>
                        {alert.is_recurring ? (
                          <span className="text-xs px-2 py-0.5 bg-brand/10 text-brand rounded">
                            Recurring
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-text-secondary/10 text-text-secondary rounded">
                            One-time
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-text-secondary">
                        {alert.name || `${getTypeLabel(alert.type)} ${formatPrice(alert.target_price)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium text-text-primary">
                        {formatPrice(alert.target_price)}
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {alert.is_active ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-gain" />
                            <span className="text-gain">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-text-muted" />
                            <span className="text-text-muted">Inactive</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAlert(alert.id)}
                        data-testid={`toggle-alert-${alert.id}`}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          alert.is_active
                            ? 'bg-loss/10 text-loss hover:bg-loss/20'
                            : 'bg-gain/10 text-gain hover:bg-gain/20'
                        }`}
                      >
                        {alert.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => setDeletingId(alert.id)}
                        data-testid={`delete-alert-${alert.id}`}
                        className="p-1.5 hover:bg-loss/10 rounded transition-colors text-text-secondary hover:text-loss"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Alert Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md" data-testid="create-alert-modal">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-line">
                <h2 className="text-xl font-semibold text-text-primary">
                  Create Price Alert
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-card-hover rounded transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-loss/10 border border-loss/20 rounded text-loss text-sm">
                    {formError}
                  </div>
                )}

                {/* Symbol */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    data-testid="alert-symbol-input"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    placeholder="e.g., AAPL"
                    className="w-full px-3 py-2 bg-page-bg border border-line rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Alert Type
                  </label>
                  <select
                    data-testid="alert-type-select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 bg-page-bg border border-line rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="price_above">Price Above</option>
                    <option value="price_below">Price Below</option>
                    <option value="percent_change">Percent Change</option>
                  </select>
                </div>

                {/* Target Price */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Target Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    data-testid="alert-price-input"
                    value={formData.target_price}
                    onChange={(e) => setFormData({ ...formData, target_price: e.target.value })}
                    placeholder="e.g., 200.00"
                    className="w-full px-3 py-2 bg-page-bg border border-line rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Alert Name (optional) */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Alert Name (optional)
                  </label>
                  <input
                    type="text"
                    data-testid="alert-name-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., AAPL target hit"
                    className="w-full px-3 py-2 bg-page-bg border border-line rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Recurring Toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_recurring"
                    data-testid="alert-recurring-checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="w-4 h-4 rounded border-line text-brand focus:ring-brand"
                  />
                  <label htmlFor="is_recurring" className="text-sm text-text-primary">
                    Recurring alert (triggers every time condition is met)
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-text-primary bg-page-bg border border-line rounded-lg hover:bg-table-header transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="submit-alert-button"
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors"
                  >
                    Create Alert
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-sm" data-testid="delete-alert-modal">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  Delete Alert?
                </h3>
                <p className="text-text-secondary text-sm mb-4">
                  Are you sure you want to delete this alert? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingId(null)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-text-primary bg-page-bg border border-line rounded-lg hover:bg-table-header transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deletingId)}
                    data-testid="confirm-delete-alert"
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-loss rounded-lg hover:bg-loss/90 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Alerts;
