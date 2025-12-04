import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, X, TrendingUp, TrendingDown, Percent, CheckCircle, XCircle, BellRing, Clock, History, Edit2, Calendar } from 'lucide-react';
import Layout from '../components/Layout';
import { useAlertStore } from '../stores/alertStore';

function Alerts() {
  const {
    alerts,
    alertHistory,
    loading,
    error,
    notificationPermission,
    fetchAlerts,
    fetchAlertHistory,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlert,
    requestNotificationPermission,
    clearError
  } = useAlertStore();

  const [showModal, setShowModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null); // null = create mode, object = edit mode
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    type: 'price_above',
    target_price: '',
    is_recurring: false,
    expires_at: ''
  });
  const [formError, setFormError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const resetForm = () => {
    setFormData({
      symbol: '',
      name: '',
      type: 'price_above',
      target_price: '',
      is_recurring: false,
      expires_at: ''
    });
    setEditingAlert(null);
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (alert) => {
    setEditingAlert(alert);
    setFormData({
      symbol: alert.symbol,
      name: alert.name || '',
      type: alert.type,
      target_price: alert.target_price?.toString() || '',
      is_recurring: Boolean(alert.is_recurring),
      expires_at: alert.expires_at ? alert.expires_at.slice(0, 16) : '' // Format for datetime-local input
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  useEffect(() => {
    fetchAlerts();
    fetchAlertHistory();
  }, [fetchAlerts, fetchAlertHistory]);

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

    const alertData = {
      symbol: formData.symbol.toUpperCase(),
      name: formData.name || undefined,
      type: formData.type,
      target_price: parseFloat(formData.target_price),
      is_recurring: formData.is_recurring,
      expires_at: formData.expires_at || null
    };

    try {
      if (editingAlert) {
        // Update existing alert
        await updateAlert(editingAlert.id, alertData);
      } else {
        // Create new alert
        await createAlert(alertData);
      }
      closeModal();
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

  const handleRequestPermission = async () => {
    await requestNotificationPermission();
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

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getPermissionStatusColor = () => {
    switch (notificationPermission) {
      case 'granted':
        return 'text-gain';
      case 'denied':
        return 'text-loss';
      default:
        return 'text-text-secondary';
    }
  };

  const getPermissionStatusText = () => {
    switch (notificationPermission) {
      case 'granted':
        return 'Browser notifications enabled';
      case 'denied':
        return 'Browser notifications blocked';
      default:
        return 'Browser notifications not enabled';
    }
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
            onClick={openCreateModal}
            data-testid="new-alert-button"
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Alert
          </button>
        </div>

        {/* Notification Settings Banner */}
        <div className="bg-card rounded-lg border border-line p-4 mb-6" data-testid="notification-settings">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BellRing className="w-5 h-5 text-brand" />
              <div>
                <div className="text-sm font-medium text-text-primary">Browser Notifications</div>
                <div className={`text-xs ${getPermissionStatusColor()}`}>
                  {getPermissionStatusText()}
                </div>
              </div>
            </div>
            {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
              <button
                onClick={handleRequestPermission}
                data-testid="enable-notifications-button"
                className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
              >
                Enable Notifications
              </button>
            )}
            {notificationPermission === 'denied' && (
              <span className="text-xs text-text-muted">
                Enable in browser settings
              </span>
            )}
            {notificationPermission === 'granted' && (
              <CheckCircle className="w-5 h-5 text-gain" />
            )}
          </div>
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

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-page-bg rounded-lg w-fit" data-testid="alerts-tabs">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'active'
                ? 'bg-card text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Bell className="w-4 h-4" />
            Active Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-card text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <History className="w-4 h-4" />
            History ({alertHistory.length})
          </button>
        </div>

        {/* Active Alerts Tab */}
        {activeTab === 'active' && (
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
                        {alert.expires_at && (
                          <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>Expires {formatDate(alert.expires_at)}</span>
                          </div>
                        )}
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
                          onClick={() => openEditModal(alert)}
                          data-testid={`edit-alert-${alert.id}`}
                          className="p-1.5 hover:bg-brand/10 rounded transition-colors text-text-secondary hover:text-brand"
                        >
                          <Edit2 className="w-4 h-4" />
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
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-card rounded-lg border border-line" data-testid="alert-history-list">
            {alertHistory.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                No triggered alerts yet. Your alert history will appear here.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {alertHistory.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="p-4 flex items-center justify-between"
                    data-testid={`history-item-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-page-bg rounded-lg">
                        {getTypeIcon(item.alert_type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">{item.symbol}</span>
                          <span className="text-xs px-2 py-0.5 bg-page-bg rounded text-text-secondary">
                            {getTypeLabel(item.alert_type)}
                          </span>
                        </div>
                        <div className="text-sm text-text-secondary">
                          Triggered at {formatPrice(item.trigger_price)} (target: {formatPrice(item.target_price)})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-text-secondary text-sm">
                      <Clock className="w-4 h-4" />
                      {formatDate(item.triggered_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Alert Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md" data-testid={editingAlert ? 'edit-alert-modal' : 'create-alert-modal'}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-line">
                <h2 className="text-xl font-semibold text-text-primary">
                  {editingAlert ? 'Edit Alert' : 'Create Price Alert'}
                </h2>
                <button
                  onClick={closeModal}
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
                    {formData.type === 'percent_change' ? 'Target Percentage' : 'Target Price'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    data-testid="alert-price-input"
                    value={formData.target_price}
                    onChange={(e) => setFormData({ ...formData, target_price: e.target.value })}
                    placeholder={formData.type === 'percent_change' ? 'e.g., 5 for 5%' : 'e.g., 200.00'}
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

                {/* Expiration Date (optional) */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Expiration Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    data-testid="alert-expires-input"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 bg-page-bg border border-line rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Alert will be automatically disabled after this date
                  </p>
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
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 text-sm font-medium text-text-primary bg-page-bg border border-line rounded-lg hover:bg-table-header transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="submit-alert-button"
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors"
                  >
                    {editingAlert ? 'Save Changes' : 'Create Alert'}
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
