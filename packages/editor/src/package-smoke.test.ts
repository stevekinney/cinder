import { describe, expect, it } from 'bun:test';

import { contentEquals } from '@cinder/markdown/pipeline';

import { createEditorAttachment, DEFAULT_DEBOUNCE_MS } from './index.js';

describe('@cinder/editor package wiring', () => {
  it('resolves @cinder/markdown through the workspace export map', () => {
    expect(typeof contentEquals).toBe('function');
  });

  it('exports the editor attachment surface from the package barrel', () => {
    expect(typeof createEditorAttachment).toBe('function');
    expect(DEFAULT_DEBOUNCE_MS).toBe(300);
  });
});
