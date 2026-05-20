import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Axis to allow scrolling along. */
export type ScrollAreaDirection = 'vertical' | 'horizontal' | 'both';
/** Element tags intentionally supported by the `as` prop. */
export type ScrollAreaElement =
  | 'article'
  | 'aside'
  | 'div'
  | 'li'
  | 'main'
  | 'nav'
  | 'ol'
  | 'pre'
  | 'section'
  | 'ul';
/**
 * Props for ScrollArea. A styled scrollable container with cross-browser
 * scrollbar theming via design tokens. This is chrome only — virtualization
 * (svelte-virtual, TanStack Virtual, etc.) remains a consumer-level concern
 * and pairs *with* this component, not inside it.
 */
export type ScrollAreaProps = Omit<
  HTMLAttributes<HTMLElement>,
  'class' | 'children' | 'tabindex' | 'role' | 'aria-label'
> & {
  /** Axis to allow scrolling on. Defaults to `'vertical'`. */
  direction?: ScrollAreaDirection;
  /** Maximum block size of the scroll viewport (any valid CSS length). */
  maxHeight?: string;
  /** Maximum inline size of the scroll viewport (any valid CSS length). */
  maxWidth?: string;
  /**
   * Accessible name for the scroll region. When provided on neutral
   * containers, the container also gets `role="region"` so assistive
   * technology treats it as a landmark. Semantic tags keep their native
   * roles. Provide this when the scroll area represents a meaningful section
   * (a chat transcript, a code panel) — omit it for purely decorative
   * scrolling chrome. This is the single source of truth for the accessible
   * name; pass it through this prop rather than the raw `aria-label` HTML
   * attribute so the landmark role and label stay coupled.
   */
  ariaLabel?: string;
  /**
   * Override the default focusable behavior. The component sets `tabindex="0"`
   * by default so keyboard users can scroll the viewport with arrow keys.
   * Pass `tabindex={-1}` to opt out when the scroll area wraps content that
   * is guaranteed not to overflow, or when the container is focused
   * programmatically rather than via tab order.
   */
  tabindex?: number;
  /** Element tag to render. Defaults to `'div'`. */
  as?: ScrollAreaElement;
  /** Additional classes merged onto the scroll viewport. */
  class?: string;
  /** Scrollable content. */
  children: Snippet;
};
