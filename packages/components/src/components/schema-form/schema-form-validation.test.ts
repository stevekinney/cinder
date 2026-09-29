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

    expect(await validateSchemaValue(schema, { name: 'Ada', count: 1 })).toEqual({
      valid: true,
      value: { name: 'Ada', count: 1 },
      issues: [],
    });

    const invalid = await validateSchemaValue(schema, { name: '', count: 0 });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((issue) => issue.path)).toEqual([['name'], ['count']]);
  });

  test('humanizes a maximum-constraint violation as "must be at most N"', async () => {
    const schema = {
      type: 'object',
      properties: { count: { type: 'integer', maximum: 10 } },
      required: ['count'],
    };

    const result = await validateSchemaValue(schema, { count: 11 });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ path: ['count'], message: 'Count must be at most 10.' }]);
  });

  test('selects draft-07 and 2019-09 validators from $schema', async () => {
    expect(
      await validateSchemaValue(
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          properties: { mode: { type: 'string' } },
          required: ['mode'],
        },
        { mode: 'safe' },
      ),
    ).toEqual({ valid: true, value: { mode: 'safe' }, issues: [] });

    expect(
      await validateSchemaValue(
        {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        { name: 'Ada' },
      ),
    ).toEqual({ valid: true, value: { name: 'Ada' }, issues: [] });

    expect(
      await validateSchemaValue(
        {
          $schema: 'https://json-schema.org/draft/2019-09/schema',
          type: 'object',
          properties: { count: { type: 'integer' } },
          required: ['count'],
        },
        { count: 1 },
      ),
    ).toEqual({ valid: true, value: { count: 1 }, issues: [] });
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

  test('does not cache failed JSON Schema compilation attempts', async () => {
    const schema = {
      type: 'object',
      required: [1],
    } as Record<string, unknown>;

    const invalid = await validateSchemaValue(schema, {});
    expect(invalid.valid).toBe(false);

    schema['properties'] = { name: { type: 'string' } };
    schema['required'] = ['name'];

    expect(await validateSchemaValue(schema, { name: 'Ada' })).toEqual({
      valid: true,
      value: { name: 'Ada' },
      issues: [],
    });
  });

  test('does not cache a schema whose compilation throws synchronously, and recovers once fixed', async () => {
    // A `$ref` that isn't a string isn't reported through `schemaErrors`/
    // `refErrors` — json-schema-library's own URI parsing throws
    // synchronously while walking it, which surfaces through
    // `compileInterpreted`'s returned promise REJECTING rather than
    // resolving with errors attached. This exercises the outer try/catch in
    // `validateJsonSchemaValue` and `validatorForSchema`'s `.catch` cache
    // cleanup, neither of which the "does not cache failed ... compilation
    // attempts" test above reaches (that one resolves with `schemaErrors`
    // populated; it never rejects).
    const schema = {
      type: 'object',
      properties: { a: { $ref: 42 } },
    } as Record<string, unknown>;

    const invalid = await validateSchemaValue(schema, { a: 1 });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues).toEqual([
      { path: [], message: expect.stringContaining('Invalid JSON Schema') },
    ]);

    // Retrying the same still-broken schema object doesn't get stuck behind
    // a poisoned cached rejection.
    const stillInvalid = await validateSchemaValue(schema, { a: 1 });
    expect(stillInvalid.valid).toBe(false);

    // Fixing the SAME object reference and revalidating succeeds — the
    // failed compile attempt was not cached against it.
    schema['properties'] = { a: { type: 'number' } };
    expect(await validateSchemaValue(schema, { a: 1 })).toEqual({
      valid: true,
      value: { a: 1 },
      issues: [],
    });
  });

  test('validates a falsy root value against a boolean-typed schema', async () => {
    const result = await validateSchemaValue(
      {
        $async: true,
        type: 'boolean',
      },
      false,
    );

    expect(result).toEqual({ valid: true, value: false, issues: [] });
  });

  // `$async` is not a JSON Schema keyword — it was an Ajv-only compile hint
  // this file's implementation never actually depended on for real
  // asynchronous validators, so it's preserved here only as an unknown
  // keyword (see "accepts an unrecognised keyword" above) rather than
  // treated as a supported schema feature.
  test('reports a const violation as a validation issue at the field path', async () => {
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
    expect(result.issues[0]?.message).toMatch(/`true`/i);
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

  // COR-228 parity fixtures — preserved across the CSP-safe interpreter swap.
  test('validates through a local $ref', async () => {
    const schema = {
      type: 'object',
      properties: { a: { $ref: '#/$defs/str' } },
      $defs: { str: { type: 'string' } },
    };
    expect(await validateSchemaValue(schema, { a: 'x' })).toEqual({
      valid: true,
      value: { a: 'x' },
      issues: [],
    });
    const invalid = await validateSchemaValue(schema, { a: 1 });
    expect(invalid.valid).toBe(false);
  });

  test('validates through a 2019-09 $recursiveRef', async () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2019-09/schema',
      $id: 'schema-form-recursive-ref',
      $recursiveAnchor: true,
      type: 'object',
      properties: { children: { type: 'array', items: { $recursiveRef: '#' } } },
    };
    const valid = await validateSchemaValue(schema, { children: [{ children: [] }] });
    expect(valid.valid).toBe(true);
    const invalid = await validateSchemaValue(schema, { children: [{ children: 'nope' }] });
    expect(invalid.valid).toBe(false);
  });

  test('validates through a 2020-12 $dynamicRef', async () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'schema-form-dynamic-ref',
      $dynamicAnchor: 'node',
      type: 'object',
      properties: { children: { type: 'array', items: { $dynamicRef: '#node' } } },
    };
    const valid = await validateSchemaValue(schema, { children: [{ children: [] }] });
    expect(valid.valid).toBe(true);
    const invalid = await validateSchemaValue(schema, { children: [{ children: 'nope' }] });
    expect(invalid.valid).toBe(false);
  });

  test('reports a missing $ref target as a root compilation issue', async () => {
    const result = await validateSchemaValue(
      { type: 'object', properties: { a: { $ref: '#/nonexistent' } } },
      { a: 1 },
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toEqual([]);
  });

  test('accepts an unrecognised keyword without affecting validation', async () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } }, 'x-vendor': 42 };
    expect(await validateSchemaValue(schema, { a: 'x' })).toEqual({
      valid: true,
      value: { a: 'x' },
      issues: [],
    });
  });

  // SchemaForm has never registered ajv-formats (unlike JsonSchemaEditor,
  // which does — see json-schema-validator.test.ts). Under Ajv's strict:false,
  // an unregistered `format` is a no-op: the keyword is recognised (no
  // warning, no schema error) but never asserts, so any value passes
  // regardless of the format's validity. That is SchemaForm's actual
  // current behaviour and this repair doesn't own changing it — preserve it
  // exactly rather than newly enforcing formats as a side effect of sharing
  // an interpreter with JsonSchemaEditor.
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

  test('every ajv-formats format is recognised but not asserted (matches current behaviour)', async () => {
    for (const format of AJV_FORMATS) {
      const type = ['int32', 'int64', 'float', 'double'].includes(format) ? 'number' : 'string';
      const schema = { type, format };
      const obviouslyInvalidValue =
        type === 'number' ? Number.NaN : '\u0000not a valid anything\u0000';
      const result = await validateSchemaValue(schema, obviouslyInvalidValue);
      // Type mismatches (NaN isn't a JSON Schema "number" once serialised,
      // but Ajv's runtime check treats it as one) still short-circuit
      // before reaching format — assert on the *reported issues*, not
      // truthiness, so a real behaviour change (format newly enforced)
      // fails loudly instead of coincidentally passing on the type check.
      const formatIssue = result.issues.find((issue) =>
        issue.message.toLowerCase().includes('format'),
      );
      expect(formatIssue).toBeUndefined();
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
