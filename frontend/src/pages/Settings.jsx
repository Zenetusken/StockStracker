import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useToast } from '../components/toast/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Settings as SettingsIcon,
  Bell,
  Lock,
  Download,
  Upload,
  Trash2,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Sun,
  Moon,
  Monitor,
  BarChart2,
  Clock,
  Hash,
  Minus,
  Plus,
} from 'lucide-react';

/**
 * Settings Page
 * #123: Notification preferences toggle
 * #124: Change password
 * #125: Export all data as JSON
 * #126: Import data from JSON
 * #127: Delete account with confirmation
 */

function Settings() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const { addToast } = useToast();
  const { themeMode, setThemeMode } = useTheme();
  const fileInputRef = useRef(null);

  // Preferences state
  const [preferences, setPreferences] = useState({
    theme: 'system',
    defaultChartType: 'candle',
    defaultTimeframe: '1D',
    decimalPlaces: 2,
    notificationsEnabled: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  // Export/Import state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    password: '',
    confirmation: '',
  });
  const [deleting, setDeleting] = useState(false);

  // Load preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const result = await api.get('/settings');
        setPreferences(result);
        // Sync theme mode with ThemeContext
        if (result.theme && ['light', 'dark', 'system'].includes(result.theme)) {
          setThemeMode(result.theme);
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
        addToast('Failed to load preferences', 'error');
      } finally {
        setPrefsLoading(false);
      }
    };
    loadPreferences();
  }, [addToast, setThemeMode]);

  // Save preferences (#123)
  const savePreferences = async () => {
    setPrefsSaving(true);
    try {
      await api.put('/settings', preferences);
      addToast('Preferences saved', 'success');
    } catch (err) {
      console.error('Failed to save preferences:', err);
      addToast('Failed to save preferences', 'error');
    } finally {
      setPrefsSaving(false);
    }
  };

  // Check password strength
  const checkPasswordStrength = useCallback(async (password) => {
    if (!password || password.length < 4) {
      setPasswordStrength(null);
      return;
    }
    try {
      const result = await api.post('/auth/check-password', { password });
      setPasswordStrength(result);
    } catch {
      setPasswordStrength(null);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      checkPasswordStrength(passwordForm.newPassword);
    }, 300);
    return () => clearTimeout(timeout);
  }, [passwordForm.newPassword, checkPasswordStrength]);

  // Change password (#124)
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }

    if (!passwordStrength?.valid) {
      addToast('Password does not meet requirements', 'error');
      return;
    }

    setPasswordChanging(true);
    try {
      await api.put('/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      addToast('Password changed successfully', 'success');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStrength(null);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to change password';
      addToast(message, 'error');
    } finally {
      setPasswordChanging(false);
    }
  };

  // Export data (#125)
  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.get('/settings/export');
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stocktracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Data exported successfully', 'success');
    } catch (err) {
      console.error('Export error:', err);
      addToast('Failed to export data', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Import data (#126)
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await api.post('/settings/import', {
        data,
        options: {
          watchlists: true,
          portfolios: true,
          alerts: true,
          preferences: true,
          mergeMode: 'merge',
        },
      });

      addToast('Data imported successfully', 'success');
    } catch (err) {
      console.error('Import error:', err);
      if (err instanceof SyntaxError) {
        addToast('Invalid JSON file', 'error');
      } else {
        addToast('Failed to import data', 'error');
      }
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Delete account (#127)
  const handleDeleteAccount = async (e) => {
    e.preventDefault();

    if (deleteForm.confirmation !== 'DELETE') {
      addToast('Please type DELETE to confirm', 'error');
      return;
    }

    setDeleting(true);
    try {
      await api.delete('/settings/account', {
        data: {
          password: deleteForm.password,
          confirmation: deleteForm.confirmation,
        },
      });
      addToast('Account deleted successfully', 'success');
      logout();
      navigate('/login');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to delete account';
      addToast(message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getStrengthColor = (score) => {
    if (score <= 1) return 'bg-loss';
    if (score <= 2) return 'bg-amber-500';
    if (score <= 3) return 'bg-amber-400';
    return 'bg-gain';
  };

  const getStrengthText = (score) => {
    if (score <= 1) return 'Weak';
    if (score <= 2) return 'Fair';
    if (score <= 3) return 'Good';
    return 'Strong';
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <SettingsIcon className="w-8 h-8" />
            Settings
          </h2>
          <p className="text-text-muted mt-2">
            Manage your account preferences and data
          </p>
        </div>

        {/* Notifications Section (#123) */}
        <div className="bg-card rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5" />
            Notifications
          </h3>

          {prefsLoading ? (
            <div className="animate-pulse h-10 bg-page-bg rounded" />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-text-primary">Price Alerts</div>
                <div className="text-sm text-text-muted">
                  Receive notifications when price alerts are triggered
                </div>
              </div>
              <button
                onClick={() => setPreferences(p => ({ ...p, notificationsEnabled: !p.notificationsEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.notificationsEnabled ? 'bg-brand' : 'bg-gray-400'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

        </div>

        {/* Display Preferences Section (#153-156) */}
        <div className="bg-card rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5" />
            Display Preferences
          </h3>

          {prefsLoading ? (
            <div className="space-y-4">
              <div className="animate-pulse h-16 bg-page-bg rounded" />
              <div className="animate-pulse h-16 bg-page-bg rounded" />
              <div className="animate-pulse h-16 bg-page-bg rounded" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Theme Preference (#153) */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Sun className="w-4 h-4 text-text-muted" />
                  Theme Mode
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'light', label: 'Light', Icon: Sun },
                    { value: 'dark', label: 'Dark', Icon: Moon },
                    { value: 'system', label: 'System', Icon: Monitor },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setPreferences(p => ({ ...p, theme: item.value }));
                        setThemeMode(item.value); // Apply theme immediately
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                        themeMode === item.value
                          ? 'bg-brand text-white border-brand'
                          : 'bg-page-bg text-text-primary border-border hover:border-brand/50'
                      }`}
                    >
                      <item.Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-1.5">
                  Choose how the app appears. System uses your device settings.
                </p>
              </div>

              {/* Default Chart Type (#154) */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-text-muted" />
                  Default Chart Type
                </label>
                <select
                  value={preferences.defaultChartType}
                  onChange={(e) => setPreferences(p => ({ ...p, defaultChartType: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-page-bg border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
                >
                  <option value="candle">Candlestick</option>
                  <option value="line">Line</option>
                  <option value="area">Area</option>
                </select>
                <p className="text-xs text-text-muted mt-1.5">
                  Chart type shown by default when viewing stock details.
                </p>
              </div>

              {/* Default Timeframe (#155) */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-text-muted" />
                  Default Timeframe
                </label>
                <select
                  value={preferences.defaultTimeframe}
                  onChange={(e) => setPreferences(p => ({ ...p, defaultTimeframe: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-page-bg border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
                >
                  <option value="1D">1 Day</option>
                  <option value="1W">1 Week</option>
                  <option value="1M">1 Month</option>
                  <option value="3M">3 Months</option>
                  <option value="1Y">1 Year</option>
                  <option value="5Y">5 Years</option>
                  <option value="MAX">All Time</option>
                </select>
                <p className="text-xs text-text-muted mt-1.5">
                  Time period shown by default on stock charts.
                </p>
              </div>

              {/* Decimal Places (#156) */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-text-muted" />
                  Decimal Places
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreferences(p => ({ ...p, decimalPlaces: Math.max(0, p.decimalPlaces - 1) }))}
                    disabled={preferences.decimalPlaces <= 0}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-page-bg text-text-primary hover:bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="8"
                      value={preferences.decimalPlaces}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0 && val <= 8) {
                          setPreferences(p => ({ ...p, decimalPlaces: val }));
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-page-bg border border-border rounded-lg text-text-primary text-center focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences(p => ({ ...p, decimalPlaces: Math.min(8, p.decimalPlaces + 1) }))}
                    disabled={preferences.decimalPlaces >= 8}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-page-bg text-text-primary hover:bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1.5">
                  Number of decimal places for price display (0-8). Preview: ${(1234.56789).toFixed(preferences.decimalPlaces)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={savePreferences}
              disabled={prefsSaving || prefsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
            >
              {prefsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Preferences
            </button>
          </div>
        </div>

        {/* Password Section (#124) */}
        <div className="bg-card rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5" />
            Change Password
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 bg-page-bg border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 bg-page-bg border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordStrength && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getStrengthColor(passwordStrength.score)} transition-all`}
                        style={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      passwordStrength.valid ? 'text-gain' : 'text-loss'
                    }`}>
                      {getStrengthText(passwordStrength.score)}
                    </span>
                  </div>
                  {passwordStrength.errors?.map((error, i) => (
                    <p key={i} className="text-xs text-loss flex items-center gap-1">
                      <X className="w-3 h-3" /> {error}
                    </p>
                  ))}
                  {passwordStrength.valid && (
                    <p className="text-xs text-gain flex items-center gap-1">
                      <Check className="w-3 h-3" /> Password meets requirements
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 bg-page-bg border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-xs text-loss mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" /> Passwords do not match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={passwordChanging || !passwordStrength?.valid || passwordForm.newPassword !== passwordForm.confirmPassword}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
            >
              {passwordChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Change Password
            </button>
          </form>
        </div>

        {/* Data Management Section (#125, #126) */}
        <div className="bg-card rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Download className="w-5 h-5" />
            Data Management
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-text-primary">Export Data</div>
                <div className="text-sm text-text-muted">
                  Download all your data as a JSON backup file
                </div>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-page-bg text-text-primary border border-border rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <div className="font-medium text-text-primary">Import Data</div>
                <div className="text-sm text-text-muted">
                  Restore data from a JSON backup file
                </div>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  id="import-file"
                />
                <label
                  htmlFor="import-file"
                  className={`flex items-center gap-2 px-4 py-2 bg-page-bg text-text-primary border border-border rounded-lg cursor-pointer hover:bg-gray-100 ${
                    importing ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone (#127) */}
        <div className="bg-card rounded-lg shadow p-6 border border-loss/20">
          <h3 className="text-lg font-semibold text-loss flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-text-primary">Delete Account</div>
              <div className="text-sm text-text-muted">
                Permanently delete your account and all associated data
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-loss text-white rounded-lg hover:bg-loss/90"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>

        {/* Delete Account Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-xl font-bold text-loss flex items-center gap-2 mb-4">
                <AlertTriangle className="w-6 h-6" />
                Delete Account
              </h3>

              <p className="text-text-muted mb-4">
                This action is <strong>permanent</strong> and cannot be undone.
                All your data including watchlists, portfolios, and transactions will be deleted.
              </p>

              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Enter your password
                  </label>
                  <input
                    type="password"
                    value={deleteForm.password}
                    onChange={(e) => setDeleteForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-text-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Type <span className="font-mono text-loss">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteForm.confirmation}
                    onChange={(e) => setDeleteForm(f => ({ ...f, confirmation: e.target.value }))}
                    className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-text-primary"
                    placeholder="DELETE"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteForm({ password: '', confirmation: '' });
                    }}
                    className="flex-1 px-4 py-2 bg-page-bg text-text-primary border border-border rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleting || deleteForm.confirmation !== 'DELETE'}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-loss text-white rounded-lg hover:bg-loss/90 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Forever
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Settings;
