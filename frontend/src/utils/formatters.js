/**
 * Formatters Utility (L1 fix)
 * Centralized formatting functions for consistent display across the app
 */

/**
 * Format a number with K/M/B suffix for compact display
 * @param {number} num - The number to format
 * @returns {string} Formatted string (e.g., "1.23M")
 */
export function formatNumber(num) {
  if (num == null || isNaN(num)) return '-';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(0);
}

/**
 * Format a price with dollar sign and 2 decimal places
 * @param {number} price - The price to format
 * @returns {string} Formatted price (e.g., "$123.45")
 */
export function formatPrice(price) {
  if (price == null || isNaN(price)) return '-';
  return '$' + price.toFixed(2);
}

/**
 * Format a percent change with sign and percentage symbol
 * @param {number} change - The percent change
 * @returns {string} Formatted change (e.g., "+1.23%")
 */
export function formatPercentChange(change) {
  if (change == null || isNaN(change)) return '-';
  const sign = change > 0 ? '+' : '';
  return sign + change.toFixed(2) + '%';
}

/**
 * Format a decimal as a percentage
 * @param {number} value - The decimal value (e.g., 0.1234)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage (e.g., "12.34%")
 */
export function formatPercent(value, decimals = 2) {
  if (value == null || isNaN(value)) return '-';
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format a price for locale-specific display (commas, decimals)
 * @param {number} value - The price/value to format
 * @param {number} minDecimals - Minimum fraction digits
 * @param {number} maxDecimals - Maximum fraction digits
 * @returns {string} Locale-formatted price
 */
export function formatLocalePrice(value, minDecimals = 2, maxDecimals = 2) {
  if (value == null || isNaN(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Format market cap with appropriate suffix
 * @param {number} marketCap - Market cap in dollars
 * @returns {string} Formatted market cap (e.g., "$1.23T")
 */
export function formatMarketCap(marketCap) {
  if (marketCap == null || isNaN(marketCap)) return '-';
  if (marketCap >= 1e12) return '$' + (marketCap / 1e12).toFixed(2) + 'T';
  if (marketCap >= 1e9) return '$' + (marketCap / 1e9).toFixed(2) + 'B';
  if (marketCap >= 1e6) return '$' + (marketCap / 1e6).toFixed(2) + 'M';
  return '$' + formatNumber(marketCap);
}

/**
 * Get CSS class for change value (gain/loss/neutral)
 * @param {number} change - The change value
 * @returns {string} CSS class name
 */
export function getChangeClass(change) {
  if (change > 0) return 'text-gain';
  if (change < 0) return 'text-loss';
  return 'text-text-muted';
}

/**
 * Get CSS class for change badge/pill
 * @param {number} change - The change value
 * @returns {string} CSS classes for badge styling
 */
export function getChangeBadgeClass(change) {
  if (change > 0) return 'bg-gain/10 text-gain';
  if (change < 0) return 'bg-loss/10 text-loss';
  return 'bg-mint/10 text-text-secondary';
}
