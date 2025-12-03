/* eslint-disable react-refresh/only-export-components -- Icon library exports both components and constants intentionally */
import { Star, Heart, TrendingUp, Zap, Target, Flame } from 'lucide-react';

// Custom Alien icon (lucide-style: 24x24, stroke-based)
// Alienware-inspired: angular head, sharp features, intense eyes
// Custom Alien icon (lucide-style: 24x24, stroke-based but fill-ready)
// Alienware-inspired: angular head, sharp features, intense eyes
export const Alien = ({ className, style, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    {...props}
  >
    {/* Head with eyes cut out using evenodd rule */}
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6 2 3 6 3 11C3 15 5 18 8 20C9.5 21 10.5 21.5 12 21.5C13.5 21.5 14.5 21 16 20C19 18 21 15 21 11C21 6 18 2 12 2ZM8.5 11.5L6 10L7 8L10.5 10.5L8.5 11.5ZM15.5 11.5L18 10L17 8L13.5 10.5L15.5 11.5Z"
    />
  </svg>
);

// Custom Squid/Octopus icon (lucide-style: 24x24, stroke-based but fill-ready)
// Simple clean octopus - dome head with tentacles as shapes
export const Squid = ({ className, style, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    {...props}
  >
    {/* Head and tentacles combined */}
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C7.58172 2 4 5.58172 4 10V12H4.00919C4.00309 12.331 4 12.6644 4 13V15.5C4 16.3284 4.67157 17 5.5 17C6.32843 17 7 16.3284 7 15.5V13C7 12.4477 7.44772 12 8 12C8.55228 12 9 12.4477 9 13V18.5C9 19.3284 9.67157 20 10.5 20C11.3284 20 12 19.3284 12 18.5V13C12 12.4477 12.4477 12 13 12C13.5523 12 14 12.4477 14 13V18.5C14 19.3284 14.6716 20 15.5 20C16.3284 20 17 19.3284 17 18.5V13C17 12.4477 17.4477 12 18 12C18.5523 12 19 12.4477 19 13V15.5C19 16.3284 19.6716 17 20.5 17C21.3284 17 22 16.3284 22 15.5V13C22 12.6644 22.0031 12.331 21.9908 12H22V10C22 5.58172 18.4183 2 12 2ZM9 8C9 8.82843 8.32843 9.5 7.5 9.5C6.67157 9.5 6 8.82843 6 8C6 7.17157 6.67157 6.5 7.5 6.5C8.32843 6.5 9 7.17157 9 8ZM16.5 9.5C17.3284 9.5 18 8.82843 18 8C18 7.17157 17.3284 6.5 16.5 6.5C15.6716 6.5 15 7.17157 15 8C15 8.82843 15.6716 9.5 16.5 9.5Z"
    />
  </svg>
);

// Icon options for watchlist picker
export const WATCHLIST_ICON_OPTIONS = [
  { name: 'star', Icon: Star },
  { name: 'heart', Icon: Heart },
  { name: 'trending', Icon: TrendingUp },
  { name: 'zap', Icon: Zap },
  { name: 'target', Icon: Target },
  { name: 'flame', Icon: Flame },
  { name: 'alien', Icon: Alien },
  { name: 'squid', Icon: Squid },
];

// Map icon name to component
export const WATCHLIST_ICONS = {
  star: Star,
  heart: Heart,
  trending: TrendingUp,
  zap: Zap,
  target: Target,
  flame: Flame,
  alien: Alien,
  squid: Squid,
};

// Get icon component by name (defaults to Star)
export function getWatchlistIcon(iconName) {
  return WATCHLIST_ICONS[iconName] || Star;
}
