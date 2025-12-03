import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

/**
 * 404 Not Found Page
 * #134: 404 page for unknown routes
 */

function NotFound() {
  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-8">
          <AlertCircle className="w-24 h-24 text-text-muted mx-auto" />
        </div>
        <h1 className="text-6xl font-bold text-text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-text-secondary mb-4">
          Page Not Found
        </h2>
        <p className="text-text-muted mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Please check the URL or go back to the home page.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
        >
          <Home className="w-5 h-5" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
