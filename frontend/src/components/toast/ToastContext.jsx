/**
 * Toast Context - Provides a convenient useToast hook
 * Wraps the Zustand toastStore for easier usage
 */

import { useToastStore } from '../../stores/toastStore';

/**
 * Custom hook for showing toast notifications
 * @returns {Object} Toast methods
 */
export function useToast() {
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);
  const clearAll = useToastStore((state) => state.clearAll);

  return {
    /**
     * Show a toast notification
     * @param {Object} options - Toast options
     * @param {string} options.type - 'success' | 'error' | 'warning' | 'info'
     * @param {string} options.title - Toast title
     * @param {string} options.message - Toast message
     * @param {number} [options.duration] - Auto-dismiss duration in ms
     */
    toast: (options) => addToast(options),

    /**
     * Show a success toast
     */
    success: (title, message) => addToast({ type: 'success', title, message }),

    /**
     * Show an error toast
     */
    error: (title, message) => addToast({ type: 'error', title, message }),

    /**
     * Show a warning toast
     */
    warning: (title, message) => addToast({ type: 'warning', title, message }),

    /**
     * Show an info toast
     */
    info: (title, message) => addToast({ type: 'info', title, message }),

    /**
     * Remove a specific toast
     */
    dismiss: removeToast,

    /**
     * Clear all toasts
     */
    clearAll,
  };
}

export default useToast;
