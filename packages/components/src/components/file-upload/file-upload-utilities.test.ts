import { describe, expect, test } from 'bun:test';

import { formatAcceptDescription } from './file-upload-utilities.ts';

describe('formatAcceptDescription', () => {
  test('falls back to a bare MIME type when it is neither a known label, an extension, nor a wildcard', () => {
    expect(formatAcceptDescription('application/json')).toBe('application/json');
  });
});
