import type { Attachment } from 'svelte/attachments';

/**
 * Focusable element selector for accessibility.
 */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Locks body scroll while the element is mounted.
 * Useful for modals, sheets, and other overlays.
 *
 * @example
 * ```svelte
 * <div {@attach bodyScrollLock}>Modal content</div>
 * ```
 */
export const bodyScrollLock: Attachment<HTMLElement> = () => {
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.overflow = previousOverflow;
  };
};

export type FocusTrapOptions = {
  /** Whether the trap is currently active (default: true) */
  enabled?: boolean;
};

/**
 * Creates a focus trap attachment that wraps Tab/Shift+Tab within an element.
 * Useful for modals, sheets, dropdowns, and other contained UI.
 *
 * @example
 * ```svelte
 * <div {@attach createFocusTrap()}>
 *   <button>First</button>
 *   <button>Last</button>
 * </div>
 * ```
 */
export function createFocusTrap(options: FocusTrapOptions = {}): Attachment<HTMLElement> {
  const { enabled = true } = options;

  return (node: HTMLElement) => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!enabled || event.key !== 'Tab') return;

      const focusableElements = node.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0] as HTMLElement;
      const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    node.addEventListener('keydown', handleKeyDown);

    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  };
}

export type ClickOutsideOptions = {
  /** Callback when clicking outside the element */
  handler: () => void;
  /** Whether the attachment is enabled — accepts a getter to stay reactive (default: true) */
  enabled?: boolean | (() => boolean);
};

/**
 * Creates a click-outside attachment that calls a handler when clicking outside the element.
 * Useful for closing dropdowns, menus, and popovers.
 *
 * @example
 * ```svelte
 * <div {@attach createClickOutside({ handler: () => isOpen = false, enabled: () => isOpen })}>
 *   Dropdown content
 * </div>
 * ```
 */
export function createClickOutside(options: ClickOutsideOptions): Attachment<HTMLElement> {
  const { handler, enabled = true } = options;

  return (node: HTMLElement) => {
    function handleClick(event: MouseEvent) {
      const isEnabled = typeof enabled === 'function' ? enabled() : enabled;
      if (!isEnabled) return;
      const target = event.target as Node;
      if (!node.contains(target)) {
        handler();
      }
    }

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  };
}

export type FocusOnMountOptions = {
  /** Selector for element to focus, or focuses first focusable if not provided */
  selector?: string;
  /** Delay before focusing (useful for animations) */
  delay?: number;
  /**
   * Element to restore focus to on destroy.
   * When provided, overrides the default behavior of restoring to previousActiveElement.
   * Pass null to disable focus restoration entirely.
   * (DEP-47)
   */
  restoreTarget?: HTMLElement | null;
};

/**
 * Creates an attachment that focuses the first focusable element within the node on mount.
 * Restores focus to the previously focused element on cleanup.
 *
 * @example
 * ```svelte
 * <div {@attach createFocusOnMount()}>
 *   <button>This will be focused</button>
 * </div>
 * ```
 *
 * @example Focus restoration to specific element
 * ```svelte
 * <script>
 *   let anchorElement: HTMLElement;
 * </script>
 *
 * <button bind:this={anchorElement} onclick={() => open = true}>
 *   Open popover
 * </button>
 *
 * {#if open}
 *   <div {@attach createFocusOnMount({ restoreTarget: anchorElement })}>
 *     <button>First focusable</button>
 *   </div>
 * {/if}
 * ```
 */
export function createFocusOnMount(options: FocusOnMountOptions = {}): Attachment<HTMLElement> {
  const { selector, delay = 0, restoreTarget } = options;

  return (node: HTMLElement) => {
    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Determine what to restore focus to on destroy:
    // - If restoreTarget is explicitly provided (including null), use it
    // - Otherwise, fall back to previousActiveElement
    const focusRestoreTarget = restoreTarget !== undefined ? restoreTarget : previousActiveElement;

    const focus = () => {
      const target = selector
        ? (node.querySelector(selector) as HTMLElement)
        : (node.querySelector(FOCUSABLE_SELECTOR) as HTMLElement);
      target?.focus();
    };

    if (delay > 0) {
      setTimeout(focus, delay);
    } else {
      requestAnimationFrame(focus);
    }

    return () => {
      focusRestoreTarget?.focus();
    };
  };
}
