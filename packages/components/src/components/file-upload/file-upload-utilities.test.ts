import { describe, expect, test } from 'bun:test';

import {
  formatAcceptDescription,
  installFilePickerReturnFallback,
} from './file-upload-utilities.ts';

describe('formatAcceptDescription', () => {
  test('falls back to a bare MIME type when it is neither a known label, an extension, nor a wildcard', () => {
    expect(formatAcceptDescription('application/json')).toBe('application/json');
  });
});

describe('installFilePickerReturnFallback', () => {
  test('returns a no-op cleanup when the input element has no owner window (e.g. a detached document)', () => {
    // `document.implementation.createHTMLDocument()` produces a Document
    // whose `defaultView` is null — the one real-world shape (a detached
    // document, as opposed to any window this test environment provides)
    // that reaches the "no window to listen on" fallback.
    const detachedDocument = document.implementation.createHTMLDocument('detached');
    const input = detachedDocument.createElement('input');
    expect(input.ownerDocument.defaultView).toBeNull();

    const cleanup = installFilePickerReturnFallback(input, () => {});

    expect(() => cleanup()).not.toThrow();
  });
});
