import { describe, expect, test } from 'bun:test';

import { deriveAttachmentKind } from './attachment-kind.ts';

describe('deriveAttachmentKind', () => {
  test('classifies image, code, and document MIME types', () => {
    expect(deriveAttachmentKind('image/png')).toBe('image');
    expect(deriveAttachmentKind('text/markdown')).toBe('code');
    expect(deriveAttachmentKind('application/json')).toBe('code');
    expect(deriveAttachmentKind('application/pdf')).toBe('document');
  });
});
