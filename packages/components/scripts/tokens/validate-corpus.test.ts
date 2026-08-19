import { describe, expect, test } from 'bun:test';
import { findModifierDocument } from './validate-corpus.ts';

describe('token corpus validation', () => {
  test('finds modifier documents through authored metadata instead of file names', () => {
    const document = {
      $extensions: { 'com.lostgradient.cinder': { modifier: { theme: 'dark' } } },
    };
    expect(
      findModifierDocument(
        [{ path: 'renamed.tokens.json', document }],
        { name: 'theme', values: ['light', 'dark'] },
        'dark',
      ),
    ).toEqual({ path: 'renamed.tokens.json', document });
  });
});
