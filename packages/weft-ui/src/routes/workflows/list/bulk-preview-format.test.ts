import { describe, expect, test } from 'bun:test';

import { confirmPhrase, confirmPhraseMatches, filterSummaryChip } from './bulk-preview-format.ts';

describe('confirmPhrase', () => {
  test('pluralizes for anything other than exactly 1', () => {
    expect(confirmPhrase('cancel', 47)).toBe('cancel 47 workflows');
    expect(confirmPhrase('cancel', 0)).toBe('cancel 0 workflows');
    expect(confirmPhrase('delete', 1)).toBe('delete 1 workflow');
  });
});

describe('confirmPhraseMatches', () => {
  test('matches case-insensitively and trims whitespace', () => {
    expect(confirmPhraseMatches('cancel 47 workflows', 'cancel 47 workflows')).toBe(true);
    expect(confirmPhraseMatches('CANCEL 47 WORKFLOWS', 'cancel 47 workflows')).toBe(true);
    expect(confirmPhraseMatches('  cancel 47 workflows  ', 'cancel 47 workflows')).toBe(true);
  });

  test('rejects a non-matching or partial phrase', () => {
    expect(confirmPhraseMatches('cancel 4 workflows', 'cancel 47 workflows')).toBe(false);
    expect(confirmPhraseMatches('cancel 47 workflow', 'cancel 47 workflows')).toBe(false);
    expect(confirmPhraseMatches('', 'cancel 47 workflows')).toBe(false);
  });
});

describe('filterSummaryChip', () => {
  test('empty filter summary produces an empty chip', () => {
    expect(filterSummaryChip({})).toBe('');
  });

  test('joins present dimensions with the metadata separator, in a stable order', () => {
    expect(filterSummaryChip({ status: 'failed', type: 'payment-capture' })).toBe(
      'status:failed · type:payment-capture',
    );
  });

  test('an array status joins its members with commas', () => {
    expect(filterSummaryChip({ status: ['failed', 'timed-out'] })).toBe('status:failed,timed-out');
  });

  test('tags and attributes render when non-empty', () => {
    expect(
      filterSummaryChip({
        tags: ['nightly', 'retry'],
        attributes: [{ key: 'customerTier' }, { key: 'region' }],
      }),
    ).toBe('tags:nightly,retry · attributes:customerTier,region');
  });

  test('empty tags/attributes arrays are omitted, not rendered as empty segments', () => {
    expect(filterSummaryChip({ status: 'failed', tags: [], attributes: [] })).toBe('status:failed');
  });
});
