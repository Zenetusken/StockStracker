import { useEffect, useState } from 'react';
import { Key, CheckCircle, AlertTriangle, AlertCircle, Circle } from 'lucide-react';
import { useApiKeysStore } from '../../stores/apiKeysStore';

const STATUS_CONFIG = {
  healthy: {
    color: 'bg-green-500',
    ringColor: 'ring-green-500/30',
    icon: CheckCircle,
    label: 'All API keys healthy'
  },
  warning: {
    color: 'bg-amber-500',
    ringColor: 'ring-amber-500/30',
    icon: AlertTriangle,
    label: 'Rate limit warning'
  },
  critical: {
    color: 'bg-red-500',
    ringColor: 'ring-red-500/30',
    icon: AlertCircle,
    label: 'Rate limit critical'
  },
  not_configured: {
    color: 'bg-gray-400',
    ringColor: 'ring-gray-400/30',
    icon: Circle,
    label: 'No API keys configured'
  }
};

export default function ApiKeyStatusIndicator({ onClick }) {
  const { fetchServices, getOverallStatus } = useApiKeysStore();
  const [, setIsInitialized] = useState(false);

  useEffect(() => {
    fetchServices()
      .then(() => setIsInitialized(true))
      .catch(console.error);

    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchServices().catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchServices]);

  const status = getOverallStatus();
  const config = STATUS_CONFIG[status.status] || STATUS_CONFIG.not_configured;

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 px-3 py-2 rounded-lg
                 hover:bg-panel-hover dark:hover:bg-white/10 transition-colors
                 focus:outline-none focus:ring-2 focus:ring-brand"
      title={config.label}
    >
      <Key className="w-5 h-5 text-text-secondary dark:text-gray-400" />

      {/* Status dot */}
      <span
        className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${config.color}
                   ring-2 ${config.ringColor} animate-pulse`}
      />

      {/* Optional label for wider displays */}
      <span className="hidden lg:inline text-sm text-text-secondary dark:text-gray-400">
        API Keys
      </span>
    </button>
  );
}
