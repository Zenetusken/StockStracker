import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useChartStore } from '../stores/chartStore';

/**
 * StockChart Component
 * Displays candlestick, line, or area charts using TradingView Lightweight Charts
 * Supports custom date range picker for flexible time period selection
 *
 * IMPORTANT: The chart background MUST be a solid color (not transparent) for visibility.
 * Using '#f9fafb' (gray-50) - very light, close to white but slightly grey.
 */

// Chart background color - MUST be solid, not transparent
// Warm cream intermediate - between page-bg (#E8E0D5) and card (#D6C7AE)
const CHART_BACKGROUND_COLOR = '#DDD3C5';

// SMA configurations - each SMA has a distinct color
const SMA_CONFIGS = [
  { period: 10, color: '#F59E0B', label: 'SMA 10' },   // Amber - fast
  { period: 20, color: '#FF6B00', label: 'SMA 20' },   // Orange
  { period: 50, color: '#8B5CF6', label: 'SMA 50' },   // Purple
  { period: 200, color: '#06B6D4', label: 'SMA 200' }, // Cyan - slow
];

// Helper function to calculate Simple Moving Average
function calculateSMA(data, period) {
  if (!data || data.length < period) return [];

  const smaData = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const smaValue = sum / period;
    smaData.push({
      time: data[i].time,
      value: smaValue
    });
  }
  return smaData;
}

// Helper function to calculate Bollinger Bands
// Returns { upper, middle, lower } arrays
function calculateBollingerBands(data, period = 20, multiplier = 2) {
  if (!data || data.length < period) return { upper: [], middle: [], lower: [] };

  const upper = [];
  const middle = [];
  const lower = [];

  for (let i = period - 1; i < data.length; i++) {
    // Calculate SMA (middle band)
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const sma = sum / period;

    // Calculate standard deviation
    let sumSquaredDiff = 0;
    for (let j = 0; j < period; j++) {
      const diff = data[i - j].close - sma;
      sumSquaredDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSquaredDiff / period);

    // Calculate bands
    middle.push({ time: data[i].time, value: sma });
    upper.push({ time: data[i].time, value: sma + (multiplier * stdDev) });
    lower.push({ time: data[i].time, value: sma - (multiplier * stdDev) });
  }

  return { upper, middle, lower };
}

// Helper function to calculate EMA (Exponential Moving Average)
function calculateEMA(data, period) {
  if (!data || data.length < period) return [];

  const multiplier = 2 / (period + 1);
  const emaData = [];

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  emaData.push({ time: data[period - 1].time, value: ema });

  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    emaData.push({ time: data[i].time, value: ema });
  }

  return emaData;
}

// Helper function to calculate MACD
// Returns { macdLine, signalLine, histogram }
function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!data || data.length < slowPeriod + signalPeriod) return { macdLine: [], signalLine: [], histogram: [] };

  // Calculate EMAs
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  // MACD Line = Fast EMA - Slow EMA
  // We need to align the arrays - slow EMA starts later
  const offset = slowPeriod - fastPeriod;
  const macdLine = [];

  for (let i = 0; i < slowEMA.length; i++) {
    const fastValue = fastEMA[i + offset]?.value;
    const slowValue = slowEMA[i]?.value;
    if (fastValue !== undefined && slowValue !== undefined) {
      macdLine.push({
        time: slowEMA[i].time,
        value: fastValue - slowValue
      });
    }
  }

  // Signal Line = 9-period EMA of MACD Line
  if (macdLine.length < signalPeriod) return { macdLine, signalLine: [], histogram: [] };

  const multiplier = 2 / (signalPeriod + 1);
  const signalLine = [];
  const histogram = [];

  // First signal is SMA of MACD
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLine[i].value;
  }
  let signal = sum / signalPeriod;
  signalLine.push({ time: macdLine[signalPeriod - 1].time, value: signal });
  histogram.push({ time: macdLine[signalPeriod - 1].time, value: macdLine[signalPeriod - 1].value - signal });

  // Calculate signal and histogram for remaining data
  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = (macdLine[i].value - signal) * multiplier + signal;
    signalLine.push({ time: macdLine[i].time, value: signal });
    histogram.push({ time: macdLine[i].time, value: macdLine[i].value - signal });
  }

  return { macdLine, signalLine, histogram };
}

// Helper function to calculate RSI (Relative Strength Index)
// Uses Wilder's smoothing method (standard RSI calculation)
function calculateRSI(data, period = 14) {
  if (!data || data.length < period + 1) return [];

  const rsiData = [];
  const gains = [];
  const losses = [];

  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate first average gain/loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // First RSI value
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRSI = 100 - (100 / (1 + firstRS));
  rsiData.push({ time: data[period].time, value: firstRSI });

  // Calculate subsequent RSI values using Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    rsiData.push({ time: data[i + 1].time, value: rsi });
  }

  return rsiData;
}

// Get available SMA periods based on timeframe
// Ensures we only show periods that will produce meaningful SMA lines
// These must match the periods in SMA_CONFIGS [10, 20, 50, 200]
function getAvailableSmaPeriods(timeframe) {
  switch (timeframe) {
    case '1D':   return [10];              // 15-min bars: ~26 points, only 10 works
    case '5D':   return [10, 20];          // Hourly bars: ~40 points
    case '1M':   return [10, 20];          // Daily bars: ~22 points (20 is marginal but OK)
    case '6M':   return [10, 20, 50];      // Daily bars: ~130 points
    case '1Y':   return [10, 20, 50];      // Weekly bars: ~52 points
    case '5Y':   return [10, 20, 50, 200]; // Weekly bars: ~260 points
    case 'Max':  return [10, 20, 50, 200]; // Weekly bars: ~1040 points
    case 'custom': return [10, 20, 50];    // Default for custom range
    default:     return [10, 20, 50];
  }
}

function StockChart({ symbol, chartType: initialChartType = 'candlestick', timeframe: initialTimeframe = '6M' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const smaSeriesRefs = useRef(new Map()); // Map<period, series> for multiple SMAs
  // RSI subplot refs
  const rsiContainerRef = useRef(null);
  const rsiChartRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  // MACD subplot refs
  const macdContainerRef = useRef(null);
  const macdChartRef = useRef(null);
  const macdSeriesRefs = useRef({ macd: null, signal: null, histogram: null });
  // Bollinger Bands refs (overlay on main chart)
  const bbSeriesRefs = useRef({ upper: null, middle: null, lower: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showIndicators, setShowIndicators] = useState(false);
  // RSI state
  const [rsiEnabled, setRsiEnabled] = useState(false);
  const [rsiPeriod] = useState(14); // Standard RSI period
  // MACD state
  const [macdEnabled, setMacdEnabled] = useState(false);
  // Bollinger Bands state
  const [bbEnabled, setBbEnabled] = useState(false);

  // Get preferences and actions from chartStore
  const getPreferences = useChartStore((state) => state.getPreferences);
  const setStoreTimeframe = useChartStore((state) => state.setTimeframe);
  const setStoreChartType = useChartStore((state) => state.setChartType);
  const setStoreSmaEnabled = useChartStore((state) => state.setSmaEnabled);
  const setStoreSmaPeriod = useChartStore((state) => state.setSmaPeriod);
  const fetchCandles = useChartStore((state) => state.fetchCandles);

  // Get preferences from store (handles localStorage internally)
  const preferences = getPreferences(symbol);
  const [chartType, setChartType] = useState(preferences.chartType || initialChartType);
  const [timeframe, setTimeframe] = useState(preferences.timeframe || initialTimeframe);
  // Multiple SMAs: array of enabled periods (e.g., [20, 50])
  const [enabledSMAs, setEnabledSMAs] = useState(() => {
    // Migrate from old single SMA format if present
    if (preferences.smaEnabled && preferences.smaPeriod) {
      return [preferences.smaPeriod];
    }
    return preferences.enabledSMAs || [];
  });
  const [availablePeriods, setAvailablePeriods] = useState(() => getAvailableSmaPeriods(preferences.timeframe || initialTimeframe));

  // Sync preferences from store when symbol changes
  useEffect(() => {
    const prefs = getPreferences(symbol);
    setTimeframe(prefs.timeframe || initialTimeframe);
    setChartType(prefs.chartType || initialChartType);
    // Handle migration from old single SMA format
    if (prefs.enabledSMAs) {
      setEnabledSMAs(prefs.enabledSMAs);
    } else if (prefs.smaEnabled && prefs.smaPeriod) {
      setEnabledSMAs([prefs.smaPeriod]);
    } else {
      setEnabledSMAs([]);
    }
  }, [symbol, initialTimeframe, initialChartType, getPreferences]);

  // Sync preferences to store when they change
  useEffect(() => {
    setStoreTimeframe(symbol, timeframe);
  }, [symbol, timeframe, setStoreTimeframe]);

  useEffect(() => {
    setStoreChartType(symbol, chartType);
  }, [symbol, chartType, setStoreChartType]);

  // For backward compatibility, sync the first enabled SMA to old store fields
  useEffect(() => {
    const hasAnySMA = enabledSMAs.length > 0;
    setStoreSmaEnabled(symbol, hasAnySMA);
    if (hasAnySMA) {
      setStoreSmaPeriod(symbol, enabledSMAs[0]);
    }
  }, [symbol, enabledSMAs, setStoreSmaEnabled, setStoreSmaPeriod]);

  // Update available SMA periods when timeframe changes
  useEffect(() => {
    const periods = getAvailableSmaPeriods(timeframe);
    setAvailablePeriods(periods);
    // Filter out any enabled SMAs that are no longer available
    setEnabledSMAs(prev => prev.filter(p => periods.includes(p)));
  }, [timeframe]);

  // Main chart effect with local isActive variable for proper cleanup
  useEffect(() => {
    // Local variable - each effect invocation has its own isolated isActive
    let isActive = true;
    let chartInstance = null;
    let seriesInstance = null;
    let crosshairHandler = null;
    let resizeObserver = null;

    const loadChart = async () => {
      const container = chartContainerRef.current;
      if (!container) return;

      // Wait for next frame to ensure container has dimensions
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (!isActive) return;

      // Retry if container has zero width
      let containerWidth = container.clientWidth;
      if (containerWidth === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!isActive) return;
        containerWidth = container.clientWidth;
      }

      if (containerWidth === 0) {
        setError('Chart container has no width');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Calculate date range based on timeframe or custom dates
        const now = Math.floor(Date.now() / 1000);
        const dayInSeconds = 86400;

        let from, to, resolution;

        // Check if using custom date range
        if (timeframe === 'custom' && customStartDate && customEndDate) {
          from = Math.floor(new Date(customStartDate).getTime() / 1000);
          to = Math.floor(new Date(customEndDate).getTime() / 1000);

          // Determine resolution based on date range
          const rangeDays = (to - from) / dayInSeconds;
          if (rangeDays <= 7) {
            resolution = '60'; // Hourly for week or less
          } else if (rangeDays <= 90) {
            resolution = 'D'; // Daily for up to 3 months
          } else {
            resolution = 'D'; // Daily for longer ranges
          }
        } else {
          // Use predefined timeframes
          let days;
          switch (timeframe) {
            case '1D': days = 1; resolution = '15'; break;
            case '5D': days = 5; resolution = '60'; break;
            case '1M': days = 30; resolution = 'D'; break;
            case '6M': days = 180; resolution = 'D'; break;
            case '1Y': days = 365; resolution = 'W'; break;    // Weekly for 1Y (daily only covers ~5 months)
            case '5Y': days = 1825; resolution = 'W'; break;   // Weekly for 5Y
            case 'Max': days = 7300; resolution = 'W'; break;  // Weekly for Max (~20 years)
            default: days = 180; resolution = 'D';
          }
          from = now - (days * dayInSeconds);
          to = now;
        }

        // Fetch candle data using chartStore (with LRU caching)
        const result = await fetchCandles(symbol, resolution, from, to);

        if (!isActive) return;

        const data = result?.data;

        if (!data || data.s !== 'ok' || !data.t || data.t.length === 0) {
          throw new Error('No chart data available');
        }

        // Transform data - don't filter by from/to since Yahoo Finance
        // returns data based on its own range parameter (1d, 5d, etc.)
        // which may not exactly match our calculated timestamps
        const chartData = data.t
          .map((timestamp, i) => ({
            time: timestamp,
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
          }))
          .filter(d => d.open != null && d.close != null); // Only filter out null values

        // Handle case where no valid data points exist
        if (chartData.length === 0) {
          throw new Error('No data available for selected time range');
        }

        if (!isActive || !container) return;

        // Get fresh dimensions
        const width = container.clientWidth || 800;
        const height = isFullscreen ? window.innerHeight - 150 : 500;

        // Create chart with SOLID LIGHT GRAY background
        chartInstance = createChart(container, {
          width,
          height,
          layout: {
            background: { type: 'solid', color: CHART_BACKGROUND_COLOR },
            textColor: '#374151',
          },
          grid: {
            vertLines: { color: '#d1d5db' },
            horzLines: { color: '#d1d5db' },
          },
          crosshair: { mode: 1 },
          rightPriceScale: { borderColor: '#9ca3af' },
          timeScale: {
            borderColor: '#9ca3af',
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: true,
          },
        });

        // Store in ref for external access (reset zoom, export)
        chartRef.current = chartInstance;

        // Add series based on chart type
        if (chartType === 'line') {
          seriesInstance = chartInstance.addLineSeries({
            color: '#3B82F6',
            lineWidth: 2,
          });
          seriesInstance.setData(chartData.map(d => ({ time: d.time, value: d.close })));
        } else if (chartType === 'area') {
          seriesInstance = chartInstance.addAreaSeries({
            topColor: 'rgba(59, 130, 246, 0.4)',
            bottomColor: 'rgba(59, 130, 246, 0.0)',
            lineColor: '#3B82F6',
            lineWidth: 2,
          });
          seriesInstance.setData(chartData.map(d => ({ time: d.time, value: d.close })));
        } else {
          seriesInstance = chartInstance.addCandlestickSeries({
            upColor: '#10B981',
            downColor: '#EF4444',
            borderVisible: false,
            wickUpColor: '#10B981',
            wickDownColor: '#EF4444',
          });
          seriesInstance.setData(chartData);
        }

        seriesRef.current = seriesInstance;

        // Add multiple SMA indicators
        smaSeriesRefs.current.clear();
        for (const period of enabledSMAs) {
          const config = SMA_CONFIGS.find(c => c.period === period);
          if (!config) continue;

          const smaData = calculateSMA(chartData, period);
          if (smaData.length > 0) {
            const smaSeries = chartInstance.addLineSeries({
              color: config.color,
              lineWidth: 2,
              title: `SMA(${period})`,
              priceLineVisible: false,
              lastValueVisible: true,
            });
            smaSeries.setData(smaData);
            smaSeriesRefs.current.set(period, smaSeries);
          }
        }

        // Add Bollinger Bands if enabled
        bbSeriesRefs.current = { upper: null, middle: null, lower: null };
        if (bbEnabled && chartData.length >= 20) {
          const { upper, middle, lower } = calculateBollingerBands(chartData, 20, 2);

          // Upper band (purple, dashed)
          if (upper.length > 0) {
            const upperSeries = chartInstance.addLineSeries({
              color: '#8B5CF6',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              title: 'BB Upper',
              priceLineVisible: false,
              lastValueVisible: false,
            });
            upperSeries.setData(upper);
            bbSeriesRefs.current.upper = upperSeries;
          }

          // Middle band (SMA 20, purple solid)
          if (middle.length > 0) {
            const middleSeries = chartInstance.addLineSeries({
              color: '#8B5CF6',
              lineWidth: 1,
              title: 'BB Middle',
              priceLineVisible: false,
              lastValueVisible: true,
            });
            middleSeries.setData(middle);
            bbSeriesRefs.current.middle = middleSeries;
          }

          // Lower band (purple, dashed)
          if (lower.length > 0) {
            const lowerSeries = chartInstance.addLineSeries({
              color: '#8B5CF6',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              title: 'BB Lower',
              priceLineVisible: false,
              lastValueVisible: false,
            });
            lowerSeries.setData(lower);
            bbSeriesRefs.current.lower = lowerSeries;
          }
        }

        // Fit content
        chartInstance.timeScale().fitContent();

        // Create RSI subplot if enabled
        const rsiContainer = rsiContainerRef.current;
        if (rsiEnabled && rsiContainer && chartData.length >= rsiPeriod + 1) {
          const rsiWidth = rsiContainer.clientWidth || width;
          const rsiHeight = 150;

          const rsiChart = createChart(rsiContainer, {
            width: rsiWidth,
            height: rsiHeight,
            layout: {
              background: { type: 'solid', color: CHART_BACKGROUND_COLOR },
              textColor: '#374151',
            },
            grid: {
              vertLines: { color: '#d1d5db' },
              horzLines: { color: '#d1d5db' },
            },
            crosshair: { mode: 1 },
            rightPriceScale: {
              borderColor: '#9ca3af',
              scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
              borderColor: '#9ca3af',
              timeVisible: true,
              secondsVisible: false,
              visible: true,
            },
          });

          rsiChartRef.current = rsiChart;

          // Add RSI line series
          const rsiSeries = rsiChart.addLineSeries({
            color: '#8B5CF6', // Purple
            lineWidth: 2,
            title: `RSI(${rsiPeriod})`,
            priceLineVisible: false,
            lastValueVisible: true,
          });

          const rsiData = calculateRSI(chartData, rsiPeriod);
          rsiSeries.setData(rsiData);
          rsiSeriesRef.current = rsiSeries;

          // Add overbought line at 70
          rsiSeries.createPriceLine({
            price: 70,
            color: '#EF4444', // Red
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Overbought',
          });

          // Add oversold line at 30
          rsiSeries.createPriceLine({
            price: 30,
            color: '#10B981', // Green
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Oversold',
          });

          // Add middle line at 50
          rsiSeries.createPriceLine({
            price: 50,
            color: '#9CA3AF', // Gray
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: false,
          });

          // Sync time scales
          chartInstance.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (range && rsiChartRef.current) {
              rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
            }
          });

          rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (range && chartRef.current) {
              chartRef.current.timeScale().setVisibleLogicalRange(range);
            }
          });

          rsiChart.timeScale().fitContent();
        }

        // Create MACD subplot if enabled
        const macdContainer = macdContainerRef.current;
        if (macdEnabled && macdContainer && chartData.length >= 35) { // Need 26 + 9 points minimum
          const macdWidth = macdContainer.clientWidth || width;
          const macdHeight = 150;

          const macdChart = createChart(macdContainer, {
            width: macdWidth,
            height: macdHeight,
            layout: {
              background: { type: 'solid', color: CHART_BACKGROUND_COLOR },
              textColor: '#374151',
            },
            grid: {
              vertLines: { color: '#d1d5db' },
              horzLines: { color: '#d1d5db' },
            },
            crosshair: { mode: 1 },
            rightPriceScale: {
              borderColor: '#9ca3af',
              scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
              borderColor: '#9ca3af',
              timeVisible: true,
              secondsVisible: false,
              visible: true,
            },
          });

          macdChartRef.current = macdChart;

          const { macdLine, signalLine, histogram } = calculateMACD(chartData);

          // Add histogram as baseline series (bars)
          if (histogram.length > 0) {
            const histogramSeries = macdChart.addHistogramSeries({
              color: '#10B981',
              priceLineVisible: false,
              lastValueVisible: false,
            });
            // Color bars based on value (green positive, red negative)
            const coloredHistogram = histogram.map(h => ({
              time: h.time,
              value: h.value,
              color: h.value >= 0 ? '#10B981' : '#EF4444',
            }));
            histogramSeries.setData(coloredHistogram);
            macdSeriesRefs.current.histogram = histogramSeries;
          }

          // Add MACD line
          if (macdLine.length > 0) {
            const macdSeries = macdChart.addLineSeries({
              color: '#3B82F6', // Blue
              lineWidth: 2,
              title: 'MACD',
              priceLineVisible: false,
              lastValueVisible: true,
            });
            macdSeries.setData(macdLine);
            macdSeriesRefs.current.macd = macdSeries;
          }

          // Add Signal line
          if (signalLine.length > 0) {
            const signalSeries = macdChart.addLineSeries({
              color: '#F59E0B', // Amber
              lineWidth: 2,
              title: 'Signal',
              priceLineVisible: false,
              lastValueVisible: true,
            });
            signalSeries.setData(signalLine);
            macdSeriesRefs.current.signal = signalSeries;
          }

          // Add zero line
          if (macdLine.length > 0) {
            macdSeriesRefs.current.macd.createPriceLine({
              price: 0,
              color: '#9CA3AF',
              lineWidth: 1,
              lineStyle: 1,
              axisLabelVisible: false,
            });
          }

          // Sync time scales
          chartInstance.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (range && macdChartRef.current) {
              macdChartRef.current.timeScale().setVisibleLogicalRange(range);
            }
          });

          macdChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (range && chartRef.current) {
              chartRef.current.timeScale().setVisibleLogicalRange(range);
            }
          });

          macdChart.timeScale().fitContent();
        }

        // Setup crosshair handler
        crosshairHandler = (param) => {
          if (!param.time || !param.point || !seriesInstance) {
            setTooltipData(null);
            return;
          }
          try {
            const seriesData = param.seriesData.get(seriesInstance);
            if (seriesData) {
              // Collect SMA values from all enabled SMA series
              const smaValues = {};
              for (const [period, series] of smaSeriesRefs.current) {
                const smaData = param.seriesData.get(series);
                if (smaData && smaData.value !== undefined) {
                  smaValues[period] = smaData.value;
                }
              }
              setTooltipData({ time: param.time, ...seriesData, smaValues });
            } else {
              setTooltipData(null);
            }
          } catch {
            setTooltipData(null);
          }
        };
        chartInstance.subscribeCrosshairMove(crosshairHandler);

        // Setup resize observer
        resizeObserver = new ResizeObserver(entries => {
          if (!chartInstance || !isActive) return;
          const entry = entries[0];
          if (entry && entry.contentRect.width > 0) {
            chartInstance.applyOptions({ width: entry.contentRect.width });
          }
        });
        resizeObserver.observe(container);

        setLoading(false);
      } catch (err) {
        console.error('Chart error:', err);
        if (isActive) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadChart();

    // Consolidated cleanup function
    return () => {
      isActive = false;

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (crosshairHandler && chartInstance) {
        try {
          chartInstance.unsubscribeCrosshairMove(crosshairHandler);
        } catch {
          // Ignore
        }
      }

      if (chartInstance) {
        try {
          chartInstance.remove();
        } catch {
          // Ignore
        }
      }

      // Cleanup RSI chart
      if (rsiChartRef.current) {
        try {
          rsiChartRef.current.remove();
        } catch {
          // Ignore
        }
      }

      // Cleanup MACD chart
      if (macdChartRef.current) {
        try {
          macdChartRef.current.remove();
        } catch {
          // Ignore
        }
      }

      chartRef.current = null;
      seriesRef.current = null;
      smaSeriesRefs.current.clear();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      macdChartRef.current = null;
      macdSeriesRefs.current = { macd: null, signal: null, histogram: null };
      bbSeriesRefs.current = { upper: null, middle: null, lower: null };
    };
  }, [symbol, chartType, timeframe, isFullscreen, customStartDate, customEndDate, enabledSMAs, rsiEnabled, rsiPeriod, macdEnabled, bbEnabled, fetchCandles]);

  // Reset zoom handler
  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  // Fullscreen handler
  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // Export PNG handler
  const handleExportPNG = () => {
    if (!chartRef.current) return;
    try {
      const canvas = chartRef.current.takeScreenshot();
      if (canvas) {
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${symbol}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        });
      }
    } catch (err) {
      console.error('Failed to export chart:', err);
    }
  };

  // Apply custom date range handler
  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);

      if (start >= end) {
        alert('Start date must be before end date');
        return;
      }

      setTimeframe('custom');
      setShowDatePicker(false);
    } else {
      alert('Please select both start and end dates');
    }
  };

  // Escape key handler for fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  const chartContent = (
    <div
      className={`rounded-lg shadow-lg p-4 relative ${isFullscreen ? 'h-full' : ''}`}
      style={{ backgroundColor: '#DDD3C5' }}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-page-bg bg-opacity-90 rounded-lg z-10">
          <div className="animate-spin h-12 w-12 border-4 border-brand border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-page-bg bg-opacity-90 rounded-lg z-10">
          <div className="text-center">
            <p className="text-loss mb-2">Failed to load chart</p>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
        </div>
      )}

      {/* Chart Controls */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        {/* Chart Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-primary font-medium">Chart Type:</span>
          <div className="flex gap-1 bg-line rounded-lg p-1">
            {['candlestick', 'line', 'area'].map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  chartType === type
                    ? 'bg-card text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-primary font-medium">Timeframe:</span>
          <div className="flex gap-1 bg-line rounded-lg p-1">
            {['1D', '5D', '1M', '6M', '1Y', '5Y', 'Max'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-card text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tf}
              </button>
            ))}
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === 'custom'
                  ? 'bg-card text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="Custom date range"
            >
              📅
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              showIndicators || enabledSMAs.length > 0 || rsiEnabled || macdEnabled || bbEnabled
                ? 'bg-brand text-white hover:bg-brand-hover'
                : 'bg-line text-text-primary hover:bg-line-light'
            }`}
            title="Technical Indicators"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Indicators
          </button>
          <button
            onClick={handleResetZoom}
            className="px-4 py-1.5 text-sm font-medium text-text-primary bg-line hover:bg-line-light rounded-lg transition-colors"
          >
            Reset Zoom
          </button>
          <button
            onClick={handleExportPNG}
            className="px-4 py-1.5 text-sm font-medium text-text-primary bg-line hover:bg-line-light rounded-lg transition-colors flex items-center gap-2"
            title="Export as PNG"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={handleToggleFullscreen}
            className="px-4 py-1.5 text-sm font-medium text-text-primary bg-line hover:bg-line-light rounded-lg transition-colors"
            title="Toggle fullscreen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Modal */}
      {showDatePicker && (
        <div className="mb-4 p-4 bg-card border border-line rounded-lg shadow-lg">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="start-date" className="text-sm font-medium text-text-primary">
                Start Date:
              </label>
              <input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-page-bg text-text-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="end-date" className="text-sm font-medium text-text-primary">
                End Date:
              </label>
              <input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-page-bg text-text-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApplyCustomRange}
                className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-hover rounded-md transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setShowDatePicker(false)}
                className="px-4 py-2 text-sm font-medium text-text-primary bg-table-header hover:bg-line rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicators Panel */}
      {showIndicators && (
        <div className="mb-4 p-4 bg-card border border-line rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Technical Indicators</h3>

          {/* Multiple SMA Indicators */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-text-primary mb-2">
              Simple Moving Averages (SMA)
            </div>
            {SMA_CONFIGS.map(({ period, color, label }) => {
              const isAvailable = availablePeriods.includes(period);
              const isEnabled = enabledSMAs.includes(period);

              const toggleSMA = () => {
                if (isEnabled) {
                  setEnabledSMAs(prev => prev.filter(p => p !== period));
                } else {
                  setEnabledSMAs(prev => [...prev, period]);
                }
              };

              return (
                <div key={period} className={`flex items-center gap-3 ${!isAvailable ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    id={`sma-${period}`}
                    checked={isEnabled}
                    onChange={toggleSMA}
                    disabled={!isAvailable}
                    className="w-4 h-4 rounded focus:ring-2 focus:ring-brand"
                    style={{ accentColor: color }}
                  />
                  <label
                    htmlFor={`sma-${period}`}
                    className="text-sm text-text-primary flex items-center gap-2"
                  >
                    <span
                      className="w-4 h-0.5 rounded"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                    {!isAvailable && (
                      <span className="text-xs text-text-muted">(needs more data)</span>
                    )}
                  </label>
                </div>
              );
            })}
            <div className="text-xs text-text-muted mt-2">
              Available for {timeframe} timeframe: {availablePeriods.join(', ')}
            </div>
            {enabledSMAs.length > 0 && (
              <div className="text-xs text-text-muted">
                Active: {enabledSMAs.map(p => `SMA(${p})`).join(', ')}
              </div>
            )}
          </div>

          {/* Bollinger Bands */}
          <div className="mt-4 pt-4 border-t border-line">
            <div className="text-sm font-medium text-text-primary mb-2">
              Volatility Indicators
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="bb-enabled"
                checked={bbEnabled}
                onChange={() => setBbEnabled(!bbEnabled)}
                className="w-4 h-4 rounded focus:ring-2 focus:ring-brand"
                style={{ accentColor: '#8B5CF6' }}
              />
              <label
                htmlFor="bb-enabled"
                className="text-sm text-text-primary flex items-center gap-2"
              >
                <span
                  className="w-4 h-0.5 rounded"
                  style={{ backgroundColor: '#8B5CF6' }}
                />
                Bollinger Bands (20, 2)
              </label>
            </div>
            <div className="text-xs text-text-muted mt-2 pl-7">
              Shows price volatility with upper/lower bands at 2 standard deviations
            </div>
          </div>

          {/* RSI Indicator */}
          <div className="mt-4 pt-4 border-t border-line">
            <div className="text-sm font-medium text-text-primary mb-2">
              Momentum Indicators
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="rsi-enabled"
                checked={rsiEnabled}
                onChange={() => setRsiEnabled(!rsiEnabled)}
                className="w-4 h-4 rounded focus:ring-2 focus:ring-brand"
                style={{ accentColor: '#8B5CF6' }}
              />
              <label
                htmlFor="rsi-enabled"
                className="text-sm text-text-primary flex items-center gap-2"
              >
                <span
                  className="w-4 h-0.5 rounded"
                  style={{ backgroundColor: '#8B5CF6' }}
                />
                RSI ({rsiPeriod})
              </label>
            </div>
            <div className="text-xs text-text-muted mt-2 pl-7">
              Relative Strength Index - shows overbought ({'>'}70) and oversold ({'<'}30) conditions
            </div>
            {/* MACD */}
            <div className="flex items-center gap-3 mt-3">
              <input
                type="checkbox"
                id="macd-enabled"
                checked={macdEnabled}
                onChange={() => setMacdEnabled(!macdEnabled)}
                className="w-4 h-4 rounded focus:ring-2 focus:ring-brand"
                style={{ accentColor: '#3B82F6' }}
              />
              <label
                htmlFor="macd-enabled"
                className="text-sm text-text-primary flex items-center gap-2"
              >
                <span
                  className="w-4 h-0.5 rounded"
                  style={{ backgroundColor: '#3B82F6' }}
                />
                MACD (12, 26, 9)
              </label>
            </div>
            <div className="text-xs text-text-muted mt-2 pl-7">
              Moving Average Convergence Divergence - trend and momentum indicator
            </div>
          </div>

          {/* Close button */}
          <div className="mt-4 pt-4 border-t border-line">
            <button
              onClick={() => setShowIndicators(false)}
              className="w-full px-4 py-2 text-sm font-medium text-text-primary bg-table-header hover:bg-line rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Crosshair Tooltip */}
      {tooltipData && (
        <div className="absolute top-20 left-4 bg-card border border-line rounded-lg p-3 shadow-lg z-20 pointer-events-none">
          <div className="text-xs space-y-1">
            <div className="font-semibold text-text-primary mb-2">
              {new Date(typeof tooltipData.time === 'number' ? tooltipData.time * 1000 : tooltipData.time).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: (timeframe === '1D' || timeframe === '5D') ? 'numeric' : undefined,
                minute: (timeframe === '1D' || timeframe === '5D') ? 'numeric' : undefined,
              })}
            </div>
            {tooltipData.open !== undefined && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">Open:</span>
                  <span className="font-medium text-text-primary">${tooltipData.open.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">High:</span>
                  <span className="font-medium text-gain">${tooltipData.high.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">Low:</span>
                  <span className="font-medium text-loss">${tooltipData.low.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">Close:</span>
                  <span className="font-medium text-text-primary">${tooltipData.close.toFixed(2)}</span>
                </div>
              </>
            )}
            {tooltipData.value !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">Price:</span>
                <span className="font-medium text-text-primary">${tooltipData.value.toFixed(2)}</span>
              </div>
            )}
            {/* SMA Values */}
            {tooltipData.smaValues && Object.keys(tooltipData.smaValues).length > 0 && (
              <div className="mt-2 pt-2 border-t border-line">
                {SMA_CONFIGS.filter(c => tooltipData.smaValues[c.period] !== undefined).map(({ period, color, label }) => (
                  <div key={period} className="flex justify-between gap-4">
                    <span className="text-text-muted flex items-center gap-1">
                      <span className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
                      {label}:
                    </span>
                    <span className="font-medium" style={{ color }}>${tooltipData.smaValues[period].toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ height: isFullscreen ? `${window.innerHeight - 150}px` : '500px' }}
      />

      {/* RSI Subplot Container */}
      {rsiEnabled && (
        <div className="mt-2">
          <div className="text-xs text-text-muted mb-1 flex items-center gap-2">
            <span className="font-medium">RSI({rsiPeriod})</span>
            <span className="text-loss">70 Overbought</span>
            <span className="text-gain">30 Oversold</span>
          </div>
          <div
            ref={rsiContainerRef}
            className="w-full rounded-lg"
            style={{ height: '150px', backgroundColor: CHART_BACKGROUND_COLOR }}
          />
        </div>
      )}

      {/* MACD Subplot Container */}
      {macdEnabled && (
        <div className="mt-2">
          <div className="text-xs text-text-muted mb-1 flex items-center gap-2">
            <span className="font-medium">MACD (12, 26, 9)</span>
            <span style={{ color: '#3B82F6' }}>MACD Line</span>
            <span style={{ color: '#F59E0B' }}>Signal Line</span>
            <span className="text-gain">Histogram</span>
          </div>
          <div
            ref={macdContainerRef}
            className="w-full rounded-lg"
            style={{ height: '150px', backgroundColor: CHART_BACKGROUND_COLOR }}
          />
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
        <div className="w-full h-full max-w-full max-h-full">
          {chartContent}
        </div>
      </div>
    );
  }

  return chartContent;
}

export default StockChart;
