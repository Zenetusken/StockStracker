import { useId } from 'react';
import { useLogoColors } from './useLogoColors';

/**
 * Compact crystal logo icon for small spaces (favicons, nav items).
 * Simplified version of LogoMark optimized for small sizes.
 */
export default function LogoIcon({ size = 32, className = '' }) {
  const id = useId();
  const colors = useLogoColors();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="StockTracker icon"
    >
      <defs>
        {/* Crystal Gradients - subtle depth: left slightly darker than center */}
        <linearGradient id={`${id}-cL1`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: colors.crystalMid }} />
          <stop offset="100%" style={{ stopColor: colors.crystalLight, stopOpacity: 0.9 }} />
        </linearGradient>
        <linearGradient id={`${id}-cL2`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: colors.crystalLight }} />
          <stop offset="100%" style={{ stopColor: colors.crystalHighlight }} />
        </linearGradient>
        <linearGradient id={`${id}-cL3`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: colors.crystalHighlight }} />
          <stop offset="100%" style={{ stopColor: colors.crystalHighlight }} />
        </linearGradient>
        <linearGradient id={`${id}-cR1`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: colors.crystalLight }} />
          <stop offset="100%" style={{ stopColor: colors.crystalHighlight }} />
        </linearGradient>
        <linearGradient id={`${id}-cR2`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: colors.crystalHighlight }} />
          <stop offset="100%" style={{ stopColor: colors.crystalLight }} />
        </linearGradient>
        <linearGradient id={`${id}-cR3`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: colors.crystalHighlight }} />
          <stop offset="100%" style={{ stopColor: colors.crystalLight }} />
        </linearGradient>
        <linearGradient id={`${id}-cT`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: colors.crystalLight }} />
          <stop offset="100%" style={{ stopColor: colors.crystalHighlight }} />
        </linearGradient>
      </defs>

      <g transform="translate(32, 38)">
        {/* Crystal 1 (Left - shortest) - 3D Perspective */}
        <g transform="translate(-6, -4)">
          <polygon points="0,-12 -4,0 -4,15 0,17" fill={`url(#${id}-cL1)`} />
          <polygon points="0,-12 4,0 4,15 0,17" fill={`url(#${id}-cR1)`} />
          <polygon points="0,-12 -4,0 0,-2 4,0" fill={`url(#${id}-cT)`} opacity="0.8" />
        </g>

        {/* Crystal 2 (Center - tallest) */}
        <g transform="translate(0, 0)">
          <polygon points="0,-25 -5,-8 -5,15 0,18" fill={`url(#${id}-cL2)`} />
          <polygon points="0,-25 5,-8 5,15 0,18" fill={`url(#${id}-cR2)`} />
          <polygon points="0,-25 -5,-8 0,-10 5,-8" fill={`url(#${id}-cT)`} />
        </g>

        {/* Crystal 3 (Right - medium) - Extended */}
        <g transform="translate(6, 2)">
          <polygon points="0,-17 -4,-4 -4,15 0,17" fill={`url(#${id}-cL3)`} />
          <polygon points="0,-17 4,-4 4,15 0,17" fill={`url(#${id}-cR3)`} />
          <polygon points="0,-17 -4,-4 0,-6 4,-4" fill={`url(#${id}-cT)`} opacity="0.9" />
        </g>

        {/* Trend Line */}
        <path
          d="M -12,14 C -8,6 -4,10 0,2 C 4,-6 8,0 11,-6 C 13,-10 15,-8 16,-11"
          stroke={colors.trendStroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M -12,14 C -8,6 -4,10 0,2 C 4,-6 8,0 11,-6 C 13,-10 15,-8 16,-11"
          stroke={colors.trendGlow}
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
        {/* Arrow Head */}
        <polygon points="19,-16 19,-9 14,-12" fill={colors.trendStroke} />
        <polygon points="18,-15 18,-11 15,-12" fill={colors.trendGlow} opacity="0.6" />
      </g>
    </svg>
  );
}
