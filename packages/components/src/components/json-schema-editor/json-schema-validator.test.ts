import { describe, expect, test } from 'bun:test';

import type { JsonSchemaObject } from './json-schema-editor-types.ts';
import {
  detectDraft,
  normaliseSchemaInput,
  tryCompile,
  tryParseJson,
  validateMetaSchema,
} from './json-schema-validator.ts';

describe('detectDraft', () => {
  test('returns 2020-12 when $schema is absent', () => {
    expect(detectDraft({})).toBe('2020-12');
  });

  test('reads recognised $schema URLs', () => {
    expect(detectDraft({ $schema: 'https://json-schema.org/draft/2020-12/schema' })).toBe(
      '2020-12',
    );
    expect(detectDraft({ $schema: 'https://json-schema.org/draft/2019-09/schema' })).toBe(
      '2019-09',
    );
    expect(detectDraft({ $schema: 'http://json-schema.org/draft-07/schema#' })).toBe('draft-07');
  });

  test('returns unknown for unrecognised values', () => {
    expect(detectDraft({ $schema: 'http://example.com/schema' })).toBe('unknown');
  });

  test('boolean schemas default to 2020-12', () => {
    expect(detectDraft(true)).toBe('2020-12');
    expect(detectDraft(false)).toBe('2020-12');
  });
});

describe('validateMetaSchema', () => {
  test('valid 2020-12 schema passes', async () => {
    const result = await validateMetaSchema({ type: 'string' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('boolean schemas pass', async () => {
    const trueResult = await validateMetaSchema(true);
    const falseResult = await validateMetaSchema(false);
    expect(trueResult.valid).toBe(true);
    expect(falseResult.valid).toBe(true);
  });

  test('schema with type array passes', async () => {
    const result = await validateMetaSchema({ type: ['string', 'null'] });
    expect(result.valid).toBe(true);
  });

  test('schema with no type passes (matches anything)', async () => {
    const result = await validateMetaSchema({});
    expect(result.valid).toBe(true);
  });

  test('schema with bogus type is flagged', async () => {
    const result = await validateMetaSchema({ type: 'not-a-type' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('oneOf with sibling type both pass', async () => {
    const result = await validateMetaSchema({
      type: 'object',
      oneOf: [{ required: ['a'] }, { required: ['b'] }],
    });
    expect(result.valid).toBe(true);
  });

  test('Draft-07 schema validated against draft-07 passes', async () => {
    const result = await validateMetaSchema(
      { $schema: 'http://json-schema.org/draft-07/schema#', type: 'string' },
      'draft-07',
    );
    expect(result.valid).toBe(true);
  });

  test('2019-09 schema validated against draft 2019-09 passes', async () => {
    const result = await validateMetaSchema(
      { $schema: 'https://json-schema.org/draft/2019-09/schema', type: 'string' },
      '2019-09',
    );
    expect(result.valid).toBe(true);
  });

  test('non-object schemas are invalid', async () => {
    const result = await validateMetaSchema('not a schema');
    expect(result).toEqual({
      valid: false,
      errors: [{ path: '', message: 'Schema must be an object or boolean', keyword: '' }],
    });
  });

  // Regression: AJV threw "no schema with key or ref ..." synchronously when
  // a 2020-12 schema was validated through a draft-07 instance (or vice versa)
  // because the meta-schema URI in $schema wasn't registered on the chosen
  // validator. The editor's debounced timers would fire after a test teardown
  // and the unhandled throw poisoned subsequent tests.
  test('mismatched $schema vs draft override returns invalid rather than throwing', async () => {
    const result = await validateMetaSchema(
      { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'string' },
      'draft-07',
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // A schema whose shape json-schema-library must walk synchronously (e.g.
  // reading `properties`) can throw rather than report a structured
  // `schemaErrors` entry when that access itself fails. validateMetaSchema's
  // try/catch turns that synchronous throw into the same { valid: false }
  // shape callers already get from a reported schema error, instead of an
  // unhandled rejection.
  test('a schema that throws synchronously while being compiled is reported as invalid, not thrown', async () => {
    const schema: Record<string, unknown> = { type: 'object' };
    Object.defineProperty(schema, 'properties', {
      enumerable: true,
      get(): never {
        throw new Error('boom from properties getter');
      },
    });
    const result = await validateMetaSchema(schema);
    expect(result).toEqual({
      valid: false,
      errors: [{ path: '', message: 'boom from properties getter', keyword: '' }],
    });
  });

  test('a non-Error throw while compiling still returns a valid: false result with a fallback message', async () => {
    const schema: Record<string, unknown> = { type: 'object' };
    Object.defineProperty(schema, 'properties', {
      enumerable: true,
      get(): never {
        // Intentionally not an Error instance — exercises the catch's
        // non-Error fallback branch, which stringifies whatever was thrown.
        throw 'not an Error instance';
      },
    });
    const result = await validateMetaSchema(schema);
    expect(result).toEqual({
      valid: false,
      errors: [{ path: '', message: 'Meta-schema validation failed', keyword: '' }],
    });
  });
});

describe('tryCompile', () => {
  test('valid schema compiles', async () => {
    const result = await tryCompile({ type: 'string' });
    expect(result.ok).toBe(true);
  });

  test('registers the standard email format before compiling', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...values: unknown[]) => warnings.push(values);
    try {
      expect(await tryCompile({ type: 'string', format: 'email' })).toEqual({ ok: true });
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings).toEqual([]);
  });

  test('flags an unresolved $ref even when meta-schema validation passes', async () => {
    const schema = { $ref: '#/$defs/missing' };
    const metaResult = await validateMetaSchema(schema);
    expect(metaResult.valid).toBe(true);
    const result = await tryCompile(schema);
    expect(result.ok).toBe(false);
  });

  test('repeated compilation of a schema with $id does not collide', async () => {
    const schema = {
      $id: 'https://example.com/person',
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    const first = await tryCompile(schema);
    const second = await tryCompile(schema);
    const third = await tryCompile(schema);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(true);
  });

  test('2019-09 schemas compile through the matching AJV instance', async () => {
    const result = await tryCompile(
      { $schema: 'https://json-schema.org/draft/2019-09/schema', type: 'string' },
      '2019-09',
    );
    expect(result.ok).toBe(true);
  });

  test('draft-07 schemas compile through the matching AJV instance', async () => {
    const result = await tryCompile(
      { $schema: 'http://json-schema.org/draft-07/schema#', type: 'string' },
      'draft-07',
    );
    expect(result.ok).toBe(true);
  });

  test('non-object schemas do not compile', async () => {
    const result = await tryCompile('not a schema');
    expect(result.ok).toBe(false);
  });

  // COR-228 parity fixtures — preserved across the CSP-safe interpreter swap.
  test('2019-09 $recursiveRef compiles and its meta-schema is valid', async () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2019-09/schema',
      $id: 'https://example.com/tree',
      $recursiveAnchor: true,
      type: 'object',
      properties: { children: { type: 'array', items: { $recursiveRef: '#' } } },
    };
    expect(await validateMetaSchema(schema, '2019-09')).toEqual({ valid: true, errors: [] });
    expect(await tryCompile(schema, '2019-09')).toEqual({ ok: true });
  });

  test('2020-12 $dynamicRef compiles and its meta-schema is valid', async () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/tree2020',
      $dynamicAnchor: 'node',
      type: 'object',
      properties: { children: { type: 'array', items: { $dynamicRef: '#node' } } },
    };
    expect(await validateMetaSchema(schema, '2020-12')).toEqual({ valid: true, errors: [] });
    expect(await tryCompile(schema, '2020-12')).toEqual({ ok: true });
  });

  test('a general (non-$defs-shorthand) unresolved $ref fails to compile', async () => {
    const schema = { type: 'object', properties: { a: { $ref: '#/nonexistent' } } };
    const result = await tryCompile(schema);
    expect(result.ok).toBe(false);
  });

  test('an unrecognised keyword is preserved without failing meta-schema or compile checks', async () => {
    const schema = { type: 'string', 'x-vendor-extension': 42 };
    const meta = await validateMetaSchema(schema);
    expect(meta.valid).toBe(true);
    expect(await tryCompile(schema)).toEqual({ ok: true });
  });

  // Mirrors the validateMetaSchema regression above: compilation can throw
  // synchronously rather than report a structured error when reading the
  // schema itself fails. tryCompile's try/catch must turn that into
  // { ok: false, error } like any other compile failure, not an unhandled
  // rejection.
  test('a schema that throws synchronously while being compiled is reported as a compile failure, not thrown', async () => {
    const schema: Record<string, unknown> = { type: 'object' };
    Object.defineProperty(schema, 'properties', {
      enumerable: true,
      get(): never {
        throw new Error('boom from properties getter');
      },
    });
    const result = await tryCompile(schema);
    expect(result).toEqual({ ok: false, error: 'boom from properties getter' });
  });

  test('a non-Error throw while compiling still returns an ok: false result with a stringified error', async () => {
    const schema: Record<string, unknown> = { type: 'object' };
    Object.defineProperty(schema, 'properties', {
      enumerable: true,
      get(): never {
        // Intentionally not an Error instance — exercises the catch's
        // non-Error fallback branch, which stringifies whatever was thrown.
        throw 'not an Error instance';
      },
    });
    const result = await tryCompile(schema);
    expect(result).toEqual({ ok: false, error: 'not an Error instance' });
  });

  // Every format ajv-formats' `fullFormats` set registers must remain a
  // recognised `format` value (no compile warning), matching the existing
  // "registers the standard email format" regression above.
  const AJV_FORMATS = [
    'date',
    'time',
    'date-time',
    'iso-time',
    'iso-date-time',
    'duration',
    'uri',
    'uri-reference',
    'uri-template',
    'url',
    'email',
    'hostname',
    'ipv4',
    'ipv6',
    'regex',
    'uuid',
    'json-pointer',
    'json-pointer-uri-fragment',
    'relative-json-pointer',
    'byte',
    'int32',
    'int64',
    'float',
    'double',
    'password',
    'binary',
  ] as const;

  test('every ajv-formats format compiles without a warning', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...values: unknown[]) => warnings.push(values);
    try {
      for (const format of AJV_FORMATS) {
        const type = ['int32', 'int64', 'float', 'double'].includes(format) ? 'number' : 'string';
        expect(await tryCompile({ type, format })).toEqual({ ok: true });
      }
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings).toEqual([]);
  });
});

describe('tryParseJson', () => {
  test('parses a valid JSON document', () => {
    const result = tryParseJson('{"a":1}');
    if (result.ok) {
      expect(result.value).toEqual({ a: 1 });
    } else {
      throw new Error('expected parse success');
    }
  });

  test('returns an error with non-empty message on malformed input', () => {
    const result = tryParseJson('{not-valid}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  test('returns extracted line and column when the syntax error includes a position', () => {
    const originalParse = JSON.parse;
    JSON.parse = (() => {
      throw new SyntaxError('JSON Parse error at position 8');
    }) as typeof JSON.parse;
    try {
      const result = tryParseJson('{\n  "a":');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          message: 'JSON Parse error at position 8',
          line: 2,
          column: 7,
        });
      }
    } finally {
      JSON.parse = originalParse;
    }
  });

  test('omits line and column when a reported parse position is invalid', () => {
    const originalParse = JSON.parse;
    JSON.parse = (() => {
      throw new SyntaxError('JSON Parse error at position 999');
    }) as typeof JSON.parse;
    try {
      const result = tryParseJson('{}');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({ message: 'JSON Parse error at position 999' });
      }
    } finally {
      JSON.parse = originalParse;
    }
  });

  test('handles non-SyntaxError parse failures defensively', () => {
    const originalParse = JSON.parse;
    JSON.parse = (() => {
      throw new Error('custom parse failure');
    }) as typeof JSON.parse;
    try {
      const result = tryParseJson('{}');
      expect(result).toEqual({ ok: false, error: { message: 'custom parse failure' } });
    } finally {
      JSON.parse = originalParse;
    }
  });
});

describe('normaliseSchemaInput', () => {
  test('accepts a string and parses it', () => {
    const result = normaliseSchemaInput('{"type":"string"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema).toEqual({ type: 'string' });
      expect(result.rawText).toBe('{"type":"string"}');
      expect(result.canonicalText).toContain('"type"');
    }
  });

  test('accepts a plain object', () => {
    const result = normaliseSchemaInput({ type: 'string' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema).toEqual({ type: 'string' });
    }
  });

  test('accepts an empty plain object schema', () => {
    const result = normaliseSchemaInput({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema).toEqual({});
    }
  });

  test('accepts JSON-compatible arrays inside object schemas', () => {
    const result = normaliseSchemaInput({ enum: ['draft', 'published'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema).toEqual({ enum: ['draft', 'published'] });
    }
  });

  test('accepts a boolean schema', () => {
    expect(normaliseSchemaInput(true).ok).toBe(true);
    expect(normaliseSchemaInput(false).ok).toBe(true);
  });

  test('rejects non-object non-boolean values', () => {
    const result = normaliseSchemaInput(42 as never);
    expect(result).toEqual({
      ok: false,
      rawText: '',
      error: 'Top-level schema must be an object or boolean',
    });
  });

  test('rejects non-plain objects', () => {
    const result = normaliseSchemaInput({ minimum: new Date('2026-06-01T00:00:00.000Z') } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('non-plain object (Date) at .minimum');
    }
  });

  test('rejects undefined inside an object', () => {
    const input = { properties: { x: undefined } } as unknown;
    const result = normaliseSchemaInput(input as never);
    expect(result.ok).toBe(false);
  });

  test('rejects functions inside an object', () => {
    const input = { foo: () => undefined } as unknown;
    const result = normaliseSchemaInput(input as never);
    expect(result.ok).toBe(false);
  });

  test('rejects symbols inside an object', () => {
    const input = { foo: Symbol('x') } as unknown;
    const result = normaliseSchemaInput(input as never);
    expect(result.ok).toBe(false);
  });

  test('rejects BigInt', () => {
    const input = { foo: 1n } as unknown;
    const result = normaliseSchemaInput(input as never);
    expect(result.ok).toBe(false);
  });

  test('rejects NaN and Infinity', () => {
    expect(normaliseSchemaInput({ foo: Number.NaN }).ok).toBe(false);
    expect(normaliseSchemaInput({ foo: Number.POSITIVE_INFINITY }).ok).toBe(false);
    expect(normaliseSchemaInput({ foo: Number.NEGATIVE_INFINITY }).ok).toBe(false);
  });

  test('rejects cyclic graphs', () => {
    const cyclic: Record<string, unknown> = { foo: 1 };
    cyclic['self'] = cyclic;
    const result = normaliseSchemaInput(cyclic);
    expect(result.ok).toBe(false);
  });

  test('allows repeated object references that are not cyclic', () => {
    const shared: JsonSchemaObject = { type: 'string' };
    const result = normaliseSchemaInput({
      properties: {
        first: shared,
        second: shared,
      },
    });

    expect(result.ok).toBe(true);
  });

  test('rejects malformed JSON string', () => {
    const result = normaliseSchemaInput('{not-valid}');
    expect(result.ok).toBe(false);
  });

  test('rejects a top-level array (not a valid schema shape)', () => {
    const result = normaliseSchemaInput('[1, 2, 3]');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('object or boolean');
    }
  });

  test('rejects a top-level array value (not a valid schema shape)', () => {
    const result = normaliseSchemaInput([1, 2, 3] as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('object or boolean');
    }
  });
});
