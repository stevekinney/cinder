import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { fixtureDirectory } from '../../../scripts/tokens/authoring-test-support.ts';
import {
  runtimeDirectory,
  schemaDirectory,
} from '../../../scripts/tokens/generator-configuration.ts';
import { CINDER_BASE } from './base-corpus.ts';
import validateFormat from './format-validator.generated.js';
import validateResolver from './resolver-validator.generated.js';
import { validateResolverDocumentSchema, validateTokenDocumentSchema } from './validate-schema.ts';

const fixtures = join(fixtureDirectory, '..');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** The pre-extraction approach: compile the vendored schema with Ajv at runtime. */
function referenceValidator(schemaFile: string) {
  const ajv = new Ajv({ allErrors: true, strict: false, logger: false, addUsedSchema: false });
  addFormats(ajv, ['uri-reference', 'json-pointer-uri-fragment']);
  const schema = readJson(join(schemaDirectory, schemaFile));
  if (typeof schema !== 'object' || schema === null) throw new Error('schema');
  return ajv.compile(schema);
}

function documentsIn(directory: string): Array<[string, unknown]> {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.tokens.json'))
    .toSorted()
    .map((name) => [
      `${directory.slice(fixtures.length)}/${name}`,
      readJson(join(directory, name)),
    ]);
}

describe('the generated standalone validators', () => {
  for (const module of ['format-validator', 'resolver-validator']) {
    test(`${module} is self-contained: no eval, no Function constructor, no imports`, () => {
      const source = readFileSync(join(runtimeDirectory, `${module}.generated.js`), 'utf8');
      expect(source.length).toBeGreaterThan(10_000);
      expect(source).not.toMatch(/\bnew Function\b|\beval\(|\brequire\(|^import /m);
    });
  }

  test('agree with a runtime-compiled Ajv validator on every token fixture and bundled document', () => {
    const reference = referenceValidator('dtcg-format-2025-10.json');
    const documents = [
      ...documentsIn(join(fixtures, 'valid')),
      ...documentsIn(join(fixtures, 'invalid')),
      ...documentsIn(fixtureDirectory),
      ...documentsIn(join(fixtureDirectory, 'negative')),
      ...Object.entries(CINDER_BASE.documents),
    ];
    expect(documents.length).toBeGreaterThan(40);
    let rejected = 0;
    for (const [name, document] of documents) {
      const expected = reference(document);
      expect(validateFormat(document), name).toBe(expected);
      if (!expected) {
        rejected++;
        expect(validateFormat.errors, name).toEqual(reference.errors);
      }
    }
    expect(rejected).toBeGreaterThan(15);
  });

  test('agree with a runtime-compiled Ajv validator on resolver documents', () => {
    const reference = referenceValidator('dtcg-resolver-2025-10.json');
    const candidates: unknown[] = [
      CINDER_BASE.resolver,
      readJson(join(fixtureDirectory, 'profile.resolver.json')),
      readJson(join(fixtureDirectory, 'negative', 'unknown-set.resolver.json')),
      { version: '2025.10', sets: [], modifiers: [], resolutionOrder: [] },
      { version: '2025.10' },
      'resolver',
    ];
    for (const document of candidates) {
      expect(validateResolver(document)).toBe(reference(document));
      if (!reference(document)) expect(validateResolver.errors).toEqual(reference.errors);
    }
    expect(validateResolver(CINDER_BASE.resolver)).toBe(true);
  });

  test('reject strokeStyle none and hidden on the schema alone', () => {
    for (const value of ['none', 'hidden']) {
      expect(validateFormat({ s: { $type: 'strokeStyle', $value: value } })).toBe(false);
    }
    expect(validateFormat({ s: { $type: 'strokeStyle', $value: 'solid' } })).toBe(true);
  });
});

/** A valid color per DTCG color space, each with the component ranges the schema enforces. */
const COLORS_BY_SPACE: Record<string, [number, number, number]> = {
  srgb: [0.2, 0.4, 0.6],
  'srgb-linear': [0.2, 0.4, 0.6],
  'display-p3': [0.2, 0.4, 0.6],
  'a98-rgb': [0.2, 0.4, 0.6],
  'prophoto-rgb': [0.2, 0.4, 0.6],
  rec2020: [0.2, 0.4, 0.6],
  'xyz-d50': [0.2, 0.4, 0.6],
  'xyz-d65': [0.2, 0.4, 0.6],
  hsl: [120, 50, 50],
  hwb: [120, 20, 30],
  lab: [50, 40, -20],
  lch: [50, 40, 130],
  oklab: [0.5, 0.1, -0.1],
  oklch: [0.5, 0.1, 250],
};

const colorTokens = Object.fromEntries(
  Object.entries(COLORS_BY_SPACE).map(([colorSpace, components]) => [
    colorSpace,
    { $type: 'color', $value: { colorSpace, components, alpha: 0.5 } },
  ]),
);
const bezierToken = { $type: 'cubicBezier', $value: [0.1, 0.2, 0.3, 0.4] };
const gradientToken = {
  $type: 'gradient',
  $value: [
    { color: { colorSpace: 'srgb', components: [0, 0, 0] }, position: 0 },
    { color: { colorSpace: 'srgb', components: [1, 1, 1] }, position: 1 },
  ],
};
const inlineTokens = { ...colorTokens, bezier: bezierToken, gradient: gradientToken };
const validFixtureDocuments = () =>
  documentsIn(join(fixtures, 'valid')).map(([, document]) => document);

describe('the schema gate over every color space, cubic Bézier and gradient', () => {
  test('accepts a color authored in each DTCG color space', () => {
    expect(() => validateTokenDocumentSchema(colorTokens)).not.toThrow();
  });

  test.each(Object.keys(COLORS_BY_SPACE))(
    'rejects a %s color whose channels are out of range',
    (space) => {
      const outOfRange = {
        $type: 'color',
        $value: { colorSpace: space, components: [9e9, 9e9, 9e9] },
      };
      const range = ['hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'srgb'].includes(space);
      // The unbounded spaces (xyz) accept any number; the rest bound at least one channel.
      if (range || !space.startsWith('xyz')) {
        expect(() => validateTokenDocumentSchema({ c: outOfRange })).toThrow();
      }
    },
  );

  test('accepts tokens declared inline in a resolver set and in a modifier context', () => {
    const resolver = {
      version: '2025.10',
      sets: {
        inline: { sources: [{ $ref: 'a.tokens.json' }, inlineTokens, ...validFixtureDocuments()] },
      },
      modifiers: {
        theme: {
          contexts: {
            light: [inlineTokens, ...validFixtureDocuments()],
            dark: [{ $ref: 'b.tokens.json' }],
          },
        },
      },
      resolutionOrder: [{ $ref: '#/sets/inline' }, { $ref: '#/modifiers/theme' }],
    };
    expect(() => validateResolverDocumentSchema(resolver)).not.toThrow();
  });

  test('rejects an inline resolver token whose value is malformed', () => {
    const resolver = {
      version: '2025.10',
      sets: { inline: { sources: [{ bezier: { $type: 'cubicBezier', $value: [0.1, 0.2] } }] } },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/inline' }],
    };
    expect(() => validateResolverDocumentSchema(resolver)).toThrow();
  });
});
