/**
 * Generates a Svelte 5 wrapper component source string for the controls panel.
 *
 * The wrapper reads prop values from `window.__CINDER_CONTROLS__` (a plain object
 * injected by the server from URL query params) and renders the target component
 * with those values spread as props.
 *
 * The generated wrapper is compiled by `Bun.build` and served at
 * `/bundle/:name/controls.js`.
 *
 * NOTE: `ComponentManifest` and `PropManifest` are defined here until `analyze.ts`
 * is created in the next phase. The analyzer will re-export them so callers can
 * `import type { ComponentManifest, PropManifest } from './analyze.ts'`.
 */

import type { ControlKind } from './controls.ts';

/** Metadata for a single component prop extracted by the static analyzer. */
export type PropManifest = {
  /** Prop name as it appears in the component's `$props()` destructure. */
  name: string;
  /** Inferred control kind for this prop's type. */
  control: ControlKind;
  /** Whether the prop was marked `$bindable()`. */
  bindable: boolean;
  /** Default value from the component source, if present. */
  defaultValue?: unknown;
  /** Whether the prop is optional (`?`). */
  optional: boolean;
};

/** Metadata for a Svelte component extracted by the static analyzer. */
export type ComponentManifest = {
  /** Kebab-case component name (matches the `.svelte` filename without extension). */
  name: string;
  /**
   * Path used in the generated `import` statement. Relative to
   * `scripts/playground/` so that `Bun.build` can resolve it.
   */
  importPath: string;
  /** Ordered list of props, as extracted from the component's script. */
  props: PropManifest[];
};

/**
 * Returns the subset of props that should appear in `controlProps` — i.e., props
 * that are not snippets and not the `class` prop. These are the props we can
 * meaningfully set from URL query parameters.
 */
function selectableProps(props: PropManifest[]): PropManifest[] {
  return props.filter((prop) => prop.control.kind !== 'snippet' && prop.name !== 'class');
}

/**
 * Derive the PascalCase component identifier from a kebab-case name.
 * `"data-list"` → `"DataList"`, `"button"` → `"Button"`.
 */
function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Generate a Svelte 5 wrapper component source string for the given manifest.
 *
 * The wrapper:
 * 1. Imports the target component by `manifest.importPath`.
 * 2. Reads prop values from `(window as any).__CINDER_CONTROLS__ ?? {}` into a
 *    reactive `$state` object.
 * 3. Filters to only the controllable props (no snippets, no `class`).
 * 4. Renders `<Component {...controlProps} />`.
 *
 * Snippet props are intentionally omitted — they cannot be represented as URL
 * query params or serialised JSON values.
 */
export function generateWrapper(manifest: ComponentManifest): string {
  const componentIdentifier = toPascalCase(manifest.name);
  const controlled = selectableProps(manifest.props);

  // Build the object type annotation for controlProps so TypeScript is happy
  // inside the generated Svelte script. We use `Record<string, unknown>` as the
  // widened type since the generated code is a dev-only harness.
  const propKeys = controlled.map((prop) => prop.name);
  const pickedComment =
    propKeys.length > 0
      ? `// Controllable props: ${propKeys.join(', ')}`
      : '// No controllable props for this component';

  return `<script lang="ts">
  import ${componentIdentifier} from '${manifest.importPath}';

  ${pickedComment}
  const rawControls: Record<string, unknown> = (window as any).__CINDER_CONTROLS__ ?? {};

  // Filter to only the props this component accepts (excluding snippets and class).
  const allowedKeys = new Set(${JSON.stringify(propKeys)});
  let controlProps = $state<Record<string, unknown>>(
    Object.fromEntries(Object.entries(rawControls).filter(([key]) => allowedKeys.has(key))),
  );
</script>

<${componentIdentifier} {...controlProps} />
`;
}
