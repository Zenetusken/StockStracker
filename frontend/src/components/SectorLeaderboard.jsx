import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';

function SectorLeaderboard({ sectors, viewMode = 'ytd' }) {
  if (!sectors || sectors.length === 0) return null;

  // Sort based on view mode
  const sortedSectors = [...sectors].sort((a, b) => {
    if (viewMode === 'ytd') {
      return (b.ytd?.changePercent || 0) - (a.ytd?.changePercent || 0);
    }
    return (b.daily?.changePercent || 0) - (a.daily?.changePercent || 0);
  });

  // Calculate max for relative bar widths
  const maxValue = Math.max(
    ...sortedSectors.map(s =>
      Math.abs(viewMode === 'ytd' ? s.ytd?.changePercent || 0 : s.daily?.changePercent || 0)
    )
  );

  const formatPercent = (val) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  // Get rank change indicator (comparing daily vs YTD rank)
  const getRankChange = (sector) => {
    if (!sector.rank?.daily || !sector.rank?.ytd) return null;
    const diff = sector.rank.ytd - sector.rank.daily;
    if (diff > 0) return { direction: 'up', amount: diff };
    if (diff < 0) return { direction: 'down', amount: Math.abs(diff) };
    return { direction: 'same', amount: 0 };
  };

  return (
    <div className="space-y-1">
      {sortedSectors.map((sector, idx) => {
        const value = viewMode === 'ytd' ? sector.ytd?.changePercent : sector.daily?.changePercent;
        const isPositive = (value || 0) >= 0;
        const barWidth = maxValue > 0 ? (Math.abs(value || 0) / maxValue) * 100 : 0;
        const rankChange = getRankChange(sector);

        return (
          <Link
            key={sector.symbol}
            to={`/stock/${sector.symbol}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-page-bg/50 transition-colors group"
          >
            {/* Rank Number */}
            <div className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-md ${
              idx < 3 ? 'bg-brand/20 text-brand' : 'bg-page-bg text-text-muted'
            }`}>
              {idx + 1}
            </div>

            {/* Sector Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors truncate">
                  {sector.name}
                </span>
                <span className="text-xs text-text-muted font-mono">
                  {sector.symbol}
                </span>
              </div>

              {/* Performance Bar */}
              <div className="h-1.5 bg-page-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>

            {/* Performance Value */}
            <div className="flex items-center gap-2">
              {/* Rank movement indicator */}
              {rankChange && viewMode === 'ytd' && rankChange.direction !== 'same' && (
                <div className="flex items-center text-xs">
                  {rankChange.direction === 'up' && (
                    <span
                      className="flex items-center text-emerald-500"
                      title={`Up ${rankChange.amount} spots today`}
                    >
                      <ChevronUp className="w-3 h-3" />
                      <span className="text-[10px]">{rankChange.amount}</span>
                    </span>
                  )}
                  {rankChange.direction === 'down' && (
                    <span
                      className="flex items-center text-rose-500"
                      title={`Down ${rankChange.amount} spots today`}
                    >
                      <ChevronDown className="w-3 h-3" />
                      <span className="text-[10px]">{rankChange.amount}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Percentage */}
              <span className={`text-sm font-semibold min-w-[65px] text-right ${
                isPositive ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {formatPercent(value)}
              </span>

              {/* Trend Icon */}
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-500 flex-shrink-0" />
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default SectorLeaderboard;
