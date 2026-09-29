import { describe, expect, test } from 'bun:test';

import {
  REVISION_POLICIES,
  revisionPolicyConsequence,
  revisionPolicyLabel,
} from './revision-policy.ts';

describe('REVISION_POLICIES', () => {
  test('covers both engine revision policy values, active-at-fire first', () => {
    expect(REVISION_POLICIES.map((descriptor) => descriptor.value)).toEqual([
      'active-at-fire',
      'pinned',
    ]);
  });

  test('every consequence is non-empty prose', () => {
    for (const descriptor of REVISION_POLICIES) {
      expect(descriptor.consequence.length).toBeGreaterThan(20);
    }
    // The pinned policy's consequence must say the schedule pauses rather
    // than silently falling back to a different revision.
    const pinned = REVISION_POLICIES.find((descriptor) => descriptor.value === 'pinned');
    expect(pinned?.consequence).toContain('pauses');
  });
});

describe('revisionPolicyLabel / revisionPolicyConsequence', () => {
  test('resolve every known policy', () => {
    expect(revisionPolicyLabel('active-at-fire')).toBe('Active at fire');
    expect(revisionPolicyLabel('pinned')).toBe('Pinned');
    expect(revisionPolicyConsequence('active-at-fire')).toContain('active at the moment');
  });
});
