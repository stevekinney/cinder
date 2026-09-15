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
    expect(detectDraft({ $schema: 'https://example.invalid/draft/2020-12/schema' })).toBe(
      'unknown',
    );
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

  // Regression: unresolved references must remain explicit compile failures
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

  test('2019-09 schemas compile through the matching interpreted draft', async () => {
    const result = await tryCompile(
      { $schema: 'https://json-schema.org/draft/2019-09/schema', type: 'string' },
      '2019-09',
    );
    expect(result.ok).toBe(true);
  });

  test('draft-07 schemas compile through the matching interpreted draft', async () => {
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

  test('accepts extension keywords without mutating authored source', async () => {
    const schema = {
      type: 'string',
      'x-vendor': { enabled: true },
    };
    const before = JSON.stringify(schema);
    await expect(validateMetaSchema(schema)).resolves.toMatchObject({ valid: true });
    await expect(tryCompile(schema)).resolves.toEqual({ ok: true });
    expect(JSON.stringify(schema)).toBe(before);
  });

  test('validates recursive and dynamic references', async () => {
    const recursive = {
      $schema: 'https://json-schema.org/draft/2019-09/schema',
      $recursiveAnchor: true,
      type: 'object',
      properties: { child: { $recursiveRef: '#' } },
    };
    const dynamic = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $dynamicAnchor: 'node',
      type: 'object',
      properties: { child: { $dynamicRef: '#node' } },
    };
    await expect(tryCompile(recursive)).resolves.toEqual({ ok: true });
    await expect(tryCompile(dynamic)).resolves.toEqual({ ok: true });
  });

  test('supports every ajv-formats name through the CSP-safe runtime', async () => {
    const valid: Record<string, unknown> = {
      date: '2020-01-01',
      time: '12:30:00Z',
      'date-time': '2020-01-01T12:30:00Z',
      'iso-time': '12:30:00',
      'iso-date-time': '2020-01-01T12:30:00',
      duration: 'P3D',
      uri: 'https://example.com',
      'uri-reference': '/a',
      'uri-template': '{/path}',
      url: 'https://example.com',
      email: 'ada@example.com',
      hostname: 'example.com',
      ipv4: '127.0.0.1',
      ipv6: '::1',
      regex: 'a+',
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      'json-pointer': '/a',
      'json-pointer-uri-fragment': '#/a',
      'relative-json-pointer': '0#',
      byte: 'YWJj',
      int32: 1,
      int64: 1,
      float: 1,
      double: 1,
      password: 'secret',
      binary: 'abc',
    };
    for (const [format, value] of Object.entries(valid)) {
      await expect(tryCompile({ format })).resolves.toEqual({ ok: true });
      const schemaResult = await validateMetaSchema({ format });
      expect(schemaResult.valid).toBe(true);
      expect(value).toBeDefined();
    }
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
    expect(normaliseSchemaInput({ foo: Number.NaN } as never).ok).toBe(false);
    expect(normaliseSchemaInput({ foo: Number.POSITIVE_INFINITY } as never).ok).toBe(false);
    expect(normaliseSchemaInput({ foo: Number.NEGATIVE_INFINITY } as never).ok).toBe(false);
  });

  test('rejects cyclic graphs', () => {
    const cyclic: Record<string, unknown> = { foo: 1 };
    cyclic['self'] = cyclic;
    const result = normaliseSchemaInput(cyclic as never);
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
