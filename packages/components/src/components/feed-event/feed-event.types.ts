import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type FeedEventVariant = 'icon' | 'minimal';
type FeedEventBase = Omit<HTMLAttributes<HTMLLIElement>, 'children' | 'class'> & {
  /** Additional class merged onto the `.cinder-feed-event` root element. */
  class?: string;
  /**
   * ISO 8601 datetime string. Rendered as `<time datetime={datetime}>` so
   * assistive tech and parsers receive a machine-readable timestamp. This is
   * always the authoritative value; the visible label is separate (see
   * `timestamp` / `timestampLabel`).
   */
  datetime: string;
  /**
   * Main event body — the description, links, and secondary metadata. Passed as
   * the default children snippet:
   *
   * ```svelte
   * <FeedEvent datetime="…" timestamp="2m ago">
   *   <strong>{user.name}</strong> pushed 3 commits
   * </FeedEvent>
   * ```
   */
  children?: Snippet;
  /**
   * Visible time label, as plain text — the common case (`"2m ago"`,
   * `"May 12, 3:30 PM"`). Rendered inside the `<time>` element. Optional, with a
   * deliberate three-way contract:
   *
   * - **omitted** (`undefined`) and no `timestampLabel` → falls back to the raw
   *   `datetime` string, which is deterministic and SSR-safe (no locale or
   *   timezone dependence).
   * - **explicit empty string** (`timestamp=""`) → renders no visible label.
   *   This is treated as "intentionally blank", NOT as omitted, so it does
   *   **not** trigger the `datetime` fallback. Use it to hide the label while
   *   keeping the machine-readable `<time datetime>` for assistive tech.
   * - **non-empty string** → rendered verbatim.
   */
  timestamp?: string;
  /**
   * Rich visible time label, for the rare case where the label needs markup
   * (e.g. an `<abbr>` or nested element). Takes precedence over `timestamp` when
   * both are supplied. Most consumers should use the `timestamp` string instead.
   */
  timestampLabel?: Snippet;
};
type FeedEventIcon = FeedEventBase & {
  /** Icon variant: renders a circular badge on the rail with the icon inside. */
  variant?: 'icon';
  /** Required for the icon variant. Type-enforced by the discriminated union. */
  icon: Snippet;
};
type FeedEventMinimal = FeedEventBase & {
  /** Minimal variant: renders a small dot on the rail, no icon. */
  variant: 'minimal';
  icon?: never;
};
export type FeedEventProps = FeedEventIcon | FeedEventMinimal;
