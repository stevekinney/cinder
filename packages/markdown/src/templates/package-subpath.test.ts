/**
 * Migrated (in part) from `packages/editor/src/package-subpath.test.ts` when
 * `@cinder/editor` was dissolved (see `docs/decisions/package-boundaries.md`).
 * Covers the headless template subpaths that moved into `@lostgradient/markdown`.
 * The ProseMirror-side subpaths (`./editor/test-utilities`,
 * `./editor/component-runtime`) are covered by
 * `packages/commentary/src/editor/package-subpath.test.ts`.
 */

import { describe, expect, it } from 'bun:test';

import { sanitizeHtml } from '@lostgradient/markdown/templates/sanitize-html';
import {
  parsePlaceholderTokens,
  resolveTemplatePlaceholders,
} from '@lostgradient/markdown/templates/template-placeholders';
import { renderTemplate } from '@lostgradient/markdown/templates/template-render';

describe('@lostgradient/markdown templates subpath exports', () => {
  it('resolves every documented templates subpath through the export map', () => {
    expect(typeof sanitizeHtml).toBe('function');
    expect(typeof parsePlaceholderTokens).toBe('function');
    expect(typeof resolveTemplatePlaceholders).toBe('function');
    expect(typeof renderTemplate).toBe('function');
  });
});
