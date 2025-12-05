import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Activity,
  BarChart3,
  Calendar,
  Grid3X3,
  List,
} from 'lucide-react';
import { useMarketOverviewStore } from '../stores/marketOverviewStore';
import { getMarketStatus } from '../utils/marketStatus';
import SectorAnalysis from './SectorAnalysis';
import SectorLeaderboard from './SectorLeaderboard';

/**
 * Market Overview Component
 * #116: Major indices (S&P 500, Dow, Nasdaq) with live updates
 * #117: Sector performance heatmap with daily AND YTD performance
 */

// Dynamic refresh based on market status:
// - 60 seconds during trading hours (9:30 AM - 4:00 PM ET)
// - 90 seconds outside trading hours

function MarketOverview() {
  // Use store for caching - data persists across unmount/remount (M1 fix)
  const data = useMarketOverviewStore((state) => state.overview);
  const sectorData = useMarketOverviewStore((state) => state.sectorData);
  const loading = useMarketOverviewStore((state) => state.isLoading);
  const error = useMarketOverviewStore((state) => state.error);
  const lastFetch = useMarketOverviewStore((state) => state.lastFetch);
  const fetchOverview = useMarketOverviewStore((state) => state.fetchOverview);

  // Local UI state only
  const [sectorView, setSectorView] = useState('heatmap'); // 'heatmap' | 'leaderboard'

  // Derive lastUpdated from store's lastFetch
  const lastUpdated = lastFetch ? new Date(lastFetch) : null;

  // Wrapper for manual refresh (force=true)
  const fetchData = () => fetchOverview(true);

  // N10 fix: Use ref for stable interval callback
  const fetchOverviewRef = useRef(fetchOverview);
  useEffect(() => {
    fetchOverviewRef.current = fetchOverview;
  }, [fetchOverview]);

  // Initial fetch and dynamic auto-refresh based on market status
  useEffect(() => {
    // Initial fetch using getState() for stable reference
    const { fetchOverview: fetch } = useMarketOverviewStore.getState();
    fetch(); // Uses cache if valid

    // Dynamic auto-refresh: 60s during trading hours, 90s otherwise
    let dataInterval = null;
    let currentIntervalMs = 0;

    const setupRefreshInterval = () => {
      const { isOpen } = getMarketStatus();
      const newIntervalMs = isOpen ? 60000 : 90000; // 60s during market hours, 90s otherwise

      // Only recreate interval if duration changed
      if (newIntervalMs !== currentIntervalMs) {
        if (dataInterval) {
          clearInterval(dataInterval);
        }
        currentIntervalMs = newIntervalMs;
        dataInterval = setInterval(() => {
          fetchOverviewRef.current(true);
        }, currentIntervalMs);
        console.log(`[MarketOverview] Auto-refresh set to ${currentIntervalMs / 1000}s (market ${isOpen ? 'open' : 'closed'})`);
      }
    };

    // Set initial interval
    setupRefreshInterval();

    // Check market status every minute to adjust interval when market opens/closes
    const statusCheckInterval = setInterval(setupRefreshInterval, 60000);

    return () => {
      if (dataInterval) clearInterval(dataInterval);
      clearInterval(statusCheckInterval);
    };
  }, []);

  // Data validation logging - verify API responses match displayed values
  useEffect(() => {
    if (sectorData?.sectors?.length > 0) {
      console.log('[MarketOverview] Sector data received:', sectorData.sectors.slice(0, 3).map(s => ({
        symbol: s.symbol,
        price: s.price,
        daily: s.daily?.changePercent?.toFixed(2) + '%',
        ytd: s.ytd?.changePercent?.toFixed(2) + '%',
      })));
    }
  }, [sectorData]);

  // Format helpers
  const formatPrice = (val) => {
    if (val == null) return '-';
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (val) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  // Get color class for change
  const getChangeClass = (change) => {
    if (change > 0) return 'text-gain';
    if (change < 0) return 'text-loss';
    return 'text-text-muted';
  };

  // Get heatmap color for sector (daily changes - smaller scale)
  const getHeatmapColor = (changePercent) => {
    if (changePercent >= 2) return 'bg-emerald-600';
    if (changePercent >= 1) return 'bg-emerald-500';
    if (changePercent >= 0.5) return 'bg-emerald-400';
    if (changePercent > 0) return 'bg-emerald-300';
    if (changePercent === 0) return 'bg-gray-400';
    if (changePercent > -0.5) return 'bg-rose-300';
    if (changePercent > -1) return 'bg-rose-400';
    if (changePercent > -2) return 'bg-rose-500';
    return 'bg-rose-600';
  };

  // Get heatmap color for YTD - returns inline style object for guaranteed rendering
  // All opacities kept high (60%+) so colors are clearly visible on dark backgrounds
  const getYtdHeatmapStyle = (changePercent) => {
    // Emerald-500 = rgb(16, 185, 129), Rose-500 = rgb(244, 63, 94), Gray-500 = rgb(107, 114, 128)
    if (changePercent >= 20) return { bg: 'rgba(16, 185, 129, 0.40)', isLight: false };   // 40%
    if (changePercent >= 15) return { bg: 'rgba(16, 185, 129, 0.35)', isLight: false };   // 35%
    if (changePercent >= 10) return { bg: 'rgba(16, 185, 129, 0.30)', isLight: false };   // 30%
    if (changePercent >= 5) return { bg: 'rgba(16, 185, 129, 0.25)', isLight: false };    // 25%
    if (changePercent > 0) return { bg: 'rgba(16, 185, 129, 0.20)', isLight: false };     // 20%
    if (changePercent === 0) return { bg: 'rgba(107, 114, 128, 0.15)', isLight: false };  // 15%
    if (changePercent > -5) return { bg: 'rgba(244, 63, 94, 0.20)', isLight: false };     // 20%
    if (changePercent > -10) return { bg: 'rgba(244, 63, 94, 0.25)', isLight: false };    // 25%
    if (changePercent > -15) return { bg: 'rgba(244, 63, 94, 0.30)', isLight: false };    // 30%
    return { bg: 'rgba(244, 63, 94, 0.35)', isLight: false };                             // 35%
  };

  // Legacy class-based function for daily heatmap (kept for compatibility)
  const getTextColorForBg = (bgClass) => {
    const lightBackgrounds = ['bg-emerald-300', 'bg-emerald-400', 'bg-rose-300', 'bg-rose-400'];
    return lightBackgrounds.includes(bgClass) ? 'text-gray-900' : 'text-white';
  };

  // Get accent color for percentage values based on sign and background
  const getValueAccent = (value, isLightBg) => {
    if (value > 0) return isLightBg ? 'text-emerald-800' : 'text-emerald-200';
    if (value < 0) return isLightBg ? 'text-rose-800' : 'text-rose-400';
    return isLightBg ? 'text-gray-800' : 'text-gray-300';
  };

  // Get intensity class for extreme values (glow effect for strong performers)
  const getIntensityStyle = (value, isYtd = false) => {
    const threshold = isYtd ? 15 : 3; // YTD: ±15%, Daily: ±3%
    if (Math.abs(value) >= threshold) {
      return value > 0
        ? 'drop-shadow-[0_0_3px_rgba(16,185,129,0.5)]' // green glow
        : 'drop-shadow-[0_0_3px_rgba(244,63,94,0.5)]'; // red glow
    }
    return '';
  };

  // Check if value is near zero (for muted styling)
  const isNearZero = (value) => Math.abs(value) < 0.5;

  // Only show loading spinner on initial load (no cached data)
  // If we have cached data, show it while refreshing in background
  if (loading && !data) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <div className="flex items-center justify-center gap-2 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading market data...
        </div>
      </div>
    );
  }

  // Only show error screen if we have no cached data
  // If we have data but refresh failed, we'll show stale data with a warning
  if (error && !data) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <div className="text-center">
          <p className="text-loss mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Major Indices (#116) */}
      <div className="bg-card rounded-lg shadow">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Market Indices
          </h2>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-text-muted">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-page-bg rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data?.indices?.map((index) => (
              <Link
                key={index.symbol}
                to={`/stock/${index.symbol}`}
                className="bg-page-bg rounded-lg p-3 hover:bg-card-hover transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-muted">
                    {index.displaySymbol}
                  </span>
                  {index.changePercent !== undefined && (
                    index.changePercent >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-gain" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-loss" />
                    )
                  )}
                </div>
                <div className="text-sm font-semibold text-text-primary truncate">
                  {index.name}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold text-text-primary">
                    ${formatPrice(index.price)}
                  </span>
                  <span className={`text-sm font-medium ${getChangeClass(index.changePercent)}`}>
                    {formatPercent(index.changePercent)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Sector Heatmap (#117) - Enhanced with YTD Performance */}
      <div className="bg-card rounded-lg shadow">
        <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Sector Performance
            </h2>
            {/* View Toggle */}
            <div className="flex rounded-lg bg-page-bg p-0.5">
              <button
                onClick={() => setSectorView('heatmap')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  sectorView === 'heatmap'
                    ? 'bg-card text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Heatmap</span>
              </button>
              <button
                onClick={() => setSectorView('leaderboard')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  sectorView === 'leaderboard'
                    ? 'bg-card text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Rankings</span>
              </button>
            </div>
          </div>
          {/* Show breadth for both daily and YTD when available */}
          <div className="flex items-center gap-4 text-xs">
            {sectorData?.breadth?.daily && (
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Today:</span>
                <span className="text-gain">{sectorData.breadth.daily.gainers} up</span>
                <span className="text-text-muted">|</span>
                <span className="text-loss">{sectorData.breadth.daily.losers} dn</span>
              </div>
            )}
            {sectorData?.breadth?.ytd && (
              <div className="flex items-center gap-2">
                <span className="text-text-muted flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  YTD:
                </span>
                <span className="text-gain">{sectorData.breadth.ytd.gainers} up</span>
                <span className="text-text-muted">|</span>
                <span className="text-loss">{sectorData.breadth.ytd.losers} dn</span>
              </div>
            )}
            {/* Fallback to old breadth format */}
            {!sectorData?.breadth && data?.breadth && (
              <div className="flex items-center gap-2">
                <span className="text-gain">{data.breadth.sectorGainers} up</span>
                <span className="text-text-muted">|</span>
                <span className="text-loss">{data.breadth.sectorLosers} down</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4">
          {/* Conditional View: Heatmap or Leaderboard */}
          {sectorView === 'heatmap' ? (
            /* Heatmap Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {(sectorData?.sectors || data?.sectors)?.map((sector) => {
                // Use enhanced sector data if available
                const dailyChange = sector.daily?.changePercent ?? sector.changePercent ?? 0;
                const ytdChange = sector.ytd?.changePercent;
                const hasYtd = ytdChange != null;
                const ytdRank = sector.rank?.ytd;
                const dailyRank = sector.rank?.daily;

                // Determine background and text colors for contrast
                // For YTD: use inline styles (rgba) to guarantee opacity rendering
                // For daily-only: use Tailwind classes (fallback)
                const ytdStyle = hasYtd ? getYtdHeatmapStyle(ytdChange) : null;
                const dailyBgClass = !hasYtd ? getHeatmapColor(dailyChange) : '';
                const dailyTextClass = !hasYtd ? getTextColorForBg(dailyBgClass) : '';
                const isLightBg = hasYtd ? ytdStyle.isLight : dailyTextClass === 'text-gray-900';

                return (
                  <Link
                    key={sector.symbol}
                    to={`/stock/${sector.symbol}`}
                    className={`rounded-lg p-3 hover:ring-2 hover:ring-brand/50 hover:scale-[1.02] transition-all duration-150 relative backdrop-blur-sm ${dailyBgClass} ${hasYtd ? (isLightBg ? 'text-gray-900' : 'text-white') : dailyTextClass}`}
                    style={ytdStyle ? { backgroundColor: ytdStyle.bg } : undefined}
                  >
                    {/* Header: Name + Rank Badges */}
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold truncate flex-1">
                        {sector.name}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        {/* Daily rank badge - show top 3 only */}
                        {dailyRank && dailyRank <= 3 && (
                          <span
                            title={`#${dailyRank} top daily performer among sectors`}
                            className={`text-[9px] font-bold px-1 py-0.5 rounded ${isLightBg ? 'bg-black/10 text-gray-700' : 'bg-white/15 text-white/90'
                              }`}
                          >
                            D#{dailyRank}
                          </span>
                        )}
                        {/* YTD rank badge */}
                        {ytdRank && ytdRank <= 5 && (
                          <span
                            title={`#${ytdRank} year-to-date performer among sectors`}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ytdRank <= 3
                              ? 'bg-yellow-400 text-yellow-900'
                              : isLightBg ? 'bg-black/10 text-gray-700' : 'bg-white/20 text-white'
                              }`}
                          >
                            #{ytdRank}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Daily change with directional arrow */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {dailyChange >= 0
                        ? <TrendingUp className={`w-3.5 h-3.5 flex-shrink-0 ${getValueAccent(dailyChange, isLightBg)} ${getIntensityStyle(dailyChange, false)}`} />
                        : <TrendingDown className={`w-3.5 h-3.5 flex-shrink-0 ${getValueAccent(dailyChange, isLightBg)} ${getIntensityStyle(dailyChange, false)}`} />
                      }
                      <span className={`text-sm font-semibold ${getValueAccent(dailyChange, isLightBg)} ${isNearZero(dailyChange) ? 'opacity-70' : ''}`}>
                        {formatPercent(dailyChange)}
                      </span>
                      <span className={`text-[11px] font-medium ${isLightBg ? 'text-gray-800' : 'text-white/80'}`}>today</span>
                    </div>

                    {/* YTD change with directional arrow - larger emphasis + intensity glow */}
                    {hasYtd && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {ytdChange >= 0
                          ? <TrendingUp className={`w-4 h-4 flex-shrink-0 ${getValueAccent(ytdChange, isLightBg)} ${getIntensityStyle(ytdChange, true)}`} />
                          : <TrendingDown className={`w-4 h-4 flex-shrink-0 ${getValueAccent(ytdChange, isLightBg)} ${getIntensityStyle(ytdChange, true)}`} />
                        }
                        <span className={`text-lg font-bold ${getValueAccent(ytdChange, isLightBg)} ${getIntensityStyle(ytdChange, true)} ${isNearZero(ytdChange) ? 'opacity-70' : ''}`}>
                          {formatPercent(ytdChange)}
                        </span>
                        <span className={`text-[11px] font-medium ${isLightBg ? 'text-gray-800' : 'text-white/80'}`}>YTD</span>
                      </div>
                    )}

                    {/* Symbol Badge */}
                    <div className={`text-[10px] font-mono mt-1 ${isLightBg ? 'text-gray-700' : 'text-white/70'}`}>
                      {sector.symbol}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* Leaderboard View */
            <SectorLeaderboard sectors={sectorData?.sectors} viewMode="ytd" />
          )}

          {/* Sector Analysis - Always visible below either view */}
          {sectorData?.analysis && (
            <SectorAnalysis
              analysis={sectorData.analysis}
              breadth={sectorData.breadth}
            />
          )}
        </div>
      </div>

      {/* Market Sentiment - Enhanced Display */}
      {data?.sentiment && (
        <div className="bg-card rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-secondary">Market Sentiment</h3>
            {data.sentiment.confidence != null && (
              <span className="text-xs text-text-muted">
                {data.sentiment.confidence}% confidence
              </span>
            )}
          </div>

          {/* Sentiment Gauge */}
          <div className="flex items-center gap-4 mb-4">
            {/* Visual Meter */}
            <div className="flex-1">
              <div className="h-4 bg-page-bg rounded-full overflow-visible relative">
                {/* Gradient background */}
                <div className="absolute inset-0 flex rounded-full overflow-hidden">
                  <div className="flex-1 bg-gradient-to-r from-rose-500 to-rose-300" />
                  <div className="flex-1 bg-gradient-to-r from-rose-300 via-gray-300 to-emerald-300" />
                  <div className="flex-1 bg-gradient-to-r from-emerald-300 to-emerald-500" />
                </div>
                {/* Indicator - triangle pointer above bar */}
                <div
                  className="absolute -top-2 transform -translate-x-1/2 transition-all duration-500 flex flex-col items-center"
                  style={{
                    left: `${(((data.sentiment.score ?? 0) + 1) / 2) * 100}%`
                  }}
                >
                  {/* Triangle pointer */}
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white drop-shadow-md" />
                  {/* Vertical line through bar */}
                  <div className="w-0.5 h-4 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
                </div>
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-text-muted">
                <span>Bearish</span>
                <span>Neutral</span>
                <span>Bullish</span>
              </div>
            </div>

            {/* Score & Label */}
            <div className="text-right min-w-[100px]">
              {(() => {
                const label = typeof data.sentiment === 'string'
                  ? data.sentiment
                  : data.sentiment?.label || 'neutral';
                const score = data.sentiment?.score ?? 0;
                return (
                  <>
                    <div className={`text-lg font-bold capitalize ${label.includes('bullish') ? 'text-gain' :
                      label.includes('bearish') ? 'text-loss' :
                        'text-text-secondary'
                      }`}>
                      {label.replace('-', ' ')}
                    </div>
                    {typeof data.sentiment === 'object' && (
                      <div className="text-xs text-text-muted">
                        Score: {score > 0 ? '+' : ''}{score.toFixed(2)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Contributing Factors - Grouped by Daily vs YTD */}
          {data.sentiment.factors && data.sentiment.factors.length > 0 && (() => {
            const DAILY_FACTOR_NAMES = ['S&P 500', 'VIX', 'Daily Breadth', 'Consensus'];
            const YTD_FACTOR_NAMES = ['YTD Breadth', 'Rotation', 'Divergence'];

            const dailyFactors = data.sentiment.factors.filter(f => DAILY_FACTOR_NAMES.includes(f.name));
            const ytdFactors = data.sentiment.factors.filter(f => YTD_FACTOR_NAMES.includes(f.name));

            const FactorRow = ({ factor }) => {
              const barWidth = Math.min(Math.abs(factor.score) * 100, 100);
              return (
                <div className="flex items-center gap-2 py-1">
                  {/* Name */}
                  <span className="w-24 text-xs text-text-secondary truncate flex-shrink-0">
                    {factor.name}
                  </span>

                  {/* Score badge */}
                  <span className={`w-11 text-xs font-mono font-medium text-right flex-shrink-0 ${factor.score > 0.1 ? 'text-gain' :
                    factor.score < -0.1 ? 'text-loss' :
                      'text-text-muted'
                    }`}>
                    {factor.score > 0 ? '+' : ''}{factor.score.toFixed(2)}
                  </span>

                  {/* Contribution bar */}
                  <div className="flex-1 h-1.5 bg-page-bg rounded-full overflow-hidden min-w-[40px]">
                    <div
                      className={`h-full rounded-full transition-all ${factor.score > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Weight */}
                  <span className="w-8 text-[10px] text-text-muted text-right flex-shrink-0">
                    {Math.round((factor.weight || 0) * 100)}%
                  </span>

                  {/* Description */}
                  <span className="w-36 text-xs text-text-muted truncate text-right flex-shrink-0" title={factor.description}>
                    {factor.description}
                  </span>
                </div>
              );
            };

            return (
              <div className="border-t border-border pt-3">
                {/* Daily Factors */}
                {dailyFactors.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 flex justify-between items-center">
                      <span>Daily Factors</span>
                      <span className="font-normal">65% weight</span>
                    </div>
                    {dailyFactors.map(f => <FactorRow key={f.name} factor={f} />)}
                  </div>
                )}

                {/* YTD Factors - only if YTD data is available */}
                {data.sentiment.hasYtdData && ytdFactors.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 flex justify-between items-center border-t border-border/50 pt-2">
                      <span>YTD Factors</span>
                      <span className="font-normal">35% weight</span>
                    </div>
                    {ytdFactors.map(f => <FactorRow key={f.name} factor={f} />)}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default MarketOverview;
