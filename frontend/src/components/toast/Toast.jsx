import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, X, Info } from 'lucide-react';

const TOAST_STYLES = {
  warning: {
    bg: 'bg-gradient-to-r from-amber-500/10 to-card',
    border: 'border-l-4 border-amber-500',
    icon: AlertTriangle,
    iconColor: 'text-amber-500'
  },
  error: {
    bg: 'bg-gradient-to-r from-loss/10 to-card',
    border: 'border-l-4 border-loss',
    icon: AlertCircle,
    iconColor: 'text-loss'
  },
  success: {
    bg: 'bg-gradient-to-r from-gain/10 to-card',
    border: 'border-l-4 border-gain',
    icon: CheckCircle,
    iconColor: 'text-gain'
  },
  info: {
    bg: 'bg-gradient-to-r from-brand/10 to-card',
    border: 'border-l-4 border-brand',
    icon: Info,
    iconColor: 'text-brand'
  }
};

export default function Toast({ toast, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);
  const progressRef = useRef(null);
  // eslint-disable-next-line react-hooks/purity -- Initial timestamp for progress calculation
  const startTimeRef = useRef(Date.now());

  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon = style.icon;

  useEffect(() => {
    if (toast.duration <= 0) return;

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        progressRef.current = requestAnimationFrame(updateProgress);
      }
    };

    progressRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (progressRef.current) {
        cancelAnimationFrame(progressRef.current);
      }
    };
  }, [toast.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  return (
    <div
      data-testid={`toast-${toast.type}`}
      className={`
        relative overflow-hidden rounded-lg shadow-lg
        ${style.bg} ${style.border}
        transition-all duration-200 ease-out
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
        animate-slide-in
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconColor}`} />

        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary dark:text-gray-100">
            {toast.title}
          </p>
          <p className="text-sm text-text-secondary dark:text-gray-400 mt-0.5">
            {toast.message}
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5">
          <div
            className={`h-full transition-none ${
              toast.type === 'warning' ? 'bg-amber-500' :
              toast.type === 'error' ? 'bg-loss' :
              toast.type === 'success' ? 'bg-gain' :
              'bg-brand'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
