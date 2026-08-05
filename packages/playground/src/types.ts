/**
 * Shared type definitions for the cinder playground analyzer and server.
 *
 * Single source of truth — import from here everywhere. Do not re-declare
 * these types in analyze.ts or component-page.svelte.
 */

/**
 * A leaf value the generator knows how to invent, described structurally so the
 * playground can synthesize a placeholder for a required array/object prop.
 *
 * `opaque` is the honest escape hatch — a field the generator cannot invent (a
 * callback, a Snippet, an unresolved type parameter). Opaque fields are OMITTED
 * from a synthesized literal rather than faked, so the result stays something a
 * reader could plausibly have written.
 */
export type ValueShape =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'enum'; options: string[] }
  /**
   * A NESTED array — `KeyboardShortcutGroup.shortcuts`, `…shortcuts[].keys`.
   * Arrays are objects to the type checker, so without this variant a nested
   * array fell through to the object branch and synthesized its ARRAY INTERNALS
   * as a literal: `shortcuts: { length: 10, '__@unscopables@38': {} }`.
   */
  | { kind: 'array'; element: ValueShape | ObjectShape }
  | { kind: 'opaque'; rawType: string };

/**
 * The named, REQUIRED fields of an object shape. Optional fields are dropped on
 * purpose: the goal is the minimal literal that type-checks and renders, not a
 * complete usage example — the authored examples are for that.
 */
export type ObjectShape = {
  fields: Array<{ name: string; shape: ValueShape | ObjectShape }>;
  /**
   * True when the object has no synthesizable named field at all — an
   * index-signature-only record like `Record<string, unknown>`. Such a value
   * seeds to `{}` / `[]`, never to an invented member: `MatrixChart`'s sibling
   * props name KEYS of the datum, so any datum we invented would contradict
   * them.
   */
  degenerate: boolean;
};

/** Discriminated union describing the kind of UI control for a single prop. */
export type ControlKind =
  | { kind: 'text' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'select'; options: string[] }
  | { kind: 'snippet' }
  | { kind: 'array'; element: ValueShape | ObjectShape; rawType: string }
  | { kind: 'object'; shape: ObjectShape; rawType: string }
  | { kind: 'unknown'; rawType: string };

/** Metadata for a single component prop extracted by the static analyzer. */
export type PropManifest = {
  name: string;
  control: ControlKind;
  defaultValue?: unknown;
  bindable: boolean;
  optional: boolean;
  description?: string;
};

/** Metadata for a Svelte component extracted by the static analyzer. */
export type ComponentManifest = {
  name: string;
  kebabName: string;
  file: string;
  importPath: string;
  props: PropManifest[];
  /**
   * True when the component is a compound namespace — its sibling `index.ts`
   * assembles sub-components onto the root via `Object.assign` (e.g.
   * `Accordion.Item`). Such a component's `children` must be those structured
   * sub-components, never plain text, so the playground neither synthesizes a
   * text `children` control for it nor mounts it bare in the live preview
   * (a bare mount with no children throws — `{@render children()}` on
   * `undefined`). It falls back to the featured example instead.
   */
  isCompound?: boolean;
};
