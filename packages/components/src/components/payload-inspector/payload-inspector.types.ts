import type { HTMLAttributes } from 'svelte/elements';

/** Active view tab for the inspector. */
export type PayloadInspectorView = 'summary' | 'tree' | 'raw';

/**
 * Structured metadata about the payload shown in the summary view.
 */
export type PayloadInspectorMeta = {
  /** Content type or serializer label, e.g. "application/json" or "Protobuf". */
  contentType?: string;
  /** Optional source label, e.g. a workflow name, activity name, or endpoint path. */
  source?: string;
  /** Optional ISO 8601 timestamp string rendered in the summary. */
  timestamp?: string;
};

/**
 * Props for the PayloadInspector component.
 */
export type PayloadInspectorProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'children'> & {
  /**
   * The payload value to inspect. Pass any JSON-serializable value — object,
   * array, string, number, boolean, or null. Pass a string for already-
   * serialized JSON; the component will attempt to parse it. Pass `undefined`
   * when no payload is available yet.
   */
  value?: unknown;
  /**
   * When true, the payload has been truncated by the producer (e.g. because it
   * exceeded a wire size limit). The inspector renders a truncation badge in the
   * summary and a notice above the raw view.
   */
  truncated?: boolean;
  /**
   * Maximum byte size before the tree view is replaced with an oversize
   * placeholder. Defaults to 1,048,576 (1 MB). Does not affect the raw view.
   */
  maxBytes?: number;
  /**
   * Structured metadata shown in the summary panel. Pass contentType, source,
   * and/or timestamp to populate the description list rows.
   */
  meta?: PayloadInspectorMeta;
  /**
   * Custom serializer for the Raw view display text. Receives the parsed value
   * and must return a string. Defaults to JSON.stringify with 2-space
   * indentation. Use this to customize key ordering, indentation, or
   * alternative serialization formats. Does not affect the Summary or Tree
   * views, or the copy buttons. For redaction, transform the value upstream and
   * pass the already-redacted value as `value`.
   */
  format?: (value: unknown) => string;
  /**
   * Custom parser applied when `value` is a string. Receives the raw string
   * and must return a parsed value or throw. Defaults to JSON.parse. Use this
   * to support alternative serialization formats.
   */
  parse?: (raw: string) => unknown;
  /**
   * Initially active view tab. Defaults to "summary". Bind to control
   * the active tab from outside.
   */
  activeView?: PayloadInspectorView;
  /**
   * Label for the inspector region, used as the accessible name for the
   * containing section. Defaults to "Payload inspector".
   */
  label?: string;
  /** Additional CSS classes applied to the root element. */
  class?: string;
};
