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
