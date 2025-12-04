import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useToast } from '../components/toast/ToastContext';
import {
  Shield,
  Activity,
  AlertTriangle,
  LogIn,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { securityApi } from '../api/security';
import TimeframeSelector from '../components/security/TimeframeSelector';
import SecuritySummaryCard from '../components/security/SecuritySummaryCard';
import CriticalEventsList from '../components/security/CriticalEventsList';
import SecurityFilters from '../components/security/SecurityFilters';
import SecurityEventTable from '../components/security/SecurityEventTable';
import FailedLoginTable from '../components/security/FailedLoginTable';

/**
 * SecurityDashboard - Main security monitoring page
 * Implements PRD requirements FR-1 through FR-5
 */
function SecurityDashboard() {
  const { addToast } = useToast();

  // Timeframe state (FR-1.6)
  const [timeframe, setTimeframe] = useState(24);

  // Summary state (FR-1)
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Critical events state (FR-4)
  const [criticalEvents, setCriticalEvents] = useState([]);
  const [criticalLoading, setCriticalLoading] = useState(true);

  // Event log state (FR-2)
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsCount, setLogsCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    eventType: '',
    severity: '',
    ipAddress: '',
    startDate: '',
    endDate: '',
  });

  // Failed logins state (FR-3)
  const [failedLogins, setFailedLogins] = useState([]);
  const [failedLoginsLoading, setFailedLoginsLoading] = useState(true);

  // General state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pageSize = 50;

  /**
   * Fetch security summary (FR-1)
   */
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const result = await securityApi.getSummary(timeframe);
      setSummary(result.summary);
    } catch (err) {
      console.error('Failed to fetch security summary:', err);
      addToast('Failed to load security summary', 'error');
    } finally {
      setSummaryLoading(false);
    }
  }, [timeframe, addToast]);

  /**
   * Fetch critical events (FR-4)
   */
  const fetchCriticalEvents = useCallback(async () => {
    try {
      setCriticalLoading(true);
      const result = await securityApi.getCriticalEvents();
      setCriticalEvents(result.events || []);
    } catch (err) {
      console.error('Failed to fetch critical events:', err);
      addToast('Failed to load critical events', 'error');
    } finally {
      setCriticalLoading(false);
    }
  }, [addToast]);

  /**
   * Fetch security logs (FR-2)
   */
  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const queryFilters = {
        ...filters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      // Remove empty values
      Object.keys(queryFilters).forEach(
        (key) => !queryFilters[key] && delete queryFilters[key]
      );
      const result = await securityApi.getLogs(queryFilters);
      setLogs(result.logs || []);
      setLogsCount(result.count || 0);
    } catch (err) {
      console.error('Failed to fetch security logs:', err);
      addToast('Failed to load security logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  }, [filters, page, addToast]);

  /**
   * Fetch failed logins (FR-3)
   */
  const fetchFailedLogins = useCallback(async () => {
    try {
      setFailedLoginsLoading(true);
      const result = await securityApi.getFailedLogins(timeframe);
      setFailedLogins(result.topIpAddresses || []);
    } catch (err) {
      console.error('Failed to fetch failed logins:', err);
      addToast('Failed to load failed login data', 'error');
    } finally {
      setFailedLoginsLoading(false);
    }
  }, [timeframe, addToast]);

  /**
   * Refresh all data
   */
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchSummary(),
      fetchCriticalEvents(),
      fetchLogs(),
      fetchFailedLogins(),
    ]);
    setIsRefreshing(false);
    addToast('Security data refreshed', 'success');
  }, [fetchSummary, fetchCriticalEvents, fetchLogs, fetchFailedLogins, addToast]);

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchCriticalEvents();
    fetchFailedLogins();
  }, [fetchSummary, fetchCriticalEvents, fetchFailedLogins]);

  // Fetch logs when filters or page changes
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  // Handle filter apply
  const handleFiltersApply = () => {
    setPage(1); // Reset to first page
    fetchLogs();
  };

  // Handle filter reset
  const handleFiltersReset = () => {
    setFilters({
      eventType: '',
      severity: '',
      ipAddress: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  // Handle view all critical events
  const handleViewAllCritical = () => {
    setFilters({
      eventType: '',
      severity: 'CRITICAL',
      ipAddress: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  return (
    <Layout>
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        data-testid="security-dashboard"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
              <Shield className="w-8 h-8" />
              Security Dashboard
            </h1>
            <p className="text-text-muted mt-2">
              Monitor security events and track account activity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TimeframeSelector
              value={timeframe}
              onChange={handleTimeframeChange}
              disabled={summaryLoading}
            />
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-page-bg border border-border rounded-lg text-sm text-text-primary hover:bg-card-hover disabled:opacity-50"
              aria-label="Refresh data"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary Cards (FR-1) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SecuritySummaryCard
            title="Total Events"
            value={summaryLoading ? '-' : (summary?.totalEvents || 0)}
            icon={Activity}
            testId="total-events"
          />
          <SecuritySummaryCard
            title="Critical Events"
            value={summaryLoading ? '-' : (summary?.bySeverity?.CRITICAL || 0)}
            subtitle={summary?.bySeverity?.CRITICAL > 0 ? 'Requires attention' : undefined}
            icon={AlertTriangle}
            variant={summary?.bySeverity?.CRITICAL > 0 ? 'critical' : 'default'}
            testId="severity-critical"
          />
          <SecuritySummaryCard
            title="Warnings"
            value={summaryLoading ? '-' : (summary?.bySeverity?.WARNING || 0)}
            icon={AlertTriangle}
            variant={summary?.bySeverity?.WARNING > 0 ? 'warning' : 'default'}
            testId="severity-warning"
          />
          <SecuritySummaryCard
            title="Login Activity"
            value={
              summaryLoading
                ? '-'
                : `${summary?.successfulLogins || 0} / ${summary?.failedLogins || 0}`
            }
            subtitle="Successful / Failed"
            icon={LogIn}
            testId="login-ratio"
          />
        </div>

        {/* Severity breakdown info cards */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div
            className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 text-center"
            data-testid="severity-info"
          >
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {summaryLoading ? '-' : (summary?.bySeverity?.INFO || 0)}
            </span>
            <span className="text-xs text-blue-700 dark:text-blue-300 block">Info</span>
          </div>
          <div
            className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 text-center"
          >
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {summaryLoading ? '-' : (summary?.bySeverity?.WARNING || 0)}
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-300 block">Warning</span>
          </div>
          <div
            className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-center"
            data-testid="severity-error"
          >
            <span className="text-lg font-bold text-red-600 dark:text-red-400">
              {summaryLoading ? '-' : (summary?.bySeverity?.ERROR || 0)}
            </span>
            <span className="text-xs text-red-700 dark:text-red-300 block">Error</span>
          </div>
          <div
            className="p-2 rounded bg-red-100 dark:bg-red-900/30 text-center"
          >
            <span className="text-lg font-bold text-red-800 dark:text-red-200">
              {summaryLoading ? '-' : (summary?.bySeverity?.CRITICAL || 0)}
            </span>
            <span className="text-xs text-red-800 dark:text-red-300 block">Critical</span>
          </div>
        </div>

        {/* Critical Events Panel (FR-4) */}
        <div className="mb-6">
          <CriticalEventsList
            events={criticalEvents}
            loading={criticalLoading}
            onViewAll={handleViewAllCritical}
          />
        </div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Event Log Section (FR-2) - takes 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <SecurityFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onApply={handleFiltersApply}
              onReset={handleFiltersReset}
              loading={logsLoading}
            />

            {/* Event Table */}
            <SecurityEventTable
              events={logs}
              loading={logsLoading}
              page={page}
              pageSize={pageSize}
              totalCount={logsCount}
              onPageChange={handlePageChange}
            />
          </div>

          {/* Sidebar - Failed Logins (FR-3) */}
          <div className="space-y-4">
            <FailedLoginTable
              failedLogins={failedLogins}
              loading={failedLoginsLoading}
              threshold={10}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default SecurityDashboard;
