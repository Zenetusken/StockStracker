/**
 * Technical indicator calculation utilities for chart rendering
 * Extracted from StockChart.jsx for better code organization and testability
 */

// SMA configurations - each SMA has a distinct color
export const SMA_CONFIGS = [
  { period: 10, color: '#F59E0B', label: 'SMA 10' },   // Amber - fast
  { period: 20, color: '#FF6B00', label: 'SMA 20' },   // Orange
  { period: 50, color: '#8B5CF6', label: 'SMA 50' },   // Purple
  { period: 200, color: '#06B6D4', label: 'SMA 200' }, // Cyan - slow
];

/**
 * Calculate Simple Moving Average
 * @param {Array} data - OHLCV candle data with {close, time}
 * @param {number} period - Number of periods for average
 * @returns {Array} SMA data points with {time, value}
 */
export function calculateSMA(data, period) {
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

/**
 * Calculate Bollinger Bands (upper, middle, lower)
 * @param {Array} data - OHLCV candle data
 * @param {number} period - SMA period (default 20)
 * @param {number} multiplier - Standard deviation multiplier (default 2)
 * @returns {Object} {upper, middle, lower} arrays
 */
export function calculateBollingerBands(data, period = 20, multiplier = 2) {
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

/**
 * Calculate Exponential Moving Average (standard EMA formula)
 * @param {Array} data - OHLCV candle data
 * @param {number} period - EMA period
 * @returns {Array} EMA data points with {time, value}
 */
export function calculateEMA(data, period) {
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

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {Array} data - OHLCV candle data
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line period (default 9)
 * @returns {Object} {macdLine, signalLine, histogram} arrays
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
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

/**
 * Calculate Relative Strength Index
 * Uses Wilder's smoothing method (standard RSI calculation)
 * @param {Array} data - OHLCV candle data
 * @param {number} period - RSI period (default 14)
 * @returns {Array} RSI data points (0-100 scale)
 */
export function calculateRSI(data, period = 14) {
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

/**
 * Get available SMA periods based on timeframe
 * Ensures we only show periods that will produce meaningful SMA lines
 * These must match the periods in SMA_CONFIGS [10, 20, 50, 200]
 * @param {string} timeframe - Timeframe ('1D', '5D', '1M', etc.)
 * @returns {Array} Available period numbers
 */
export function getAvailableSmaPeriods(timeframe) {
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
