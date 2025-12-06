/**
 * Reusable Loading Card Component
 * Card skeleton for loading states in card-based layouts
 */

import Skeleton from './Skeleton';

export default function LoadingCard({
  lines = 3,
  showTitle = true,
  className = '',
}) {
  // Vary line widths for natural appearance
  const lineWidths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-1/3'];

  return (
    <div className={`bg-card rounded-lg shadow p-6 ${className}`}>
      <div className="space-y-3">
        {showTitle && (
          <Skeleton variant="title" className="w-1/3" />
        )}
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className={lineWidths[i % lineWidths.length]}
          />
        ))}
      </div>
    </div>
  );
}
