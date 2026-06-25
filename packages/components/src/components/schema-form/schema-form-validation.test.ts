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
  test('validates JSON Schema values with lazy Ajv compilation', async () => {
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
