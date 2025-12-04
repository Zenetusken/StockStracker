import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import SecurityEventRow from './SecurityEventRow';

/**
 * SecurityEventTable - Paginated table of security events
 * @param {Object} props
 * @param {Array} props.events - Array of security event objects
 * @param {boolean} props.loading - Loading state
 * @param {number} props.page - Current page (1-indexed)
 * @param {number} props.pageSize - Events per page
 * @param {number} props.totalCount - Total number of events
 * @param {Function} props.onPageChange - Callback when page changes
 */
function SecurityEventTable({
  events = [],
  loading = false,
  page = 1,
  pageSize = 50,
  totalCount = 0,
  onPageChange,
}) {
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="h-6 w-48 bg-page-bg rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-page-bg rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Table header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Security Event Log
          {totalCount > 0 && (
            <span className="text-sm font-normal text-text-muted">
              ({totalCount} events)
            </span>
          )}
        </h3>
      </div>

      {/* Table */}
      {events.length === 0 ? (
        <div className="p-8 text-center text-text-muted">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No security events found</p>
          <p className="text-sm mt-1">Try adjusting your filters or timeframe</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead className="bg-page-bg">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  Severity
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  Event Type
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  IP Address
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider hidden lg:table-cell"
                >
                  User Agent
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  Time
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 w-10"
                  aria-label="Expand"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <SecurityEventRow key={event.id} event={event} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="text-sm text-text-muted">
            Showing {startIndex} to {endIndex} of {totalCount} events
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded border border-border text-text-muted hover:text-text-primary hover:bg-page-bg disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
              data-testid="prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-text-primary px-3">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded border border-border text-text-muted hover:text-text-primary hover:bg-page-bg disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
              data-testid="next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SecurityEventTable;
