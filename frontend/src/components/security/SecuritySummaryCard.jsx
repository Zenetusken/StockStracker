import { SEVERITY_CONFIG } from '../../api/security';

/**
 * SecuritySummaryCard - Displays a summary metric card
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string|number} props.value - Main value to display
 * @param {string} props.subtitle - Optional subtitle/description
 * @param {React.ReactNode} props.icon - Icon component
 * @param {string} props.variant - Card variant (default, info, warning, error, critical)
 * @param {string} props.testId - Data test ID for testing
 */
function SecuritySummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  testId,
}) {
  const variantStyles = {
    default: {
      bg: 'bg-card',
      border: 'border-border',
      iconBg: 'bg-page-bg',
      iconColor: 'text-text-muted',
      valueColor: 'text-text-primary',
    },
    info: {
      bg: SEVERITY_CONFIG.INFO.bgClass,
      border: SEVERITY_CONFIG.INFO.borderClass,
      iconBg: 'bg-blue-100 dark:bg-blue-800/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      valueColor: 'text-blue-700 dark:text-blue-300',
    },
    warning: {
      bg: SEVERITY_CONFIG.WARNING.bgClass,
      border: SEVERITY_CONFIG.WARNING.borderClass,
      iconBg: 'bg-amber-100 dark:bg-amber-800/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      valueColor: 'text-amber-700 dark:text-amber-300',
    },
    error: {
      bg: SEVERITY_CONFIG.ERROR.bgClass,
      border: SEVERITY_CONFIG.ERROR.borderClass,
      iconBg: 'bg-red-100 dark:bg-red-800/30',
      iconColor: 'text-red-600 dark:text-red-400',
      valueColor: 'text-red-700 dark:text-red-300',
    },
    critical: {
      bg: SEVERITY_CONFIG.CRITICAL.bgClass,
      border: SEVERITY_CONFIG.CRITICAL.borderClass,
      iconBg: 'bg-red-200 dark:bg-red-800/40',
      iconColor: 'text-red-700 dark:text-red-300',
      valueColor: 'text-red-800 dark:text-red-200',
    },
  };

  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={`rounded-lg border p-4 ${styles.bg} ${styles.border}`}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`p-2 rounded-lg ${styles.iconBg}`}>
            <Icon className={`w-5 h-5 ${styles.iconColor}`} aria-hidden="true" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-muted truncate">{title}</p>
          <p className={`text-2xl font-bold ${styles.valueColor} mt-1`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-text-muted mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SecuritySummaryCard;
