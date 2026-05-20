import { describe, expect, it } from 'bun:test';

import { parseFixtureFile } from './fixture-schema.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimum valid fixture entry used across tests. */
const VALID_FIXTURE = { name: 'open', props: { isOpen: true } };

function parse(options: { fixtures: unknown; metadata?: unknown; componentName?: string }) {
  return parseFixtureFile({
    componentName: 'TestComponent',
    ...options,
  });
}

// ---------------------------------------------------------------------------
// (a) Function as a prop value → rejected
// ---------------------------------------------------------------------------

describe('prop value: function', () => {
  it('rejects a callback / function value', () => {
    expect(() =>
      parse({ fixtures: [{ name: 'open', props: { onClick: () => void 0 } }] }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// (b) Date / class instance as a prop value → rejected
// ---------------------------------------------------------------------------

describe('prop value: Date and class instances', () => {
  it('rejects a Date value', () => {
    expect(() => parse({ fixtures: [{ name: 'open', props: { created: new Date() } }] })).toThrow();
  });

  it('rejects an arbitrary class instance', () => {
    class Thing {
      value = 42;
    }
    expect(() => parse({ fixtures: [{ name: 'open', props: { thing: new Thing() } }] })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// (c) Name with uppercase → rejected
// ---------------------------------------------------------------------------

describe('fixture name: uppercase characters', () => {
  it('rejects a name containing uppercase letters', () => {
    expect(() => parse({ fixtures: [{ name: 'OpenModal', props: {} }] })).toThrow(/kebab-case/i);
  });
});

// ---------------------------------------------------------------------------
// (d) Name not kebab-case → rejected
// ---------------------------------------------------------------------------

describe('fixture name: non-kebab-case', () => {
  it('rejects underscore-separated name (open_modal)', () => {
    expect(() => parse({ fixtures: [{ name: 'open_modal', props: {} }] })).toThrow(/kebab-case/i);
  });

  it('rejects PascalCase name (OpenModal)', () => {
    expect(() => parse({ fixtures: [{ name: 'OpenModal', props: {} }] })).toThrow(/kebab-case/i);
  });

  it('rejects name with a space (open modal)', () => {
    expect(() => parse({ fixtures: [{ name: 'open modal', props: {} }] })).toThrow(/kebab-case/i);
  });
});

// ---------------------------------------------------------------------------
// (e) Name longer than 40 chars → rejected
// ---------------------------------------------------------------------------

describe('fixture name: exceeds maximum length', () => {
  it('rejects a name that is 41 characters long', () => {
    const tooLong = 'a'.repeat(41);
    expect(() => parse({ fixtures: [{ name: tooLong, props: {} }] })).toThrow(/40/);
  });

  it('accepts a name that is exactly 40 characters long', () => {
    // 40 lowercase letters — valid
    const exactly40 = 'a'.repeat(40);
    expect(() => parse({ fixtures: [{ name: exactly40, props: {} }] })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// (f) Reserved name 'default' → rejected
// ---------------------------------------------------------------------------

describe('fixture name: reserved names', () => {
  it("rejects the reserved name 'default'", () => {
    expect(() => parse({ fixtures: [{ name: 'default', props: {} }] })).toThrow(/reserved/i);
  });
});

// ---------------------------------------------------------------------------
// (g) Duplicate names after normalization → rejected
// ---------------------------------------------------------------------------

describe('fixture name: uniqueness', () => {
  it('rejects two fixtures with the same name (exact duplicate)', () => {
    expect(() =>
      parse({
        fixtures: [
          { name: 'open', props: {} },
          { name: 'open', props: {} },
        ],
      }),
    ).toThrow(/duplicate/i);
  });

  it("rejects 'open' and 'Open' — 'Open' fails the pattern, confirming the input is rejected", () => {
    // 'Open' fails the kebab-case pattern check (uppercase letter). The schema
    // rejects it before the uniqueness check runs, but the overall result is still
    // a rejection, which is the required behaviour per the spec.
    expect(() =>
      parse({
        fixtures: [
          { name: 'open', props: {} },
          { name: 'Open', props: {} },
        ],
      }),
    ).toThrow();
  });

  it("rejects 'open' and 'open ' (trailing space) — 'open ' fails the pattern, confirming the input is rejected", () => {
    // 'open ' contains a space and fails the kebab-case pattern check.
    expect(() =>
      parse({
        fixtures: [
          { name: 'open', props: {} },
          { name: 'open ', props: {} },
        ],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// (h) 6 fixtures without fixtureBudgetOverride → rejected
// ---------------------------------------------------------------------------

describe('fixture budget', () => {
  it('rejects 6 fixtures without a fixtureBudgetOverride', () => {
    const sixFixtures = Array.from({ length: 6 }, (_, index) => ({
      name: `fixture-${index + 1}`,
      props: {},
    }));

    expect(() => parse({ fixtures: sixFixtures })).toThrow(/budget/i);
  });

  // -------------------------------------------------------------------------
  // (i) 6 fixtures WITH valid fixtureBudgetOverride → accepted
  // -------------------------------------------------------------------------

  it('accepts 6 fixtures when a valid fixtureBudgetOverride is provided', () => {
    const sixFixtures = Array.from({ length: 6 }, (_, index) => ({
      name: `fixture-${index + 1}`,
      props: {},
    }));

    expect(() =>
      parse({
        fixtures: sixFixtures,
        metadata: {
          fixtureBudgetOverride: {
            reason: 'All six states are visually distinct and individually reviewable.',
            approvedBy: 'steve',
          },
        },
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// (j) Mask maxAreaPercent: 50 → rejected (over 10% cap)
// ---------------------------------------------------------------------------

describe('mask rule: maxAreaPercent', () => {
  it('rejects a mask with maxAreaPercent of 50 (exceeds 10% cap)', () => {
    expect(() =>
      parse({
        fixtures: [
          {
            name: 'open',
            props: {},
            mask: [{ testId: 'timestamp', reason: 'timestamp', maxAreaPercent: 50 }],
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts a mask with maxAreaPercent of 10 (at the cap)', () => {
    expect(() =>
      parse({
        fixtures: [
          {
            name: 'open',
            props: {},
            mask: [{ testId: 'timestamp', reason: 'timestamp', maxAreaPercent: 10 }],
          },
        ],
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// (k) Mask reason: unknown string → rejected (closed enum)
// ---------------------------------------------------------------------------

describe('mask rule: reason enum', () => {
  it("rejects a mask with an unrecognised reason ('something-custom')", () => {
    expect(() =>
      parse({
        fixtures: [
          {
            name: 'open',
            props: {},
            mask: [
              {
                testId: 'some-element',
                reason: 'something-custom',
                maxAreaPercent: 5,
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// (l) Interact target with selector instead of testId → rejected
// ---------------------------------------------------------------------------

describe('interact step: target shape', () => {
  it("rejects a target with 'selector' instead of 'testId'", () => {
    expect(() =>
      parse({
        fixtures: [
          {
            name: 'open',
            props: {},
            interact: [{ action: 'click', target: { selector: '.foo' } }],
          },
        ],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// (m) Happy path: valid fixture accepted
// ---------------------------------------------------------------------------

describe('happy path', () => {
  it('accepts a minimal valid fixture array', () => {
    expect(() => parse({ fixtures: [VALID_FIXTURE] })).not.toThrow();
  });

  it('returns the parsed fixtures and metadata', () => {
    const result = parse({ fixtures: [VALID_FIXTURE] });
    expect(result.fixtures).toHaveLength(1);
    expect(result.fixtures[0]?.name).toBe('open');
    expect(result.metadata).toEqual({});
  });

  it('accepts fixtures with interact and mask', () => {
    expect(() =>
      parse({
        fixtures: [
          {
            name: 'open',
            props: { isOpen: true },
            interact: [{ action: 'click', target: { testId: 'open-button' } }],
            mask: [{ testId: 'timestamp', reason: 'timestamp', maxAreaPercent: 5 }],
          },
        ],
      }),
    ).not.toThrow();
  });

  it('accepts nested JSON-serializable props (array, object, null, booleans, numbers)', () => {
    expect(() =>
      parse({
        fixtures: [
          {
            name: 'complex',
            props: {
              items: [1, 'two', null, true, { nested: false }],
              count: 0,
            },
          },
        ],
      }),
    ).not.toThrow();
  });
});
