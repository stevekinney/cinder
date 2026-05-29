/**
 * Collapsible tree visualization of a JSON value. Hard caps from
 * COMPONENT-COVERAGE-PLAN.md:
 *
 * - Synchronous render only — no virtualization, no chunking.
 * - Payloads larger than `maxBytes` (default 1MB serialized) render a
 *   fallback with copy/download actions instead of attempting the tree.
 * - Maximum nested depth `maxDepth` (default 50). Deeper nodes render
 *   "…" with a hint to inspect via a different tool.
 *
 * Consumers needing more (search, filter, virtualization, schema-aware
 * rendering) should compose their own viewer.
 */
export type JsonViewerProps = {
  /** The value to render. Any JSON-serializable structure. */
  value: unknown;
  /** Initial collapse depth. Nodes deeper than this start collapsed. Default 1. */
  initialDepth?: number;
  /** Hard depth cap. Nodes deeper than this never render their children. Default 50. */
  maxDepth?: number;
  /** Hard byte cap on the serialized payload. Default 1_048_576 (1 MB). */
  maxBytes?: number;
  /** Additional class names merged with `.cinder-json-viewer`. */
  class?: string;
};
