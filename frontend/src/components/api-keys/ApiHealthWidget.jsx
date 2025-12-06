import { useEffect } from 'react';
import { Key, CheckCircle, AlertTriangle, AlertCircle, Circle, ChevronRight } from 'lucide-react';
import { useApiKeysStore } from '../../stores/apiKeysStore';
import RateLimitBar from './RateLimitBar';
import { Skeleton } from '../ui';

const STATUS_CONFIG = {
  healthy: {
    bgColor: 'bg-card',
    iconColor: 'text-gain',
    icon: CheckCircle,
    label: 'All systems operational'
  },
  warning: {
    bgColor: 'bg-card',
    iconColor: 'text-amber-500',
    icon: AlertTriangle,
    label: 'Rate limit warning'
  },
  critical: {
    bgColor: 'bg-card',
    iconColor: 'text-loss',
    icon: AlertCircle,
    label: 'Rate limit critical'
  },
  not_configured: {
    bgColor: 'bg-card',
    iconColor: 'text-text-muted',
    icon: Circle,
    label: 'No API keys configured'
  }
};

export default function ApiHealthWidget({ onClick }) {
  const { services, isLoading, fetchServices, getOverallStatus } = useApiKeysStore();

  useEffect(() => {
    fetchServices().catch(console.error);
  }, [fetchServices]);

  const status = getOverallStatus();
  const config = STATUS_CONFIG[status.status] || STATUS_CONFIG.not_configured;
  const StatusIcon = config.icon;

  // Get configured services for display
  const configuredServices = services.filter(s => s.active_keys > 0);

  // Loading state - show skeleton while fetching
  if (isLoading && services.length === 0) {
    return (
      <div className="rounded-lg shadow bg-card p-6 h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-text-secondary" />
            <h3 className="text-lg font-semibold text-text-primary">API Status</h3>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="w-3/4" />
          <Skeleton className="w-1/2" />
          <Skeleton className="w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-lg shadow ${config.bgColor} dark:!bg-white/5 dark:backdrop-blur-md p-6 cursor-pointer
                 hover:shadow-md transition-shadow h-full`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-text-secondary" />
          <h3 className="text-lg font-semibold text-text-primary">API Status</h3>
        </div>
        <ChevronRight className="w-5 h-5 text-text-muted" />
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-4">
        <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
        <span className="text-sm text-text-primary">{config.label}</span>
      </div>

      {/* Service summaries */}
      {configuredServices.length > 0 ? (
        <div className="space-y-3">
          {configuredServices.slice(0, 2).map((service) => (
            <div key={service.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary">
                  {service.display_name}
                </span>
                <span className="text-xs text-text-muted">
                  {service.active_keys} key{service.active_keys !== 1 ? 's' : ''}
                </span>
              </div>
              {service.usage?.byLimit?.global && (
                <RateLimitBar
                  current={service.usage.byLimit.global.current}
                  max={service.usage.byLimit.global.max}
                  description={service.usage.byLimit.global.description}
                />
              )}
            </div>
          ))}
          {configuredServices.length > 2 && (
            <p className="text-xs text-text-muted">
              +{configuredServices.length - 2} more service{configuredServices.length - 2 !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          Click to configure API keys for real-time data
        </p>
      )}
    </div>
  );
}
