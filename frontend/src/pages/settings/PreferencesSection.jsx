import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../components/toast/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Bell,
  Save,
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

function PreferencesSection() {
  const toast = useToast();
  const { themeMode, setThemeMode } = useTheme();

  const [preferences, setPreferences] = useState({
    theme: 'system',
    defaultChartType: 'candle',
    defaultTimeframe: '1D',
    decimalPlaces: 2,
    notificationsEnabled: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

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
      } catch {
        toast.error('Failed to load preferences');
      } finally {
        setPrefsLoading(false);
      }
    };
    loadPreferences();
  }, [toast, setThemeMode]);

  // Save preferences
  const savePreferences = async () => {
    setPrefsSaving(true);
    try {
      await api.put('/settings', preferences);
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  return (
    <>
      {/* Notifications Section */}
      <div className="bg-card rounded-lg shadow p-6 mb-6" data-testid="settings-notifications">
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

      {/* Display Preferences Section */}
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
            {/* Theme Preference */}
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
                      setThemeMode(item.value);
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

            {/* Default Chart Type */}
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

            {/* Default Timeframe */}
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

            {/* Decimal Places */}
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
    </>
  );
}

export default PreferencesSection;
