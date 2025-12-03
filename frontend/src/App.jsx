import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import WatchlistDetail from './pages/WatchlistDetail';
import PortfolioDetail from './pages/PortfolioDetail';
import Alerts from './pages/Alerts';
import Screener from './pages/Screener';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import ToastContainer from './components/toast/ToastContainer';
import AlertChecker from './components/AlertChecker';
import NetworkStatus from './components/NetworkStatus';
import useRateLimitEvents from './hooks/useRateLimitEvents';
import { useAuthStore } from './stores/authStore';
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

  useEffect(() => {
    // Fetch CSRF token first, then check auth
    api.fetchCsrfToken().then(() => {
      checkAuth();
    });
  }, [checkAuth]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RateLimitEventsProvider>
        <ToastContainer />
        <AlertChecker />
        <NetworkStatus />
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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
              <Dashboard />
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
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </RateLimitEventsProvider>
    </BrowserRouter>
  );
}

export default App;
