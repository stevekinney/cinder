import { describe, expect, test } from 'bun:test';
import {
  findModifierDocument,
  findModifierDocuments,
  orderModifierDocuments,
} from './validate-corpus.ts';

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

  test('does not select empty modifier assignment maps', () => {
    expect(
      findModifierDocuments(
        [
          {
            path: 'empty.tokens.json',
            document: { $extensions: { 'com.lostgradient.cinder': { modifier: {} } } },
          },
        ],
        { theme: 'dark' },
      ),
    ).toEqual([]);
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

  test('orders selected modifier documents by the resolver axis order', () => {
    const theme = {
      path: 'themes/dark.tokens.json',
      document: { $extensions: { 'com.lostgradient.cinder': { modifier: { theme: 'dark' } } } },
    };
    const motion = {
      path: 'modes/reduced.tokens.json',
      document: { $extensions: { 'com.lostgradient.cinder': { modifier: { motion: 'reduced' } } } },
    };
    expect(
      orderModifierDocuments(
        [motion, theme],
        [
          { name: 'theme', values: ['dark'] },
          { name: 'motion', values: ['reduced'] },
        ],
      ),
    ).toEqual([theme, motion]);
  });

  test('orders combined modifier documents after single-axis documents at the same precedence', () => {
    const motion = {
      path: 'z-motion.tokens.json',
      document: { $extensions: { 'com.lostgradient.cinder': { modifier: { motion: 'reduced' } } } },
    };
    const combined = {
      path: 'a-combined.tokens.json',
      document: {
        $extensions: {
          'com.lostgradient.cinder': { modifier: { theme: 'dark', motion: 'reduced' } },
        },
      },
    };
    expect(
      orderModifierDocuments(
        [combined, motion],
        [
          { name: 'theme', values: ['dark'] },
          { name: 'motion', values: ['reduced'] },
        ],
      ),
    ).toEqual([motion, combined]);
  });
});
