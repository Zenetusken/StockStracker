import { AlertTriangle, Globe } from 'lucide-react';

/**
 * FailedLoginTable - Displays failed login attempts grouped by IP address
 * @param {Object} props
 * @param {Array} props.failedLogins - Array of failed login objects { ip_address, count }
 * @param {boolean} props.loading - Loading state
 * @param {number} props.threshold - Threshold for highlighting (default: 10)
 */
function FailedLoginTable({ failedLogins = [], loading = false, threshold = 10 }) {
  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-text-muted" />
          <h3 className="font-semibold text-text-primary">Failed Logins by IP</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-page-bg rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4" data-testid="failed-logins-table">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-text-muted" />
        <h3 className="font-semibold text-text-primary">
          Failed Logins by IP
          {failedLogins.length > 0 && (
            <span className="ml-2 text-sm font-normal text-text-muted">
              ({failedLogins.length} IPs)
            </span>
          )}
        </h3>
      </div>

      {failedLogins.length === 0 ? (
        <div className="text-center py-6 text-text-muted">
          <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No failed login attempts</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="top-ips">
          {failedLogins.map((item) => {
            const isHighRisk = item.count >= threshold;
            return (
              <div
                key={item.ip_address}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isHighRisk
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-page-bg border-border'
                }`}
                data-testid={`failed-login-ip`}
              >
                <div className="flex items-center gap-3">
                  {isHighRisk && (
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  )}
                  <div>
                    <span
                      className={`font-mono text-sm ${
                        isHighRisk
                          ? 'text-red-700 dark:text-red-300 font-medium'
                          : 'text-text-primary'
                      }`}
                    >
                      {item.ip_address}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-medium ${
                      isHighRisk
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-text-muted'
                    }`}
                  >
                    {item.count} {item.count === 1 ? 'attempt' : 'attempts'}
                  </span>
                  {isHighRisk && (
                    <span className="px-2 py-0.5 text-xs bg-red-600 text-white rounded-full">
                      High Risk
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {failedLogins.some((item) => item.count >= threshold) && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              IPs with {threshold}+ failed attempts may indicate brute force attacks.
              Consider implementing IP blocking or additional security measures.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FailedLoginTable;
