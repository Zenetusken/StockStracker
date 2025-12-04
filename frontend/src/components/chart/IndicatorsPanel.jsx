/**
 * IndicatorsPanel Component
 * UI panel for configuring technical indicators on the stock chart
 * Extracted from StockChart.jsx for better code organization
 */

import { SMA_CONFIGS } from '../../utils/indicators';

/**
 * @param {boolean} showIndicators - Panel visibility
 * @param {Function} onClose - Close panel handler
 * @param {Array} enabledSMAs - Currently enabled SMA periods
 * @param {Function} onToggleSMA - Toggle SMA period
 * @param {Object} smaVisible - SMA visibility state {period: boolean}
 * @param {Function} onToggleSMAVisibility - Toggle SMA visibility
 * @param {number|null} smaSettingsOpen - Which SMA settings is open
 * @param {Function} setSmaSettingsOpen - Set open SMA settings
 * @param {Array} availablePeriods - Available SMA periods for timeframe
 * @param {string} timeframe - Current timeframe
 * @param {boolean} bbEnabled - Bollinger Bands enabled
 * @param {Function} onToggleBB - Toggle Bollinger Bands
 * @param {boolean} bbVisible - Bollinger Bands visible
 * @param {Function} onToggleBBVisibility - Toggle BB visibility
 * @param {boolean} rsiEnabled - RSI enabled
 * @param {Function} onToggleRSI - Toggle RSI
 * @param {boolean} rsiVisible - RSI visible
 * @param {Function} onToggleRSIVisibility - Toggle RSI visibility
 * @param {number} rsiPeriod - RSI period
 * @param {boolean} macdEnabled - MACD enabled
 * @param {Function} onToggleMACD - Toggle MACD
 * @param {boolean} macdVisible - MACD visible
 * @param {Function} onToggleMACDVisibility - Toggle MACD visibility
 */
function IndicatorsPanel({
  onClose,
  enabledSMAs,
  onToggleSMA,
  smaVisible,
  onToggleSMAVisibility,
  smaSettingsOpen,
  setSmaSettingsOpen,
  availablePeriods,
  timeframe,
  onChangeSMAPeriod,
  bbEnabled,
  onToggleBB,
  bbVisible,
  onToggleBBVisibility,
  rsiEnabled,
  onToggleRSI,
  rsiVisible,
  onToggleRSIVisibility,
  rsiPeriod,
  macdEnabled,
  onToggleMACD,
  macdVisible,
  onToggleMACDVisibility,
}) {
  return (
    <div className="mb-4 p-4 bg-card border border-line rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Technical Indicators</h3>

      {/* Multiple SMA Indicators */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-text-primary mb-2">
          Simple Moving Averages (SMA)
        </div>
        {SMA_CONFIGS.map(({ period, color, label }) => {
          const isAvailable = availablePeriods.includes(period);
          const isEnabled = enabledSMAs.includes(period);
          const isVisible = smaVisible[period] !== false; // Default to visible
          const settingsOpen = smaSettingsOpen === period;

          const toggleSettings = () => {
            setSmaSettingsOpen(settingsOpen ? null : period);
          };

          return (
            <div key={period} className={`flex flex-col ${!isAvailable ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`sma-${period}`}
                  checked={isEnabled}
                  onChange={() => onToggleSMA(period)}
                  disabled={!isAvailable}
                  className="w-4 h-4 rounded focus:ring-2 focus:ring-brand"
                  style={{ accentColor: color }}
                />
                <label
                  htmlFor={`sma-${period}`}
                  className="text-sm text-text-primary flex items-center gap-2 flex-1"
                >
                  <span
                    className="w-4 h-0.5 rounded"
                    style={{ backgroundColor: color }}
                  />
                  {label}
                  {!isAvailable && (
                    <span className="text-xs text-text-muted">(needs more data)</span>
                  )}
                </label>
                {isEnabled && isAvailable && (
                  <>
                    {/* Settings gear icon */}
                    <button
                      id={`sma-${period}-settings`}
                      onClick={toggleSettings}
                      className={`p-1 rounded hover:bg-line transition-colors ${settingsOpen ? 'bg-line' : ''}`}
                      title="Change period"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    {/* Visibility toggle */}
                    <button
                      id={`sma-${period}-visibility`}
                      onClick={() => onToggleSMAVisibility(period)}
                      className="p-1 rounded hover:bg-line transition-colors"
                      title={isVisible ? 'Hide SMA' : 'Show SMA'}
                    >
                      {isVisible ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                    {/* Remove/delete icon */}
                    <button
                      id={`sma-${period}-remove`}
                      onClick={() => onToggleSMA(period)}
                      className="p-1 rounded hover:bg-loss/20 transition-colors"
                      title="Remove indicator"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              {/* Settings dropdown */}
              {settingsOpen && (
                <div className="ml-7 mt-2 p-2 bg-table-header rounded-md border border-line">
                  <div className="text-xs text-text-muted mb-2">Change period to:</div>
                  <div className="flex flex-wrap gap-2">
                    {availablePeriods.filter(p => p !== period && !enabledSMAs.includes(p)).map(newPeriod => (
                      <button
                        key={newPeriod}
                        id={`sma-${period}-change-to-${newPeriod}`}
                        onClick={() => onChangeSMAPeriod(period, newPeriod)}
                        className="px-2 py-1 text-xs bg-page-bg border border-line rounded hover:bg-line transition-colors"
                      >
                        {newPeriod}
                      </button>
                    ))}
                    {availablePeriods.filter(p => p !== period && !enabledSMAs.includes(p)).length === 0 && (
                      <span className="text-xs text-text-muted">No other periods available</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div className="text-xs text-text-muted mt-2">
          Available for {timeframe} timeframe: {availablePeriods.join(', ')}
        </div>
        {enabledSMAs.length > 0 && (
          <div className="text-xs text-text-muted">
            Active: {enabledSMAs.map(p => `SMA(${p})`).join(', ')}
          </div>
        )}
      </div>

      {/* Bollinger Bands */}
      <div className="mt-4 pt-4 border-t border-line">
        <div className="text-sm font-medium text-text-primary mb-2">
          Volatility Indicators
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="bb-enabled"
            checked={bbEnabled}
            onChange={onToggleBB}
            className="w-4 h-4 rounded focus:ring-2 focus:ring-brand"
            style={{ accentColor: '#8B5CF6' }}
          />
          <label
            htmlFor="bb-enabled"
            className="text-sm text-text-primary flex items-center gap-2 flex-1"
          >
            <span
              className="w-4 h-0.5 rounded"
              style={{ backgroundColor: '#8B5CF6' }}
            />
            Bollinger Bands (20, 2)
          </label>
          {bbEnabled && (
            <>
              <button
                id="bb-visibility"
                onClick={onToggleBBVisibility}
                className="p-1 rounded hover:bg-line transition-colors"
                title={bbVisible ? 'Hide Bollinger Bands' : 'Show Bollinger Bands'}
              >
                {bbVisible ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
              <button
                id="bb-remove"
                onClick={onToggleBB}
                className="p-1 rounded hover:bg-loss/20 transition-colors"
                title="Remove indicator"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="text-xs text-text-muted mt-2 pl-7">
          Shows price volatility with upper/lower bands at 2 standard deviations
        </div>
      </div>

      {/* RSI Indicator */}
      <div className="mt-4 pt-4 border-t border-line">
        <div className="text-sm font-medium text-text-primary mb-2">
          Momentum Indicators
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="rsi-enabled"
            checked={rsiEnabled}
            onChange={onToggleRSI}
            className="w-4 h-4 rounded focus:ring-2 focus:ring-brand"
            style={{ accentColor: '#8B5CF6' }}
          />
          <label
            htmlFor="rsi-enabled"
            className="text-sm text-text-primary flex items-center gap-2 flex-1"
          >
            <span
              className="w-4 h-0.5 rounded"
              style={{ backgroundColor: '#8B5CF6' }}
            />
            RSI ({rsiPeriod})
          </label>
          {rsiEnabled && (
            <>
              <button
                id="rsi-visibility"
                onClick={onToggleRSIVisibility}
                className="p-1 rounded hover:bg-line transition-colors"
                title={rsiVisible ? 'Hide RSI' : 'Show RSI'}
              >
                {rsiVisible ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
              <button
                id="rsi-remove"
                onClick={onToggleRSI}
                className="p-1 rounded hover:bg-loss/20 transition-colors"
                title="Remove indicator"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="text-xs text-text-muted mt-2 pl-7">
          Relative Strength Index - shows overbought ({'>'}70) and oversold ({'<'}30) conditions
        </div>
        {/* MACD */}
        <div className="flex items-center gap-3 mt-3">
          <input
            type="checkbox"
            id="macd-enabled"
            checked={macdEnabled}
            onChange={onToggleMACD}
            className="w-4 h-4 rounded focus:ring-2 focus:ring-brand"
            style={{ accentColor: '#3B82F6' }}
          />
          <label
            htmlFor="macd-enabled"
            className="text-sm text-text-primary flex items-center gap-2 flex-1"
          >
            <span
              className="w-4 h-0.5 rounded"
              style={{ backgroundColor: '#3B82F6' }}
            />
            MACD (12, 26, 9)
          </label>
          {macdEnabled && (
            <>
              <button
                id="macd-visibility"
                onClick={onToggleMACDVisibility}
                className="p-1 rounded hover:bg-line transition-colors"
                title={macdVisible ? 'Hide MACD' : 'Show MACD'}
              >
                {macdVisible ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
              <button
                id="macd-remove"
                onClick={onToggleMACD}
                className="p-1 rounded hover:bg-loss/20 transition-colors"
                title="Remove indicator"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="text-xs text-text-muted mt-2 pl-7">
          Moving Average Convergence Divergence - trend and momentum indicator
        </div>
      </div>

      {/* Close button */}
      <div className="mt-4 pt-4 border-t border-line">
        <button
          onClick={onClose}
          className="w-full px-4 py-2 text-sm font-medium text-text-primary bg-table-header hover:bg-line rounded-md transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default IndicatorsPanel;
