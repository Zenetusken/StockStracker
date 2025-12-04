import { Clock } from 'lucide-react';
import { TIMEFRAME_OPTIONS } from '../../api/security';

/**
 * TimeframeSelector - Dropdown to select time range for security data
 * @param {Object} props
 * @param {number} props.value - Current timeframe value in hours
 * @param {Function} props.onChange - Callback when timeframe changes
 * @param {boolean} props.disabled - Whether the selector is disabled
 */
function TimeframeSelector({ value, onChange, disabled = false }) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="px-3 py-1.5 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Select timeframe"
        data-testid="timeframe-select"
      >
        {TIMEFRAME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default TimeframeSelector;
