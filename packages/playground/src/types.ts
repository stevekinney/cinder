/**
 * Shared type definitions for the cinder playground analyzer and server.
 *
 * Single source of truth — import from here everywhere. Do not re-declare
 * these types in analyze.ts or component-page.svelte.
 */

/** Discriminated union describing the kind of UI control for a single prop. */
export type ControlKind =
  | { kind: 'text' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'select'; options: string[] }
  | { kind: 'snippet' }
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
