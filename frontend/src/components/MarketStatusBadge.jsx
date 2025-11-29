import { getMarketStatus } from '../utils/marketStatus.js';

/**
 * Component to display market status with colored dot indicator
 */
export default function MarketStatusBadge() {
  const status = getMarketStatus();

  const colorClasses = {
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${colorClasses[status.color]}`}>
      <div className={`w-2 h-2 ${status.dotColor} rounded-full ${status.isOpen ? 'animate-pulse' : ''}`}></div>
      <span>{status.message}</span>
    </div>
  );
}
