/**
 * Exhaustive tests for template placeholder domain logic.
 * DEP-582: Pure functions with no ProseMirror or DOM dependencies.
 * DEP-625: Comprehensive security tests for prototype pollution and XSS prevention.
 */

import { describe, expect, it } from 'bun:test';
import { runInNewContext } from 'node:vm';

import { sortPlaceholderDiagnostics } from './placeholder-definition-data.js';
import { isBlockedSegment, isReservedSegment } from './placeholder-security.js';
import {
  buildPlaceholderCandidatesFromJsonSchema,
  normalizePlaceholderDefinitions,
  parseMarkdownPlaceholderTokens,
  parsePlaceholderTokens,
  resolveTemplatePlaceholders,
  validatePlaceholderTokens,
} from './template-placeholders.js';
import type { PlaceholderDefinitions, PlaceholderDiagnostic } from './types.ts';

describe('validatePlaceholderTokens', () => {
  const candidates = [
    { path: 'name', types: ['string'] as const },
    { path: 'age', types: ['number'] as const },
    { path: 'input.x', types: ['string'] as const },
  ];

  it('reports malformed_token without a path for an unclosed token', () => {
    const tokens = parsePlaceholderTokens('{{name');

    expect(validatePlaceholderTokens(tokens, candidates)).toEqual([
      {
        code: 'malformed_token',
        message: expect.any(String),
        location: { kind: 'token', startOffset: 0, endOffset: 6 },
      },
    ]);
  });

  const invalidPaths = [
    ['numeric start', '123'],
    ['double dot', 'a..b'],
    ['empty string', ''],
    ['leading dot', '.a'],
    ['inner space', 'a b'],
  ] as const;

  it.each(invalidPaths)(
    'reports invalid_path_format for path with %s ("%s")',
    (_label, pathValue) => {
      const text = `{{${pathValue}}}`;
      const issues = validatePlaceholderTokens(parsePlaceholderTokens(text), candidates);

      expect(issues).toEqual([
        {
          code: 'invalid_path_format',
          message: expect.any(String),
          path: pathValue,
          location: { kind: 'token', startOffset: 0, endOffset: text.length },
        },
      ]);
    },
  );

  it('reports unknown_placeholder for valid-format path not in candidate set', () => {
    const issues = validatePlaceholderTokens(
      parsePlaceholderTokens('{{unknown_field}}'),
      candidates,
    );

    expect(issues.map((issue) => [issue.code, issue.path])).toEqual([
      ['unknown_placeholder', 'unknown_field'],
    ]);
  });

  it('reports no issues for a declared token', () => {
    expect(validatePlaceholderTokens(parsePlaceholderTokens('{{ name }}'), candidates)).toEqual([]);
  });

  it('orders mixed issues by source offset', () => {
    const text = '{{name}} and {{}} and {{unknown}} and {{constructor}} and {{input.x';
    const issues = validatePlaceholderTokens(parsePlaceholderTokens(text), candidates);

    expect(
      issues.map((issue) => [
        issue.code,
        issue.location.kind === 'token' ? issue.location.startOffset : -1,
      ]),
    ).toEqual([
      ['invalid_path_format', text.indexOf('{{}}')],
      ['unknown_placeholder', text.indexOf('{{unknown}}')],
      ['blocked_path', text.indexOf('{{constructor}}')],
      ['malformed_token', text.indexOf('{{input.x')],
    ]);
  });

  it('carries the original token range in each diagnostic location', () => {
    const text = 'prefix {{bad..path}} suffix';
    const [issue] = validatePlaceholderTokens(parsePlaceholderTokens(text), candidates);

    expect(issue?.location).toEqual({ kind: 'token', startOffset: 7, endOffset: 20 });
    expect(text.slice(7, 20)).toBe('{{bad..path}}');
  });

  it('validates Markdown-scanned tokens with original offsets', () => {
    const text = '`{{code}}` and **{{unknown}}**';
    const issues = validatePlaceholderTokens(parseMarkdownPlaceholderTokens(text), candidates);

    expect(issues.map((issue) => issue.location)).toEqual([
      {
        kind: 'token',
        startOffset: text.indexOf('{{unknown}}'),
        endOffset: text.indexOf('{{unknown}}') + '{{unknown}}'.length,
      },
    ]);
  });
});

/** Asymmetric matcher standing in for any diagnostic message. */
const ANY_MESSAGE = expect.any(String) as unknown as string;

function definitionIssue(
  code: PlaceholderDiagnostic['code'],
  pointer: string,
  path?: string,
): PlaceholderDiagnostic {
  return {
    code,
    message: ANY_MESSAGE,
    ...(path === undefined ? {} : { path }),
    location: { kind: 'definition', pointer },
  };
}

const INVALID_DEFINITIONS_CONFIGURATION: PlaceholderDiagnostic = {
  code: 'invalid_definitions',
  message: ANY_MESSAGE,
  location: { kind: 'configuration', property: 'definitions' },
};

function normalizeCandidates(
  candidates: unknown,
): ReturnType<typeof normalizePlaceholderDefinitions> {
  return normalizePlaceholderDefinitions({ candidates });
}

function candidateCodes(candidates: unknown): string[] {
  return normalizeCandidates(candidates).issues.map((issue) =>
    issue.location.kind === 'definition' ? `${issue.code} ${issue.location.pointer}` : issue.code,
  );
}

describe('normalizePlaceholderDefinitions definitions boundary', () => {
  it('normalizes the schema arm into an enabled catalog', () => {
    const definitions: PlaceholderDefinitions = {
      schema: {
        type: 'object',
        properties: { user: { properties: { name: { type: 'string' } } } },
      },
    };

    expect(normalizePlaceholderDefinitions(definitions)).toEqual({
      candidates: [{ path: 'user' }, { path: 'user.name', types: ['string'] }],
      issues: [],
      enabled: true,
    });
  });

  it('normalizes the explicit candidates arm into a sorted enabled catalog', () => {
    const definitions: PlaceholderDefinitions = {
      candidates: [
        { path: 'total', types: ['integer', 'number'], title: 'Total' },
        { path: 'items' },
        { path: 'Zeta', description: 'Upper-case sorts first' },
      ],
    };

    expect(normalizePlaceholderDefinitions(definitions)).toEqual({
      candidates: [
        { path: 'Zeta', description: 'Upper-case sorts first' },
        { path: 'items' },
        { path: 'total', types: ['number', 'integer'], title: 'Total' },
      ],
      issues: [],
      enabled: true,
    });
  });

  it('keeps valid empty definitions enabled while permitting no paths', () => {
    expect(normalizePlaceholderDefinitions({ candidates: [] })).toEqual({
      candidates: [],
      issues: [],
      enabled: true,
    });
    expect(normalizePlaceholderDefinitions({ schema: {} })).toEqual({
      candidates: [],
      issues: [],
      enabled: true,
    });
  });

  it('rejects neither and both arms with a configuration diagnostic', () => {
    expect(normalizePlaceholderDefinitions({})).toEqual({
      candidates: [],
      issues: [INVALID_DEFINITIONS_CONFIGURATION],
      enabled: false,
    });
    expect(
      normalizePlaceholderDefinitions({ schema: { type: 'object' }, candidates: [{ path: 'a' }] }),
    ).toEqual({ candidates: [], issues: [INVALID_DEFINITIONS_CONFIGURATION], enabled: false });
  });

  it('treats an explicitly undefined arm as absent', () => {
    expect(
      normalizePlaceholderDefinitions({ schema: undefined, candidates: [{ path: 'a' }] }),
    ).toEqual({
      candidates: [{ path: 'a' }],
      issues: [],
      enabled: true,
    });
    expect(normalizePlaceholderDefinitions({ schema: undefined })).toEqual({
      candidates: [],
      issues: [INVALID_DEFINITIONS_CONFIGURATION],
      enabled: false,
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an array', [{ candidates: [] }]],
    ['a string', 'schema'],
    [
      'a class instance',
      new (class Definitions {
        candidates = [];
      })(),
    ],
    ['a foreign-realm object', runInNewContext('({ candidates: [] })')],
  ])('rejects definitions that are %s as configuration', (_label, definitions) => {
    expect(normalizePlaceholderDefinitions(definitions)).toEqual({
      candidates: [],
      issues: [INVALID_DEFINITIONS_CONFIGURATION],
      enabled: false,
    });
  });

  it('accepts null-prototype definitions and candidates', () => {
    const candidate = Object.assign(Object.create(null) as Record<string, unknown>, { path: 'a' });
    const definitions = Object.assign(Object.create(null) as Record<string, unknown>, {
      candidates: [candidate],
    });

    expect(normalizePlaceholderDefinitions(definitions)).toEqual({
      candidates: [{ path: 'a' }],
      issues: [],
      enabled: true,
    });
  });

  it('reports unknown definition keys at their escaped pointer and disables the catalog', () => {
    expect(
      normalizePlaceholderDefinitions({
        candidates: [{ path: 'a' }],
        'extra/key': true,
        values: {},
      }),
    ).toEqual({
      candidates: [{ path: 'a' }],
      issues: [
        definitionIssue('invalid_definitions', '/extra~1key'),
        definitionIssue('invalid_definitions', '/values'),
      ],
      enabled: false,
    });
  });

  it('reports an accessor arm without invoking it', () => {
    let reads = 0;
    const definitions = {};
    Object.defineProperty(definitions, 'schema', {
      enumerable: true,
      get() {
        reads++;
        return {};
      },
    });

    expect(normalizePlaceholderDefinitions(definitions)).toEqual({
      candidates: [],
      issues: [definitionIssue('invalid_definitions', '/schema')],
      enabled: false,
    });
    expect(reads).toBe(0);
  });

  it('disables the catalog for schema issues while retaining valid partial candidates', () => {
    const result = normalizePlaceholderDefinitions({
      schema: { type: 'object', properties: { bad: { type: [] }, good: { type: 'string' } } },
    });

    expect(result).toEqual({
      candidates: [{ path: 'good', types: ['string'] }],
      issues: [definitionIssue('invalid_schema', '/schema/properties/bad/type', 'bad')],
      enabled: false,
    });
  });
});

describe('normalizePlaceholderDefinitions explicit candidates', () => {
  it.each([
    ['an object', { path: 'a' }],
    ['a string', 'a'],
    ['null', null],
  ])('reports candidates that are %s at /candidates', (_label, candidates) => {
    expect(candidateCodes(candidates)).toEqual(['invalid_definitions /candidates']);
  });

  it('reports sparse and accessor candidate arrays at /candidates without reading them', () => {
    let reads = 0;
    const withAccessor: unknown[] = [];
    Object.defineProperty(withAccessor, '0', {
      enumerable: true,
      get() {
        reads++;
        return { path: 'a' };
      },
    });

    const sparse: unknown[] = [];
    sparse[0] = { path: 'a' };
    sparse[2] = { path: 'b' };

    expect(candidateCodes(sparse)).toEqual(['invalid_definitions /candidates']);
    expect(candidateCodes(withAccessor)).toEqual(['invalid_definitions /candidates']);
    expect(reads).toBe(0);
  });

  it('reports non-plain candidates at their index and keeps valid entries', () => {
    class Candidate {
      path = 'instance';
    }
    const result = normalizeCandidates([
      null,
      'path',
      ['path'],
      new Candidate(),
      runInNewContext('({ path: "foreign" })'),
      { path: 'valid' },
    ]);

    expect(result.issues).toEqual([
      definitionIssue('invalid_candidate', '/candidates/0'),
      definitionIssue('invalid_candidate', '/candidates/1'),
      definitionIssue('invalid_candidate', '/candidates/2'),
      definitionIssue('invalid_candidate', '/candidates/3'),
      definitionIssue('invalid_candidate', '/candidates/4'),
    ]);
    expect(result.candidates).toEqual([{ path: 'valid' }]);
    expect(result.enabled).toBe(false);
  });

  it('rejects unknown candidate fields, including the removed valueKind', () => {
    expect(candidateCodes([{ path: 'a', valueKind: 'string', 'odd~field': 1 }])).toEqual([
      'invalid_candidate /candidates/0/odd~0field',
      'invalid_candidate /candidates/0/valueKind',
    ]);
  });

  it.each([
    ['missing', {}],
    ['empty', { path: '' }],
    ['a number', { path: 1 }],
    ['undefined', { path: undefined }],
  ])('reports a path that is %s as invalid_candidate', (_label, candidate) => {
    expect(candidateCodes([candidate])).toEqual(['invalid_candidate /candidates/0/path']);
  });

  it.each(['1abc', 'a..b', '.a', 'a.', 'first-name', 'a b', 'ünïcode', 'items.0'])(
    'reports malformed path "%s" as invalid_path_format',
    (path) => {
      expect(normalizeCandidates([{ path }]).issues).toEqual([
        definitionIssue('invalid_path_format', '/candidates/0/path', path),
      ]);
    },
  );

  it.each(['__proto__', 'user.constructor', 'user.Prototype', 'VALUEOF', '__custom', 'a.__b'])(
    'reports reserved path "%s" as blocked_path',
    (path) => {
      expect(normalizeCandidates([{ path }]).issues).toEqual([
        definitionIssue('blocked_path', '/candidates/0/path', path),
      ]);
    },
  );

  it.each([
    ['an empty list', []],
    ['a duplicate entry', ['string', 'string']],
    ['an unknown name', ['text']],
    ['a non-string entry', [1]],
    ['a bare string', 'string'],
    ['null', null],
  ])('reports types declared as %s as invalid_candidate', (_label, types) => {
    const result = normalizeCandidates([{ path: 'a', types }]);

    expect(result.issues).toEqual([
      definitionIssue('invalid_candidate', '/candidates/0/types', 'a'),
    ]);
    expect(result.candidates).toEqual([]);
  });

  it('reports non-string title and description', () => {
    expect(candidateCodes([{ path: 'a', title: 1, description: null }])).toEqual([
      'invalid_candidate /candidates/0/description',
      'invalid_candidate /candidates/0/title',
    ]);
  });

  it('normalizes explicit undefined optional fields to absent', () => {
    expect(
      normalizeCandidates([
        { path: 'a', types: undefined, title: undefined, description: undefined },
      ]),
    ).toEqual({ candidates: [{ path: 'a' }], issues: [], enabled: true });
  });

  it('reports a duplicate path even when the earlier declaration has invalid metadata', () => {
    const result = normalizeCandidates([{ path: 'a', title: 1 }, { path: 'a' }]);

    expect(result.issues).toEqual([
      definitionIssue('invalid_candidate', '/candidates/0/title', 'a'),
      definitionIssue('duplicate_candidate', '/candidates/1/path', 'a'),
    ]);
    expect(result.candidates).toEqual([]);
    expect(result.enabled).toBe(false);
  });

  it('reports each later duplicate path and keeps the first declaration', () => {
    const result = normalizeCandidates([
      { path: 'a', title: 'First' },
      { path: 'b' },
      { path: 'a', title: 'Second' },
      { path: 'a' },
    ]);

    expect(result.issues).toEqual([
      definitionIssue('duplicate_candidate', '/candidates/2/path', 'a'),
      definitionIssue('duplicate_candidate', '/candidates/3/path', 'a'),
    ]);
    expect(result.candidates).toEqual([{ path: 'a', title: 'First' }, { path: 'b' }]);
  });

  it('reports accessor candidate fields without invoking them', () => {
    let reads = 0;
    const candidate = {};
    for (const field of ['path', 'types', 'title']) {
      Object.defineProperty(candidate, field, {
        enumerable: true,
        get() {
          reads++;
          return 'a';
        },
      });
    }

    expect(candidateCodes([candidate])).toEqual([
      'invalid_candidate /candidates/0/path',
      'invalid_candidate /candidates/0/title',
      'invalid_candidate /candidates/0/types',
    ]);
    expect(reads).toBe(0);
  });
});

describe('placeholder diagnostic ordering', () => {
  it('sorts definition and configuration issues before tokens and removes identical duplicates', () => {
    const token = (
      startOffset: number,
      code: PlaceholderDiagnostic['code'],
    ): PlaceholderDiagnostic => ({
      code,
      message: code,
      location: { kind: 'token', startOffset, endOffset: startOffset + 4 },
    });
    const definition: PlaceholderDiagnostic = {
      code: 'invalid_schema',
      message: 'invalid',
      location: { kind: 'definition', pointer: '/schema/type' },
    };
    const configuration: PlaceholderDiagnostic = {
      code: 'invalid_definitions',
      message: 'invalid',
      location: { kind: 'configuration', property: 'definitions' },
    };

    expect(
      sortPlaceholderDiagnostics([
        token(10, 'unknown_placeholder'),
        token(2, 'missing_value'),
        token(2, 'invalid_value'),
        definition,
        configuration,
        { ...definition },
      ]),
    ).toEqual([
      definition,
      configuration,
      token(2, 'invalid_value'),
      token(2, 'missing_value'),
      token(10, 'unknown_placeholder'),
    ]);
  });
});

describe('reserved segment predicate', () => {
  it('is shared by schema traversal, candidate validation and resolution', () => {
    const reserved = ['__proto__', 'Constructor', 'PROTOTYPE', 'hasOwnProperty', '__anything'];

    for (const segment of reserved) {
      expect(isReservedSegment(segment)).toBe(true);
      expect(isBlockedSegment(segment)).toBe(true);
      expect(normalizeCandidates([{ path: segment }]).issues[0]?.code).toBe('blocked_path');
      const schemaIssues = buildPlaceholderCandidatesFromJsonSchema({
        properties: JSON.parse(`{"${segment}": {"type": "string"}}`) as Record<string, unknown>,
      }).issues;
      expect(schemaIssues[0]?.code).toBe('blocked_path');
    }
    expect(isReservedSegment('name')).toBe(false);
    expect(isReservedSegment('_private')).toBe(false);
  });

  it('separates malformed segments from reserved ones', () => {
    expect(isReservedSegment('first-name')).toBe(false);
    expect(isBlockedSegment('first-name')).toBe(true);
    expect(isBlockedSegment('')).toBe(true);
    expect(isBlockedSegment('name')).toBe(false);
  });

  it('still serializes unaddressable keys inside a whole object value', () => {
    const { candidates } = buildPlaceholderCandidatesFromJsonSchema({
      properties: { user: { type: 'object' } },
    });

    const result = resolveTemplatePlaceholders(
      '{{user}}',
      { user: { 'first-name': 'Ada', 'dotted.key': 1 } },
      { definitions: { candidates }, valueMode: 'markdown' },
    );

    expect(result).toEqual({
      text: '&#123;&#34;dotted&#46;key&#34;&#58;1&#44;&#34;first&#45;name&#34;&#58;&#34;Ada&#34;&#125;',
      issues: [],
    });
  });
});
