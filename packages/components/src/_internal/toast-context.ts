/**
 * Internal toast context shape, factored out of `toast-region.svelte` so that
 * plain `.ts` consumers (the `useToast` hook in `src/utilities/use-toast.ts`)
 * can import the symbol key and types without going through the `.svelte`
 * module path. The ambient `*.svelte` declaration only exposes the default
 * export to plain TS, so any context bridge needs a `.ts` home.
 *
 * `toast-region.svelte` re-exports these types so the public surface stays a
 * single import path for downstream consumers.
 */

import type { Snippet } from 'svelte';

/** Symbol key for the toast Svelte context. */
export const TOAST_CONTEXT_KEY = Symbol('cinder-toast');

/** Toast variant — drives both visual treatment and live-region routing. */
export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

/** Options for {@link ToastApi.show}. */
export type ToastOptions = {
  /** Visual + live-region variant. Defaults to `info`. */
  variant?: ToastVariant;
  /** Auto-dismiss after this many milliseconds. 0 = sticky. Defaults to 5000. */
  duration?: number;
  /** When true, the consumer can dismiss the toast (X button). Defaults to true. */
  dismissible?: boolean;
  /** Stable id for deduplication / programmatic dismiss. Auto-generated otherwise. */
  id?: string;
  /**
   * Optional leading icon snippet, rendered before the message for visual
   * parity with Alert/Banner/Callout. Decorative only (rendered
   * `aria-hidden`); status meaning must still be conveyed by the message text
   * and variant, never by the icon alone.
   */
  icon?: Snippet;
  /**
   * Optional action paired with the message. Renders a button after the
   * message text and invokes `onAction` when clicked. The toast is dismissed
   * after the action runs unless `keepOpen` is true.
   */
  action?: { label: string; onAction: () => void; keepOpen?: boolean };
};

/** A single toast as tracked by the region. */
export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  dismissible: boolean;
  icon?: Snippet;
  action?: { label: string; onAction: () => void; keepOpen?: boolean };
};

/** Imperative API exposed via Svelte context. */
export type ToastApi = {
  /** Show a toast. Returns the assigned id (useful when you want to dismiss it later). */
  show: (message: string, options?: ToastOptions) => string;
  /** Dismiss a specific toast by id. No-op if the id is not active. */
  dismiss: (id: string) => void;
  /** Dismiss every active toast. */
  dismissAll: () => void;
};
