import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/client';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // === STATE ===
      user: null,
      isAuthenticated: false,
      isLoading: true, // True until initial auth check completes
      error: null,

      // === ACTIONS ===

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.post('/auth/login', { email, password });
          set({
            user: data.user || data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return { success: true };
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'Login failed',
          });
          return { success: false, error: error.message };
        }
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
          return { success: true };
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'Registration failed',
          });
          return { success: false, error: error.message };
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          console.error('[AuthStore] Logout error:', error);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
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
