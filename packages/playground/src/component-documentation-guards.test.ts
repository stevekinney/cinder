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

  test('enforces the schema maxLength on reason (≤140) and alternative (≤64)', () => {
    // A reason at the 140-char cap passes; one character over is rejected, so an
    // oversized (schema-invalid) payload can't slip past the runtime guard.
    expect(isAvoidWhenArray([{ reason: 'r'.repeat(140) }])).toBe(true);
    expect(isAvoidWhenArray([{ reason: 'r'.repeat(141) }])).toBe(false);

    // A kebab alternative at the 64-char cap passes; 65 is rejected. (Padded with
    // hyphens so the value stays kebab-valid and only the length is under test.)
    const altAtCap = `a${'-a'.repeat(31)}b`; // 64 chars, valid kebab
    expect(altAtCap.length).toBe(64);
    expect(isAvoidWhenArray([{ reason: 'ok', alternative: altAtCap }])).toBe(true);
    expect(isAvoidWhenArray([{ reason: 'ok', alternative: `${altAtCap}-c` }])).toBe(false);
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

  test('enforces the schema maxLength caps (pattern 80, keys/action 120, notes 280)', () => {
    // Each field passes at its cap and is rejected one character over, so an
    // oversized (schema-invalid) a11y payload can't pass the runtime guard.
    expect(isA11yMetadata({ pattern: 'p'.repeat(80) })).toBe(true);
    expect(isA11yMetadata({ pattern: 'p'.repeat(81) })).toBe(false);

    expect(isA11yMetadata({ keyboard: [{ keys: 'k'.repeat(120), action: 'do' }] })).toBe(true);
    expect(isA11yMetadata({ keyboard: [{ keys: 'k'.repeat(121), action: 'do' }] })).toBe(false);
    expect(isA11yMetadata({ keyboard: [{ keys: 'Enter', action: 'a'.repeat(120) }] })).toBe(true);
    expect(isA11yMetadata({ keyboard: [{ keys: 'Enter', action: 'a'.repeat(121) }] })).toBe(false);

    expect(isA11yMetadata({ notes: ['n'.repeat(280)] })).toBe(true);
    expect(isA11yMetadata({ notes: ['n'.repeat(281)] })).toBe(false);
  });
});
