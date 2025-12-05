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

function SignalMeter({ label, value, detail, showValue }) {
  const getColor = (pct) => {
    if (pct >= 70) return 'bg-emerald-500';
    if (pct >= 55) return 'bg-emerald-400';
    if (pct >= 45) return 'bg-gray-400';
    if (pct >= 30) return 'bg-rose-400';
    return 'bg-rose-500';
  };

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
        {showValue && <span className="text-xs font-mono text-text-secondary">{showValue}</span>}
      </div>
      <div className="h-2 bg-page-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <div className="text-xs text-text-muted mt-1">{detail}</div>
    </div>
  );
}

function SignalDots({ label, filled, total, detail }) {
  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="flex gap-1">
        {[...Array(total)].map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${
              i < filled ? 'bg-emerald-500' : 'bg-page-bg border border-card-border'
            }`}
          />
        ))}
      </div>
      <div className="text-xs text-text-muted mt-1">{detail}</div>
    </div>
  );
}

function SignalCount({ label, count, detail }) {
  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold text-amber-500">{count}</span>
        <span className="text-xs text-text-muted">{detail}</span>
      </div>
    </div>
  );
}

function SignalBreakdown({ breadth, signals }) {
  const dailyGainers = breadth?.daily?.gainers || 0;
  const dailyLosers = breadth?.daily?.losers || 0;
  const ytdGainers = breadth?.ytd?.gainers || 0;
  const ytdLosers = breadth?.ytd?.losers || 0;
  const dailyTotal = dailyGainers + dailyLosers || 1;
  const ytdTotal = ytdGainers + ytdLosers || 1;
  const dailyPercent = (dailyGainers / dailyTotal) * 100;
  const ytdPercent = (ytdGainers / ytdTotal) * 100;

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Daily Breadth */}
        <SignalMeter
          label="Daily Breadth"
          value={dailyPercent}
          detail={`${dailyGainers} up / ${dailyLosers} down`}
        />

        {/* YTD Breadth */}
        <SignalMeter
          label="YTD Breadth"
          value={ytdPercent}
          detail={`${ytdGainers} up / ${ytdLosers} down`}
        />

        {/* Rotation Spread - only show if significant */}
        {Math.abs(signals?.rotation || 0) > 1 && (
          <SignalMeter
            label="Rotation Spread"
            value={50 + ((signals?.rotation || 0) / 30) * 50}
            detail={`${(signals?.rotation || 0) > 0 ? 'Cyclical' : 'Defensive'} tilt`}
            showValue={`${(signals?.rotation || 0) > 0 ? '+' : ''}${(signals?.rotation || 0).toFixed(1)}%`}
          />
        )}

        {/* Momentum Alignment */}
        <SignalDots
          label="Momentum"
          filled={signals?.momentum || 0}
          total={3}
          detail={`${signals?.momentum || 0}/3 leaders aligned`}
        />

        {/* Divergence - only show if present */}
        {(signals?.divergence || 0) > 0 && (
          <SignalCount
            label="Rank Divergence"
            count={signals?.divergence || 0}
            detail={(signals?.divergence || 0) === 1 ? 'sector' : 'sectors'}
          />
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

      {/* Signal Breakdown (collapsible) */}
      {showBreakdown && breadth && (
        <SignalBreakdown breadth={breadth} signals={analysis?.signals} />
      )}

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
