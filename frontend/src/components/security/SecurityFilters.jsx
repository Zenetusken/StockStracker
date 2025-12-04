import { useState } from 'react';
import { Filter, X, Search } from 'lucide-react';
import { SEVERITY_LEVELS, EVENT_CATEGORIES } from '../../api/security';
import { toISODateString } from '../../utils/dateUtils';

/**
 * SecurityFilters - Filter controls for security event log
 * @param {Object} props
 * @param {Object} props.filters - Current filter values
 * @param {Function} props.onFiltersChange - Callback when filters change
 * @param {Function} props.onApply - Callback when filters are applied
 * @param {Function} props.onReset - Callback when filters are reset
 * @param {boolean} props.loading - Loading state
 */
function SecurityFilters({ filters, onFiltersChange, onApply, onReset, loading = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateError, setDateError] = useState('');

  const handleInputChange = (field, value) => {
    onFiltersChange({ ...filters, [field]: value });

    // Clear date error when dates change
    if (field === 'startDate' || field === 'endDate') {
      setDateError('');
    }
  };

  const handleApply = () => {
    // Validate date range
    if (filters.startDate && filters.endDate) {
      if (new Date(filters.startDate) > new Date(filters.endDate)) {
        setDateError('End date must be after start date');
        return;
      }
    }
    setDateError('');
    onApply();
  };

  const handleReset = () => {
    setDateError('');
    onReset();
  };

  const activeFilterCount = [
    filters.eventType,
    filters.severity,
    filters.ipAddress,
    filters.startDate,
    filters.endDate,
  ].filter(Boolean).length;

  return (
    <div className="bg-card rounded-lg border border-border p-4" data-testid="security-filters">
      {/* Filter header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-text-primary hover:text-brand transition-colors"
          aria-expanded={isExpanded}
          aria-controls="filter-panel"
        >
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-brand text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="text-sm text-text-muted hover:text-text-primary flex items-center gap-1"
            disabled={loading}
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Filter panel */}
      {isExpanded && (
        <div id="filter-panel" className="mt-4 space-y-4">
          {/* Event Type Filter */}
          <div>
            <label
              htmlFor="filter-event-type"
              className="block text-sm font-medium text-text-muted mb-1"
            >
              Event Type
            </label>
            <select
              id="filter-event-type"
              value={filters.eventType || ''}
              onChange={(e) => handleInputChange('eventType', e.target.value)}
              className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
              data-testid="filter-event-type"
            >
              <option value="">All event types</option>
              {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                <optgroup key={category} label={category}>
                  {events.map((event) => (
                    <option key={event} value={event}>
                      {formatEventType(event)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label
              htmlFor="filter-severity"
              className="block text-sm font-medium text-text-muted mb-1"
            >
              Severity
            </label>
            <select
              id="filter-severity"
              value={filters.severity || ''}
              onChange={(e) => handleInputChange('severity', e.target.value)}
              className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
              data-testid="filter-severity"
            >
              <option value="">All severities</option>
              {Object.values(SEVERITY_LEVELS).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          {/* IP Address Filter */}
          <div>
            <label
              htmlFor="filter-ip"
              className="block text-sm font-medium text-text-muted mb-1"
            >
              IP Address
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                id="filter-ip"
                type="text"
                value={filters.ipAddress || ''}
                onChange={(e) => handleInputChange('ipAddress', e.target.value)}
                placeholder="e.g., 192.168.1.100"
                className="w-full pl-9 pr-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
                data-testid="filter-ip"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="filter-start-date"
                className="block text-sm font-medium text-text-muted mb-1"
              >
                Start Date
              </label>
              <input
                id="filter-start-date"
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                max={toISODateString(new Date())}
                className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
                data-testid="date-start"
              />
            </div>
            <div>
              <label
                htmlFor="filter-end-date"
                className="block text-sm font-medium text-text-muted mb-1"
              >
                End Date
              </label>
              <input
                id="filter-end-date"
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                max={toISODateString(new Date())}
                className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-brand focus:border-transparent"
                data-testid="date-end"
              />
            </div>
          </div>

          {/* Date validation error */}
          {dateError && (
            <p className="text-sm text-red-600 dark:text-red-400" data-testid="date-error">
              {dateError}
            </p>
          )}

          {/* Apply button */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border rounded-lg hover:bg-page-bg"
              disabled={loading}
            >
              Reset
            </button>
            <button
              onClick={handleApply}
              disabled={loading}
              className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
              data-testid="apply-filters"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format event type for display
 */
function formatEventType(eventType) {
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default SecurityFilters;
