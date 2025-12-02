import { Star, Heart, TrendingUp, Zap, Target, Flame } from 'lucide-react';

// Custom Alien icon (lucide-style: 24x24, stroke-based)
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
    {/* Alien head - wide cranium with rounded chin */}
    <path d="M12 2C6 2 3 6 3 11c0 4 2 7 5 9 1.5 1 2.5 1.5 4 1.5s2.5-.5 4-1.5c3-2 5-5 5-9 0-5-3-9-9-9z" />
    {/* Left eye - narrow squinty angular slit pointing inward-down */}
    <path d="M5 8l5 3 1-1.5-5-2.5z" fill="currentColor" />
    {/* Right eye - narrow squinty angular slit pointing inward-down */}
    <path d="M19 8l-5 3-1-1.5 5-2.5z" fill="currentColor" />
  </svg>
);

// Custom Squid/Octopus icon (lucide-style: 24x24, stroke-based)
// Simple clean octopus - dome head with tentacles as single strokes
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
    {/* Octopus head - rounded dome */}
    <path d="M4 9 C4 4 8 1 12 1 C16 1 20 4 20 9 C20 11 18 12 18 12 L6 12 C6 12 4 11 4 9 Z" />
    {/* 6 tentacles flowing down with curls */}
    <path d="M6 12 Q3 15 4 19 Q5 21 6 20" />
    <path d="M8.5 12 Q7 16 8 21 Q9 23 10 22" />
    <path d="M11 12 L11 22" />
    <path d="M13 12 L13 22" />
    <path d="M15.5 12 Q17 16 16 21 Q15 23 14 22" />
    <path d="M18 12 Q21 15 20 19 Q19 21 18 20" />
    {/* Eyes */}
    <circle cx="9" cy="7" r="1.5" fill="currentColor" />
    <circle cx="15" cy="7" r="1.5" fill="currentColor" />
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
