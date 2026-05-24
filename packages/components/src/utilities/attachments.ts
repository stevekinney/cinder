import type { Attachment } from 'svelte/attachments';

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
