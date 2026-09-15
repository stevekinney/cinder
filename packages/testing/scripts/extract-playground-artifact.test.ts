import { describe, expect, test } from 'bun:test';
import { safeMember } from './extract-playground-artifact.ts';

describe('playground artifact extraction', () => {
  test('rejects traversal and absolute archive members', () => {
    expect(safeMember('../outside')).toBe(false);
    expect(safeMember('/absolute')).toBe(false);
    expect(safeMember('static/../outside')).toBe(false);
    expect(safeMember('static/index.html')).toBe(true);
  });
});
