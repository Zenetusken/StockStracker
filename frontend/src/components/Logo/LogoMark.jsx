import { useId } from 'react';
import { useLogoColors } from './useLogoColors';

/**
 * Crystal icon logo mark with 3D perspective crystals and trend line.
 * Colors adapt dynamically to the current theme.
 */
export default function LogoMark({ size = 48, className = '', style = {} }) {
  const id = useId();
  const colors = useLogoColors();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-label="StockTracker logo"
    >
      <defs>
        {/* Crystal Left Facet Gradients - subtle depth: left slightly darker than center */}
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

        {/* Crystal Right Facet Gradients */}
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

        {/* Crystal Top Gradient */}
        <linearGradient id={`${id}-cT`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: colors.crystalLight }} />
          <stop offset="100%" style={{ stopColor: colors.crystalHighlight }} />
        </linearGradient>

        {/* Glow Filter for Trend Line */}
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor={colors.trendStroke} floodOpacity="0.7" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Shimmer Filter */}
        <filter id={`${id}-shimmer`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(100, 115)">
        {/* Crystal 1 (Left - shortest) - 3D Perspective */}
        <g transform="translate(-18, -12)" filter={`url(#${id}-shimmer)`}>
          <polygon points="0,-35 -12,0 -12,45 0,50" fill={`url(#${id}-cL1)`} />
          <polygon points="0,-35 12,0 12,45 0,50" fill={`url(#${id}-cR1)`} />
          <polygon points="0,-35 -12,0 0,-5 12,0" fill={`url(#${id}-cT)`} opacity="0.8" />
          <line x1="0" y1="-35" x2="0" y2="50" stroke={colors.crystalHighlight} strokeWidth="0.5" opacity="0.4" />
        </g>

        {/* Crystal 2 (Center - tallest) - Foreground */}
        <g transform="translate(0, 0)" filter={`url(#${id}-shimmer)`}>
          <polygon points="0,-75 -14,-20 -14,45 0,52" fill={`url(#${id}-cL2)`} />
          <polygon points="0,-75 14,-20 14,45 0,52" fill={`url(#${id}-cR2)`} />
          <polygon points="0,-75 -14,-20 0,-28 14,-20" fill={`url(#${id}-cT)`} />
          <line x1="0" y1="-75" x2="0" y2="52" stroke={colors.crystalHighlight} strokeWidth="0.5" opacity="0.5" />
          <polygon points="0,-65 -8,-25 -8,40 0,46 8,40 8,-25" fill={colors.crystalLight} opacity="0.1" />
        </g>

        {/* Crystal 3 (Right - medium) - Extended down for alignment */}
        <g transform="translate(18, 6)" filter={`url(#${id}-shimmer)`}>
          <polygon points="0,-50 -12,-10 -12,45 0,50" fill={`url(#${id}-cL3)`} />
          <polygon points="0,-50 12,-10 12,45 0,50" fill={`url(#${id}-cR3)`} />
          <polygon points="0,-50 -12,-10 0,-15 12,-10" fill={`url(#${id}-cT)`} opacity="0.9" />
          <line x1="0" y1="-50" x2="0" y2="50" stroke={colors.crystalHighlight} strokeWidth="0.5" opacity="0.4" />
        </g>

        {/* Trend Line with Glow */}
        <g filter={`url(#${id}-glow)`}>
          <path
            d="M -38,42 C -28,22 -15,35 -5,12 C 5,-10 15,2 22,-12 C 28,-20 32,-18 34,-24"
            stroke={colors.trendStroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M -38,42 C -28,22 -15,35 -5,12 C 5,-10 15,2 22,-12 C 28,-20 32,-18 34,-24"
            stroke={colors.trendGlow}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.6"
          />
          {/* Arrow Head */}
          <polygon points="38,-36 39,-22 29,-26" fill={colors.trendStroke} />
          <polygon points="37,-34 38,-24 31,-27" fill={colors.trendGlow} opacity="0.6" />
        </g>

        {/* Sparkle Accents */}
        <circle cx="-28" cy="-30" r="1.5" fill={colors.sparkle} opacity={colors.sparkleOpacity - 0.1} />
        <circle cx="0" cy="-65" r="2" fill={colors.sparkle} opacity={colors.sparkleOpacity} />
        <circle cx="28" cy="-42" r="1.5" fill={colors.sparkle} opacity={colors.sparkleOpacity - 0.1} />
      </g>
    </svg>
  );
}
