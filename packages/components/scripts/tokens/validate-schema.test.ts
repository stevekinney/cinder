import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateResolverDocumentSchema, validateTokenDocumentSchema } from './validate-schema.ts';
import { assertValidTokenDocument, validateTokenDocument } from './validate.ts';

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
});
