import { describe, expect, test } from 'bun:test';

import { isRelevant, type GuidanceClaim } from './guidance-context.ts';

function claimRelevantFrom(relevantFrom: string): GuidanceClaim {
  return { id: 'claim', content: 'x', anchor: 'y', relevantFrom };
}

describe('isRelevant', () => {
  test('returns false for a missing/invalid current version guard', () => {
    const claim = claimRelevantFrom('1.0.0');
    expect(isRelevant(claim, 'not-a-version')).toBe(false);
  });

  test('prerelease arrays of unequal length: the longer side wins once the shorter runs out', () => {
    // Shared prefix ("alpha") continues past the first position (loops back
    // to the top of the comparison loop), then the current version's extra
    // trailing part means the claim's (shorter) prerelease array runs out
    // first.
    expect(isRelevant(claimRelevantFrom('1.0.0-alpha'), '1.0.0-alpha.1')).toBe(true);
    // Reversed: the claim's prerelease array is the longer one, so the
    // checked version runs out first and is treated as lower precedence.
    expect(isRelevant(claimRelevantFrom('1.0.0-alpha.1'), '1.0.0-alpha')).toBe(false);
  });

  test('identical prerelease identifiers compare as equal', () => {
    expect(isRelevant(claimRelevantFrom('1.0.0-alpha.1'), '1.0.0-alpha.1')).toBe(true);
  });

  test('a numeric prerelease identifier always has lower precedence than a string one at the same position', () => {
    expect(isRelevant(claimRelevantFrom('1.0.0-9'), '1.0.0-alpha')).toBe(true);
    expect(isRelevant(claimRelevantFrom('1.0.0-alpha'), '1.0.0-9')).toBe(false);
  });

  test('falls back to lexical/numeric ordering when both identifiers share a type', () => {
    expect(isRelevant(claimRelevantFrom('1.0.0-alpha'), '1.0.0-beta')).toBe(true);
    expect(isRelevant(claimRelevantFrom('1.0.0-beta'), '1.0.0-alpha')).toBe(false);
  });
});
