import { describe, expect, test } from 'bun:test';

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
  test('valid 2020-12 schema passes', () => {
    const result = validateMetaSchema({ type: 'string' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('boolean schemas pass', () => {
    expect(validateMetaSchema(true).valid).toBe(true);
    expect(validateMetaSchema(false).valid).toBe(true);
  });

  test('schema with type array passes', () => {
    expect(validateMetaSchema({ type: ['string', 'null'] }).valid).toBe(true);
  });

  test('schema with no type passes (matches anything)', () => {
    expect(validateMetaSchema({}).valid).toBe(true);
  });

  test('schema with bogus type is flagged', () => {
    const result = validateMetaSchema({ type: 'not-a-type' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('oneOf with sibling type both pass', () => {
    const result = validateMetaSchema({
      type: 'object',
      oneOf: [{ required: ['a'] }, { required: ['b'] }],
    });
    expect(result.valid).toBe(true);
  });

  test('Draft-07 schema validated against draft-07 passes', () => {
    const result = validateMetaSchema(
      { $schema: 'http://json-schema.org/draft-07/schema#', type: 'string' },
      'draft-07',
    );
    expect(result.valid).toBe(true);
  });

  test('forced draft mismatch returns invalid instead of throwing', () => {
    const result = validateMetaSchema(
      { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'string' },
      'draft-07',
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toContain('no schema with key or ref');
  });
});

describe('tryCompile', () => {
  test('valid schema compiles', () => {
    const result = tryCompile({ type: 'string' });
    expect(result.ok).toBe(true);
  });

  test('flags an unresolved $ref even when meta-schema validation passes', () => {
    const schema = { $ref: '#/$defs/missing' };
    expect(validateMetaSchema(schema).valid).toBe(true);
    const result = tryCompile(schema);
    expect(result.ok).toBe(false);
  });

  test('repeated compilation of a schema with $id does not collide', () => {
    const schema = {
      $id: 'https://example.com/person',
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    expect(tryCompile(schema).ok).toBe(true);
    expect(tryCompile(schema).ok).toBe(true);
    expect(tryCompile(schema).ok).toBe(true);
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

  test('accepts a boolean schema', () => {
    expect(normaliseSchemaInput(true).ok).toBe(true);
    expect(normaliseSchemaInput(false).ok).toBe(true);
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
