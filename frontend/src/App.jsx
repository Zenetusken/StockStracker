import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MFAVerificationPage from './pages/MFAVerificationPage';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import StockDetail from './pages/StockDetail';
import Watchlists from './pages/Watchlists';
import WatchlistDetail from './pages/WatchlistDetail';
import PortfolioDetail from './pages/PortfolioDetail';
import Alerts from './pages/Alerts';
import Screener from './pages/Screener';
import Settings from './pages/Settings';
import SecurityDashboard from './pages/SecurityDashboard';
import NotFound from './pages/NotFound';
import ToastContainer from './components/toast/ToastContainer';
import AlertChecker from './components/AlertChecker';
import NetworkStatus from './components/NetworkStatus';
import ErrorBoundary from './components/ErrorBoundary';
import SkipToMain from './components/SkipToMain';
import MobileBottomNav from './components/MobileBottomNav';
import useRateLimitEvents from './hooks/useRateLimitEvents';
import { useAuthStore } from './stores/authStore';
import { subscribeToQuoteUpdates } from './stores/quoteStore';
import { useChartStore } from './stores/chartStore';
import { api } from './api/client';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="text-text-muted dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RateLimitEventsProvider({ children }) {
  useRateLimitEvents();
  return children;
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const logout = useAuthStore((state) => state.logout);

  // Bridge quote updates to chart store (decoupled via pub/sub)
  useEffect(() => {
    const unsubscribe = subscribeToQuoteUpdates((updates) => {
      useChartStore.getState().updateCurrentCandlesBulk(updates);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Set up session expired handler
    api.setSessionExpiredHandler(() => {
      // Clear auth state without calling the logout API (session is already invalid)
      logout(true); // true = skip API call
    });

    // Fetch CSRF token first, then check auth
    api.fetchCsrfToken().then(() => {
      checkAuth();
    });
  }, [checkAuth, logout]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SkipToMain />
      <RateLimitEventsProvider>
        <ToastContainer />
        <AlertChecker />
        <NetworkStatus />
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/mfa-verify" element={<MFAVerificationPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <Portfolio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock/:symbol"
          element={
            <ProtectedRoute>
              <StockDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/watchlists"
          element={
            <ProtectedRoute>
              <Watchlists />
            </ProtectedRoute>
          }
        />
        <Route
          path="/watchlist/:id"
          element={
            <ProtectedRoute>
              <WatchlistDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio/:id"
          element={
            <ProtectedRoute>
              <PortfolioDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <Alerts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/screener"
          element={
            <ProtectedRoute>
              <Screener />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security"
          element={
            <ProtectedRoute>
              <SecurityDashboard />
            </ProtectedRoute>
          }
        />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
        <DisclaimerFooter />
        <AuthenticatedMobileNav />
      </RateLimitEventsProvider>
    </BrowserRouter>
  );
}

// Separate component to conditionally render mobile nav for authenticated users
function AuthenticatedMobileNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <MobileBottomNav /> : null;
}

// Subtle disclaimer footer for legal protection
// Positioned only in main content area, with gradient fade effect
function DisclaimerFooter() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Only show on authenticated pages
  if (!isAuthenticated) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 sm:left-64 bg-gradient-to-t from-dark-bg/80 to-transparent pt-6 pb-1 px-4 text-center z-30 pointer-events-none md:pb-1 pb-14">
      <p className="text-[9px] text-gray-500/70 pointer-events-auto select-none">
        Data by Yahoo Finance & Finnhub • Not investment advice • Verify before investing
      </p>
    </footer>
  );
}

export default App;
