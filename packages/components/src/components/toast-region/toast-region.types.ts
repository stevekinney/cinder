import type { Snippet } from 'svelte';

import type {
  ToastApi,
  ToastItem,
  ToastOptions,
  ToastVariant,
} from '../../_internal/toast-context.ts';

export type { ToastApi, ToastItem, ToastOptions, ToastVariant };

/** Props for the ToastRegion component. */
export type ToastRegionProps = {
  /** Maximum simultaneous toasts in each region. Default 5. */
  maxStack?: number;
  /** Default auto-dismiss duration in ms. Default 5000. Set to 0 for sticky. */
  defaultDuration?: number;
  /** Additional class names merged with `.cinder-toast-region`. */
  class?: string;
  /**
   * Optional children. When provided, the region wraps them so descendants
   * can call `useToast()` and read the region's context. Most apps mount
   * `<ToastRegion>` as a self-closing tag at the root of their layout and
   * leave this empty — but some patterns (modal-scoped regions, tests)
   * benefit from explicit child composition.
   */
  children?: Snippet;
};
