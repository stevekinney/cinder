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
});

describe('tryCompile', () => {
  test('valid schema compiles', async () => {
    const result = await tryCompile({ type: 'string' });
    expect(result.ok).toBe(true);
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
