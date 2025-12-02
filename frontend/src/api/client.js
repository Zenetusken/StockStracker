// Centralized API client for all HTTP requests
const API_BASE_URL = '/api';

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
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      let response = await fetch(url, config);

      // Handle no-content responses
      if (response.status === 204) {
        return null;
      }

      let data = await response.json().catch(() => null);

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
        throw new ApiError(
          data?.error || data?.message || `Request failed with status ${response.status}`,
          response.status,
          data
        );
      }

      // Update CSRF token if returned in response (token rotation)
      if (data?.csrfToken) {
        this.csrfToken = data.csrfToken;
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Network error', 0, null);
    }
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
