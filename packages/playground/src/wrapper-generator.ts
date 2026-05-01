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
 * Required props the controls panel can't surface (snippet bodies, unknown
 * types). The wrapper supplies sensible defaults so the component still
 * renders even when these aren't bound from the controls panel.
 *
 * Heuristic categories:
 * - `children`-like snippets render a small `Sample content.` string.
 * - Other named snippets render their name as a placeholder.
 * - `id` / `name`-like required strings get a stable synthetic value.
 * - Event handler names (`on[A-Z]...`, `onclick`, etc.) get a no-op fn.
 * - Anything else falls back to undefined and the component decides.
 */
function defaultExpressionFor(prop: PropManifest): string | null {
  if (prop.control.kind === 'snippet') {
    // Use a snippet form so the {@render ...} call sites in the component
    // see a real Snippet, not a string.
    return null;
  }
  if (prop.control.kind === 'unknown') {
    const lower = prop.name.toLowerCase();
    if (
      prop.name.startsWith('on') &&
      prop.name.length > 2 &&
      prop.name[2] === prop.name[2]?.toUpperCase()
    ) {
      return '() => {}';
    }
    if (['onclick', 'onchange', 'oninput', 'onsubmit'].includes(lower)) {
      return '() => {}';
    }
    if (['id', 'name', 'label', 'title', 'placeholder'].some((needle) => lower.includes(needle))) {
      return JSON.stringify(`tryit-${prop.name}`);
    }
    if (lower.includes('value') || lower.includes('text')) {
      return JSON.stringify('');
    }
    if (lower.includes('items') || lower.includes('options') || lower.includes('children')) {
      return '[]';
    }
    return 'undefined';
  }
  return null;
}

/**
 * Generate a Svelte 5 wrapper component source string for the given manifest.
 *
 * The wrapper:
 * 1. Imports the target component by `manifest.importPath`.
 * 2. Reads prop values from `(window as any).__CINDER_CONTROLS__ ?? {}` into a
 *    reactive `$state` object.
 * 3. Filters to only the controllable props (no snippets, no `class`).
 * 4. Synthesises filler defaults for required snippet / unknown-typed props
 *    so components like Accordion (which require `children`) still render
 *    something inside the Try-it preview.
 * 5. Renders `<Component {...controlProps} {...filler}>{#snippet children()}…{/snippet}</Component>`.
 */
export function generateWrapper(manifest: ComponentManifest): string {
  const componentIdentifier = toPascalCase(manifest.name);
  const controlled = selectableProps(manifest.props);

  const propKeys = controlled.map((prop) => prop.name);
  const pickedComment =
    propKeys.length > 0
      ? `// Controllable props: ${propKeys.join(', ')}`
      : '// No controllable props for this component';

  // Required snippet props the wrapper has to satisfy. We render each as a
  // top-level snippet block in the template — `children` gets a sample
  // paragraph, others get their name as a placeholder string.
  const requiredSnippets = manifest.props.filter(
    (prop) => prop.control.kind === 'snippet' && prop.optional === false,
  );

  // Required non-snippet props the controls panel can't handle (kind: 'unknown').
  // Generate a `let` binding with a sensible default so spreading the wrapper
  // covers the contract.
  const requiredUnknown = manifest.props.filter(
    (prop) =>
      prop.optional === false &&
      prop.control.kind === 'unknown' &&
      prop.name !== 'class' &&
      // Don't override anything the controls panel will provide.
      !propKeys.includes(prop.name),
  );

  const fillerLines = requiredUnknown
    .map((prop) => {
      const expr = defaultExpressionFor(prop);
      if (expr === null) return null;
      return `  const ${prop.name}_filler = ${expr};`;
    })
    .filter((line): line is string => line !== null);

  const fillerSpread = requiredUnknown
    .map((prop) => `${prop.name}: ${prop.name}_filler`)
    .join(', ');

  const snippetBlocks = requiredSnippets
    .map((prop) => {
      if (prop.name === 'children') {
        return `  {#snippet children()}<span style="color: var(--cinder-text-muted);">Sample content.</span>{/snippet}`;
      }
      return `  {#snippet ${prop.name}()}<span style="color: var(--cinder-text-muted);">[${prop.name}]</span>{/snippet}`;
    })
    .join('\n');

  const fillerObjectLine =
    fillerSpread.length > 0
      ? `  const fillerProps: Record<string, unknown> = { ${fillerSpread} };`
      : `  const fillerProps: Record<string, unknown> = {};`;

  return `<script lang="ts">
  import { onMount } from 'svelte';
  import ${componentIdentifier} from '${manifest.importPath}';

  ${pickedComment}
  // Filter to only the props this component accepts (excluding snippets and class).
  const allowedKeys = new Set(${JSON.stringify(propKeys)});

  function readControlProps(): Record<string, unknown> {
    const raw: Record<string, unknown> = (window as any).__CINDER_CONTROLS__ ?? {};
    return Object.fromEntries(Object.entries(raw).filter(([key]) => allowedKeys.has(key)));
  }

  let controlProps = $state<Record<string, unknown>>(readControlProps());

${fillerLines.join('\n')}
${fillerObjectLine}

  // Re-read props reactively whenever the host page updates __CINDER_CONTROLS__.
  // The host dispatches 'cinder:controls-updated' on window after each change.
  //
  // Use onMount rather than $effect: the wrapper is shipped as a separate
  // compiled bundle from the host page, and Svelte's effect-orphan check
  // rejects effects that run across runtime boundaries. onMount fires after
  // mount() so the runtime context is established and the listener wiring
  // is straightforward DOM rather than a reactive effect.
  onMount(() => {
    function handleUpdate() {
      controlProps = readControlProps();
    }
    window.addEventListener('cinder:controls-updated', handleUpdate);
    return () => window.removeEventListener('cinder:controls-updated', handleUpdate);
  });
</script>

<${componentIdentifier} {...fillerProps} {...controlProps}>
${snippetBlocks}
</${componentIdentifier}>
`;
}
