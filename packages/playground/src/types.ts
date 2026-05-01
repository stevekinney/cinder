/**
 * Shared type definitions for the cinder playground analyzer, controls, and server.
 *
 * Single source of truth — import from here everywhere. Do not re-declare these
 * types in analyze.ts, controls.ts, or component-page.svelte.
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
};
