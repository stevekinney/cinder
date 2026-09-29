// Svelte 5 ambient types for `.svelte` module resolution under plain tsc.
// svelte2tsx provides a proper per-file declaration, but tsc still needs the
// fallback `*.svelte` module shape to resolve imports in `.ts` barrels.
declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component<Record<string, unknown>>;
  export default component;
}

// TypeScript 6 defaults `noUncheckedSideEffectImports` to true, so the
// per-component `import './x.css'` statements throughout `src/components/**`
// need a declaration to resolve against. This is the same wildcard that
// bundler type packages ship (`vite/client.d.ts`). Note what it does not buy:
// a wildcard ambient module satisfies the check without any file-existence
// test, so a mistyped stylesheet path still type-checks. Stylelint and the
// build cover that; the compiler does not.
declare module '*.css' {}
