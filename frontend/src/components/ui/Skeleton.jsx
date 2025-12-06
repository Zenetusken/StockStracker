/**
 * Reusable Skeleton Component
 * Animated placeholder for content loading states
 */

const VARIANTS = {
  text: 'h-4 rounded',
  title: 'h-6 rounded',
  subtitle: 'h-5 rounded',
  card: 'h-32 rounded-lg',
  circle: 'rounded-full',
  button: 'h-10 rounded-lg',
};

export default function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
}) {
  const variantClasses = VARIANTS[variant] || VARIANTS.text;

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`animate-pulse bg-page-bg ${variantClasses} ${className}`}
      style={Object.keys(style).length > 0 ? style : undefined}
      aria-hidden="true"
    />
  );
}
