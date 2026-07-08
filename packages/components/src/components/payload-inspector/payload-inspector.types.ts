import type { HTMLAttributes } from 'svelte/elements';

/** Schema-facing payload value. Kept permissive to match the runtime `unknown` prop. */
export type PayloadInspectorSchemaValue = unknown;

/**
 * Props for the PayloadInspector component.
 */
export type PayloadInspectorProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'children'> & {
  /**
   * The payload value to inspect. Pass any JSON-serializable value — object,
   * array, string, number, boolean, or null. Plain strings are rendered as
   * string values; strings that look like serialized JSON are parsed. Pass
   * `undefined` when no payload is available yet.
   */
  value?: unknown;
  /**
   * When true, the payload has been truncated by the producer (e.g. because it
   * exceeded a wire size limit). The inspector renders a truncation badge in
   * the header.
   */
  truncated?: boolean;
  /**
   * Maximum byte size before the tree view is replaced with an oversize
   * placeholder. Defaults to 1,048,576 (1 MB).
   */
  maxBytes?: number;
  /**
   * Custom parser applied when `value` is a string. Receives the raw string
   * and must return a parsed value or throw. Defaults to JSON.parse. Use this
   * to support alternative serialization formats.
   */
  parse?: (raw: string) => unknown;
  /**
   * Visible header label for the inspector. Defaults to "Payload inspector".
   */
  label?: string;
  /** Additional CSS classes applied to the root element. */
  class?: string;
};

/**
 * Cinder-specific schema surface for PayloadInspector.
 *
 * The parser callback is documented but marked unsupported because functions
 * cannot be represented as JSON Schema controls.
 */
export type PayloadInspectorSchemaProps = {
  /**
   * The payload value to inspect. Pass any JSON-serializable value — object,
   * array, string, number, boolean, or null. Plain strings are rendered as
   * string values; strings that look like serialized JSON are parsed. Pass
   * `undefined` when no payload is available yet.
   *
   * @schemaPermissive
   */
  value?: PayloadInspectorSchemaValue;
  /**
   * When true, the payload has been truncated by the producer (e.g. because it
   * exceeded a wire size limit). The inspector renders a truncation badge in
   * the header.
   */
  truncated?: boolean;
  /**
   * Maximum byte size before the tree view is replaced with an oversize
   * placeholder. Defaults to 1,048,576 (1 MB).
   */
  maxBytes?: number;
  /**
   * Visible header label for the inspector. Defaults to "Payload inspector".
   */
  label?: string;
  /** Additional CSS classes applied to the root element. */
  class?: string;
};
