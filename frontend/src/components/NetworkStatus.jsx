import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Network Status Component
 * #132: Network offline detection
 * Shows a banner when the user goes offline and hides when back online
 */

function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "back online" briefly then hide
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Show banner if already offline (use setTimeout to avoid sync setState in effect)
    if (!navigator.onLine) {
      const timeout = setTimeout(() => setShowBanner(true), 0);
      return () => {
        clearTimeout(timeout);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
        isOnline
          ? 'bg-gain text-white'
          : 'bg-loss text-white animate-pulse'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          Back online
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          You are offline. Some features may be unavailable.
        </>
      )}
    </div>
  );
}

export default NetworkStatus;
