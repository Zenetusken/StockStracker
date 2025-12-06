import { useState, useMemo } from 'react';
import {
  Trophy,
  RefreshCw,
  AlertTriangle,
  BarChart2,
  Zap,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// Icon mapping for insight types
const ICON_MAP = {
  trophy: Trophy,
  refresh: RefreshCw,
  'alert-triangle': AlertTriangle,
  'bar-chart-2': BarChart2,
  zap: Zap,
};

// Sentiment styling for insight cards
const SENTIMENT_STYLES = {
  bullish: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-500',
  },
  'slightly-bullish': {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/10',
    icon: 'text-emerald-400',
  },
  neutral: {
    bg: 'bg-gray-500/5',
    border: 'border-gray-500/10',
    icon: 'text-text-muted',
  },
  'slightly-bearish': {
    bg: 'bg-rose-500/5',
    border: 'border-rose-500/10',
    icon: 'text-rose-400',
  },
  bearish: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    icon: 'text-rose-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-500',
  },
};

// ============= Helper Functions =============

function extractMetrics(analysis, breadth) {
  const metrics = [];
  const dailyGainers = breadth?.daily?.gainers || 0;
  const dailyLosers = breadth?.daily?.losers || 0;
  const ytdGainers = breadth?.ytd?.gainers || 0;
  const ytdLosers = breadth?.ytd?.losers || 0;
  const dailyTotal = dailyGainers + dailyLosers;
  const ytdTotal = ytdGainers + ytdLosers;

  // Daily metric
  if (dailyTotal > 0) {
    const dailyRatio = dailyGainers / dailyTotal;
    metrics.push({
      label: 'Today',
      value: `${dailyGainers}/${dailyTotal}`,
      trend: dailyRatio >= 0.5 ? 'up' : 'down',
      sentiment: dailyRatio >= 0.6 ? 'bullish' : dailyRatio <= 0.4 ? 'bearish' : 'neutral'
    });
  }

  // YTD metric
  if (ytdTotal > 0) {
    const ytdRatio = ytdGainers / ytdTotal;
    metrics.push({
      label: 'YTD',
      value: `${ytdGainers}/${ytdTotal}`,
      trend: ytdRatio >= 0.5 ? 'up' : 'down',
      sentiment: ytdRatio >= 0.7 ? 'bullish' : ytdRatio <= 0.3 ? 'bearish' : 'neutral'
    });
  }

  // Rotation metric (only if significant)
  const rotation = analysis?.signals?.rotation || 0;
  if (Math.abs(rotation) > 2) {
    metrics.push({
      label: rotation > 0 ? 'Cyclical' : 'Defensive',
      value: `${rotation > 0 ? '+' : ''}${rotation.toFixed(1)}%`,
      trend: rotation > 0 ? 'up' : 'down',
      sentiment: Math.abs(rotation) > 5 ? (rotation > 0 ? 'bullish' : 'bearish') : 'neutral'
    });
  }

  return metrics;
}

function getSentimentStyle(breadth) {
  const dailyGainers = breadth?.daily?.gainers || 0;
  const dailyLosers = breadth?.daily?.losers || 0;
  const ytdGainers = breadth?.ytd?.gainers || 0;
  const ytdLosers = breadth?.ytd?.losers || 0;
  const dailyTotal = dailyGainers + dailyLosers || 1;
  const ytdTotal = ytdGainers + ytdLosers || 1;
  const dailyRatio = dailyGainers / dailyTotal;
  const ytdRatio = ytdGainers / ytdTotal;

  if (dailyRatio >= 0.7 && ytdRatio >= 0.7) {
    return 'bg-emerald-500/5 border-emerald-500/15';
  }
  if (dailyRatio <= 0.3 && ytdRatio <= 0.3) {
    return 'bg-rose-500/5 border-rose-500/15';
  }
  return 'bg-brand/5 border-brand/10';
}

function cleanSummaryText(summary) {
  if (!summary) return '';
  return summary
    .replace(/\s*\(\d+\/\d+(?:\s+\w+)?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============= Sub-components =============

function MetricPill({ label, value, trend, sentiment }) {
  const colors = {
    bullish: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    bearish: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    neutral: 'bg-gray-500/10 text-text-secondary border-gray-500/20'
  };
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${colors[sentiment] || colors.neutral}`}>
      <TrendIcon className="w-3 h-3" />
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
}

// Enhanced: Dual-direction breadth bar showing gainers vs losers from center
function BreadthBar({ gainers, losers, label }) {
  const total = gainers + losers || 1;
  const gainerPct = (gainers / total) * 100;
  const loserPct = (losers / total) * 100;
  const isPositive = gainers > losers;
  const isEqual = gainers === losers;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-muted uppercase tracking-wide font-medium">{label}</span>
        <span className={`text-xs font-semibold ${
          isEqual ? 'text-text-secondary' : isPositive ? 'text-emerald-500' : 'text-rose-500'
        }`}>
          {gainers}/{total}
        </span>
      </div>

      {/* Dual-direction bar */}
      <div className="relative h-2.5 bg-page-bg rounded-full overflow-hidden">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-text-muted/30 z-10" />

        {/* Gainers (right side) */}
        <div
          className="absolute left-1/2 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-r-full transition-all duration-700"
          style={{ width: `${gainerPct / 2}%` }}
        />

        {/* Losers (left side) */}
        <div
          className="absolute right-1/2 h-full bg-gradient-to-l from-rose-500 to-rose-400 rounded-l-full transition-all duration-700"
          style={{ width: `${loserPct / 2}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>{losers} down</span>
        <span>{gainers} up</span>
      </div>
    </div>
  );
}

// Enhanced: Horizontal gauge showing cyclical ↔ defensive spectrum
function RotationGauge({ rotation }) {
  // rotation: negative = defensive, positive = cyclical
  // Map -15 to +15 range to 0-100 for positioning
  const normalized = Math.max(-15, Math.min(15, rotation));
  const position = 50 + (normalized / 15) * 50;
  const isSignificant = Math.abs(rotation) > 3;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-muted uppercase tracking-wide font-medium">Rotation</span>
        <span className={`text-xs font-mono font-semibold ${
          rotation > 0 ? 'text-emerald-500' : rotation < 0 ? 'text-rose-500' : 'text-text-secondary'
        }`}>
          {rotation > 0 ? '+' : ''}{rotation.toFixed(1)}%
        </span>
      </div>

      {/* Gradient gauge */}
      <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-rose-500/20 via-gray-500/10 to-emerald-500/20">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-text-muted/40 z-10" />

        {/* Position indicator */}
        <div
          className={`absolute top-0 h-full w-1.5 rounded-full transition-all duration-700 ${
            isSignificant
              ? rotation > 0 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-rose-500 shadow-lg shadow-rose-500/50'
              : 'bg-text-secondary'
          }`}
          style={{ left: `calc(${position}% - 3px)` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>← Defensive</span>
        <span>Cyclical →</span>
      </div>
    </div>
  );
}

// Enhanced: Semi-circular arc with glowing segments
function MomentumArc({ filled, total }) {
  const segments = Array.from({ length: total }, (_, i) => i < filled);

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-text-muted uppercase tracking-wide font-medium block">Momentum</span>

      <div className="flex items-center gap-3">
        {/* Arc visualization */}
        <div className="relative w-14 h-7 flex-shrink-0">
          <svg viewBox="0 0 56 28" className="w-full h-full">
            {segments.map((isFilled, i) => {
              const startAngle = 180 + (i * 60);
              const endAngle = startAngle + 55;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const cx = 28, cy = 28, r = 20;

              const x1 = cx + r * Math.cos(startRad);
              const y1 = cy + r * Math.sin(startRad);
              const x2 = cx + r * Math.cos(endRad);
              const y2 = cy + r * Math.sin(endRad);

              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                  fill="none"
                  strokeWidth="5"
                  strokeLinecap="round"
                  className={`transition-all duration-500 ${
                    isFilled ? 'stroke-emerald-500' : 'stroke-page-bg'
                  }`}
                  style={isFilled ? { filter: 'drop-shadow(0 0 3px rgb(16 185 129 / 0.5))' } : {}}
                />
              );
            })}
          </svg>
        </div>

        {/* Text */}
        <div>
          <div className="text-base font-bold text-text-primary">{filled}/{total}</div>
          <div className="text-[10px] text-text-muted leading-tight">leaders aligned</div>
        </div>
      </div>
    </div>
  );
}

// Enhanced: Badge with icon and severity coloring
function DivergenceBadge({ count }) {
  const severity = count >= 4 ? 'high' : count >= 2 ? 'moderate' : 'low';
  const colors = {
    high: 'bg-amber-500/15 border-amber-500/30 text-amber-500',
    moderate: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    low: 'bg-gray-500/10 border-gray-500/20 text-text-secondary'
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-text-muted uppercase tracking-wide font-medium block">Divergence</span>

      <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${colors[severity]}`}>
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="text-base font-bold">{count}</span>
        <span className="text-[10px] opacity-70">{count === 1 ? 'sector' : 'sectors'}</span>
      </div>
    </div>
  );
}

function SignalBreakdown({ breadth, signals }) {
  const dailyGainers = breadth?.daily?.gainers || 0;
  const dailyLosers = breadth?.daily?.losers || 0;
  const ytdGainers = breadth?.ytd?.gainers || 0;
  const ytdLosers = breadth?.ytd?.losers || 0;
  const hasDivergence = (signals?.divergence || 0) > 0;

  return (
    <div className="bg-card-bg/50 backdrop-blur-sm border border-card-border/50 rounded-lg p-4">
      {/* Header with legend */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-brand" />
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Signal Breakdown
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Bullish
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Bearish
          </span>
        </div>
      </div>

      {/* Enhanced grid layout */}
      <div className={`grid gap-4 ${hasDivergence ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {/* Breadth metrics grouped */}
        <div className="space-y-3 p-3 bg-page-bg/30 rounded-lg">
          <BreadthBar label="Daily Breadth" gainers={dailyGainers} losers={dailyLosers} />
          <BreadthBar label="YTD Breadth" gainers={ytdGainers} losers={ytdLosers} />
        </div>

        {/* Rotation gauge */}
        <div className="p-3 bg-page-bg/30 rounded-lg">
          <RotationGauge rotation={signals?.rotation || 0} />
        </div>

        {/* Momentum arc */}
        <div className="p-3 bg-page-bg/30 rounded-lg">
          <MomentumArc filled={signals?.momentum || 0} total={3} />
        </div>

        {/* Divergence badge - only show if present */}
        {hasDivergence && (
          <div className="p-3 bg-page-bg/30 rounded-lg">
            <DivergenceBadge count={signals?.divergence || 0} />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryBanner({ summary, metrics, bannerStyle, showBreakdown, onToggle }) {
  if (!summary) return null;

  return (
    <div className={`rounded-lg border ${bannerStyle} p-4`}>
      {/* Summary Text */}
      <p className="text-sm text-text-primary leading-relaxed font-medium">
        {summary}
      </p>

      {/* Metric Pills */}
      {metrics.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {metrics.map((metric, idx) => (
            <MetricPill key={idx} {...metric} />
          ))}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors mt-3"
      >
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showBreakdown ? 'rotate-180' : ''}`} />
        Signal Breakdown
      </button>
    </div>
  );
}

function InsightCard({ insight }) {
  const Icon = ICON_MAP[insight.icon] || BarChart2;
  const styles = SENTIMENT_STYLES[insight.sentiment] || SENTIMENT_STYLES.neutral;

  return (
    <div className={`rounded-lg p-3 border ${styles.bg} ${styles.border} transition-all hover:scale-[1.01]`}>
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-md ${styles.bg}`}>
          <Icon className={`w-4 h-4 ${styles.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              {insight.title}
            </span>
          </div>
          <p className="text-sm text-text-primary leading-snug">{insight.text}</p>
          {insight.subtext && (
            <p className="text-xs text-text-muted mt-1">{insight.subtext}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= Main Component =============

function SectorAnalysis({ analysis, breadth }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Clean summary text (remove parenthetical numbers)
  const cleanSummary = useMemo(() => cleanSummaryText(analysis?.summary), [analysis?.summary]);

  // Extract metrics for pills
  const metrics = useMemo(() => extractMetrics(analysis, breadth), [analysis, breadth]);

  // Get sentiment-based styling
  const bannerStyle = useMemo(() => getSentimentStyle(breadth), [breadth]);

  if (!analysis || (!analysis.summary && (!analysis.insights || analysis.insights.length === 0))) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Enhanced Summary Banner */}
      {analysis.summary && (
        <SummaryBanner
          summary={cleanSummary}
          metrics={metrics}
          bannerStyle={bannerStyle}
          showBreakdown={showBreakdown}
          onToggle={() => setShowBreakdown(!showBreakdown)}
        />
      )}

      {/* Signal Breakdown (animated collapsible) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          showBreakdown && breadth ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {breadth && (
          <SignalBreakdown breadth={breadth} signals={analysis?.signals} />
        )}
      </div>

      {/* Insights Grid */}
      {analysis.insights && analysis.insights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {analysis.insights.map((insight, idx) => (
            <InsightCard key={insight.type || idx} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

export default SectorAnalysis;
