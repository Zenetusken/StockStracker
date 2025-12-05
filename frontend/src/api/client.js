// Centralized API client for all HTTP requests
const API_BASE_URL = '/api';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 500, 502, 503, 504], // Note: 429 excluded - don't retry rate limits
};

class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.csrfToken = null;
    this.onSessionExpired = null; // Callback for session expiration
  }

  // Set callback for session expiration handling
  setSessionExpiredHandler(callback) {
    this.onSessionExpired = callback;
  }

  // Calculate exponential backoff delay
  getRetryDelay(attempt) {
    const delay = Math.min(
      RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
      RETRY_CONFIG.maxDelay
    );
    // Add jitter (±25%)
    return delay * (0.75 + Math.random() * 0.5);
  }

  // Check if error is retryable
  isRetryable(status, attempt) {
    return (
      attempt < RETRY_CONFIG.maxRetries &&
      (status === 0 || RETRY_CONFIG.retryableStatuses.includes(status))
    );
  }

  // Sleep helper for retry delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Fetch CSRF token from backend
  async fetchCsrfToken() {
    try {
      const response = await fetch(`${this.baseUrl}/csrf-token`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        this.csrfToken = data.csrfToken;
        return this.csrfToken;
      }
    } catch (error) {
      console.warn('Failed to fetch CSRF token:', error.message);
    }
    return null;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';
    const skipRetry = options.skipRetry || false;
    // N2 fix: Extract signal for AbortController support
    const { signal } = options;

    // Build headers with CSRF token for state-changing requests
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Include CSRF token for POST, PUT, DELETE, PATCH requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    const config = {
      credentials: 'include',
      headers,
      signal, // N2 fix: Pass abort signal to fetch
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    let lastError = null;
    let attempt = 0;

    while (attempt <= (skipRetry ? 0 : RETRY_CONFIG.maxRetries)) {
      // N2 fix: Check if aborted before each attempt
      if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      try {
        let response = await fetch(url, config);

        // Handle no-content responses
        if (response.status === 204) {
          return null;
        }

        let data = await response.json().catch(() => null);

        // Handle session expired (401 Unauthorized)
        if (response.status === 401) {
          if (this.onSessionExpired) {
            this.onSessionExpired();
          }
          throw new ApiError(
            'Your session has expired. Please log in again.',
            401,
            data
          );
        }

        // If CSRF token error, refresh token and retry once
        if (response.status === 403 && data?.error?.includes('CSRF')) {
          await this.fetchCsrfToken();
          if (this.csrfToken) {
            config.headers['x-csrf-token'] = this.csrfToken;
            response = await fetch(url, config);
            if (response.status === 204) return null;
            data = await response.json().catch(() => null);
          }
        }

        if (!response.ok) {
          const error = new ApiError(
            data?.error || data?.message || `Request failed with status ${response.status}`,
            response.status,
            data
          );

          // Check if we should retry
          if (this.isRetryable(response.status, attempt) && !skipRetry) {
            lastError = error;
            attempt++;
            const delay = this.getRetryDelay(attempt - 1);
            console.warn(`Request failed (${response.status}), retrying in ${Math.round(delay)}ms... (attempt ${attempt}/${RETRY_CONFIG.maxRetries})`);
            await this.sleep(delay);
            continue;
          }

          throw error;
        }

        // Update CSRF token if returned in response (token rotation)
        if (data?.csrfToken) {
          this.csrfToken = data.csrfToken;
        }

        return data;
      } catch (error) {
        // N2 fix: Don't retry aborted requests
        if (error.name === 'AbortError') {
          throw error;
        }

        if (error instanceof ApiError) {
          // Don't retry 401 errors
          if (error.status === 401) {
            throw error;
          }
          lastError = error;
        } else {
          // Network error - check if retryable
          lastError = new ApiError(error.message || 'Network error', 0, null);
        }

        // Check if we should retry network errors
        if (this.isRetryable(0, attempt) && !skipRetry) {
          attempt++;
          const delay = this.getRetryDelay(attempt - 1);
          console.warn(`Network error, retrying in ${Math.round(delay)}ms... (attempt ${attempt}/${RETRY_CONFIG.maxRetries})`);
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    // Should not reach here, but just in case
    throw lastError || new ApiError('Request failed after retries', 0, null);
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export { ApiError };
export default api;
