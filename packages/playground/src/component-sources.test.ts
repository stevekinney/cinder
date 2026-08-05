/**
 * Unit tests for `component-sources.ts`'s Editor CSS-sidecar resolution.
 *
 * Regression coverage for a hardcoded `componentName === 'review-editor'`
 * check this file used to have: the real `EDITOR_COMPONENT_SOURCE` case pins
 * today's manifest shape, and the injected-fixture case proves the lookup
 * generalizes beyond the one styles export the real manifest currently has.
 */

import { describe, expect, it } from 'bun:test';

import { EDITOR_COMPONENT_SOURCE, resolveEditorStylesheetUrl } from './component-sources.ts';

describe('EDITOR_COMPONENT_SOURCE.componentStylesheetUrl', () => {
  it('resolves review-editor against the real editor package.json exports map', () => {
    expect(EDITOR_COMPONENT_SOURCE.componentStylesheetUrl('review-editor')).toBe(
      '/package-components/editor/review-editor/review-editor.css',
    );
  });

  it('returns null for editor components with no styles export', () => {
    expect(EDITOR_COMPONENT_SOURCE.componentStylesheetUrl('markdown-editor')).toBeNull();
    expect(EDITOR_COMPONENT_SOURCE.componentStylesheetUrl('diff-viewer')).toBeNull();
  });
});

describe('resolveEditorStylesheetUrl', () => {
  it('recognizes any component present in the export-key set, not just review-editor', () => {
    const fixtureKeys = new Set(['./review-editor/styles', './diagram-editor/styles']);
    expect(resolveEditorStylesheetUrl(fixtureKeys, 'review-editor')).toBe(
      '/package-components/editor/review-editor/review-editor.css',
    );
    expect(resolveEditorStylesheetUrl(fixtureKeys, 'diagram-editor')).toBe(
      '/package-components/editor/diagram-editor/diagram-editor.css',
    );
    expect(resolveEditorStylesheetUrl(fixtureKeys, 'markdown-editor')).toBeNull();
  });
});
