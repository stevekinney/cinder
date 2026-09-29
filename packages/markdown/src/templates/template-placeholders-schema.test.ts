/**
 * Tests for JSON Schema placeholder catalog extraction (COR-523).
 * DEP-582: Pure functions with no ProseMirror or DOM dependencies.
 */

import { describe, expect, it, spyOn } from 'bun:test';
import { runInNewContext } from 'node:vm';

import { buildPlaceholderCandidatesFromJsonSchema } from './template-placeholders.js';
import type { JsonSchemaObject, PlaceholderDiagnostic, PlaceholderSchemaType } from './types.ts';

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

function paths(schema: JsonSchemaObject): string[] {
  return buildPlaceholderCandidatesFromJsonSchema(schema).candidates.map(
    (candidate) => candidate.path,
  );
}

function codesAndPointers(schema: JsonSchemaObject): string[] {
  return buildPlaceholderCandidatesFromJsonSchema(schema).issues.map((issue) =>
    issue.location.kind === 'definition' ? `${issue.code} ${issue.location.pointer}` : issue.code,
  );
}

let stackFrames = 0;

function descend(remaining: number, callback: () => void): void {
  stackFrames++;
  if (remaining === 0) {
    callback();
    return;
  }
  descend(remaining - 1, callback);
}

/** Run `callback` with only `headroom` frames of `descend` left before a stack overflow. */
function runNearStackLimit(headroom: number, callback: () => void): void {
  let limit = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    stackFrames = 0;
    try {
      descend(Number.MAX_SAFE_INTEGER, () => {});
    } catch {
      limit = stackFrames;
    }
  }
  descend(limit - headroom, callback);
}

describe('buildPlaceholderCandidatesFromJsonSchema result shape', () => {
  it('returns sorted candidates with type metadata and an empty issue list', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', description: 'The name' },
        count: { type: 'integer' },
        age: { type: ['null', 'number'] },
      },
    };

    expect(buildPlaceholderCandidatesFromJsonSchema(schema)).toEqual({
      candidates: [
        { path: 'age', types: ['number', 'null'] },
        { path: 'count', types: ['integer'] },
        { path: 'name', types: ['string'], title: 'Name', description: 'The name' },
      ],
      issues: [],
    });
  });

  it('returns an empty catalog for a schema with no properties', () => {
    expect(buildPlaceholderCandidatesFromJsonSchema({})).toEqual({ candidates: [], issues: [] });
    expect(buildPlaceholderCandidatesFromJsonSchema({ type: 'object' })).toEqual({
      candidates: [],
      issues: [],
    });
    expect(buildPlaceholderCandidatesFromJsonSchema({ properties: {} })).toEqual({
      candidates: [],
      issues: [],
    });
  });
});

describe('buildPlaceholderCandidatesFromJsonSchema candidates', () => {
  it('emits parent and child paths for nested object schema in code-unit order', () => {
    const schema = {
      type: 'object',
      properties: {
        input: {
          type: 'object',
          properties: { y: { type: 'number' }, x: { type: 'string' }, Z: { type: 'string' } },
        },
      },
    };

    expect(paths(schema)).toEqual(['input', 'input.Z', 'input.x', 'input.y']);
  });

  it('emits all intermediate and leaf paths for deeply nested schema (3+ levels)', () => {
    const schema = {
      type: 'object',
      properties: {
        a: {
          type: 'object',
          properties: {
            b: {
              type: 'object',
              properties: { c: { type: 'object', properties: { d: { type: 'string' } } } },
            },
          },
        },
      },
    };

    expect(paths(schema)).toEqual(['a', 'a.b', 'a.b.c', 'a.b.c.d']);
  });

  it('recurses into nested properties when type is absent and reports unknown metadata', () => {
    const schema = {
      type: 'object',
      properties: { container: { properties: { inner: { type: 'string' } } } },
    };

    expect(buildPlaceholderCandidatesFromJsonSchema(schema).candidates).toEqual([
      { path: 'container' },
      { path: 'container.inner', types: ['string'] },
    ]);
  });

  it('emits a whole-array candidate and never expands items into indexed paths', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'object', properties: { label: { type: 'string' } } },
        },
      },
    };

    expect(buildPlaceholderCandidatesFromJsonSchema(schema)).toEqual({
      candidates: [{ path: 'tags', types: ['array'] }],
      issues: [],
    });
  });

  it('represents every JSON type, keeping integer distinct from number', () => {
    const schemaTypes: PlaceholderSchemaType[] = [
      'string',
      'number',
      'integer',
      'boolean',
      'null',
      'object',
      'array',
    ];
    const properties = Object.fromEntries(schemaTypes.map((type) => [`${type}_value`, { type }]));

    const { candidates, issues } = buildPlaceholderCandidatesFromJsonSchema({
      type: 'object',
      properties,
    });

    expect(issues).toEqual([]);
    for (const type of schemaTypes) {
      expect(candidates.find((candidate) => candidate.path === `${type}_value`)?.types).toEqual([
        type,
      ]);
    }
  });

  it('normalizes type unions into enumeration order without collapsing them', () => {
    const schema = {
      type: 'object',
      properties: {
        amount: { type: ['integer', 'number'] },
        everything: {
          type: ['array', 'object', 'null', 'boolean', 'integer', 'number', 'string'],
        },
      },
    };

    expect(buildPlaceholderCandidatesFromJsonSchema(schema).candidates).toEqual([
      { path: 'amount', types: ['number', 'integer'] },
      {
        path: 'everything',
        types: ['string', 'number', 'integer', 'boolean', 'null', 'object', 'array'],
      },
    ]);
  });

  it('uses title and description as metadata and never turns values into metadata', () => {
    const schema = {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          title: 'Status',
          description: 'Current status',
          default: 'DEFAULT_SECRET',
          examples: ['EXAMPLE_SECRET'],
          enum: ['ENUM_SECRET'],
          const: 'CONST_SECRET',
        },
      },
    };

    const result = buildPlaceholderCandidatesFromJsonSchema(schema);

    expect(result).toEqual({
      candidates: [
        { path: 'status', types: ['string'], title: 'Status', description: 'Current status' },
      ],
      issues: [],
    });
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });

  it('visits a shared acyclic schema object at each path that declares it', () => {
    const shared = { type: 'object', properties: { x: { type: 'string' } } };
    const schema = { type: 'object', properties: { a: shared, b: shared } };

    expect(paths(schema)).toEqual(['a', 'a.x', 'b', 'b.x']);
    expect(codesAndPointers(schema)).toEqual([]);
  });

  it('accepts null-prototype schema objects', () => {
    const name = Object.assign(Object.create(null) as Record<string, unknown>, { type: 'string' });
    const properties = Object.assign(Object.create(null) as Record<string, unknown>, { name });
    const schema = Object.assign(Object.create(null) as Record<string, unknown>, { properties });

    expect(buildPlaceholderCandidatesFromJsonSchema(schema)).toEqual({
      candidates: [{ path: 'name', types: ['string'] }],
      issues: [],
    });
  });

  it('traverses iteratively, so deep schemas cannot overflow the call stack', () => {
    const depth = 3000;
    let node: Record<string, unknown> = { type: 'string' };
    for (let level = 0; level < depth; level++) {
      node = { type: 'object', properties: { a: node } };
    }
    const schema = { type: 'object', properties: { a: node } };

    let candidateCount = 0;
    runNearStackLimit(1000, () => {
      candidateCount = buildPlaceholderCandidatesFromJsonSchema(schema).candidates.length;
    });

    expect(candidateCount).toBe(depth + 1);
  });
});

describe('buildPlaceholderCandidatesFromJsonSchema supported and inert keywords', () => {
  const unsupportedKeywords = [
    '$ref',
    'allOf',
    'anyOf',
    'oneOf',
    'if',
    'then',
    'else',
    'patternProperties',
  ];

  it.each(unsupportedKeywords)('reports unsupported "%s" on the root schema', (keyword) => {
    const schema = {
      type: 'object',
      properties: { field: { type: 'string' } },
      [keyword]:
        keyword === '$ref'
          ? '#/$defs/Foo'
          : { properties: { inferred: { type: 'string' } }, type: 'object' },
    };

    const result = buildPlaceholderCandidatesFromJsonSchema(schema);

    expect(result.issues).toEqual([
      definitionIssue('unsupported_schema', `/schema/${keyword.replace('/', '~1')}`),
    ]);
    expect(result.candidates.map((candidate) => candidate.path)).toEqual(['field']);
  });

  it.each(unsupportedKeywords)(
    'reports unsupported "%s" on a property schema without following it',
    (keyword) => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: { name: { type: 'string' } },
            [keyword]:
              keyword === '$ref'
                ? '#/$defs/User'
                : [{ properties: { inferred: { type: 'string' } } }],
          },
        },
      };

      expect(codesAndPointers(schema)).toEqual([
        `unsupported_schema /schema/properties/user/${keyword}`,
      ]);
      expect(paths(schema)).toEqual(['user', 'user.name']);
    },
  );

  it('reports schema-valued additionalProperties and ignores boolean additionalProperties', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        open: { type: 'object', additionalProperties: true },
        mapped: { type: 'object', additionalProperties: { type: 'string' } },
      },
    };

    expect(codesAndPointers(schema)).toEqual([
      'unsupported_schema /schema/properties/mapped/additionalProperties',
    ]);
    expect(paths(schema)).toEqual(['mapped', 'open']);
  });

  it('never fetches a remote $ref', () => {
    const fetchSpy = spyOn(globalThis, 'fetch');
    try {
      const schema = {
        type: 'object',
        properties: { remote: { $ref: 'https://example.com/schema.json' } },
      };

      expect(codesAndPointers(schema)).toEqual([
        'unsupported_schema /schema/properties/remote/$ref',
      ]);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('treats constraints, unused $defs, items contents and annotations as inert', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/root',
      $comment: 'annotation',
      $defs: { unused: { $ref: '#/nowhere', allOf: [] } },
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 10,
          pattern: '^[a-z]+$',
          format: 'email',
          readOnly: true,
          deprecated: false,
        },
        count: { type: 'integer', minimum: 0, maximum: 5, multipleOf: 1 },
        list: { type: 'array', items: { $ref: '#/$defs/unused', anyOf: [] }, minItems: 1 },
      },
    };

    expect(buildPlaceholderCandidatesFromJsonSchema(schema)).toEqual({
      candidates: [
        { path: 'count', types: ['integer'] },
        { path: 'list', types: ['array'] },
        { path: 'name', types: ['string'] },
      ],
      issues: [],
    });
  });
});

describe('buildPlaceholderCandidatesFromJsonSchema malformed schemas', () => {
  const malformedTypes: [string, unknown][] = [
    ['an empty list', []],
    ['a duplicate entry', ['string', 'string']],
    ['an unknown name', 'text'],
    ['an unknown name in a list', ['string', 'text']],
    ['a non-string entry', ['string', 1]],
    ['a number', 1],
    ['null', null],
    ['an object', { type: 'string' }],
  ];

  it.each(malformedTypes)(
    'reports a property type declared as %s once at its /type pointer',
    (_label, type) => {
      const schema = {
        type: 'object',
        properties: {
          bad: { type, properties: { child: { type: 'string' } } },
          good: { type: 'string' },
        },
      };

      const result = buildPlaceholderCandidatesFromJsonSchema(schema);

      expect(result.issues).toEqual([
        definitionIssue('invalid_schema', '/schema/properties/bad/type', 'bad'),
      ]);
      expect(result.candidates).toEqual([{ path: 'good', types: ['string'] }]);
    },
  );

  it.each([['array'], ['string'], [['object']], [['object', 'null']], [1], [null]])(
    'reports root type %p at /schema/type and emits no candidates',
    (type) => {
      const schema = { type, properties: { name: { type: 'string' } } };

      expect(buildPlaceholderCandidatesFromJsonSchema(schema)).toEqual({
        candidates: [],
        issues: [definitionIssue('invalid_schema', '/schema/type')],
      });
    },
  );

  it.each([
    ['an array', []],
    ['null', null],
    ['a boolean schema', true],
    [
      'a class instance',
      new (class Schema {
        type = 'object';
      })(),
    ],
  ])('reports a root schema that is %s at /schema', (_label, schema) => {
    expect(buildPlaceholderCandidatesFromJsonSchema(schema as unknown as JsonSchemaObject)).toEqual(
      {
        candidates: [],
        issues: [definitionIssue('invalid_schema', '/schema')],
      },
    );
  });

  it('reports non-plain properties on the root and on a property', () => {
    expect(codesAndPointers({ type: 'object', properties: ['name'] })).toEqual([
      'invalid_schema /schema/properties',
    ]);
    expect(codesAndPointers({ properties: { user: { properties: 'name' } } })).toEqual([
      'invalid_schema /schema/properties/user/properties',
    ]);
  });

  it('reports boolean, null and array property schemas and keeps valid siblings', () => {
    const schema = {
      type: 'object',
      properties: { flag: true, empty: null, list: [], name: { type: 'string' } },
    };

    expect(codesAndPointers(schema)).toEqual([
      'invalid_schema /schema/properties/empty',
      'invalid_schema /schema/properties/flag',
      'invalid_schema /schema/properties/list',
    ]);
    expect(paths(schema)).toEqual(['name']);
  });

  it('reports properties attached to an explicitly non-object type', () => {
    const schema = {
      type: 'object',
      properties: {
        label: { type: 'string', properties: { inner: { type: 'string' } } },
        maybe: { type: ['object', 'null'], properties: { inner: { type: 'string' } } },
      },
    };

    expect(codesAndPointers(schema)).toEqual([
      'invalid_schema /schema/properties/label/properties',
    ]);
    expect(paths(schema)).toEqual(['label', 'maybe', 'maybe.inner']);
  });

  it('reports non-string title and description and drops only that metadata', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string', title: 1, description: { text: 'x' } } },
    };

    expect(buildPlaceholderCandidatesFromJsonSchema(schema)).toEqual({
      candidates: [{ path: 'name', types: ['string'] }],
      issues: [
        definitionIssue('invalid_schema', '/schema/properties/name/description', 'name'),
        definitionIssue('invalid_schema', '/schema/properties/name/title', 'name'),
      ],
    });
  });

  it('reports cycles on the active ancestry at the repeated node', () => {
    const node: Record<string, unknown> = { type: 'object' };
    node['properties'] = { self: node, leaf: { type: 'string' } };
    const root: Record<string, unknown> = { type: 'object' };
    root['properties'] = { node, again: root };

    const result = buildPlaceholderCandidatesFromJsonSchema(root);

    expect(result.issues).toEqual([
      definitionIssue('cyclic_schema', '/schema/properties/again', 'again'),
      definitionIssue('cyclic_schema', '/schema/properties/node/properties/self', 'node.self'),
    ]);
    expect(result.candidates.map((candidate) => candidate.path)).toEqual(['node', 'node.leaf']);
  });

  it('orders diagnostics by pointer and then code, independent of key order', () => {
    const forward = {
      type: 'object',
      properties: { b: { type: 'nope', allOf: [] }, a: { type: 'nope' } },
    };
    const reversed = {
      type: 'object',
      properties: { a: { type: 'nope' }, b: { allOf: [], type: 'nope' } },
    };

    const expected = [
      'invalid_schema /schema/properties/a/type',
      'unsupported_schema /schema/properties/b/allOf',
      'invalid_schema /schema/properties/b/type',
    ];
    expect(codesAndPointers(forward)).toEqual(expected);
    expect(codesAndPointers(reversed)).toEqual(expected);
  });
});

describe('buildPlaceholderCandidatesFromJsonSchema path and security policy', () => {
  it('reports unaddressable property names at their escaped pointer and omits their subtree', () => {
    const schema = {
      type: 'object',
      properties: {
        'first-name': { type: 'string' },
        'first.name': { type: 'string' },
        '123numeric': { type: 'number' },
        'with space': { type: 'string' },
        ünïcode: { type: 'string' },
        'a/b~c': { type: 'object', properties: { nested: { type: 'string' } } },
        valid_field: { type: 'string' },
      },
    };

    expect(codesAndPointers(schema)).toEqual([
      'invalid_path_format /schema/properties/123numeric',
      'invalid_path_format /schema/properties/a~1b~0c',
      'invalid_path_format /schema/properties/first-name',
      'invalid_path_format /schema/properties/first.name',
      'invalid_path_format /schema/properties/with space',
      'invalid_path_format /schema/properties/ünïcode',
    ]);
    expect(paths(schema)).toEqual(['valid_field']);
  });

  it('reports unaddressable names in nested schemas and keeps valid siblings', () => {
    const schema = {
      type: 'object',
      properties: {
        parent: {
          type: 'object',
          properties: { 'child-field': { type: 'string' }, child_valid: { type: 'number' } },
        },
      },
    };

    expect(codesAndPointers(schema)).toEqual([
      'invalid_path_format /schema/properties/parent/properties/child-field',
    ]);
    expect(paths(schema)).toEqual(['parent', 'parent.child_valid']);
  });

  it('blocks reserved names case-insensitively and every dunder name', () => {
    const properties = JSON.parse(
      '{"__proto__": {"type": "object", "properties": {"polluted": {"type": "string"}}},' +
        '"Constructor": {"type": "string"}, "TOSTRING": {"type": "string"},' +
        '"__custom": {"type": "string"}, "safe": {"type": "string"}}',
    ) as Record<string, unknown>;

    const result = buildPlaceholderCandidatesFromJsonSchema({ type: 'object', properties });

    expect(result.issues).toEqual([
      definitionIssue('blocked_path', '/schema/properties/Constructor', 'Constructor'),
      definitionIssue('blocked_path', '/schema/properties/TOSTRING', 'TOSTRING'),
      definitionIssue('blocked_path', '/schema/properties/__custom', '__custom'),
      definitionIssue('blocked_path', '/schema/properties/__proto__', '__proto__'),
    ]);
    expect(result.candidates).toEqual([{ path: 'safe', types: ['string'] }]);
  });

  it('never invokes getters and reports accessor schema data', () => {
    let reads = 0;
    const accessorSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      } as Record<string, unknown>,
    };
    Object.defineProperty(accessorSchema.properties, 'secret', {
      enumerable: true,
      get() {
        reads++;
        return { type: 'string' };
      },
    });
    const typed: Record<string, unknown> = {};
    Object.defineProperty(typed, 'type', {
      enumerable: true,
      get() {
        reads++;
        return 'string';
      },
    });
    accessorSchema.properties['typed'] = typed;

    expect(codesAndPointers(accessorSchema)).toEqual([
      'invalid_schema /schema/properties/secret',
      'invalid_schema /schema/properties/typed/type',
    ]);
    expect(paths(accessorSchema)).toEqual(['name']);
    expect(reads).toBe(0);
  });

  it('rejects class instances and foreign-realm objects as property schemas', () => {
    class NameSchema {
      type = 'string';
    }
    const foreign = runInNewContext('({ type: "string" })') as Record<string, unknown>;
    const schema = {
      type: 'object',
      properties: { instance: new NameSchema(), foreign, local: { type: 'string' } },
    };

    expect(codesAndPointers(schema)).toEqual([
      'invalid_schema /schema/properties/foreign',
      'invalid_schema /schema/properties/instance',
    ]);
    expect(paths(schema)).toEqual(['local']);
  });

  it('keeps diagnostics free of schema values', () => {
    const schema = {
      type: 'object',
      properties: {
        bad: { type: 'VALUE_SECRET', default: 'VALUE_SECRET' },
        'VALUE-key': { type: 'string' },
      },
    };

    for (const issue of buildPlaceholderCandidatesFromJsonSchema(schema).issues) {
      expect(issue.message).not.toContain('VALUE_SECRET');
    }
  });
});
