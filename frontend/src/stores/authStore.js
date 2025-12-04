import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/client';
import { useToastStore } from './toastStore';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // === STATE ===
      user: null,
      isAuthenticated: false,
      isLoading: true, // True until initial auth check completes
      error: null,
      mfaRequired: false, // True when MFA verification is pending
      sessionExpired: false, // True only when a previously authenticated session expires

      // === ACTIONS ===

      login: async (email, password) => {
        set({ isLoading: true, error: null, mfaRequired: false });
        try {
          const data = await api.post('/auth/login', { email, password });

          // Check if MFA is required (202 response with mfaRequired flag)
          if (data.mfaRequired) {
            set({
              isLoading: false,
              mfaRequired: true,
              error: null,
            });
            return { success: false, mfaRequired: true };
          }

          set({
            user: data.user || data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            mfaRequired: false,
            sessionExpired: false, // Clear session expired flag on successful login
          });
          // Show success toast
          useToastStore.getState().addToast({
            type: 'success',
            title: 'Welcome back!',
            message: 'You have successfully signed in.',
          });
          return { success: true };
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'Login failed',
            mfaRequired: false,
          });
          // Show error toast
          useToastStore.getState().addToast({
            type: 'error',
            title: 'Login failed',
            message: error.message || 'Please check your credentials.',
          });
          return { success: false, error: error.message };
        }
      },

      verifyMFA: async (code, useBackup = false) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.post('/auth/verify-mfa', { code, useBackup });
          set({
            user: data.user || data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            mfaRequired: false,
            sessionExpired: false,
          });
          // Show success toast
          useToastStore.getState().addToast({
            type: 'success',
            title: 'Welcome back!',
            message: 'MFA verification successful.',
          });
          return { success: true };
        } catch (error) {
          set({
            isLoading: false,
            error: error.message || 'MFA verification failed',
          });
          // Show error toast
          useToastStore.getState().addToast({
            type: 'error',
            title: 'MFA verification failed',
            message: error.message || 'Invalid code. Please try again.',
          });
          return { success: false, error: error.message };
        }
      },

      clearMfaState: () => {
        set({ mfaRequired: false, error: null });
      },

      register: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.post('/auth/register', { email, password });
          set({
            user: data.user || data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          // Show success toast
          useToastStore.getState().addToast({
            type: 'success',
            title: 'Account created!',
            message: 'Welcome to StockTracker.',
          });
          return { success: true };
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'Registration failed',
          });
          // Show error toast
          useToastStore.getState().addToast({
            type: 'error',
            title: 'Registration failed',
            message: error.message || 'Please try again.',
          });
          return { success: false, error: error.message };
        }
      },

      logout: async (skipApiCall = false) => {
        // Capture auth state BEFORE clearing - needed to determine if this is a real expiration
        const wasAuthenticated = get().isAuthenticated;

        if (!skipApiCall) {
          try {
            await api.post('/auth/logout');
          } catch (error) {
            console.error('[AuthStore] Logout error:', error);
          }
        }
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          // Only show "session expired" if user WAS authenticated before the 401
          // This prevents showing the message to first-time visitors who never had a session
          sessionExpired: skipApiCall && wasAuthenticated,
        });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const data = await api.get('/auth/me');
          set({
            user: data.user || data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return true;
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null, // Don't set error for auth check - just means not logged in
          });
          return false;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      // === SELECTORS ===
      getUser: () => get().user,
      isLoggedIn: () => get().isAuthenticated,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
