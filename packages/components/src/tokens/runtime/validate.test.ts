import { describe, expect, test } from 'bun:test';

import { TokenValidationError } from './types.ts';
import { validateResolverDocument } from './validate-resolver.ts';
import { validateTokenDocumentSchema } from './validate-schema.ts';
import { validateTokenDocument } from './validate-tokens.ts';
import { assertValidResolverDocument } from './validate.ts';

/** The path-addressed reasons a validator reports for `run`, or a failure if it reports none. */
function issuesOf(run: () => void): Array<{ path: string; reason: string }> {
  try {
    run();
  } catch (error) {
    if (error instanceof TokenValidationError) return error.issues;
    throw error;
  }
  throw new Error('expected the validator to report issues');
}

const order = [{ $ref: '#/sets/shared' }];
const sets = { shared: { sources: [{ $ref: 'shared.tokens.json' }] } };

describe('the semantic token validator, run without the schema gate', () => {
  test('reports an unknown $type on a group or token', () => {
    const issues = issuesOf(() =>
      validateTokenDocument({ $type: 'bogus', a: { $value: 1 } }, 'doc.json'),
    );
    expect(issues).toContainEqual({ path: 'doc.json', reason: 'unknown $type "bogus"' });
  });

  test('reports a $root that is not a token object', () => {
    const issues = issuesOf(() => validateTokenDocument({ group: { $root: 'nope' } }));
    expect(issues).toContainEqual({
      path: '$.group.$root',
      reason: '$root must be a token object',
    });
  });

  test('reports a child that is neither a token nor a group', () => {
    const issues = issuesOf(() => validateTokenDocument({ $type: 'number', a: 'not an object' }));
    expect(issues).toContainEqual({ path: '$.a', reason: 'token or group must be an object' });
  });

  test('reports a composite member that is missing', () => {
    const issues = issuesOf(() =>
      validateTokenDocument({ shadow: { $type: 'shadow', $value: {} } }),
    );
    expect(issues.map((issue) => issue.reason)).toContain('composite value must include color');
  });

  test('reports a shadow layer that is not an object', () => {
    const issues = issuesOf(() =>
      validateTokenDocument({ shadow: { $type: 'shadow', $value: [1] } }),
    );
    expect(issues).toContainEqual({ path: '$.shadow.0', reason: 'shadow must be an object' });
  });

  test('reports a gradient stop that is not an object', () => {
    const issues = issuesOf(() =>
      validateTokenDocument({ ramp: { $type: 'gradient', $value: [1, 2] } }),
    );
    expect(issues).toContainEqual({
      path: '$.ramp.0',
      reason: 'gradient stop must be an object',
    });
  });
});

describe('the schema gate over a document with arrays where groups belong', () => {
  test('rejects an array in place of a group, naming its path', () => {
    const issues = issuesOf(() =>
      validateTokenDocumentSchema({ group: { list: [{ $value: 1 }] } }, 'doc.json'),
    );
    expect(issues.map((issue) => issue.path)).toContain('doc.json.group.list');
  });
});

describe('the semantic resolver validator, run without the schema gate', () => {
  test('reports a modifier with no contexts object', () => {
    const issues = issuesOf(() =>
      validateResolverDocument({
        version: '2025.10',
        sets,
        modifiers: { theme: 1 },
        resolutionOrder: order,
      }),
    );
    expect(issues).toContainEqual({
      path: '$.modifiers.theme',
      reason: 'modifier must have a contexts object',
    });
  });

  test('reports a resolution order entry that is not a $ref object', () => {
    const issues = issuesOf(() =>
      validateResolverDocument({
        version: '2025.10',
        sets,
        modifiers: {},
        resolutionOrder: [...order, 1],
      }),
    );
    expect(issues).toContainEqual({
      path: '$.resolutionOrder.1',
      reason: 'resolutionOrder entry must be a $ref object',
    });
  });

  test('assertValidResolverDocument rejects a resolver that omits its sets or modifiers', () => {
    expect(
      issuesOf(() =>
        assertValidResolverDocument({ version: '2025.10', modifiers: {}, resolutionOrder: order }),
      ),
    ).toEqual([
      { path: '$', reason: 'resolver must contain version, sets, modifiers, and resolutionOrder' },
    ]);
  });
});
