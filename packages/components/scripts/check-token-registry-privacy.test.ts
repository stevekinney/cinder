import { describe, expect, test } from 'bun:test';

import { findPrivacyViolations, type RegistryEntry } from './check-token-registry-privacy.ts';

function entry(cssProperty: string, isPublic: boolean): RegistryEntry {
  return { path: 'token.under.test', cssProperty, public: isPublic };
}

describe('findPrivacyViolations', () => {
  test('accepts each flag paired with its own prefix', () => {
    expect(
      findPrivacyViolations([
        entry('--cinder-space-4', true),
        entry('--_cinder-internal-gap', false),
      ]),
    ).toEqual([]);
  });

  test('rejects a private property advertised as public', () => {
    const violations = findPrivacyViolations([entry('--_cinder-internal-gap', true)]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toMatch(/advertised as public/);
  });

  test('rejects a public property on an entry marked private', () => {
    const violations = findPrivacyViolations([entry('--cinder-space-4', false)]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toMatch(/marked private/);
  });

  // The two prefixes are DISJOINT, so "not private" never implies "public".
  // A check written as the negation of the other would let a third namespace
  // through in whichever direction it was not testing.
  test('rejects a third namespace under either flag', () => {
    expect(findPrivacyViolations([entry('--vendor-foo', true)])).toHaveLength(1);
    expect(findPrivacyViolations([entry('--vendor-foo', false)])).toHaveLength(1);
  });

  test('reports every offender, not just the first', () => {
    const violations = findPrivacyViolations([
      entry('--_cinder-a', true),
      entry('--cinder-b', true),
      entry('--vendor-c', true),
    ]);
    expect(violations.map((violation) => violation.cssProperty)).toEqual([
      '--_cinder-a',
      '--vendor-c',
    ]);
  });

  test('an empty registry has no violations', () => {
    expect(findPrivacyViolations([])).toEqual([]);
  });
});
