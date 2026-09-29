/**
 * Storage values are opaque bytes (plan §9.6: "Value display via
 * PayloadInspector … handle non-JSON gracefully"). This module classifies a
 * raw `Uint8Array` for display: valid UTF-8 text (which `PayloadInspector`
 * itself further classifies as JSON vs. a plain string) renders through the
 * inspector; anything that doesn't decode cleanly renders as an explicit
 * binary fallback instead of feeding replacement-character garbage into it.
 */

export interface StorageValuePreview {
  readonly kind: 'empty' | 'text' | 'binary';
  readonly text?: string;
  readonly byteLength: number;
}

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function previewStorageValue(value: Uint8Array): StorageValuePreview {
  if (value.byteLength === 0) return { kind: 'empty', byteLength: 0 };

  try {
    return { kind: 'text', text: utf8Decoder.decode(value), byteLength: value.byteLength };
  } catch {
    return { kind: 'binary', byteLength: value.byteLength };
  }
}
