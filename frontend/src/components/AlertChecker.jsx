import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { useQuoteStore } from '../stores/quoteStore';
import { useToastStore } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';

/**
 * AlertChecker - Background component that monitors quotes and triggers alerts
 * Renders nothing, just manages alert checking logic
 */
function AlertChecker() {
  const user = useAuthStore((state) => state.user);
  const alerts = useAlertStore((state) => state.alerts);
  const fetchAlerts = useAlertStore((state) => state.fetchAlerts);
  const canTriggerAlert = useAlertStore((state) => state.canTriggerAlert);
  const markAlertTriggered = useAlertStore((state) => state.markAlertTriggered);
  const notificationPermission = useAlertStore((state) => state.notificationPermission);

  const quotes = useQuoteStore((state) => state.quotes);
  const subscribe = useQuoteStore((state) => state.subscribe);
  const unsubscribe = useQuoteStore((state) => state.unsubscribe);

  const addToast = useToastStore((state) => state.addToast);

  // Track previous quote values to detect changes
  const prevQuotesRef = useRef({});
  // Track previously subscribed symbols for proper cleanup (M3 fix)
  const prevSymbolsRef = useRef([]);

  // Get unique symbols from active alerts - memoized for stable reference (M3 fix)
  const activeAlerts = useMemo(() => alerts.filter(a => a.is_active), [alerts]);
  const alertSymbols = useMemo(
    () => [...new Set(activeAlerts.map(a => a.symbol.toUpperCase()))],
    [activeAlerts]
  );

  // Fetch alerts on mount if user is logged in
  useEffect(() => {
    if (user) {
      fetchAlerts().catch(() => {});
    }
  }, [user, fetchAlerts]);

  // Subscribe to alert symbols - uses ref for stable cleanup (M3 fix)
  useEffect(() => {
    const currentSymbols = alertSymbols;
    const prevSymbols = prevSymbolsRef.current;

    // Check if symbols actually changed
    const currentSorted = [...currentSymbols].sort().join(',');
    const prevSorted = [...prevSymbols].sort().join(',');

    if (currentSorted !== prevSorted) {
      // Unsubscribe from previous symbols
      if (prevSymbols.length > 0) {
        unsubscribe(prevSymbols);
      }
      // Subscribe to new symbols
      if (currentSymbols.length > 0) {
        subscribe(currentSymbols);
      }
      prevSymbolsRef.current = currentSymbols;
    }

    return () => {
      // Cleanup on unmount - unsubscribe from tracked symbols
      if (prevSymbolsRef.current.length > 0) {
        unsubscribe(prevSymbolsRef.current);
      }
    };
  }, [alertSymbols, subscribe, unsubscribe]);

  // Trigger alert notification (defined first so it can be used by checkAlerts)
  const triggerAlert = useCallback((alert, quote, message) => {
    const title = alert.name || `Price Alert: ${alert.symbol}`;

    // Show toast notification
    addToast({
      type: 'warning',
      title,
      message,
      service: `alert-${alert.id}`,
      duration: 10000 // 10 seconds for alerts
    });

    // Show browser notification if permitted
    if (notificationPermission === 'granted' && typeof Notification !== 'undefined') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          tag: `alert-${alert.id}`, // Prevents duplicate notifications
          requireInteraction: true
        });
      } catch (err) {
        console.error('Browser notification failed:', err);
      }
    }

    // Mark as triggered in store
    markAlertTriggered(alert.id, quote);
  }, [addToast, notificationPermission, markAlertTriggered]);

  // Check alert conditions
  const checkAlerts = useCallback((symbol, quote, prevQuote) => {
    if (!quote || !quote.current) return;

    const symbolAlerts = activeAlerts.filter(
      a => a.symbol.toUpperCase() === symbol.toUpperCase()
    );

    symbolAlerts.forEach((alert) => {
      if (!canTriggerAlert(alert.id)) return;

      let shouldTrigger = false;
      let message = '';

      switch (alert.type) {
        case 'price_above':
          // Trigger if current price crosses above target
          if (quote.current >= alert.target_price) {
            // Only trigger if we crossed the threshold (wasn't already above)
            const wasBelow = !prevQuote || prevQuote.current < alert.target_price;
            if (wasBelow || !prevQuote) {
              shouldTrigger = true;
              message = `${symbol} is now above $${alert.target_price.toFixed(2)} at $${quote.current.toFixed(2)}`;
            }
          }
          break;

        case 'price_below':
          // Trigger if current price crosses below target
          if (quote.current <= alert.target_price) {
            // Only trigger if we crossed the threshold (wasn't already below)
            const wasAbove = !prevQuote || prevQuote.current > alert.target_price;
            if (wasAbove || !prevQuote) {
              shouldTrigger = true;
              message = `${symbol} dropped below $${alert.target_price.toFixed(2)} to $${quote.current.toFixed(2)}`;
            }
          }
          break;

        case 'percent_change':
          // Trigger if percent change exceeds target (absolute value)
          if (quote.percentChange && Math.abs(quote.percentChange) >= alert.target_price) {
            shouldTrigger = true;
            const direction = quote.percentChange >= 0 ? 'up' : 'down';
            message = `${symbol} moved ${direction} ${Math.abs(quote.percentChange).toFixed(2)}%`;
          }
          break;

        default:
          break;
      }

      if (shouldTrigger) {
        triggerAlert(alert, quote, message);
      }
    });
  }, [activeAlerts, canTriggerAlert, triggerAlert]);

  // Watch for quote updates and check alerts
  useEffect(() => {
    if (alertSymbols.length === 0) return;

    // Check each symbol that has new quote data
    alertSymbols.forEach((symbol) => {
      const currentQuote = quotes[symbol];
      const prevQuote = prevQuotesRef.current[symbol];

      // Only check if quote has updated
      if (currentQuote && currentQuote.lastUpdate !== prevQuote?.lastUpdate) {
        checkAlerts(symbol, currentQuote, prevQuote);
      }
    });

    // Update previous quotes reference
    prevQuotesRef.current = { ...quotes };
  }, [quotes, alertSymbols, checkAlerts]);

  // This component doesn't render anything
  return null;
}

export default AlertChecker;
