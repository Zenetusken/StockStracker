import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/auth/me', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          sessionStorage.setItem('user', JSON.stringify(data.user));
          setIsAuthenticated(true);
        } else {
          sessionStorage.removeItem('user');
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
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
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
