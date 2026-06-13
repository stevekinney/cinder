import { describe, expect, test } from 'bun:test';

import { computeActiveSection, type SectionOffset } from './component-page-scroll-spy.ts';

const sections: SectionOffset[] = [
  { id: 'overview', top: 0 },
  { id: 'guidance', top: 600 },
  { id: 'examples', top: 1200 },
  { id: 'props', top: 1800 },
];

describe('computeActiveSection', () => {
  test('returns null for an empty section list', () => {
    expect(computeActiveSection([], 0, 800, 3000, 100)).toBeNull();
  });

  test('the first section is active at the top of the page', () => {
    expect(computeActiveSection(sections, 0, 800, 3000, 100)).toBe('overview');
  });

  test('the last section whose top crosses the activation line wins', () => {
    // scrollY 700 + activationLine 100 = 800; guidance (600) is above, examples
    // (1200) is below, so guidance is active.
    expect(computeActiveSection(sections, 700, 800, 3000, 100)).toBe('guidance');
  });

  test('a section exactly on the activation line is active', () => {
    // scrollY 500 + 100 = 600 === guidance.top.
    expect(computeActiveSection(sections, 500, 800, 3000, 100)).toBe('guidance');
  });

  test('reaching the bottom of the document forces the last section active', () => {
    // Even though props.top (1800) is far below the activation line, hitting the
    // document bottom lights up the final section.
    expect(computeActiveSection(sections, 2200, 800, 3000, 100)).toBe('props');
  });

  test('the activation line offsets which section is considered current', () => {
    // A larger activation line activates later sections sooner.
    expect(computeActiveSection(sections, 500, 800, 3000, 700)).toBe('examples');
  });

  test('a non-scrollable short page keeps the first section active at the top', () => {
    // documentHeight (700) <= viewportHeight (800): the page cannot scroll, so
    // `scrollY + viewportHeight >= documentHeight - 4` is already true at the
    // top. The bottom-snap must NOT fire here — the first section stays active.
    expect(computeActiveSection(sections, 0, 800, 700, 100)).toBe('overview');
  });
});
