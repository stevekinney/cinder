import { describe, expect, test } from 'bun:test';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import Ajv2019 from 'ajv/dist/2019';
import Ajv2020 from 'ajv/dist/2020';

import { compileJsonSchemaRuntime, validateJsonSchemaRuntime } from './json-schema-runtime.ts';

describe('JSON Schema runtime', () => {
  test('reports a rejected numeric format through the custom validator', () => {
    const node = compileJsonSchemaRuntime({ type: 'number', format: 'int32' });
    const result = validateJsonSchemaRuntime(node, 2 ** 31);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('format-int32-error');
  });

  test('reports a rejected string format through the custom validator', () => {
    const node = compileJsonSchemaRuntime({ type: 'string', format: 'date' });
    const result = validateJsonSchemaRuntime(node, '2020-02-30');

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('format-date-error');
  });

  test('skips a string format for a non-string value', () => {
    const node = compileJsonSchemaRuntime({ format: 'date' });
    const result = validateJsonSchemaRuntime(node, 2020);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('skips formats for null values allowed by a nullable schema', () => {
    const node = compileJsonSchemaRuntime({ type: ['string', 'null'], format: 'date' });

    expect(validateJsonSchemaRuntime(node, null)).toEqual({ valid: true, errors: [] });
    expect(validateJsonSchemaRuntime(node, '2020-02-30').valid).toBe(false);
  });

  test('skips numeric formats for strings while still rejecting malformed numbers', () => {
    const node = compileJsonSchemaRuntime({ format: 'int32' });

    expect(validateJsonSchemaRuntime(node, 'not-a-number')).toEqual({ valid: true, errors: [] });
    const result = validateJsonSchemaRuntime(node, 2 ** 31);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('format-int32-error');
  });

  test.each([
    'http://json-schema.org/draft-07/schema#',
    'https://json-schema.org/draft/2019-09/schema',
    'https://json-schema.org/draft/2020-12/schema',
  ])('applies format assertions only to applicable types under %s', ($schema) => {
    const stringFormat = compileJsonSchemaRuntime({ $schema, format: 'date' });
    const numericFormat = compileJsonSchemaRuntime({ $schema, format: 'int32' });

    expect(validateJsonSchemaRuntime(stringFormat, 2020).valid).toBe(true);
    expect(validateJsonSchemaRuntime(numericFormat, '2020').valid).toBe(true);
    expect(validateJsonSchemaRuntime(stringFormat, '2020-02-30').valid).toBe(false);
    expect(validateJsonSchemaRuntime(numericFormat, 2 ** 31).valid).toBe(false);
  });

  test.each([
    ['http://json-schema.org/draft-07/schema#', Ajv],
    ['https://json-schema.org/draft/2019-09/schema', Ajv2019],
    ['https://json-schema.org/draft/2020-12/schema', Ajv2020],
  ] as const)(
    'matches Ajv applicability for every installed format under %s',
    ($schema, AjvClass) => {
      const ajv = new AjvClass({ strict: false });
      addFormats(ajv);

      for (const [format, definition] of Object.entries(fullFormats)) {
        const nonApplicableValue =
          typeof definition === 'object' && definition !== null && 'type' in definition
            ? 'not-a-number'
            : 123;
        const schema = { $schema, format };
        const control = ajv.compile(schema);
        const runtime = compileJsonSchemaRuntime(schema);
        for (const value of [nonApplicableValue, null, true, {}, []]) {
          const result = validateJsonSchemaRuntime(runtime, value);
          expect(result.valid).toBe(control(value));
          expect(result.valid).toBe(true);
        }
      }
    },
  );

  test('falls back to the default draft for an unknown override', () => {
    expect(compileJsonSchemaRuntime({ type: 'string' }, 'future-draft').schema).toEqual({
      type: 'string',
    });
  });

  test('rejects an override that contradicts the declared schema draft', () => {
    const schema = { $schema: 'http://json-schema.org/draft-07/schema#', type: 'string' };

    expect(() => compileJsonSchemaRuntime(schema, '2020-12')).toThrow(
      'Schema draft draft-07 does not match override 2020-12',
    );
    expect(
      validateJsonSchemaRuntime(compileJsonSchemaRuntime(schema, 'draft-07'), 'value'),
    ).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects an unknown declared draft', () => {
    expect(() =>
      compileJsonSchemaRuntime({
        $schema: 'https://example.invalid/draft/future/schema',
        type: 'string',
      }),
    ).toThrow('Unknown JSON Schema draft: https://example.invalid/draft/future/schema');
  });
});
