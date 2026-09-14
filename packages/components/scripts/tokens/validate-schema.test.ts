import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateResolverDocumentSchema, validateTokenDocumentSchema } from './validate-schema.ts';
import { assertValidTokenDocument, validateTokenDocument } from './validate.ts';

const inheritedTypeCases = [
  ['color', { colorSpace: 'oklch', components: [0.5, 0.1, 255] }],
  ['dimension', { value: 1, unit: 'rem' }],
  ['fontFamily', ['Inter', 'sans-serif']],
  ['fontWeight', 600],
  ['duration', { value: 150, unit: 'ms' }],
  ['cubicBezier', [0.2, 0, 0, 1]],
  ['number', 1],
  ['strokeStyle', 'solid'],
  ['border', { color: '{color}', width: '{dimension}', style: 'solid' }],
  ['transition', { duration: '{duration}', delay: '{duration}', timingFunction: '{easing}' }],
  [
    'shadow',
    {
      color: '{color}',
      offsetX: '{dimension}',
      offsetY: '{dimension}',
      blur: '{dimension}',
      spread: '{dimension}',
    },
  ],
  [
    'gradient',
    [
      { color: '{color}', position: 0 },
      { color: '{color}', position: 1 },
    ],
  ],
  [
    'typography',
    {
      fontFamily: '{family}',
      fontSize: '{dimension}',
      fontWeight: '{weight}',
      letterSpacing: '{dimension}',
      lineHeight: 1.5,
    },
  ],
] as const;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = join(scriptDirectory, 'schemas');

function readSchema(fileName: string): { $schema?: unknown } {
  return JSON.parse(readFileSync(join(schemaDirectory, fileName), 'utf8')) as { $schema?: unknown };
}

describe('vendored DTCG schema files', () => {
  test('both schemas declare the draft-07 dialect', () => {
    expect(readSchema('dtcg-format-2025-10.json').$schema).toBe(
      'http://json-schema.org/draft-07/schema#',
    );
    expect(readSchema('dtcg-resolver-2025-10.json').$schema).toBe(
      'http://json-schema.org/draft-07/schema#',
    );
  });
});

describe('JSON Schema validation (format)', () => {
  test.each(inheritedTypeCases)(
    'accepts an inherited %s type without rewriting source',
    (type, value) => {
      const document = deepFreeze({
        $extensions: { 'com.example.editor': { untouched: true } },
        group: { $type: type, token: { $value: value } },
      });
      const before = JSON.stringify(document);
      expect(() => assertValidTokenDocument(document)).not.toThrow();
      expect(JSON.stringify(document)).toBe(before);
    },
  );

  test.each(inheritedTypeCases)('accepts a locally declared %s type control', (type, value) => {
    expect(() => assertValidTokenDocument({ token: { $type: type, $value: value } })).not.toThrow();
  });

  test('uses the nearest inherited type and preserves an explicit local override', () => {
    expect(() =>
      assertValidTokenDocument({
        outer: {
          $type: 'strokeStyle',
          inner: {
            $type: 'number',
            inherited: { $value: 1 },
            local: { $type: 'strokeStyle', $value: 'solid' },
          },
        },
      }),
    ).not.toThrow();
  });

  test('inherits a type through an $extends group reference', () => {
    expect(() =>
      assertValidTokenDocument({
        base: { $type: 'strokeStyle', token: { $value: 'solid' } },
        derived: { $extends: '{base}', child: { $value: 'solid' } },
      }),
    ).not.toThrow();
  });

  test('uses the ordered resolver context for a cross-document extension', () => {
    const base = {
      base: { $type: 'strokeStyle', token: { $value: 'solid' } },
    };
    const derived = {
      derived: { $extends: '{base}', child: { $value: 'solid' } },
    };

    expect(() => assertValidTokenDocument(derived, 'derived.tokens.json')).toThrow();
    expect(() =>
      assertValidTokenDocument(derived, 'derived.tokens.json', [base, derived]),
    ).not.toThrow();
  });

  test('does not reuse a partial context projection after authored expansion fails', () => {
    const document = {
      derived: { $extends: '{missing}', child: { $value: 'solid' } },
    };
    const context = {
      derived: { $type: 'strokeStyle', token: { $value: 'solid' } },
    };
    expect(() => assertValidTokenDocument(document, '$', [context])).toThrow();
  });

  test('rejects a composed extension cycle preserved by a partial group override', () => {
    const base = {
      first: { $extends: '{second}' },
      second: { $extends: '{first}' },
    };
    const override = { first: { $type: 'number', child: { $value: 0 } } };

    expect(() =>
      assertValidTokenDocument(override, 'override.tokens.json', [base, override]),
    ).toThrow('circular $extends reference');
  });

  test('does not project missing or cyclic external extension targets', () => {
    const document = { derived: { $extends: '{base}', child: { $value: 'solid' } } };
    expect(() => assertValidTokenDocument(document, '$', [{ other: {} }])).toThrow();
    expect(() =>
      assertValidTokenDocument(document, '$', [
        { base: { $extends: '{derived}' } },
        { derived: { $extends: '{base}' } },
      ]),
    ).toThrow();
  });

  test('inherits an untyped extension target through the receiver lexical parent', () => {
    expect(() =>
      assertValidTokenDocument({
        outer: {
          $type: 'strokeStyle',
          derived: { $extends: '{base}', child: { $value: 'solid' } },
        },
        base: {},
      }),
    ).not.toThrow();
  });

  test('prefers explicit and chained extension target types over the receiver parent', () => {
    expect(() =>
      validateTokenDocumentSchema({
        outer: {
          $type: 'strokeStyle',
          explicit: { $extends: '{base}', child: { $value: 1 } },
          chained: { $extends: '{middle}', child: { $value: 2 } },
        },
        base: { $type: 'number', token: { $value: 0 } },
        middle: { $extends: '{base}' },
      }),
    ).not.toThrow();
  });

  test('handles overlapping inherited scalar and composite shapes', () => {
    expect(() =>
      assertValidTokenDocument({
        family: { $type: 'fontFamily', token: { $value: 'Inter' } },
        typography: {
          $type: 'typography',
          token: {
            $value: {
              fontFamily: 'Inter',
              fontSize: '{size}',
              fontWeight: '{weight}',
              letterSpacing: '{spacing}',
              lineHeight: 1.5,
            },
          },
        },
      }),
    ).not.toThrow();
  });

  test('handles numeric lineHeight alongside dimension-shaped typography members', () => {
    expect(() =>
      assertValidTokenDocument({
        number: { $type: 'number', $value: 1.5 },
        numeric: {
          $type: 'typography',
          token: {
            $value: {
              fontFamily: 'Inter',
              fontSize: { value: 1, unit: 'rem' },
              fontWeight: 400,
              letterSpacing: { value: 0, unit: 'px' },
              lineHeight: 1.5,
            },
          },
        },
      }),
    ).not.toThrow();
  });

  test('projects inherited types onto a group $root token without changing source', () => {
    const document = deepFreeze({
      group: { $type: 'strokeStyle', $root: { $value: 'solid' } },
    });
    const before = JSON.stringify(document);
    expect(() => assertValidTokenDocument(document)).not.toThrow();
    expect(JSON.stringify(document)).toBe(before);
  });

  test('does not project types through malformed, unresolved, or cyclic extensions', () => {
    for (const document of [
      { derived: { $extends: 42, child: { $value: 'solid' } } },
      { derived: { $extends: '{missing}', child: { $value: 'solid' } } },
      {
        first: { $extends: '{second}', child: { $value: 'solid' } },
        second: { $extends: '{first}' },
      },
    ])
      expect(() => assertValidTokenDocument(document)).toThrow();

    expect(() =>
      assertValidTokenDocument({
        outer: {
          $type: 'strokeStyle',
          derived: { $extends: '{missing}', child: { $value: 'solid' } },
        },
      }),
    ).toThrow();

    expect(() =>
      assertValidTokenDocument({
        outer: {
          $type: 'strokeStyle',
          first: { $extends: '{outer.second}', child: { $value: 'solid' } },
          second: { $extends: '{outer.first}' },
        },
      }),
    ).toThrow();
  });

  test('does not let an own type hide a cyclic extension', () => {
    for (const value of [0, -1]) {
      expect(() =>
        assertValidTokenDocument({
          first: {
            $type: 'number',
            $extends: '{second}',
            child: { $value: value },
          },
          second: { $extends: '{first}' },
        }),
      ).toThrow();
      expect(() =>
        assertValidTokenDocument({
          first: {
            $type: 'number',
            $extends: '{second}',
            child: { $type: 'number', $value: value },
          },
          second: { $extends: '{first}' },
        }),
      ).toThrow();
    }
  });

  test('keeps local type precedence for reference tokens', () => {
    expect(() =>
      assertValidTokenDocument({
        base: { $type: 'strokeStyle', $value: 'solid' },
        group: {
          $type: 'number',
          inherited: { $ref: '#/base' },
          local: { $type: 'strokeStyle', $ref: '#/base' },
        },
      }),
    ).not.toThrow();
  });

  test('rejects malformed inherited composite values at their source paths', () => {
    expect(() =>
      assertValidTokenDocument({
        border: { $type: 'border', token: { $value: { color: '{color}', width: '{width}' } } },
      }),
    ).toThrow('$.border.token.$value');
    expect(() =>
      assertValidTokenDocument({
        typography: {
          $type: 'typography',
          token: { $value: { fontFamily: 'Inter', lineHeight: { value: -1, unit: 'px' } } },
        },
      }),
    ).toThrow('$.typography.token.$value');
  });

  test.each(['none', 'hidden', 'banana'])('rejects invalid inherited strokeStyle %s', (value) => {
    expect(() =>
      assertValidTokenDocument({ stroke: { $type: 'strokeStyle', token: { $value: value } } }),
    ).toThrow();
    expect(() =>
      assertValidTokenDocument({
        stroke: { $type: 'strokeStyle', token: { $type: 'strokeStyle', $value: value } },
      }),
    ).toThrow();
  });

  test('retains source paths for invalid projected inherited values', () => {
    expect(() =>
      assertValidTokenDocument({ parent: { $type: 'strokeStyle', child: { $value: 'banana' } } }),
    ).toThrow('$.parent.child.$value');
  });

  test('preserves JSON-parsed __proto__ token keys and source paths', () => {
    const document = JSON.parse('{"group":{"$type":"number","__proto__":{"$value":"invalid"}}}');
    expect(() => assertValidTokenDocument(document)).toThrow('$.group.__proto__.$value');
  });

  test('preserves deeply frozen source and metadata after failed validation', () => {
    const document = deepFreeze({
      $extensions: { 'com.example.editor': { untouched: ['exact', 1] } },
      parent: { $type: 'strokeStyle', child: { $value: 'banana' } },
    });
    const before = JSON.stringify(document);
    expect(() => assertValidTokenDocument(document)).toThrow();
    expect(JSON.stringify(document)).toBe(before);
  });

  test('accepts a document that conforms to the official DTCG 2025.10 format schema', () => {
    expect(() =>
      validateTokenDocumentSchema({
        $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
        sample: { $type: 'number', $value: 1 },
      }),
    ).not.toThrow();
  });

  test('rejects an unknown colorSpace with a named path and reason', () => {
    let caught: unknown;
    try {
      validateTokenDocumentSchema(
        { sample: { $type: 'color', $value: { colorSpace: 'banana', components: [0, 0, 0] } } },
        '$',
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const issues = (caught as { issues: Array<{ path: string; reason: string }> }).issues;
    expect(issues.length).toBeGreaterThan(0);
    expect(
      issues.some(
        (issue) =>
          issue.path === '$.sample.$value.colorSpace' && issue.reason.includes('must be one of'),
      ),
    ).toBe(true);
  });

  test('rejects a document missing a required composite member with a named path and reason', () => {
    let caught: unknown;
    try {
      validateTokenDocumentSchema({
        sample: { $type: 'border', $value: { color: '{color}', width: '{dimension}' } },
      });
    } catch (error) {
      caught = error;
    }
    const issues = (caught as { issues: Array<{ path: string; reason: string }> }).issues;
    expect(
      issues.some(
        (issue) =>
          issue.path === '$.sample.$value' &&
          issue.reason === "must have required property 'style'",
      ),
    ).toBe(true);
  });

  test('catches an 8-digit hex color the hand-rolled semantic validator alone accepts', () => {
    const document = {
      $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
      sample: {
        $type: 'color' as const,
        $value: { colorSpace: 'oklch', components: [0, 0, 0], hex: '#11223380' },
      },
    };

    // Before: the pre-existing hand-rolled semantic validator alone accepts this
    // (see the "not.toThrow()" 8-digit-hex assertion in validate.test.ts) --
    // the official schema only permits exactly 6 hex digits.
    expect(() => validateTokenDocument(document)).not.toThrow();

    // After: the JSON Schema first-pass gate rejects it.
    let caught: unknown;
    try {
      validateTokenDocumentSchema(document);
    } catch (error) {
      caught = error;
    }
    const issues = (caught as { issues: Array<{ path: string; reason: string }> }).issues;
    expect(
      issues.some((issue) => issue.path === '$.sample.$value.hex' && issue.reason.includes('#')),
    ).toBe(true);

    // And the combined gate (schema, then semantic) used by the real loading
    // pipeline now rejects a document the semantic-only path used to accept.
    expect(() => assertValidTokenDocument(document)).toThrow();
  });

  test('accepts $root tokens and $extends groups (both are 2025.10 format features)', () => {
    expect(() =>
      validateTokenDocumentSchema({ group: { $type: 'number', $root: { $value: 1 } } }),
    ).not.toThrow();
    expect(() =>
      validateTokenDocumentSchema({
        base: { $type: 'number', token: { $value: 1 } },
        derived: { $extends: '{base}', nested: { token: { $value: 2 } } },
      }),
    ).not.toThrow();
  });

  test('accepts document-level $extensions carrying a resolver modifier assignment', () => {
    expect(() =>
      validateTokenDocumentSchema({
        $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
        $extensions: { 'com.lostgradient.cinder': { modifier: { theme: 'dark' } } },
        color: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0.1, 255] } },
      }),
    ).not.toThrow();
  });
});

describe('JSON Schema validation (resolver)', () => {
  test('accepts a document conforming to the official object-keyed resolver shape', () => {
    expect(() =>
      validateResolverDocumentSchema({
        version: '2025.10',
        sets: { foundation: { sources: [{ $ref: 'sets/foundation.tokens.json' }] } },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: 'themes/light.tokens.json' }],
              dark: [{ $ref: 'themes/dark.tokens.json' }],
            },
          },
        },
        resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
      }),
    ).not.toThrow();
  });

  test('accepts the real, migrated cinder.resolver.json file on disk', () => {
    // CIN-27 migrated packages/components/src/tokens/cinder.resolver.json
    // from an array-based shape to the official object-keyed shape. This
    // reads the real file (not a copy) so a future edit to it that drifts
    // from the official schema fails here, not only in tokens:validate.
    const resolverPath = join(scriptDirectory, '..', '..', 'src', 'tokens', 'cinder.resolver.json');
    const document: unknown = JSON.parse(readFileSync(resolverPath, 'utf8'));
    expect(() => validateResolverDocumentSchema(document)).not.toThrow();
  });

  test('rejects the pre-migration array-based resolver shape Cinder used to author', () => {
    // Historical regression guard: cinder.resolver.json used to declare
    // sets/modifiers as arrays of {name, ...} objects and resolutionOrder as
    // a plain string array, despite declaring the official 2025.10 $schema
    // URI -- it never actually conformed. CIN-27 migrated the real file to
    // the shape asserted above and wired this schema validator into
    // assertValidResolverDocument (see validate.ts), so this now documents
    // what the toolchain used to accept and no longer does.
    let caught: unknown;
    try {
      validateResolverDocumentSchema({
        version: '2025.10',
        sets: [{ name: 'foundation', source: ['sets/foundation.tokens.json'] }],
        modifiers: [{ name: 'theme', values: ['light', 'dark'], default: 'light' }],
        resolutionOrder: ['theme'],
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const issues = (caught as { issues: Array<{ path: string; reason: string }> }).issues;
    expect(issues.some((issue) => issue.path === '$.sets' && issue.reason.includes('object'))).toBe(
      true,
    );
    expect(
      issues.some((issue) => issue.path === '$.modifiers' && issue.reason.includes('object')),
    ).toBe(true);
  });

  test('reports a named path and reason for a resolver schema violation', () => {
    let caught: unknown;
    try {
      validateResolverDocumentSchema({
        version: 'not-2025.10',
        resolutionOrder: [],
      });
    } catch (error) {
      caught = error;
    }
    const issues = (caught as { issues: Array<{ path: string; reason: string }> }).issues;
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.path === '$.version')).toBe(true);
  });

  test('enforces the uri-reference format rather than treating it as unconstrained', () => {
    // The schemas apply `format: uri-reference` to source and resolutionOrder
    // `$ref` values. Registering those formats as no-op stubs would let a
    // malformed reference through the gate that exists to catch it, so this
    // pins that the real ajv-formats validators are wired in.
    expect(() =>
      validateResolverDocumentSchema({
        version: '2025.10',
        sets: { foundation: { sources: [{ $ref: 'sets/bad%2x.tokens.json' }] } },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/foundation' }],
      }),
    ).toThrow();
  });
});
