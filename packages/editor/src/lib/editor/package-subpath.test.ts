/**
 * Migrated (in part) from `packages/editor/src/package-subpath.test.ts` when
 * `@cinder/editor` was dissolved (see `docs/decisions/package-boundaries.md`).
 * Covers the ProseMirror-side subpaths that moved into `@cinder/commentary`.
 * The headless template subpaths are covered by
 * `packages/markdown/src/templates/package-subpath.test.ts`.
 */

import { describe, expect, it } from 'bun:test';

import { createEditorAttachment } from '@cinder/commentary/editor/component-runtime';
import { createDocFromMarkdown, debugDocStructure } from '@cinder/commentary/editor/test-utilities';

describe('@cinder/commentary editor subpath exports', () => {
  it('resolves every documented editor subpath through the export map', () => {
    expect(typeof createEditorAttachment).toBe('function');
    expect(typeof createDocFromMarkdown).toBe('function');
    expect(typeof debugDocStructure).toBe('function');
  });
});
