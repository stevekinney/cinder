// @ts-nocheck — this file deliberately self-imports `@lostgradient/editor/editor/*`
// by bare specifier to prove the package's OWN export map resolves at runtime
// (bun test). Both `tsc` and `svelte-check` resolve that subpath's `types`
// condition to `dist/`, which does not exist yet when this package's own
// `typecheck` task runs before its own `build` task in turbo's schedule
// (unlike a downstream package's cross-package imports, which resolve fine
// because upstream packages build first) — so static analysis can't see this
// file as valid without a prebuilt dist. Runtime resolution (what the test
// actually asserts) is unaffected; `bun test` resolves the "bun" export
// condition straight to source.
//
// `@lostgradient/markdown`'s sibling test avoids the identical self-import-
// before-build problem by excluding `**/*.test.ts` in
// `packages/markdown/tsconfig.check.json`. That pattern does NOT transfer
// here: markdown's `typecheck` script is `tsc` only — no svelte-check — so
// excluding test files from the ONE config `tsc` reads is sufficient.
// Editor's `typecheck` script is `tsc -p tsconfig.json && bunx svelte-check
// --workspace src/lib --tsconfig ../../tsconfig.json`, and svelte-check is
// invoked with the WORKSPACE ROOT tsconfig, not editor's own — so an
// exclusion added to `packages/editor/tsconfig.json` (or a sibling
// `tsconfig.check.json`) is never consulted by the svelte-check step at all;
// confirmed empirically that editing editor's own tsconfig's `exclude` list
// does not change svelte-check's behavior. Excluding `**/*.test.ts` from the
// shared root tsconfig instead would fix this file but is a much bigger,
// riskier change (every package's svelte-check invocation reads that same
// config) for a single test file, so `@ts-nocheck` stays as the targeted fix.

/**
 * Migrated (in part) from `packages/editor/src/package-subpath.test.ts` when
 * `@cinder/editor` was dissolved (see `docs/decisions/package-boundaries.md`).
 * Covers the ProseMirror-side subpaths that moved into `@lostgradient/editor`.
 * The headless template subpaths are covered by
 * `packages/markdown/src/templates/package-subpath.test.ts`.
 */

import { describe, expect, it } from 'bun:test';

import { createEditorAttachment } from '@lostgradient/editor/editor/component-runtime';
import {
  createDocFromMarkdown,
  debugDocStructure,
} from '@lostgradient/editor/editor/test-utilities';

describe('@lostgradient/editor editor subpath exports', () => {
  it('resolves every documented editor subpath through the export map', () => {
    expect(typeof createEditorAttachment).toBe('function');
    expect(typeof createDocFromMarkdown).toBe('function');
    expect(typeof debugDocStructure).toBe('function');
  });
});
