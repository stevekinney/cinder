/**
 * Generates a Svelte 5 wrapper component source string for the controls panel.
 *
 * The wrapper reads prop values from `window.__CINDER_CONTROLS__` (a plain object
 * injected by the server) and renders the target component with those values spread as props.
 *
 * The generated wrapper is compiled by `Bun.build` and served at
 * `/bundle/:name/controls.js`.
 */

import type { ComponentManifest, PropManifest } from './types.ts';

export type { ComponentManifest, PropManifest };

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
 * Snippet props are intentionally omitted — they cannot be represented as
 * serialized form values.
 */
export function generateWrapper(manifest: ComponentManifest): string {
  const componentIdentifier = toPascalCase(manifest.name);
  const controlled = selectableProps(manifest.props);

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
