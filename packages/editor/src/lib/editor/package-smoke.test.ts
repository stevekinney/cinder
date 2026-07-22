/**
 * Migrated from `packages/editor/src/package-smoke.test.ts` when
 * `@cinder/editor` was dissolved (see `docs/decisions/package-boundaries.md`).
 * This half of the split verifies the ProseMirror/Milkdown editor barrel and
 * its dependency on `@lostgradient/markdown` resolve through the workspace export
 * map.
 */

import { describe, expect, it } from 'bun:test';

import { contentEquals } from '@lostgradient/markdown/pipeline';

import { createEditorAttachment, DEFAULT_DEBOUNCE_MS } from './index.js';

describe('@cinder/commentary editor package wiring', () => {
  it('resolves @lostgradient/markdown through the workspace export map', () => {
    expect(typeof contentEquals).toBe('function');
  });

  it('exports the editor attachment surface from the package barrel', () => {
    expect(typeof createEditorAttachment).toBe('function');
    expect(DEFAULT_DEBOUNCE_MS).toBe(300);
  });
});
