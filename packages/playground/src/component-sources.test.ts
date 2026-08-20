/**
 * Unit tests for `component-sources.ts`'s Editor CSS-sidecar resolution.
 *
 * Regression coverage for a hardcoded `componentName === 'review-editor'`
 * check this file used to have: the real `EDITOR_COMPONENT_SOURCE` case pins
 * today's manifest shape, and the injected-fixture case proves the lookup
 * generalizes beyond the one styles export the real manifest currently has.
 */

import { describe, expect, it } from 'bun:test';

import {
  CHAT_COMPONENT_SOURCE,
  CINDER_COMPONENT_SOURCE,
  EDITOR_COMPONENT_SOURCE,
  documentationComponentStylesheetUrl,
  documentationExampleStylesheetUrls,
  resolveEditorStylesheetUrl,
} from './component-sources.ts';

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

describe('documentationComponentStylesheetUrl', () => {
  it('does not add a second stylesheet for documentation primitives', () => {
    expect(documentationComponentStylesheetUrl(CINDER_COMPONENT_SOURCE, 'button')).toBeNull();
  });

  it('loads only the documented Cinder component outside the shared stylesheet', () => {
    expect(documentationComponentStylesheetUrl(CINDER_COMPONENT_SOURCE, 'dropdown')).toBe(
      '/components/dropdown/dropdown.css',
    );
  });

  it('does not link a headless Cinder component to a nonexistent stylesheet', () => {
    expect(
      documentationComponentStylesheetUrl(CINDER_COMPONENT_SOURCE, 'click-away-listener'),
    ).toBeNull();
  });
});

describe('documentationExampleStylesheetUrls', () => {
  it('adds styles for Cinder components composed by the documented component examples', () => {
    expect(
      documentationExampleStylesheetUrls(CINDER_COMPONENT_SOURCE, 'checkbox-group', [
        'basic',
        'disabled-fieldset',
      ]),
    ).toEqual([
      '/components/checkbox/checkbox.css',
      '/components/checkbox-group/checkbox-group.css',
      '/components/form-field/form-field.css',
    ]);
  });

  it('collects root-barrel imports and recursively follows local implementation modules', () => {
    expect(
      documentationExampleStylesheetUrls(CINDER_COMPONENT_SOURCE, 'autocomplete', [
        'inside-form-field',
      ]),
    ).toContain('/components/form-field/form-field.css');
    expect(
      documentationExampleStylesheetUrls(CINDER_COMPONENT_SOURCE, 'json-schema-editor', []),
    ).toEqual(
      expect.arrayContaining(['/components/tabs/tabs.css', '/components/textarea/textarea.css']),
    );
  });

  it('collects Cinder styles from extracted-package implementation modules', () => {
    expect(documentationExampleStylesheetUrls(EDITOR_COMPONENT_SOURCE, 'diff-viewer', [])).toEqual(
      expect.arrayContaining([
        '/components/segmented-control/segmented-control.css',
        '/components/spinner/spinner.css',
        '/components/surface/surface.css',
      ]),
    );
  });

  it('follows TypeScript barrels to their local Svelte implementations', () => {
    expect(
      documentationExampleStylesheetUrls(EDITOR_COMPONENT_SOURCE, 'markdown-editor', []),
    ).toEqual(
      expect.arrayContaining([
        '/components/dropdown/dropdown.css',
        '/components/toolbar/toolbar.css',
      ]),
    );
  });

  it('recursively follows Cinder components imported by examples', () => {
    expect(
      documentationExampleStylesheetUrls(CINDER_COMPONENT_SOURCE, 'card', ['danger-zone-toggle']),
    ).toEqual(
      expect.arrayContaining([
        '/components/confirm-dialog/confirm-dialog.css',
        '/components/modal/modal.css',
      ]),
    );
  });

  it('loads extracted-package component sidecars imported by examples, not helper-only imports', () => {
    expect(
      documentationExampleStylesheetUrls(CHAT_COMPONENT_SOURCE, 'chat-composer-popover', [
        'slash-commands',
      ]),
    ).toEqual(expect.arrayContaining(['/package-components/chat/chat/chat.css']));
    expect(
      documentationExampleStylesheetUrls(CHAT_COMPONENT_SOURCE, 'chat-conversation-header', [
        'basic',
      ]),
    ).not.toContain('/package-components/chat/chat/chat.css');
  });
});
