import { useEffect, useRef, useState } from 'react';
import { useToastStore } from '../stores/toastStore';

const SSE_URL = 'http://localhost:3001/api/rate-limits/stream';

function useRateLimitEvents() {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isCleaningUpRef = useRef(false);
  const addToast = useToastStore((state) => state.addToast);
  const clearServiceToasts = useToastStore((state) => state.clearServiceToasts);

  useEffect(() => {
    isCleaningUpRef.current = false;

    const connect = () => {
      if (isCleaningUpRef.current) return;

      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        console.log('[RateLimitSSE] Connecting to:', SSE_URL);

        const eventSource = new EventSource(SSE_URL, {
          withCredentials: true
        });

        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('[RateLimitSSE] Connection opened');
          setConnected(true);
          setReconnecting(false);
          reconnectAttemptsRef.current = 0;
        };

        eventSource.addEventListener('connected', (event) => {
          console.log('[RateLimitSSE] Server confirmed connection');
        });

        eventSource.addEventListener('usage_warning', (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[RateLimitSSE] Usage warning:', data);
            addToast({
              type: 'warning',
              title: `${data.displayName} Usage Warning`,
              message: data.message,
              service: data.service,
              duration: 6000
            });
          } catch (err) {
            console.error('[RateLimitSSE] Error parsing usage_warning:', err);
          }
        });

        eventSource.addEventListener('rate_limit_hit', (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[RateLimitSSE] Rate limit hit:', data);
            addToast({
              type: 'error',
              title: `${data.displayName} Rate Limited`,
              message: data.message,
              service: data.service,
              duration: 8000
            });
          } catch (err) {
            console.error('[RateLimitSSE] Error parsing rate_limit_hit:', err);
          }
        });

        eventSource.addEventListener('rate_limit_recovered', (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[RateLimitSSE] Rate limit recovered:', data);

            // Clear any existing error toasts for this service
            clearServiceToasts(data.service, 'error');

            addToast({
              type: 'success',
              title: `${data.displayName} Available`,
              message: data.message,
              service: data.service,
              duration: 5000
            });
          } catch (err) {
            console.error('[RateLimitSSE] Error parsing rate_limit_recovered:', err);
          }
        });

        eventSource.onerror = (error) => {
          console.error('[RateLimitSSE] Connection error:', error);
          setConnected(false);
          eventSource.close();

          const maxAttempts = 10;
          if (reconnectAttemptsRef.current < maxAttempts && !isCleaningUpRef.current) {
            setReconnecting(true);
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptsRef.current),
              30000
            );
            reconnectAttemptsRef.current += 1;

            console.log(
              `[RateLimitSSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxAttempts})...`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setReconnecting(false);
          }
        };
      } catch (err) {
        console.error('[RateLimitSSE] Error creating connection:', err);
        setConnected(false);
      }
    };

    // Debounced initial connection
    const connectTimeout = setTimeout(() => {
      if (!isCleaningUpRef.current) {
        connect();
      }
    }, 500); // Increased to 500ms to avoid race conditions on load

    return () => {
      console.log('[RateLimitSSE] Cleaning up connection');
      isCleaningUpRef.current = true;

      clearTimeout(connectTimeout);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        // Remove listeners before closing to prevent error events during close
        const es = eventSourceRef.current;
        es.onerror = null;
        es.onopen = null;
        es.onmessage = null;
        es.close();
        eventSourceRef.current = null;
      }

      setConnected(false);
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
    };
  }, [addToast, clearServiceToasts]);

  return { connected, reconnecting };
}

export default useRateLimitEvents;
