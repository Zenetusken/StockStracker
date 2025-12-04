import { SEVERITY_CONFIG } from '../../api/security';

/**
 * SeverityBadge - Displays a colored badge for security event severity
 * @param {Object} props
 * @param {string} props.severity - Severity level (INFO, WARNING, ERROR, CRITICAL)
 * @param {string} props.size - Badge size (sm, md, lg)
 */
function SeverityBadge({ severity, size = 'md' }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-2.5 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses[size]}`}
      data-testid={`severity-badge-${severity?.toLowerCase()}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}

export default SeverityBadge;
