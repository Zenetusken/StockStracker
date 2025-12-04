import {
  LogIn,
  LogOut,
  Lock,
  Unlock,
  Smartphone,
  Key,
  ShieldCheck,
  ShieldX,
  Clock,
  Activity,
  AlertTriangle,
  Ban,
  UserCheck,
  UserX,
  Settings,
  Trash,
  RefreshCw,
  KeyRound,
  Download,
  Upload,
  Shield,
  AlertCircle,
} from 'lucide-react';

/**
 * Icon mapping for security event types
 */
const EVENT_ICONS = {
  // Authentication
  LOGIN_SUCCESS: { icon: LogIn, color: 'text-green-600 dark:text-green-400' },
  LOGIN_FAILED: { icon: LogIn, color: 'text-red-600 dark:text-red-400' },
  LOGIN_BLOCKED: { icon: Ban, color: 'text-red-700 dark:text-red-300' },
  LOGOUT: { icon: LogOut, color: 'text-gray-600 dark:text-gray-400' },
  // Account
  ACCOUNT_CREATED: { icon: UserCheck, color: 'text-green-600 dark:text-green-400' },
  ACCOUNT_LOCKED: { icon: Lock, color: 'text-red-600 dark:text-red-400' },
  ACCOUNT_UNLOCKED: { icon: Unlock, color: 'text-green-600 dark:text-green-400' },
  ACCOUNT_DISABLED: { icon: UserX, color: 'text-amber-600 dark:text-amber-400' },
  ACCOUNT_DELETED: { icon: Trash, color: 'text-red-600 dark:text-red-400' },
  // Password
  PASSWORD_CHANGED: { icon: KeyRound, color: 'text-blue-600 dark:text-blue-400' },
  PASSWORD_RESET_REQUESTED: { icon: RefreshCw, color: 'text-amber-600 dark:text-amber-400' },
  PASSWORD_RESET_COMPLETED: { icon: KeyRound, color: 'text-green-600 dark:text-green-400' },
  WEAK_PASSWORD_REJECTED: { icon: KeyRound, color: 'text-red-600 dark:text-red-400' },
  // MFA
  MFA_ENABLED: { icon: ShieldCheck, color: 'text-green-600 dark:text-green-400' },
  MFA_DISABLED: { icon: ShieldX, color: 'text-amber-600 dark:text-amber-400' },
  MFA_VERIFIED: { icon: Smartphone, color: 'text-green-600 dark:text-green-400' },
  MFA_FAILED: { icon: Smartphone, color: 'text-red-600 dark:text-red-400' },
  MFA_BACKUP_USED: { icon: Key, color: 'text-amber-600 dark:text-amber-400' },
  // Session
  SESSION_CREATED: { icon: Clock, color: 'text-blue-600 dark:text-blue-400' },
  SESSION_DESTROYED: { icon: Clock, color: 'text-gray-600 dark:text-gray-400' },
  SESSION_EXPIRED: { icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
  SESSION_REGENERATED: { icon: RefreshCw, color: 'text-blue-600 dark:text-blue-400' },
  // Access
  UNAUTHORIZED_ACCESS: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400' },
  FORBIDDEN_ACCESS: { icon: Ban, color: 'text-red-600 dark:text-red-400' },
  CSRF_VIOLATION: { icon: Shield, color: 'text-red-700 dark:text-red-300' },
  RATE_LIMIT_EXCEEDED: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  // Suspicious
  SUSPICIOUS_ACTIVITY: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400' },
  BRUTE_FORCE_DETECTED: { icon: AlertTriangle, color: 'text-red-700 dark:text-red-300' },
  MULTIPLE_FAILED_LOGINS: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  // Admin
  ADMIN_ACTION: { icon: Settings, color: 'text-blue-600 dark:text-blue-400' },
  API_KEY_CREATED: { icon: Key, color: 'text-green-600 dark:text-green-400' },
  API_KEY_DELETED: { icon: Trash, color: 'text-red-600 dark:text-red-400' },
  CONFIG_CHANGED: { icon: Settings, color: 'text-blue-600 dark:text-blue-400' },
  DATA_EXPORTED: { icon: Download, color: 'text-blue-600 dark:text-blue-400' },
  DATA_IMPORTED: { icon: Upload, color: 'text-blue-600 dark:text-blue-400' },
};

const DEFAULT_ICON = { icon: Activity, color: 'text-gray-600 dark:text-gray-400' };

/**
 * EventTypeIcon - Displays an icon for a security event type
 * @param {Object} props
 * @param {string} props.eventType - The security event type
 * @param {string} props.size - Icon size (sm, md, lg)
 * @param {string} props.className - Additional CSS classes
 */
function EventTypeIcon({ eventType, size = 'md', className = '' }) {
  const config = EVENT_ICONS[eventType] || DEFAULT_ICON;
  const IconComponent = config.icon;

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <IconComponent
      className={`${sizeClasses[size]} ${config.color} ${className}`}
      aria-hidden="true"
    />
  );
}

export default EventTypeIcon;
