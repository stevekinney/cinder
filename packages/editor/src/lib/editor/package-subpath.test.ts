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
