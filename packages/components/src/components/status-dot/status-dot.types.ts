import type { HTMLAttributes } from 'svelte/elements';

/**
 * Semantic status values understood by StatusDot.
 *
 * The string values are stamped onto the root as `data-cinder-status` and
 * drive color exclusively via CSS — there are no hard-coded color classes
 * on the component. The token mapping (e.g. `online` → `--cinder-success`,
 * `danger` → `--cinder-danger`) lives in `status-dot.css` so consumers can
 * theme without forking the component.
 *
 * - `success` maps to `--cinder-success` (same hue as `online`).
 * - `accent` maps to `--cinder-accent`.
 *
 * Exported so host components (e.g. `stacked-list-item.svelte`) can type
 * their own `status` prop against this union rather than restating it.
 */
export type StatusDotStatus =
  | 'online'
  | 'offline'
  | 'warning'
  | 'danger'
  | 'pending'
  | 'neutral'
  | 'success'
  | 'accent';

export type StatusDotSize = 'sm' | 'md';

/** Realtime connection states that StatusDot can render as a live-region preset. */
export type StatusDotConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * Props for StatusDot.
 *
 * The component manages the accessible name itself so the status is never
 * communicated by color alone (WCAG 1.4.1): the visible label text wins,
 * then a hidden but provided `label`, then the raw `status` token. A
 * consumer-supplied `aria-label` always takes priority over the automatic
 * fallback.
 */
export type StatusDotProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  /** Semantic status. Drives color via `data-cinder-status`; defaults to a neutral dot or derives from `connectionState`. */
  status?: StatusDotStatus;
  /** Realtime connection preset. Sets status, default label, and live-region semantics. */
  connectionState?: StatusDotConnectionState;
  /** Optional human label. Rendered visibly when `showLabel` is true; used as the accessible name either way. */
  label?: string;
  /** Use role="status" with polite live-region attributes. Defaults true when connectionState is provided. */
  live?: boolean;
  /** Whether to render the visible label. Default `true`. */
  showLabel?: boolean;
  /** Dot size. Default `'md'`. */
  size?: StatusDotSize;
  /** Extra classes appended to the root element. */
  class?: string;
};

export interface StatusDotSchemaProps {
  /** Semantic status. Drives color via `data-cinder-status`; defaults to a neutral dot or derives from `connectionState`. `success` maps to `--cinder-success`; `accent` maps to `--cinder-accent`. */
  status?: StatusDotStatus;
  /** Realtime connection preset. Sets status, default label, and live-region semantics. */
  connectionState?: StatusDotConnectionState;
  /** Optional human label. Rendered visibly when `showLabel` is true; used as the accessible name either way. */
  label?: string;
  /** Whether to render the visible label. @default true */
  showLabel?: boolean;
  /** Use role="status" with polite live-region attributes. Defaults true when connectionState is provided. */
  live?: boolean;
  /** Dot size. @default "md" */
  size?: StatusDotSize;
  /** Extra classes appended to the root element. */
  class?: string;
}
