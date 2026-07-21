/**
 * Migrated (in part) from `packages/editor/src/package-subpath.test.ts` when
 * `@cinder/editor` was dissolved (see `docs/decisions/package-boundaries.md`).
 * Covers the headless template subpaths that moved into `@cinder/markdown`.
 * The ProseMirror-side subpaths (`./editor/test-utilities`,
 * `./editor/component-runtime`) are covered by
 * `packages/commentary/src/editor/package-subpath.test.ts`.
 */

import { describe, expect, it } from 'bun:test';

import { sanitizeHtml } from '@cinder/markdown/templates/sanitize-html';
import {
  parsePlaceholderTokens,
  resolveTemplatePlaceholders,
} from '@cinder/markdown/templates/template-placeholders';
import { renderTemplate } from '@cinder/markdown/templates/template-render';

describe('@cinder/markdown templates subpath exports', () => {
  it('resolves every documented templates subpath through the export map', () => {
    expect(typeof sanitizeHtml).toBe('function');
    expect(typeof parsePlaceholderTokens).toBe('function');
    expect(typeof resolveTemplatePlaceholders).toBe('function');
    expect(typeof renderTemplate).toBe('function');
  });
});
