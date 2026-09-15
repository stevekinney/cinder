import { describe, expect, test } from 'bun:test';

import {
  issuesByPath,
  jsonPointerToPath,
  parseJsonDraft,
  readSchemaFormData,
  serializeValidatedValue,
  validateSchemaValue,
} from './schema-form-validation.ts';

describe('schema-form validation', () => {
  test('validates JSON Schema values with the shared lazy runtime', async () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        count: { type: 'integer', minimum: 1 },
      },
      required: ['name', 'count'],
    };

    await expect(validateSchemaValue(schema, { name: 'Ada', count: 1 })).resolves.toEqual({
      valid: true,
      value: { name: 'Ada', count: 1 },
      issues: [],
    });

    const invalid = await validateSchemaValue(schema, { name: '', count: 0 });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((issue) => issue.path)).toEqual([['name'], ['count']]);
  });

  test('does not mutate frozen schemas or instances', async () => {
    const schema = Object.freeze({
      type: 'object',
      properties: Object.freeze({
        name: Object.freeze({ type: 'string', format: 'email' }),
      }),
      required: Object.freeze(['name']),
    });
    const value = Object.freeze({ name: 'ada@example.com' });
    const schemaBefore = JSON.stringify(schema);
    const valueBefore = JSON.stringify(value);

    await expect(validateSchemaValue(schema, value)).resolves.toMatchObject({ valid: true });

    expect(JSON.stringify(schema)).toBe(schemaBefore);
    expect(JSON.stringify(value)).toBe(valueBefore);
  });

  test('selects draft-07 and 2019-09 validators from $schema', async () => {
    await expect(
      validateSchemaValue(
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          properties: { mode: { type: 'string' } },
          required: ['mode'],
        },
        { mode: 'safe' },
      ),
    ).resolves.toEqual({ valid: true, value: { mode: 'safe' }, issues: [] });

    await expect(
      validateSchemaValue(
        {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        { name: 'Ada' },
      ),
    ).resolves.toEqual({ valid: true, value: { name: 'Ada' }, issues: [] });

    await expect(
      validateSchemaValue(
        {
          $schema: 'https://json-schema.org/draft/2019-09/schema',
          type: 'object',
          properties: { count: { type: 'integer' } },
          required: ['count'],
        },
        { count: 1 },
      ),
    ).resolves.toEqual({ valid: true, value: { count: 1 }, issues: [] });
  });

  test('maps JSON Schema required errors to the missing field path', async () => {
    const result = await validateSchemaValue(
      {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      {},
    );

    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ path: ['name'] });
  });

  test('maps nested JSON Schema required errors to the nested missing field path', async () => {
    const result = await validateSchemaValue(
      {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      },
      { nested: {} },
    );

    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ path: ['nested', 'name'] });
  });

  test('rejects legacy Standard Schema-shaped objects at runtime', async () => {
    const result = await validateSchemaValue(
      {
        '~standard': {
          version: 1,
          vendor: 'example',
          validate: () => ({ value: { name: 'Ada' } }),
        },
      },
      {},
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      { path: [], message: 'SchemaForm only accepts JSON Schema objects.' },
    ]);
  });

  test('rejects non-object schemas at runtime', async () => {
    const result = await validateSchemaValue(null as never, {});

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      { path: [], message: 'SchemaForm only accepts JSON Schema objects.' },
    ]);
  });

  test('rejects unrecognised draft identifiers', async () => {
    await expect(
      validateSchemaValue(
        { $schema: 'https://example.invalid/draft/2020-12/schema', type: 'string' },
        'Ada',
      ),
    ).resolves.toMatchObject({ valid: false });
  });

  test('reports invalid JSON Schema compilation errors as root issues', async () => {
    const result = await validateSchemaValue(
      {
        type: 'object',
        required: [1],
      },
      {},
    );

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toEqual([]);
    expect(result.issues[0]?.message).toMatch(/Invalid JSON Schema/i);
  });

  test('reports validator runtime exceptions as root issues', async () => {
    const value = new Proxy(
      {},
      {
        get() {
          throw new Error('validator probe failed');
        },
      },
    );

    await expect(
      validateSchemaValue({ type: 'object', properties: { name: { type: 'string' } } }, value),
    ).resolves.toEqual({
      valid: false,
      value,
      issues: [{ path: [], message: 'Invalid JSON Schema: validator probe failed' }],
    });
  });

  test('does not cache failed JSON Schema compilation attempts', async () => {
    const schema = {
      type: 'object',
      required: [1],
    } as Record<string, unknown>;

    const invalid = await validateSchemaValue(schema, {});
    expect(invalid.valid).toBe(false);

    schema['properties'] = { name: { type: 'string' } };
    schema['required'] = ['name'];

    await expect(validateSchemaValue(schema, { name: 'Ada' })).resolves.toEqual({
      valid: true,
      value: { name: 'Ada' },
      issues: [],
    });
  });

  test('treats fulfilled async JSON Schema validation as valid for falsy root values', async () => {
    const result = await validateSchemaValue(
      {
        $async: true,
        type: 'boolean',
      },
      false,
    );

    expect(result).toEqual({ valid: true, value: false, issues: [] });
  });

  test('reports async JSON Schema validation rejections as validation issues', async () => {
    const result = await validateSchemaValue(
      {
        $async: true,
        type: 'object',
        properties: { accepted: { type: 'boolean', const: true } },
        required: ['accepted'],
      },
      { accepted: false },
    );

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toEqual(['accepted']);
    expect(result.issues[0]?.message).toMatch(/constant/i);
  });

  test('validates local recursive and dynamic references', async () => {
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
    await expect(validateSchemaValue(recursive, { child: { child: {} } })).resolves.toMatchObject({
      valid: true,
    });
    await expect(validateSchemaValue(dynamic, { child: { child: {} } })).resolves.toMatchObject({
      valid: true,
    });
  });

  test('validates standard formats and rejects malformed values', async () => {
    const formats = [
      ['date', '2020-02-29', '2020-02-30'],
      ['time', '23:59:60Z', '24:00:00Z'],
      ['date-time', '2020-02-29T23:59:59Z', '2020-19-39T29:00:00Z'],
      ['email', 'ada@example.com', 'invalid'],
      ['iso-time', '12:30:00', 'invalid'],
      ['iso-time', '12:30:00+05:30', '29:00:00'],
      ['iso-date-time', '2020-01-01T12:30:00', '2020-19-39T29:00:00'],
      ['regex', 'a+', '['],
      ['json-pointer-uri-fragment', '#/name~1first%20name', '#/bad~2escape'],
      ['byte', 'YWJj', '!'],
      ['int32', 1, 2 ** 31],
      ['int64', 1, 1.5],
    ] as const;
    for (const [format, validValue, invalidValue] of formats) {
      await expect(validateSchemaValue({ format }, validValue)).resolves.toMatchObject({
        valid: true,
      });
      await expect(validateSchemaValue({ format }, invalidValue)).resolves.toMatchObject({
        valid: false,
      });
    }
  });

  test('accepts a nullable formatted field when its value is null', async () => {
    const schema = {
      type: 'object',
      properties: {
        reviewedOn: { type: ['string', 'null'], format: 'date' },
      },
    } as const;

    await expect(validateSchemaValue(schema, { reviewedOn: null })).resolves.toMatchObject({
      valid: true,
    });
    await expect(validateSchemaValue(schema, { reviewedOn: '2020-02-30' })).resolves.toMatchObject({
      valid: false,
    });
  });

  test('groups issues by path without overwriting the first field message', () => {
    expect(
      issuesByPath([
        { path: ['name'], message: 'First' },
        { path: ['name'], message: 'Second' },
        { path: ['nested', 'count'], message: 'Nested' },
      ]),
    ).toEqual({
      name: 'First',
      'nested/count': 'Nested',
    });
  });

  test('parses JSON pointer and raw JSON drafts', () => {
    expect(jsonPointerToPath('/nested/a~1b/c~0d')).toEqual(['nested', 'a/b', 'c~d']);
    expect(parseJsonDraft(['raw'], '{"ok":true}')).toEqual({ ok: true, value: { ok: true } });
    const invalid = parseJsonDraft(['raw'], '{');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issue.path).toEqual(['raw']);
  });

  test('serializes validated output and reads the native FormData output', () => {
    const serialized = serializeValidatedValue({ name: 'Ada' });
    expect(serialized).toEqual({ ok: true, value: '{"name":"Ada"}' });

    const formData = new FormData();
    formData.set('payload', '{"name":"Ada"}');
    expect(readSchemaFormData(formData, 'payload')).toEqual({ name: 'Ada' });
    expect(readSchemaFormData(formData, 'missing')).toBeUndefined();

    formData.set('payload', '{');
    expect(readSchemaFormData(formData, 'payload')).toBeUndefined();
  });

  test('reports non-serializable validated output', () => {
    const cycle: Record<string, unknown> = {};
    cycle['self'] = cycle;
    const serialized = serializeValidatedValue(cycle);
    expect(serialized.ok).toBe(false);
    if (!serialized.ok) {
      expect(serialized.issue.path).toEqual([]);
      expect(serialized.issue.message).toMatch(/circular|cyclic/i);
    }
  });

  test('rejects values that JSON would silently coerce or omit', () => {
    const nonFiniteNumber = serializeValidatedValue({ count: Number.NaN });
    expect(nonFiniteNumber.ok).toBe(false);
    if (!nonFiniteNumber.ok) {
      expect(nonFiniteNumber.issue.message).toMatch(/non-finite number/i);
    }

    const bigint = serializeValidatedValue({ count: 1n });
    expect(bigint.ok).toBe(false);
    if (!bigint.ok) {
      expect(bigint.issue.message).toMatch(/bigint/i);
    }

    const missingRootValue = serializeValidatedValue(undefined);
    expect(missingRootValue.ok).toBe(false);
    if (!missingRootValue.ok) {
      expect(missingRootValue.issue.message).toMatch(/not JSON serializable/i);
    }
  });
});
