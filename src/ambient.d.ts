// Svelte 5 ambient types for `.svelte` module resolution under plain tsc.
// svelte2tsx provides a proper per-file declaration, but tsc still needs the
// fallback `*.svelte` module shape to resolve imports in `.ts` barrels.
declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component<Record<string, unknown>>;
  export default component;
}
