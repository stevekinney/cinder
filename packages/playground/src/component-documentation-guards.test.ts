import { describe, expect, test } from 'bun:test';

import { isA11yMetadata, isAvoidWhenArray } from './component-documentation-guards.ts';

describe('isAvoidWhenArray', () => {
  test('accepts a reason with an optional kebab-case alternative', () => {
    expect(isAvoidWhenArray([{ reason: 'Too heavy for inline use' }])).toBe(true);
    expect(
      isAvoidWhenArray([{ reason: 'Use the lighter control', alternative: 'toggle-group' }]),
    ).toBe(true);
  });

  test('rejects an empty or whitespace-only reason', () => {
    expect(isAvoidWhenArray([{ reason: '' }])).toBe(false);
    expect(isAvoidWhenArray([{ reason: '   ' }])).toBe(false);
  });

  test('rejects a non-kebab-case alternative', () => {
    expect(isAvoidWhenArray([{ reason: 'ok', alternative: 'ToggleGroup' }])).toBe(false);
    expect(isAvoidWhenArray([{ reason: 'ok', alternative: '1toggle' }])).toBe(false);
    expect(isAvoidWhenArray([{ reason: 'ok', alternative: '' }])).toBe(false);
  });

  test('rejects unknown keys', () => {
    expect(isAvoidWhenArray([{ reason: 'ok', extra: 'nope' }])).toBe(false);
  });

  test('rejects non-object or non-array shapes', () => {
    expect(isAvoidWhenArray('nope')).toBe(false);
    expect(isAvoidWhenArray([null])).toBe(false);
    expect(isAvoidWhenArray([{ reason: 5 }])).toBe(false);
  });
});

describe('isA11yMetadata', () => {
  test('accepts a fully-populated, well-formed payload', () => {
    expect(
      isA11yMetadata({
        pattern: 'WAI-ARIA Accordion',
        keyboard: [{ keys: 'Enter / Space', action: 'Toggle the panel' }],
        notes: ['Focus stays on the trigger after toggling.'],
      }),
    ).toBe(true);
  });

  test('accepts an empty object (all fields optional)', () => {
    expect(isA11yMetadata({})).toBe(true);
  });

  test('rejects an empty pattern', () => {
    expect(isA11yMetadata({ pattern: '' })).toBe(false);
  });

  test('rejects keyboard entries with empty keys or action', () => {
    expect(isA11yMetadata({ keyboard: [{ keys: '', action: 'do' }] })).toBe(false);
    expect(isA11yMetadata({ keyboard: [{ keys: 'Enter', action: '' }] })).toBe(false);
  });

  test('rejects keyboard entries with unknown keys', () => {
    expect(isA11yMetadata({ keyboard: [{ keys: 'Enter', action: 'do', extra: 1 }] })).toBe(false);
  });

  test('rejects empty notes entries', () => {
    expect(isA11yMetadata({ notes: [''] })).toBe(false);
  });

  test('rejects an empty notes array (mirrors manifest.schema.json minItems)', () => {
    expect(isA11yMetadata({ notes: [] })).toBe(false);
  });

  test('rejects unknown top-level keys', () => {
    expect(isA11yMetadata({ pattern: 'X', extra: true })).toBe(false);
  });
});
