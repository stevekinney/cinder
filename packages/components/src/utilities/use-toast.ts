/**
 * Imperative API for the Toast region.
 *
 * Consumers compose `<ToastRegion />` somewhere high in their tree (typically
 * the root layout), then call `useToast()` from any descendant component to
 * get an api that shows / dismisses toasts.
 *
 * Why not a process-global singleton? Region-scoped state means each
 * `<ToastRegion />` instance is independent — important for tests, modal-
 * within-modal flows, and SSR safety. The singleton trap (toasts leaking
 * across requests, route transitions orphaning notifications) is structurally
 * impossible with this model.
 */

import { getToastContext } from '../_internal/toast-context.ts';

/**
 * Returns the toast API for the nearest enclosing `<ToastRegion />`.
 *
 * Throws if no `<ToastRegion />` is mounted above the caller. The error is
 * intentionally loud — calling `useToast()` outside a region is always a
 * setup bug, not something to silently no-op.
 */
export function useToast() {
  return getToastContext();
}

export type {
  ToastApi,
  ToastItem,
  ToastOptions,
  ToastVariant,
} from '../_internal/toast-context.ts';
