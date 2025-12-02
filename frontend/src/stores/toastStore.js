import { create } from 'zustand';

let toastId = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],

  // Duration presets for different toast types (in ms)
  durations: {
    warning: 6000,
    error: 8000,
    success: 5000,
    info: 5000
  },

  // Add a new toast
  addToast: ({ type = 'info', title, message, service = null, duration = null }) => {
    const { toasts, durations } = get();

    // Deduplication: don't add if same service has an active toast of same type
    if (service) {
      const existingToast = toasts.find(
        (t) => t.service === service && t.type === type
      );
      if (existingToast) {
        return existingToast.id;
      }
    }

    const id = `toast-${++toastId}`;
    const actualDuration = duration ?? durations[type] ?? 5000;

    const newToast = {
      id,
      type,
      title,
      message,
      service,
      duration: actualDuration,
      createdAt: Date.now()
    };

    set({ toasts: [...toasts, newToast] });

    // Auto-dismiss after duration
    if (actualDuration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, actualDuration);
    }

    return id;
  },

  // Remove a toast by id
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },

  // Clear all toasts
  clearAll: () => {
    set({ toasts: [] });
  },

  // Remove toasts for a specific service (useful when service recovers)
  clearServiceToasts: (service, type = null) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => {
        if (t.service !== service) return true;
        if (type !== null && t.type !== type) return true;
        return false;
      })
    }));
  }
}));

export default useToastStore;
