import { describe, expect, it } from 'bun:test';

import type { ConstraintsDocument } from './constraints.ts';
import {
  defineConstraints,
  evaluateConstraints,
  evaluatePredicate,
  whenMatches,
} from './constraints.ts';

// ---------------------------------------------------------------------------
// evaluatePredicate — {prop, equals}
// ---------------------------------------------------------------------------

describe('evaluatePredicate — equals', () => {
  it('returns true when the attribute matches', () => {
    expect(evaluatePredicate({ prop: 'variant', equals: 'primary' }, { variant: 'primary' })).toBe(
      true,
    );
  });

  it('returns false when the attribute does not match', () => {
    expect(
      evaluatePredicate({ prop: 'variant', equals: 'primary' }, { variant: 'secondary' }),
    ).toBe(false);
  });

  it('returns false when the attribute is missing', () => {
    expect(evaluatePredicate({ prop: 'variant', equals: 'primary' }, {})).toBe(false);
  });

  it('works with boolean values', () => {
    expect(evaluatePredicate({ prop: 'iconOnly', equals: true }, { iconOnly: true })).toBe(true);
    expect(evaluatePredicate({ prop: 'iconOnly', equals: true }, { iconOnly: false })).toBe(false);
    expect(evaluatePredicate({ prop: 'iconOnly', equals: false }, { iconOnly: false })).toBe(true);
  });

  it('works with numeric values', () => {
    expect(evaluatePredicate({ prop: 'count', equals: 3 }, { count: 3 })).toBe(true);
    expect(evaluatePredicate({ prop: 'count', equals: 3 }, { count: 4 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluatePredicate — {prop, exists}
// ---------------------------------------------------------------------------

describe('evaluatePredicate — exists', () => {
  it('returns true when the key is present with a non-empty value', () => {
    expect(evaluatePredicate({ prop: 'label', exists: true }, { label: 'Save' })).toBe(true);
  });

  it('returns true when the key is present with an empty string', () => {
    expect(evaluatePredicate({ prop: 'label', exists: true }, { label: '' })).toBe(true);
  });

  it('returns true when the key is present with false', () => {
    expect(evaluatePredicate({ prop: 'disabled', exists: true }, { disabled: false })).toBe(true);
  });

  it('returns true when the key is present with null', () => {
    expect(evaluatePredicate({ prop: 'href', exists: true }, { href: null })).toBe(true);
  });

  it('returns false when the key is absent', () => {
    expect(evaluatePredicate({ prop: 'label', exists: true }, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluatePredicate — {prop, nonEmpty}
// ---------------------------------------------------------------------------

describe('evaluatePredicate — nonEmpty', () => {
  it('returns true for a non-empty string', () => {
    expect(evaluatePredicate({ prop: 'label', nonEmpty: true }, { label: 'Save' })).toBe(true);
  });

  it('returns false when the key is absent', () => {
    expect(evaluatePredicate({ prop: 'label', nonEmpty: true }, {})).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(evaluatePredicate({ prop: 'label', nonEmpty: true }, { label: '' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(evaluatePredicate({ prop: 'label', nonEmpty: true }, { label: null })).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(evaluatePredicate({ prop: 'label', nonEmpty: true }, { label: undefined })).toBe(false);
  });

  it('returns false for an empty array', () => {
    expect(evaluatePredicate({ prop: 'items', nonEmpty: true }, { items: [] })).toBe(false);
  });

  it('returns true for a non-empty array', () => {
    expect(evaluatePredicate({ prop: 'items', nonEmpty: true }, { items: ['a'] })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluatePredicate — {snippet}
// ---------------------------------------------------------------------------

describe('evaluatePredicate — snippet', () => {
  it('returns true when the snippet attribute is truthy', () => {
    expect(evaluatePredicate({ snippet: 'children' }, { children: true })).toBe(true);
  });

  it('returns true when the snippet attribute is a non-empty string', () => {
    expect(evaluatePredicate({ snippet: 'children' }, { children: 'some content' })).toBe(true);
  });

  it('returns false when the snippet key is absent', () => {
    expect(evaluatePredicate({ snippet: 'children' }, {})).toBe(false);
  });

  it('returns false when the snippet attribute is false', () => {
    // Svelte Snippet props are either a Snippet object or not passed; false means "not passed".
    expect(evaluatePredicate({ snippet: 'children' }, { children: false })).toBe(false);
  });

  it('returns false when the snippet attribute is null', () => {
    expect(evaluatePredicate({ snippet: 'children' }, { children: null })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluatePredicate — {allOf}
// ---------------------------------------------------------------------------

describe('evaluatePredicate — allOf', () => {
  it('returns true when all child predicates match', () => {
    expect(
      evaluatePredicate(
        {
          allOf: [
            { prop: 'iconOnly', equals: false },
            { prop: 'label', nonEmpty: true },
          ],
        },
        { iconOnly: false, label: 'Save' },
      ),
    ).toBe(true);
  });

  it('returns false when any child predicate does not match', () => {
    expect(
      evaluatePredicate(
        {
          allOf: [
            { prop: 'iconOnly', equals: false },
            { prop: 'label', nonEmpty: true },
          ],
        },
        { iconOnly: false, label: '' },
      ),
    ).toBe(false);
  });

  it('returns true for an empty allOf list', () => {
    expect(evaluatePredicate({ allOf: [] }, {})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluatePredicate — {anyOf}
// ---------------------------------------------------------------------------

describe('evaluatePredicate — anyOf', () => {
  it('returns true when at least one child predicate matches', () => {
    expect(
      evaluatePredicate(
        {
          anyOf: [
            { prop: 'aria-label', nonEmpty: true },
            { prop: 'aria-labelledby', nonEmpty: true },
          ],
        },
        { 'aria-label': 'Close' },
      ),
    ).toBe(true);
  });

  it('returns false when no child predicate matches', () => {
    expect(
      evaluatePredicate(
        {
          anyOf: [
            { prop: 'aria-label', nonEmpty: true },
            { prop: 'aria-labelledby', nonEmpty: true },
          ],
        },
        {},
      ),
    ).toBe(false);
  });

  it('returns false for an empty anyOf list', () => {
    expect(evaluatePredicate({ anyOf: [] }, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluatePredicate — nested allOf/anyOf
// ---------------------------------------------------------------------------

describe('evaluatePredicate — nested composition', () => {
  it('handles allOf containing anyOf', () => {
    const predicate = {
      allOf: [
        { prop: 'iconOnly', equals: true as boolean },
        {
          anyOf: [
            { prop: 'leadingIcon', exists: true as true },
            { prop: 'trailingIcon', exists: true as true },
            { snippet: 'children' },
          ],
        },
      ],
    };

    expect(evaluatePredicate(predicate, { iconOnly: true, leadingIcon: true })).toBe(true);
    expect(evaluatePredicate(predicate, { iconOnly: true })).toBe(false);
    expect(evaluatePredicate(predicate, { iconOnly: false, leadingIcon: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// whenMatches
// ---------------------------------------------------------------------------

describe('whenMatches', () => {
  it('returns true when when is undefined (no guard)', () => {
    expect(whenMatches(undefined, {})).toBe(true);
    expect(whenMatches(undefined, { iconOnly: true })).toBe(true);
  });

  it('returns true when the when predicate matches', () => {
    expect(whenMatches({ prop: 'iconOnly', equals: true }, { iconOnly: true })).toBe(true);
  });

  it('returns false when the when predicate does not match', () => {
    expect(whenMatches({ prop: 'iconOnly', equals: true }, { iconOnly: false })).toBe(false);
    expect(whenMatches({ prop: 'iconOnly', equals: true }, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateConstraints — combinator: exactlyOne
// ---------------------------------------------------------------------------

describe('evaluateConstraints — exactlyOne combinator', () => {
  const document: ConstraintsDocument = {
    component: 'test',
    summary: 'Test document',
    rules: [
      {
        id: 'exactly-one-test',
        severity: 'error',
        description: 'Exactly one source required',
        kind: 'exactlyOne',
        of: [
          { prop: 'a', nonEmpty: true },
          { prop: 'b', nonEmpty: true },
          { prop: 'c', nonEmpty: true },
        ],
      },
    ],
  };

  it('passes when exactly one predicate matches', () => {
    const violations = evaluateConstraints(document, { a: 'value' });
    expect(violations).toHaveLength(0);
  });

  it('produces a violation when zero predicates match', () => {
    const violations = evaluateConstraints(document, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('exactly-one-test');
  });

  it('produces a violation when two predicates match', () => {
    const violations = evaluateConstraints(document, { a: 'x', b: 'y' });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('exactly-one-test');
  });

  it('produces a violation when all three predicates match', () => {
    const violations = evaluateConstraints(document, { a: 'x', b: 'y', c: 'z' });
    expect(violations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// evaluateConstraints — combinator: anyOf
// ---------------------------------------------------------------------------

describe('evaluateConstraints — anyOf combinator', () => {
  const document: ConstraintsDocument = {
    component: 'test',
    summary: 'Test document',
    rules: [
      {
        id: 'any-name-source',
        severity: 'error',
        description: 'An accessible name source is required',
        kind: 'anyOf',
        of: [
          { prop: 'label', nonEmpty: true },
          { prop: 'aria-label', nonEmpty: true },
          { prop: 'aria-labelledby', nonEmpty: true },
        ],
      },
    ],
  };

  it('passes when at least one predicate matches', () => {
    expect(evaluateConstraints(document, { label: 'Save' })).toHaveLength(0);
    expect(evaluateConstraints(document, { 'aria-label': 'Close' })).toHaveLength(0);
    expect(evaluateConstraints(document, { label: 'Save', 'aria-label': 'Close' })).toHaveLength(0);
  });

  it('produces a violation when zero predicates match', () => {
    const violations = evaluateConstraints(document, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('any-name-source');
    expect(violations[0]!.severity).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// evaluateConstraints — combinator: allOf
// ---------------------------------------------------------------------------

describe('evaluateConstraints — allOf combinator', () => {
  const document: ConstraintsDocument = {
    component: 'test',
    summary: 'Test document',
    rules: [
      {
        id: 'all-required',
        severity: 'warning',
        description: 'All fields required',
        kind: 'allOf',
        of: [
          { prop: 'id', nonEmpty: true },
          { prop: 'value', exists: true },
        ],
      },
    ],
  };

  it('passes when all predicates match', () => {
    expect(evaluateConstraints(document, { id: 'my-input', value: '' })).toHaveLength(0);
  });

  it('produces a violation when any predicate does not match', () => {
    const violations = evaluateConstraints(document, { id: 'my-input' });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('all-required');
    expect(violations[0]!.severity).toBe('warning');
  });

  it('produces a violation when all predicates miss', () => {
    const violations = evaluateConstraints(document, {});
    expect(violations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// evaluateConstraints — combinator: requires
// ---------------------------------------------------------------------------

describe('evaluateConstraints — requires combinator', () => {
  const document: ConstraintsDocument = {
    component: 'test',
    summary: 'Test document',
    rules: [
      {
        id: 'requires-autocomplete',
        severity: 'warning',
        description: 'Password inputs should set autocomplete',
        kind: 'requires',
        when: { prop: 'type', equals: 'password' },
        of: [{ prop: 'autocomplete', nonEmpty: true }],
      },
    ],
  };

  it('passes when the required predicate matches', () => {
    expect(
      evaluateConstraints(document, { type: 'password', autocomplete: 'current-password' }),
    ).toHaveLength(0);
  });

  it('produces a violation when the required predicate does not match', () => {
    const violations = evaluateConstraints(document, { type: 'password' });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('requires-autocomplete');
  });
});

// ---------------------------------------------------------------------------
// evaluateConstraints — when clause gating
// ---------------------------------------------------------------------------

describe('evaluateConstraints — when clause gating', () => {
  const document: ConstraintsDocument = {
    component: 'test',
    summary: 'Test document',
    rules: [
      {
        id: 'gated-rule',
        severity: 'error',
        description: 'Only fires when iconOnly is true',
        kind: 'anyOf',
        when: { prop: 'iconOnly', equals: true },
        of: [{ prop: 'aria-label', nonEmpty: true }],
      },
    ],
  };

  it('does not fire when the when clause does not match', () => {
    // iconOnly is false — rule should not fire even though aria-label is missing
    expect(evaluateConstraints(document, { iconOnly: false })).toHaveLength(0);
    expect(evaluateConstraints(document, {})).toHaveLength(0);
  });

  it('fires when the when clause matches and the rule is violated', () => {
    const violations = evaluateConstraints(document, { iconOnly: true });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('gated-rule');
  });

  it('does not fire when the when clause matches but the rule passes', () => {
    expect(evaluateConstraints(document, { iconOnly: true, 'aria-label': 'Close' })).toHaveLength(
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// evaluateConstraints — severity is preserved
// ---------------------------------------------------------------------------

describe('evaluateConstraints — severity preservation', () => {
  const document: ConstraintsDocument = {
    component: 'test',
    summary: 'Test document',
    rules: [
      {
        id: 'info-rule',
        severity: 'info',
        description: 'Informational hint',
        kind: 'anyOf',
        of: [{ prop: 'description', nonEmpty: true }],
      },
      {
        id: 'warning-rule',
        severity: 'warning',
        description: 'Warning hint',
        kind: 'anyOf',
        of: [{ prop: 'placeholder', nonEmpty: true }],
      },
      {
        id: 'error-rule',
        severity: 'error',
        description: 'Error hint',
        kind: 'anyOf',
        of: [{ prop: 'label', nonEmpty: true }],
      },
    ],
  };

  it('preserves severity on each violation', () => {
    const violations = evaluateConstraints(document, {});
    expect(violations).toHaveLength(3);

    const severities = violations.map((v) => v.severity);
    expect(severities).toContain('info');
    expect(severities).toContain('warning');
    expect(severities).toContain('error');
  });
});

// ---------------------------------------------------------------------------
// evaluateConstraints — violation message format
// ---------------------------------------------------------------------------

describe('evaluateConstraints — violation message format', () => {
  const document: ConstraintsDocument = {
    component: 'test',
    summary: 'Test',
    rules: [
      {
        id: 'my-rule',
        severity: 'error',
        description: 'Something is wrong',
        kind: 'anyOf',
        of: [{ prop: 'x', exists: true }],
      },
    ],
  };

  it('formats message as "<description> (rule: <id>)"', () => {
    const violations = evaluateConstraints(document, {});
    expect(violations[0]!.message).toBe('Something is wrong (rule: my-rule)');
  });
});

// ---------------------------------------------------------------------------
// Complex synthetic document — two independent rules
// ---------------------------------------------------------------------------

describe('evaluateConstraints — complex synthetic document', () => {
  const document: ConstraintsDocument = {
    component: 'synthetic',
    summary: 'Two independent rules',
    rules: [
      {
        id: 'rule-a',
        severity: 'error',
        description: 'Rule A requires at least one of x or y',
        kind: 'anyOf',
        of: [
          { prop: 'x', nonEmpty: true },
          { prop: 'y', nonEmpty: true },
        ],
      },
      {
        id: 'rule-b',
        severity: 'warning',
        description: 'Rule B: exactly one of p or q',
        kind: 'exactlyOne',
        of: [
          { prop: 'p', nonEmpty: true },
          { prop: 'q', nonEmpty: true },
        ],
      },
    ],
  };

  it('evaluates both rules independently — both pass', () => {
    expect(evaluateConstraints(document, { x: 'val', p: 'val' })).toHaveLength(0);
  });

  it('evaluates both rules independently — only rule-a fails', () => {
    const violations = evaluateConstraints(document, { p: 'val' });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('rule-a');
  });

  it('evaluates both rules independently — only rule-b fails (zero matches)', () => {
    const violations = evaluateConstraints(document, { x: 'val' });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('rule-b');
  });

  it('evaluates both rules independently — only rule-b fails (two matches)', () => {
    const violations = evaluateConstraints(document, { x: 'val', p: 'val', q: 'val' });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('rule-b');
  });

  it('evaluates both rules independently — both fail', () => {
    const violations = evaluateConstraints(document, {});
    expect(violations).toHaveLength(2);
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).toContain('rule-a');
    expect(ruleIds).toContain('rule-b');
  });
});

// ---------------------------------------------------------------------------
// defineConstraints — identity helper
// ---------------------------------------------------------------------------

describe('defineConstraints', () => {
  it('returns the argument unchanged', () => {
    const document: ConstraintsDocument = {
      component: 'button',
      summary: 'Test',
      rules: [],
    };
    expect(defineConstraints(document)).toBe(document);
  });
});

// ---------------------------------------------------------------------------
// isNonEmpty — false is treated as empty (Svelte snippet={false} means absent)
// ---------------------------------------------------------------------------

describe('evaluatePredicate — false is treated as empty', () => {
  it('treats false as empty for nonEmpty predicates', () => {
    expect(evaluatePredicate({ prop: 'label', nonEmpty: true }, { label: false })).toBe(false);
  });

  it('treats false as empty for snippet predicates', () => {
    // Svelte Snippet props are either a Snippet object or undefined; false is "not passed".
    expect(evaluatePredicate({ snippet: 'children' }, { children: false })).toBe(false);
  });

  it('still treats exists as true for false (key is present)', () => {
    expect(evaluatePredicate({ prop: 'disabled', exists: true }, { disabled: false })).toBe(true);
  });
});
