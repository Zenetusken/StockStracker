import { useId } from 'react';
import LogoMark from './LogoMark';
import { useLogoColors } from './useLogoColors';

const SIZES = {
  sm: { height: 32, icon: 28, fontSize: '1.125rem', gap: 0 },
  md: { height: 40, icon: 36, fontSize: '1.5rem', gap: 0 },
  lg: { height: 56, icon: 48, fontSize: '2rem', gap: 2 },
};

/**
 * Full logo with crystal icon and "StockTracker" wordmark.
 * Colors adapt dynamically to the current theme.
 */
export default function LogoFull({ size = 'md', className = '', showIcon = true }) {
  const id = useId();
  const colors = useLogoColors();
  const dims = SIZES[size] || SIZES.md;

  return (
    <div
      className={`flex items-end ${className}`}
      style={{ height: dims.height }}
    >
      {showIcon && (
        <LogoMark size={dims.icon} style={{ marginBottom: '-2px' }} />
      )}
      <svg
        viewBox="0 0 180 40"
        height={dims.height * 0.7}
        style={{ marginLeft: showIcon ? dims.gap : 0 }}
        role="img"
        aria-label="StockTracker"
      >
        <defs>
          <linearGradient id={`${id}-textGrad`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: colors.wordmarkStart }} />
            <stop offset="100%" style={{ stopColor: colors.wordmarkEnd }} />
          </linearGradient>
        </defs>
        <text
          x="0"
          y="28"
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize="26"
          fontWeight="600"
          letterSpacing="-0.02em"
        >
          <tspan fill={`url(#${id}-textGrad)`}>Stock</tspan>
          <tspan fill={colors.wordmarkSolid}>Tracker</tspan>
        </text>
      </svg>
    </div>
  );
}
