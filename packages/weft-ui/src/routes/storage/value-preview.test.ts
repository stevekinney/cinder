import { describe, expect, test } from 'bun:test';

import { previewStorageValue } from './value-preview.ts';

describe('previewStorageValue', () => {
  test('empty bytes classify as empty', () => {
    expect(previewStorageValue(new Uint8Array())).toEqual({ kind: 'empty', byteLength: 0 });
  });

  test('valid UTF-8 JSON text classifies as text and decodes verbatim', () => {
    const bytes = new TextEncoder().encode('{"owner":"ops"}');
    expect(previewStorageValue(bytes)).toEqual({
      kind: 'text',
      text: '{"owner":"ops"}',
      byteLength: bytes.byteLength,
    });
  });

  test('valid UTF-8 plain-string text classifies as text', () => {
    const bytes = new TextEncoder().encode('true');
    expect(previewStorageValue(bytes)).toEqual({ kind: 'text', text: 'true', byteLength: 4 });
  });

  test('invalid UTF-8 bytes classify as binary with no text field', () => {
    // A lone continuation byte (0x80) is never valid at the start of a UTF-8 sequence.
    const bytes = new Uint8Array([0xff, 0xfe, 0x80, 0x01]);
    const preview = previewStorageValue(bytes);
    expect(preview.kind).toBe('binary');
    expect(preview.text).toBeUndefined();
    expect(preview.byteLength).toBe(4);
  });
});
