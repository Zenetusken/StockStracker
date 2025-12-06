/**
 * Reusable Loading Spinner Component
 * Standardized spinner for consistent loading feedback across the app
 */

const SIZES = {
  xs: 'h-3 w-3 border-2',
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-12 w-12 border-4',
};

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = SIZES[size] || SIZES.md;

  return (
    <div
      className={`animate-spin ${sizeClasses} border-brand border-t-transparent rounded-full ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
