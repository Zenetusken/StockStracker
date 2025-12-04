// Security Dashboard API module
import api from './client';

/**
 * Security API endpoints for the Security Dashboard
 */
export const securityApi = {
  /**
   * GET /api/admin/security/summary
   * Get security dashboard summary with metrics
   * @param {number} hours - Timeframe in hours (default: 24)
   */
  getSummary: (hours = 24) => api.get(`/admin/security/summary?hours=${hours}`),

  /**
   * GET /api/admin/security/logs
   * Query audit logs with filtering
   * @param {Object} filters - Filter parameters
   * @param {string} filters.eventType - Filter by event type
   * @param {string} filters.severity - Filter by severity level
   * @param {string} filters.ipAddress - Filter by IP address
   * @param {string} filters.startDate - Filter start date (ISO string)
   * @param {string} filters.endDate - Filter end date (ISO string)
   * @param {number} filters.limit - Number of results (default: 50, max: 500)
   * @param {number} filters.offset - Pagination offset
   */
  getLogs: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.ipAddress) params.append('ipAddress', filters.ipAddress);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    const queryString = params.toString();
    return api.get(`/admin/security/logs${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * GET /api/admin/security/failed-logins
   * Get failed login attempts grouped by IP address
   * @param {number} hours - Timeframe in hours (default: 24)
   */
  getFailedLogins: (hours = 24) => api.get(`/admin/security/failed-logins?hours=${hours}`),

  /**
   * GET /api/admin/security/critical
   * Get recent critical security events
   */
  getCriticalEvents: () => api.get('/admin/security/critical'),
};

/**
 * Security event types for filtering
 */
export const SECURITY_EVENT_TYPES = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_BLOCKED: 'LOGIN_BLOCKED',
  LOGOUT: 'LOGOUT',
  // Account
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  // Password
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  WEAK_PASSWORD_REJECTED: 'WEAK_PASSWORD_REJECTED',
  // MFA
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  MFA_VERIFIED: 'MFA_VERIFIED',
  MFA_FAILED: 'MFA_FAILED',
  MFA_BACKUP_USED: 'MFA_BACKUP_USED',
  // Session
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_DESTROYED: 'SESSION_DESTROYED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_REGENERATED: 'SESSION_REGENERATED',
  // Access
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  FORBIDDEN_ACCESS: 'FORBIDDEN_ACCESS',
  CSRF_VIOLATION: 'CSRF_VIOLATION',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  // Suspicious
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  BRUTE_FORCE_DETECTED: 'BRUTE_FORCE_DETECTED',
  MULTIPLE_FAILED_LOGINS: 'MULTIPLE_FAILED_LOGINS',
  // Admin
  ADMIN_ACTION: 'ADMIN_ACTION',
  API_KEY_CREATED: 'API_KEY_CREATED',
  API_KEY_DELETED: 'API_KEY_DELETED',
  CONFIG_CHANGED: 'CONFIG_CHANGED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  DATA_IMPORTED: 'DATA_IMPORTED',
};

/**
 * Severity levels
 */
export const SEVERITY_LEVELS = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
};

/**
 * Severity configuration for UI display
 */
export const SEVERITY_CONFIG = {
  INFO: {
    label: 'Info',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    textClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    borderClass: 'border-blue-200 dark:border-blue-800',
  },
  WARNING: {
    label: 'Warning',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    textClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-900/20',
    borderClass: 'border-amber-200 dark:border-amber-800',
  },
  ERROR: {
    label: 'Error',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    textClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    borderClass: 'border-red-200 dark:border-red-800',
  },
  CRITICAL: {
    label: 'Critical',
    color: '#991B1B',
    bgColor: 'rgba(153, 27, 27, 0.1)',
    textClass: 'text-red-800 dark:text-red-300',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    borderClass: 'border-red-300 dark:border-red-700',
  },
};

/**
 * Event type categories for grouping
 */
export const EVENT_CATEGORIES = {
  Authentication: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'LOGOUT'],
  Account: ['ACCOUNT_CREATED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'ACCOUNT_DISABLED', 'ACCOUNT_DELETED'],
  Password: ['PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'WEAK_PASSWORD_REJECTED'],
  MFA: ['MFA_ENABLED', 'MFA_DISABLED', 'MFA_VERIFIED', 'MFA_FAILED', 'MFA_BACKUP_USED'],
  Session: ['SESSION_CREATED', 'SESSION_DESTROYED', 'SESSION_EXPIRED', 'SESSION_REGENERATED'],
  Access: ['UNAUTHORIZED_ACCESS', 'FORBIDDEN_ACCESS', 'CSRF_VIOLATION', 'RATE_LIMIT_EXCEEDED'],
  Suspicious: ['SUSPICIOUS_ACTIVITY', 'BRUTE_FORCE_DETECTED', 'MULTIPLE_FAILED_LOGINS'],
  Admin: ['ADMIN_ACTION', 'API_KEY_CREATED', 'API_KEY_DELETED', 'CONFIG_CHANGED', 'DATA_EXPORTED', 'DATA_IMPORTED'],
};

/**
 * Timeframe options for the selector
 */
export const TIMEFRAME_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 6, label: '6 hours' },
  { value: 24, label: '24 hours' },
  { value: 168, label: '7 days' },
  { value: 720, label: '30 days' },
];

export default securityApi;
