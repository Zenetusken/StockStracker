import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for Server-Sent Events (SSE) with auto-reconnect
 * @param {string[]} symbols - Array of symbols to subscribe to
 * @param {function} onQuoteUpdate - Callback when quotes are updated
 * @param {function} onError - Optional callback for errors
 * @returns {object} - { connected, reconnecting }
 */
function useSSE(symbols, onQuoteUpdate, onError) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const connectTimeoutRef = useRef(null);
  const isCleaningUpRef = useRef(false);

  // Memoize the symbols string to prevent unnecessary reconnects
  const symbolsKey = symbols?.join(',') || '';

  useEffect(() => {
    // Don't connect if no symbols
    if (!symbolsKey) {
      return;
    }

    // Prevent rapid reconnects during StrictMode double-mount
    isCleaningUpRef.current = false;

    const connect = () => {
      // Don't connect if we're in cleanup phase
      if (isCleaningUpRef.current) {
        return;
      }

      try {
        // Close existing connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        const url = `http://localhost:3001/api/stream/quotes?symbols=${encodeURIComponent(
          symbolsKey
        )}`;

        console.log('[SSE] Connecting to:', url);

        // Create EventSource with credentials
        const eventSource = new EventSource(url, {
          withCredentials: true,
        });

        eventSourceRef.current = eventSource;

        // Handle connection open
        eventSource.onopen = () => {
          console.log('[SSE] Connection opened');
          setConnected(true);
          setReconnecting(false);
          reconnectAttemptsRef.current = 0;
        };

        // Handle messages
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[SSE] Message received:', data.type);

            if (data.type === 'connected') {
              console.log('[SSE] Server confirmed connection for symbols:', data.symbols);
            } else if (data.type === 'quote_update') {
              // Call the update callback with the quotes
              if (onQuoteUpdate) {
                onQuoteUpdate(data);
              }
            }
          } catch (err) {
            console.error('[SSE] Error parsing message:', err);
          }
        };

        // Handle errors
        eventSource.onerror = (error) => {
          console.error('[SSE] Connection error:', error);
          setConnected(false);

          // Close the connection
          eventSource.close();

          // Call error callback if provided
          if (onError) {
            onError(error);
          }

          // Attempt to reconnect with exponential backoff
          const maxAttempts = 10;
          if (reconnectAttemptsRef.current < maxAttempts) {
            setReconnecting(true);
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptsRef.current),
              30000
            ); // Max 30 seconds
            reconnectAttemptsRef.current += 1;

            console.log(
              `[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxAttempts})...`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error('[SSE] Max reconnection attempts reached');
            setReconnecting(false);
          }
        };
      } catch (err) {
        console.error('[SSE] Error creating connection:', err);
        setConnected(false);
      }
    };

    // Debounced initial connection to prevent rapid reconnects in StrictMode
    connectTimeoutRef.current = setTimeout(() => {
      if (!isCleaningUpRef.current) {
        connect();
      }
    }, 100);

    // Cleanup function
    return () => {
      console.log('[SSE] Cleaning up connection');
      isCleaningUpRef.current = true;

      // Clear connect timeout
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close event source
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setConnected(false);
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onQuoteUpdate and onError are stable callbacks
  }, [symbolsKey]); // Re-connect if symbols change

  return {
    connected,
    reconnecting,
  };
}

export default useSSE;
