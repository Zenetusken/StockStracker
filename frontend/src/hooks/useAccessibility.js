import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Accessibility Hooks and Utilities
 * #140-145: Keyboard navigation, ARIA, screen reader, focus management, high contrast, reduced motion
 */

/**
 * #145: Hook to detect reduced motion preference
 */
export function useReducedMotion() {
  // Initialize state with the current value to avoid calling setState in effect
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * #144: Hook to detect high contrast preference
 */
export function useHighContrast() {
  // Initialize state with the current value to avoid calling setState in effect
  const [prefersHighContrast, setPrefersHighContrast] = useState(
    () => window.matchMedia('(prefers-contrast: more)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');

    const handleChange = (event) => {
      setPrefersHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersHighContrast;
}

/**
 * #142: Hook for screen reader announcements
 * Creates a live region that announces messages to screen readers
 */
export function useAnnouncer() {
  const announcerRef = useRef(null);

  useEffect(() => {
    // Create announcer element if it doesn't exist
    let announcer = document.getElementById('sr-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'sr-announcer';
      announcer.className = 'sr-announcer';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }
    announcerRef.current = announcer;

    return () => {
      // Don't remove on cleanup - other components may use it
    };
  }, []);

  const announce = useCallback((message, priority = 'polite') => {
    if (announcerRef.current) {
      // Update aria-live for priority
      announcerRef.current.setAttribute('aria-live', priority);
      // Clear and set message (forces re-announcement)
      announcerRef.current.textContent = '';
      setTimeout(() => {
        announcerRef.current.textContent = message;
      }, 50);
    }
  }, []);

  return { announce };
}

/**
 * #143: Hook for focus management
 * Helps trap focus within modals and manage focus on route changes
 */
export function useFocusTrap(isActive = false) {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store currently focused element
    previousFocusRef.current = document.activeElement;

    // Find all focusable elements
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusableElements = containerRef.current.querySelectorAll(focusableSelector);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }

    // Handle tab key
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    containerRef.current.addEventListener('keydown', handleKeyDown);
    const container = containerRef.current;

    return () => {
      container?.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previous element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}

/**
 * #140: Hook for keyboard navigation
 * Provides arrow key navigation for lists
 */
export function useArrowKeyNavigation(items, onSelect) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback((e) => {
    if (!items?.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < items.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : items.length - 1
        );
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && onSelect) {
          onSelect(items[focusedIndex], focusedIndex);
        }
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
      case 'Escape':
        setFocusedIndex(-1);
        break;
    }
  }, [items, focusedIndex, onSelect]);

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
  };
}

/**
 * Generate unique IDs for ARIA relationships
 */
let idCounter = 0;
export function useUniqueId(prefix = 'accessible') {
  const [id] = useState(() => `${prefix}-${++idCounter}`);
  return id;
}

export default {
  useReducedMotion,
  useHighContrast,
  useAnnouncer,
  useFocusTrap,
  useArrowKeyNavigation,
  useUniqueId,
};
