import { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Circle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  Power,
  TestTube,
  XCircle,
  Ban
} from 'lucide-react';
import RateLimitBar from './RateLimitBar';
import MaskedKeyDisplay from './MaskedKeyDisplay';
import { useApiKeysStore } from '../../stores/apiKeysStore';

const STATUS_ICONS = {
  healthy: { icon: CheckCircle, color: 'text-gain' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  critical: { icon: AlertCircle, color: 'text-loss' },
  exceeded: { icon: XCircle, color: 'text-loss', badge: 'EXCEEDED' },
  rate_limited: { icon: Ban, color: 'text-loss', badge: 'RATE LIMITED' },
  not_configured: { icon: Circle, color: 'text-text-muted' }
};

// Format time until reset for display
function formatTimeUntil(isoTimestamp) {
  if (!isoTimestamp) return null;
  const now = Date.now();
  const resetTime = new Date(isoTimestamp).getTime();
  const diffMs = resetTime - now;

  if (diffMs <= 0) return 'now';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  }
  if (minutes > 0) {
    const remainingSecs = seconds % 60;
    return `${minutes}m ${remainingSecs}s`;
  }
  return `${seconds}s`;
}

export default function ApiServiceCard({ service, onAddKey }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [testingKey, setTestingKey] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const { deleteKey, updateKey, testKey } = useApiKeysStore();

  // Check if this service requires an API key
  const keyRequired = service.config?.keyRequired !== false;

  const getStatus = () => {
    // Check explicit rate limit status first (from backend)
    if (service.rateLimitStatus?.hardLimited) return 'rate_limited';
    if (service.rateLimitStatus?.usageExceeded) return 'exceeded';

    // For keyless services, base status on usage only
    if (!keyRequired) {
      if (service.usage?.percentUsed > 90) return 'critical';
      if (service.usage?.percentUsed > 70) return 'warning';
      return 'healthy';
    }
    if (service.active_keys === 0) return 'not_configured';
    if (service.usage?.percentUsed > 90) return 'critical';
    if (service.usage?.percentUsed > 70) return 'warning';
    return 'healthy';
  };

  const status = getStatus();
  const StatusIcon = STATUS_ICONS[status].icon;

  const handleTestKey = async (keyId) => {
    setTestingKey(keyId);
    setTestResult(null);
    try {
      const result = await testKey(keyId);
      setTestResult({ keyId, ...result });
    } catch (error) {
      setTestResult({ keyId, valid: false, error: error.message });
    } finally {
      setTestingKey(null);
    }
  };

  const handleToggleKey = async (keyId, currentActive) => {
    try {
      await updateKey(keyId, { is_active: currentActive ? 0 : 1 });
    } catch (error) {
      console.error('Failed to toggle key:', error);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (confirm('Are you sure you want to delete this API key?')) {
      try {
        await deleteKey(keyId);
      } catch (error) {
        console.error('Failed to delete key:', error);
      }
    }
  };

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-table-header dark:!bg-white/5 dark:backdrop-blur-md cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-5 h-5 ${STATUS_ICONS[status].color}`} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-text-primary">
                {service.display_name}
              </h3>
              {STATUS_ICONS[status].badge && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-loss/20 text-loss font-semibold animate-pulse">
                  {STATUS_ICONS[status].badge}
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary">
              {keyRequired
                ? `${service.active_keys} key${service.active_keys !== 1 ? 's' : ''} configured`
                : 'No API Key Required'}
              {service.rateLimitStatus?.resetsAt && service.rateLimitStatus?.isLimited && (
                <span className="ml-2 text-xs text-text-muted">
                  Resets in {formatTimeUntil(service.rateLimitStatus.resetsAt)}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Quick usage indicator - show the first (most important) rate limit (only when collapsed) */}
          {!isExpanded && service.usage && (keyRequired ? service.active_keys > 0 : true) && Object.keys(service.usage.byLimit || {}).length > 0 && (
            <div className="hidden sm:block w-40">
              {(() => {
                const limitTypes = Object.keys(service.usage.byLimit || {});
                const primaryLimit = limitTypes[0];
                const limit = service.usage.byLimit[primaryLimit];
                return (
                  <RateLimitBar
                    serviceName={service.name}
                    limitType={primaryLimit}
                    max={limit.max}
                    description={limit.description}
                  />
                );
              })()}
            </div>
          )}

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 border-t border-line bg-table-header dark:!bg-white/5 dark:backdrop-blur-md">
          {/* Links */}
          <div className="flex gap-4 mb-4 text-sm">
            {service.docs_url && (
              <a
                href={service.docs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-brand-light hover:text-brand"
              >
                <ExternalLink className="w-3 h-3" />
                Docs
              </a>
            )}
            {service.signup_url && (
              <a
                href={service.signup_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-brand-light hover:text-brand"
              >
                <ExternalLink className="w-3 h-3" />
                Get API Key
              </a>
            )}
          </div>

          {/* Rate Limits */}
          {service.usage && (keyRequired ? service.active_keys > 0 : true) && (
            <div className="mb-4 space-y-3">
              <h4 className="text-sm font-medium text-text-primary">
                Rate Limits (Sliding Window)
              </h4>
              {Object.entries(service.usage.byLimit || {}).map(([type, limit]) => (
                <RateLimitBar
                  key={type}
                  serviceName={service.name}
                  limitType={type}
                  max={limit.max}
                  description={limit.description}
                  windowSeconds={limit.windowSeconds}
                />
              ))}
            </div>
          )}

          {/* Keys section - only show for services that require keys */}
          {keyRequired ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-text-primary">
                  API Keys
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddKey(service.name);
                  }}
                  className="text-sm text-brand-light hover:text-brand font-medium"
                >
                  + Add Key
                </button>
              </div>

              {service.keys?.length > 0 ? (
                <div className="space-y-2">
                  {service.keys.map((key) => (
                    <div
                      key={key.id}
                      className={`flex items-center justify-between p-3 rounded-lg
                                ${key.is_active ? 'bg-page-bg' : 'bg-table-header opacity-60'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">
                            {key.key_name || 'Unnamed Key'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-line-light text-text-secondary">
                            {key.source}
                          </span>
                          {key.is_rate_limited === 1 && (
                            <span className="text-xs px-2 py-0.5 rounded bg-loss/20 text-loss">
                              Rate Limited
                            </span>
                          )}
                        </div>
                        <MaskedKeyDisplay
                          maskedValue={key.key_value_masked}
                          className="mt-1"
                        />
                        {testResult?.keyId === key.id && (
                          <div className={`mt-2 text-sm ${testResult.valid ? 'text-gain' : 'text-loss'}`}>
                            {testResult.valid ? 'Key is valid' : `Invalid: ${testResult.error}`}
                            {testResult.warning && <span className="text-amber-600"> ({testResult.warning})</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => handleTestKey(key.id)}
                          disabled={testingKey === key.id}
                          className="p-2 rounded hover:bg-card-hover dark:hover:bg-gray-700 transition-colors"
                          title="Test key"
                        >
                          <TestTube className={`w-4 h-4 ${testingKey === key.id ? 'animate-pulse text-brand' : 'text-text-muted'}`} />
                        </button>
                        <button
                          onClick={() => handleToggleKey(key.id, key.is_active)}
                          className="p-2 rounded hover:bg-card-hover dark:hover:bg-gray-700 transition-colors"
                          title={key.is_active ? 'Disable key' : 'Enable key'}
                        >
                          <Power className={`w-4 h-4 ${key.is_active ? 'text-gain' : 'text-text-muted'}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          title="Delete key"
                        >
                          <Trash2 className="w-4 h-4 text-loss" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary dark:text-gray-400 italic">
                  No API keys configured. Add one to enable this service.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-gain/10 border border-gain/30">
              <p className="text-sm text-gain">
                This service uses an unofficial free API that does not require an API key.
                Usage is tracked automatically for visibility.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
