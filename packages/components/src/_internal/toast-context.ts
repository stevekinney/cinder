/**
 * Internal toast context shape, factored out of `toast-region.svelte` so that
 * plain `.ts` consumers (the `useToast` hook in `src/utilities/use-toast.ts`)
 * can import the context accessors and types without going through the `.svelte`
 * module path. The ambient `*.svelte` declaration only exposes the default
 * export to plain TS, so any context bridge needs a `.ts` home.
 *
 * `toast-region.svelte` re-exports these types so the public surface stays a
 * single import path for downstream consumers.
 */

import type { Snippet } from 'svelte';
import { createContext } from 'svelte';

/** Toast variant — drives both visual treatment and live-region routing. */
export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

/** Toast viewport anchor. */
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** Options for {@link ToastApi.show}. */
export type ToastOptions = {
  /** Visual + live-region variant. Defaults to `info`. */
  variant?: ToastVariant;
  /** Auto-dismiss after this many milliseconds. 0 = sticky. Defaults to 5000. */
  duration?: number;
  /**
   * When true, user dismissal affordances are enabled (X button, Escape,
   * swipe). Programmatic removal via `dismiss`, `dismissAll`, overflow, and
   * action default-dismiss still works when this is false.
   */
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
   * after the action runs unless `keepOpen` is true, even when `dismissible`
   * is false.
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
  /** Dismiss a specific toast by id. No-op if the id is not active; ignores `dismissible`. */
  dismiss: (id: string) => void;
  /** Dismiss every active toast; ignores `dismissible`. */
  dismissAll: () => void;
  /**
   * Show a sticky loading toast while a promise is pending, then replace it
   * with success or danger output when the promise settles. Late settlements
   * are ignored if the loading toast was dismissed or superseded.
   */
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((value: T) => string);
      error: string | ((error: unknown) => string);
    } & Pick<ToastOptions, 'id' | 'duration' | 'dismissible' | 'action'>,
  ) => string;
};

const [getToastContextStrict, setToastContext] = createContext<ToastApi>();

export { setToastContext };

/**
 * Returns the toast API from the nearest enclosing `<ToastRegion />`.
 *
 * Throws when no `<ToastRegion />` ancestor has called `setToastContext` —
 * a missing region is always a programmer error, never a valid runtime state.
 * `createContext`'s strict getter provides this guarantee automatically.
 */
export const getToastContext = getToastContextStrict;
