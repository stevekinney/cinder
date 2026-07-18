import { describe, expect, test } from 'bun:test';

import { formatBytes } from './format-bytes.ts';

describe('formatBytes', () => {
  test('formats byte, kilobyte, and megabyte ranges', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});
