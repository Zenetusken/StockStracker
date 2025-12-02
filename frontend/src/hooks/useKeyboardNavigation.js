import { useState, useCallback, useEffect } from 'react';

/**
 * useKeyboardNavigation Hook
 * Provides keyboard navigation for list-based components like search results.
 *
 * Features:
 * - Arrow up/down navigation
 * - Enter to select
 * - Escape to close
 * - Arrow right/left for preview panel
 * - Home/End for first/last item
 *
 * @param {Object} options
 * @param {Array} options.items - Array of items to navigate
 * @param {boolean} options.isOpen - Whether the list is open/visible
 * @param {Function} options.onSelect - Callback when item is selected (Enter)
 * @param {Function} options.onClose - Callback to close the list (Escape)
 * @param {Function} options.onPreviewOpen - Callback to open preview (Arrow Right)
 * @param {Function} options.onPreviewClose - Callback to close preview (Arrow Left)
 * @param {boolean} options.loop - Whether to loop from last to first item
 */
export default function useKeyboardNavigation({
  items = [],
  isOpen = false,
  onSelect,
  onClose,
  onPreviewOpen,
  onPreviewClose,
  loop = true,
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Reset active index when items change or list closes
  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      setPreviewOpen(false);
    }
  }, [isOpen]);

  // Reset when items change
  useEffect(() => {
    setActiveIndex(-1);
  }, [items]);

  const handleKeyDown = useCallback((event) => {
    if (!isOpen || items.length === 0) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setActiveIndex((prev) => {
          if (prev < items.length - 1) {
            return prev + 1;
          }
          return loop ? 0 : prev;
        });
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        setActiveIndex((prev) => {
          if (prev > 0) {
            return prev - 1;
          }
          if (prev === 0 && loop) {
            return items.length - 1;
          }
          return prev === -1 ? items.length - 1 : prev;
        });
        break;
      }

      case 'Enter': {
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < items.length) {
          const selectedItem = items[activeIndex];
          if (onSelect && selectedItem) {
            onSelect(selectedItem);
          }
        }
        break;
      }

      case 'Escape': {
        event.preventDefault();
        if (previewOpen) {
          setPreviewOpen(false);
          if (onPreviewClose) onPreviewClose();
        } else if (onClose) {
          onClose();
        }
        break;
      }

      case 'ArrowRight': {
        if (activeIndex >= 0 && !previewOpen) {
          event.preventDefault();
          setPreviewOpen(true);
          if (onPreviewOpen) {
            onPreviewOpen(items[activeIndex]);
          }
        }
        break;
      }

      case 'ArrowLeft': {
        if (previewOpen) {
          event.preventDefault();
          setPreviewOpen(false);
          if (onPreviewClose) onPreviewClose();
        }
        break;
      }

      case 'Home': {
        event.preventDefault();
        setActiveIndex(0);
        break;
      }

      case 'End': {
        event.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      }

      case 'Tab': {
        // Allow Tab to work normally but close preview
        if (previewOpen) {
          setPreviewOpen(false);
          if (onPreviewClose) onPreviewClose();
        }
        break;
      }

      default:
        break;
    }
  }, [isOpen, items, activeIndex, loop, onSelect, onClose, onPreviewOpen, onPreviewClose, previewOpen]);

  // Get the currently active item
  const activeItem = activeIndex >= 0 && activeIndex < items.length ? items[activeIndex] : null;

  // Check if a specific item is active
  const isItemActive = useCallback((item) => {
    if (!item || activeIndex < 0) return false;
    return items[activeIndex] === item || items[activeIndex]?.symbol === item.symbol;
  }, [items, activeIndex]);

  // Manually set active index (e.g., on mouse hover)
  const setActive = useCallback((index) => {
    if (index >= -1 && index < items.length) {
      setActiveIndex(index);
    }
  }, [items.length]);

  // Set active by item
  const setActiveItem = useCallback((item) => {
    if (!item) {
      setActiveIndex(-1);
      return;
    }
    const index = items.findIndex(i => i === item || i.symbol === item.symbol);
    if (index >= 0) {
      setActiveIndex(index);
    }
  }, [items]);

  return {
    activeIndex,
    activeItem,
    isItemActive,
    setActive,
    setActiveItem,
    handleKeyDown,
    previewOpen,
    setPreviewOpen,
  };
}
