import type { HTMLAttributes } from 'svelte/elements';

/** Severity / tone of an event entry. */
export type EventSeverity = 'debug' | 'info' | 'success' | 'warning' | 'error';

/** Connection state for the event stream source. */
export type EventStreamState = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * A single event entry in the stream.
 *
 * `id` must be stable and unique across the lifetime of the viewer — it drives
 * React-style keyed reconciliation. Use a server-assigned ID or a deterministic
 * hash, not `Math.random()`.
 */
export type StreamEvent = {
  /** Stable unique identifier used as the keyed list identity. */
  id: string;
  /** Machine-readable ISO 8601 datetime string rendered into `<time datetime>`. */
  datetime: string;
  /** Human-readable timestamp label (e.g. "12:04:32", "2m ago"). Falls back to `datetime`. */
  timestamp?: string;
  /** Severity tone that drives visual styling and the accessible label prefix. */
  severity?: EventSeverity;
  /** Origin label identifying which service, worker, or activity produced the event. */
  source?: string;
  /** One-line summary of the event. */
  summary: string;
  /** Optional structured JSON payload. Rendered in a collapsible JsonViewer. */
  details?: unknown;
};

/**
 * Props for the EventStreamViewer component.
 */
export type EventStreamViewerProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
  /** Events to render in chronological order, oldest first. */
  events: StreamEvent[];
  /**
   * Current connection state. When provided, renders a StatusDot connection preset in
   * the toolbar. Omit when the stream has no live transport.
   */
  connectionState?: EventStreamState;
  /**
   * When true, new events automatically scroll the list to the bottom.
   * Set to false to pause follow-latest (e.g. while the user reads earlier events).
   * Bindable so the parent can read the paused state the component sets internally.
   */
  followLatest?: boolean;
  /**
   * Whether to show the "events were truncated" notice. This is a boolean flag,
   * not a count: the viewer never slices `events` itself. Set it to `true` when
   * you have already trimmed the array (e.g. capped retention) and want users to
   * know earlier events are not shown.
   */
  truncated?: boolean;
  /**
   * Show a loading skeleton instead of the event list. Use while the first
   * batch of events is in flight.
   */
  loading?: boolean;
  /**
   * Accessible label for the event list region. Required for accessibility.
   * Defaults to "Event stream".
   */
  label?: string;
  /**
   * Callback fired when the user clicks the "Copy visible" toolbar action.
   * Receives the text of all currently visible events. When omitted the copy
   * action is hidden.
   */
  oncopyvisible?: (text: string) => void;
  /**
   * Callback fired when the user updates the filter query in the toolbar's
   * search field. The consumer is responsible for filtering `events` in
   * response. When omitted the filter input is hidden.
   */
  onfilter?: (query: string) => void;
  /**
   * Current filter query value, for controlled usage. Pairs with `onfilter`.
   */
  filterQuery?: string;
  /** Additional CSS classes applied to the root element. */
  class?: string;
};
