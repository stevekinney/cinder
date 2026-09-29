import { describe, expect, test } from 'bun:test';

import { compileSchema } from 'json-schema-library';

import {
  childNodes,
  compileInterpreted,
  dedupeInterpreterErrors,
  isRefResolutionSchemaError,
  stripPointerHash,
} from './json-schema-interpreter.ts';

const DRAFTS = ['draft-07', '2019-09', '2020-12'] as const;

// Every format ajv-formats registers when `formats(ajv)` runs with default
// options (its `fullFormats` set). Each entry is [format, a value the
// format should accept, a value it should reject] — `null` for the reject
// slot means the format never rejects (ajv-formats registers it as a
// no-op/always-valid format).
const AJV_FORMATS_FIXTURES: [string, string | number, string | number | null][] = [
  ['date', '2024-01-15', 'not-a-date'],
  ['time', '12:00:00Z', 'not-a-time'],
  ['date-time', '2024-01-15T12:00:00Z', 'not-a-date-time'],
  ['iso-time', '12:00:00', 'not-a-time'],
  ['iso-date-time', '2024-01-15T12:00:00', 'not-a-date-time'],
  ['duration', 'P1D', 'not-a-duration'],
  ['uri', 'https://example.com', 'not a uri'],
  ['uri-reference', '/relative/path', String.raw`not\a uri`],
  ['uri-template', 'https://example.com/{id}', '\x00not-a-template'],
  ['url', 'https://example.com', 'not-a-url'],
  ['email', 'a@b.com', 'not-an-email'],
  ['hostname', 'example.com', 'exa mple'],
  ['ipv4', '127.0.0.1', '999.1.1.1'],
  ['ipv6', '::1', 'not-ipv6'],
  ['regex', '^[a-z]+$', '('],
  ['uuid', '123e4567-e89b-12d3-a456-426614174000', 'not-a-uuid'],
  ['json-pointer', '/a/b', 'a/b'],
  ['json-pointer-uri-fragment', '#/a/b', 'not-a-fragment'],
  ['relative-json-pointer', '0/a', 'not-a-relative-pointer'],
  ['byte', 'aGVsbG8=', 'not base64!!'],
  ['int32', 42, null],
  ['int64', 42, null],
  ['float', 1.5, null],
  ['double', 1.5, null],
  ['password', 'anything', null],
  ['binary', 'anything', null],
];

describe('json-schema-interpreter: local $ref', () => {
  for (const draft of DRAFTS) {
    test(`${draft}: resolves a local $defs reference`, async () => {
      const compiled = await compileInterpreted(
        {
          type: 'object',
          properties: { a: { $ref: '#/$defs/str' } },
          $defs: { str: { type: 'string' } },
        },
        draft,
      );
      expect(compiled.validate({ a: 'x' }).valid).toBe(true);
      expect(compiled.validate({ a: 1 }).valid).toBe(false);
      expect(compiled.schemaErrors).toEqual([]);
      expect(compiled.refErrors).toEqual([]);
    });
  }
});

describe('json-schema-interpreter: missing references', () => {
  test('a #/$defs/... shorthand ref to a missing target is caught eagerly (schemaErrors)', async () => {
    const compiled = await compileInterpreted({ $ref: '#/$defs/missing' }, '2020-12');
    expect(compiled.schemaErrors.length).toBeGreaterThan(0);
    // Meta-schema validation (schema-shape only) must stay blind to this —
    // it's a ref-resolution problem, not a structural one.
    const metaErrors = compiled.schemaErrors.filter((error) => !isRefResolutionSchemaError(error));
    expect(metaErrors).toEqual([]);
  });

  test('a general (non-shorthand) unresolved ref is still caught, via the eager tree walk', async () => {
    const compiled = await compileInterpreted(
      { type: 'object', properties: { a: { $ref: '#/nonexistent' } } },
      '2020-12',
    );
    // Not caught by the $defs-shorthand parse-time check...
    expect(compiled.schemaErrors).toEqual([]);
    // ...but caught by the eager walk regardless of what data is validated.
    expect(compiled.refErrors.length).toBeGreaterThan(0);
    expect(compiled.validate({}).valid).toBe(true); // lazy validate alone misses it
  });

  test('an unresolved ref nested three levels deep is caught', async () => {
    const compiled = await compileInterpreted(
      {
        type: 'object',
        properties: {
          a: { type: 'array', items: { allOf: [{ $ref: '#/nonexistent' }] } },
        },
      },
      '2020-12',
    );
    expect(compiled.refErrors.length).toBeGreaterThan(0);
  });

  test('tryCompile-equivalent (schemaErrors + refErrors, deduped) reports failure for every missing-ref shape', async () => {
    for (const schema of [{ $ref: '#/$defs/missing' }, { $ref: '#/nonexistent' }]) {
      const compiled = await compileInterpreted(schema, '2020-12');
      const combined = dedupeInterpreterErrors([...compiled.schemaErrors, ...compiled.refErrors]);
      expect(combined.length).toBeGreaterThan(0);
    }
  });
});

describe('json-schema-interpreter: 2019-09 $recursiveRef', () => {
  test('resolves recursive self-references and validates nested data', async () => {
    const compiled = await compileInterpreted(
      {
        $schema: 'https://json-schema.org/draft/2019-09/schema',
        $id: 'https://example.com/tree',
        $recursiveAnchor: true,
        type: 'object',
        properties: { children: { type: 'array', items: { $recursiveRef: '#' } } },
      },
      '2019-09',
    );
    expect(compiled.refErrors).toEqual([]);
    expect(compiled.validate({ children: [{ children: [] }] }).valid).toBe(true);
    expect(compiled.validate({ children: [{ children: 'nope' }] }).valid).toBe(false);
  });
});

describe('json-schema-interpreter: 2020-12 $dynamicRef', () => {
  test('resolves dynamic anchors and validates nested data', async () => {
    const compiled = await compileInterpreted(
      {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'https://example.com/tree2020',
        $dynamicAnchor: 'node',
        type: 'object',
        properties: { children: { type: 'array', items: { $dynamicRef: '#node' } } },
      },
      '2020-12',
    );
    expect(compiled.refErrors).toEqual([]);
    expect(compiled.validate({ children: [{ children: [] }] }).valid).toBe(true);
    expect(compiled.validate({ children: [{ children: 'nope' }] }).valid).toBe(false);
  });
});

describe('json-schema-interpreter: boolean schemas', () => {
  for (const draft of DRAFTS) {
    test(`${draft}: true accepts everything, false rejects everything`, async () => {
      const trueSchema = await compileInterpreted(true, draft);
      const falseSchema = await compileInterpreted(false, draft);
      expect(trueSchema.schemaErrors).toEqual([]);
      expect(falseSchema.schemaErrors).toEqual([]);
      expect(trueSchema.validate({ anything: 1 }).valid).toBe(true);
      expect(falseSchema.validate({ anything: 1 }).valid).toBe(false);
    });
  }
});

describe('json-schema-interpreter: unknown keywords (strict:false parity)', () => {
  test('an unrecognised keyword is preserved and does not affect validation', async () => {
    const compiled = await compileInterpreted(
      { type: 'string', 'x-vendor-extension': 42 },
      '2020-12',
    );
    expect(compiled.schemaErrors).toEqual([]);
    expect(compiled.validate('hello').valid).toBe(true);
    expect(compiled.validate(5).valid).toBe(false);
  });
});

describe('json-schema-interpreter: formats option', () => {
  test('formats defaults to enforced (JsonSchemaEditor behaviour)', async () => {
    const compiled = await compileInterpreted({ type: 'string', format: 'email' }, '2020-12');
    expect(compiled.validate('not-an-email').valid).toBe(false);
  });

  test('formats: false disables assertion without warning or schema error (SchemaForm behaviour)', async () => {
    const compiled = await compileInterpreted({ type: 'string', format: 'email' }, '2020-12', {
      formats: false,
    });
    expect(compiled.schemaErrors).toEqual([]);
    expect(compiled.validate('not-an-email').valid).toBe(true);
  });
});

describe('json-schema-interpreter: draft selection', () => {
  for (const draft of DRAFTS) {
    test(`${draft}: compiles and validates independent of the schema's own $schema`, async () => {
      // No $schema at all — the caller-selected draft applies regardless.
      const compiled = await compileInterpreted({ type: 'string' }, draft);
      expect(compiled.validate('x').valid).toBe(true);
      expect(compiled.validate(5).valid).toBe(false);
    });
  }
});

describe('json-schema-interpreter: every ajv-formats format', () => {
  for (const [format, validValue, invalidValue] of AJV_FORMATS_FIXTURES) {
    test(`${format} is a recognised format`, async () => {
      const type = typeof validValue === 'number' ? 'number' : 'string';
      const compiled = await compileInterpreted({ type, format }, '2020-12');
      expect(compiled.schemaErrors).toEqual([]);
      expect(compiled.validate(validValue).valid).toBe(true);
      if (invalidValue !== null) {
        expect(compiled.validate(invalidValue).valid).toBe(false);
      }
    });
  }
});

describe('json-schema-interpreter: pointer helpers', () => {
  test('stripPointerHash converts the root and nested pointers', () => {
    expect(stripPointerHash('#')).toBe('');
    expect(stripPointerHash('#/a/b')).toBe('/a/b');
  });
});

// Unlike float/double/password/binary (always-valid no-op formats, see
// AJV_FORMATS_FIXTURES above), int32 and int64 run a real check —
// int32Format also enforces the 32-bit signed range, int64Format enforces
// integer-ness. These pin the actual rejection path both formats share.
describe('json-schema-interpreter: int32/int64 formats actually reject bad values', () => {
  test('int32 rejects a non-integer number', async () => {
    const compiled = await compileInterpreted({ type: 'number', format: 'int32' }, '2020-12');
    const result = compiled.validate(1.5);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('format-int32-error');
    expect(result.errors[0]?.message).toContain('not a valid int32');
  });

  test('int32 rejects a number outside the 32-bit signed range', async () => {
    const compiled = await compileInterpreted({ type: 'number', format: 'int32' }, '2020-12');
    const tooLarge = compiled.validate(2 ** 31);
    const tooSmall = compiled.validate(-(2 ** 31) - 1);
    expect(tooLarge.valid).toBe(false);
    expect(tooSmall.valid).toBe(false);
    expect(compiled.validate(2 ** 31 - 1).valid).toBe(true);
    expect(compiled.validate(-(2 ** 31)).valid).toBe(true);
  });

  test('int64 rejects a non-integer number', async () => {
    const compiled = await compileInterpreted({ type: 'number', format: 'int64' }, '2020-12');
    const result = compiled.validate(1.5);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('format-int64-error');
    expect(result.errors[0]?.message).toContain('not a valid int64');
  });
});

// `collectRefErrors`'s eager walk declares `dependentSchemas` as a child-
// bearing field explicitly (see `childNodes`), so a $ref nested under it
// must be caught the same way a $ref under `properties` or `items` is.
describe('json-schema-interpreter: dependentSchemas participates in the eager ref walk', () => {
  test('an unresolved $ref nested under dependentSchemas is caught eagerly', async () => {
    const compiled = await compileInterpreted(
      {
        type: 'object',
        dependentSchemas: {
          creditCard: { $ref: '#/nonexistent' },
        },
      },
      '2019-09',
    );
    expect(compiled.schemaErrors).toEqual([]);
    expect(compiled.refErrors.length).toBeGreaterThan(0);
    expect(compiled.refErrors[0]?.pointer).toBe('#/dependentSchemas/creditCard');
    // Lazy validate alone would miss it, same as the `properties`-nested case above.
    expect(compiled.validate({}).valid).toBe(true);
  });

  test('a resolved $ref nested under dependentSchemas produces no ref error and still validates', async () => {
    const compiled = await compileInterpreted(
      {
        type: 'object',
        dependentSchemas: {
          creditCard: { $ref: '#/$defs/billing' },
        },
        $defs: { billing: { type: 'object', required: ['address'] } },
      },
      '2019-09',
    );
    expect(compiled.refErrors).toEqual([]);
    expect(compiled.validate({ creditCard: '1234' }).valid).toBe(false);
    expect(compiled.validate({ creditCard: '1234', address: '123 Main St' }).valid).toBe(true);
  });
});

describe('childNodes', () => {
  test('walks propertyDependencies children when a draft populates that opt-in keyword', () => {
    const root = compileSchema({
      type: 'object',
      properties: { circle: { type: 'number' }, square: { type: 'string' } },
    });
    const circle = root.properties?.['circle'];
    const square = root.properties?.['square'];
    if (circle === undefined || square === undefined) throw new Error('fixture nodes missing');

    // No draft this module compiles with registers `propertyDependencies`, so a
    // compiled node never carries it; build the one a registering draft would.
    const node = { ...circle, propertyDependencies: { shape: { circle, square } } };

    expect(childNodes(node)).toEqual([circle, square]);
  });
});
