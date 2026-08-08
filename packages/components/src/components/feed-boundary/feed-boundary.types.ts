import type { HTMLAttributes } from 'svelte/elements';

export type FeedBoundaryProps = Omit<HTMLAttributes<HTMLLIElement>, 'children' | 'class'> & {
  /** Additional class merged onto the `.cinder-feed-boundary` root element. */
  class?: string;
  /**
   * Accessible and visible label for the boundary, e.g.
   * "Reconnected — 3 events replayed" or "Sequence gap — expected 12,
   * received 15". The consumer owns the wording; the boundary owns the
   * `role="separator"` semantics and the rule treatment.
   */
  label: string;
  /**
   * Optional machine-readable ISO 8601 datetime for the boundary moment.
   * Rendered as `<time datetime>` when provided.
   */
  datetime?: string;
  /**
   * Optional human-readable timestamp label. Falls back to `datetime` when
   * omitted while `datetime` is set.
   */
  timestamp?: string;
};
