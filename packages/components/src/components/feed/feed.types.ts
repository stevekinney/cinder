import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { StatusDotConnectionState } from '../status-dot/status-dot.types.ts';

/**
 * Connection state for a live feed source. When provided to the `log` arm,
 * renders a StatusDot connection preset in the toolbar — the vocabulary IS
 * StatusDot's, aliased so the two can never drift.
 */
export type FeedConnectionState = StatusDotConnectionState;

type FeedBase = {
  /** Additional class merged onto the feed root element. */
  class?: string;
  /** Feed entries (typically `<Feed.Event>` / `<Feed.Boundary>` children). */
  children: Snippet;
};

/**
 * The default `list` arm: a plain ordered list for a user-facing activity or
 * notification stream.
 */
export type FeedListProps = Omit<HTMLAttributes<HTMLOListElement>, 'children' | 'class'> &
  FeedBase & {
    /** Discriminates the arms. Omit (or pass `'list'`) for the plain list. */
    kind?: 'list';
    /**
     * List arm only (`kind` omitted or `'list'`) — rejected by the log arm,
     * whose `role="log"` viewport is implicitly live. When true, the wrapper
     * becomes an ARIA live region: `aria-live="polite"` and
     * `aria-atomic="false"`. Use for feeds that mutate while the user is
     * on the page (streaming notifications, chat-like activity).
     * Defaults to false — a polite live region on a static feed is noise.
     */
    live?: boolean;
    following?: never;
    loading?: never;
    truncated?: never;
    connectionState?: never;
    label?: never;
    toolbar?: never;
  };

/**
 * The `log` arm: an operator-facing append-only stream. Renders a
 * `role="log"` scroll viewport (implicit live-region semantics) with
 * follow-latest scrolling that pauses when the user scrolls away from the
 * bottom and resumes when they return (or press the built-in
 * "Resume following" control). Filtering, copy actions, and structured
 * detail inspection are consumer compositions — pass controls via `toolbar`
 * and render details inside your `Feed.Event` children.
 */
export type FeedLogProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> &
  FeedBase & {
    kind: 'log';
    /**
     * Log arm only — requires `kind: 'log'`; rejected by the list arm. When
     * true, appended content automatically scrolls the viewport to the
     * bottom. Scrolling away from the bottom pauses following; scrolling back
     * to the bottom (or the built-in control) resumes it. Bindable so the
     * parent can read the paused state the component sets internally.
     */
    following?: boolean;
    /**
     * Log arm only — requires `kind: 'log'`; rejected by the list arm. Show
     * a loading skeleton instead of the entries. Use while the first batch
     * of entries is in flight.
     */
    loading?: boolean;
    /**
     * Log arm only — requires `kind: 'log'`; rejected by the list arm.
     * Whether to show the "earlier entries not shown" notice. This is a
     * boolean flag, not a count: the feed never trims its own children. Set
     * it when you have already capped retention and want users to know
     * earlier entries are not shown.
     */
    truncated?: boolean;
    /**
     * Log arm only — requires `kind: 'log'`; rejected by the list arm.
     * Current connection state. When provided, renders a StatusDot connection
     * preset in the toolbar. Omit when the stream has no live transport.
     */
    connectionState?: FeedConnectionState;
    /**
     * Log arm only — requires `kind: 'log'`; rejected by the list arm.
     * Accessible label for the log region. Required for accessibility.
     * @default 'Activity log'
     */
    label?: string;
    /**
     * Consumer-composed toolbar controls (filter inputs, copy buttons, …),
     * rendered at the end of the toolbar row.
     */
    toolbar?: Snippet;
    live?: never;
  };

export type FeedProps = FeedListProps | FeedLogProps;
