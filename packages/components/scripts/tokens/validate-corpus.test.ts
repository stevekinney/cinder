import { describe, expect, test } from 'bun:test';
import { findModifierDocument, findModifierDocuments } from './validate-corpus.ts';

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

  test('only selects multi-axis modifier documents for matching combinations', () => {
    const document = {
      $extensions: {
        'com.lostgradient.cinder': { modifier: { theme: 'dark', motion: 'reduced' } },
      },
    };
    const documents = [{ path: 'combined.tokens.json', document }];
    expect(findModifierDocuments(documents, { theme: 'dark', motion: 'default' })).toEqual([]);
    expect(findModifierDocuments(documents, { theme: 'dark', motion: 'reduced' })).toEqual(
      documents,
    );
  });
});
