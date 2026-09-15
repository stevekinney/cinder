import { describe, expect, test } from 'bun:test';

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

  test('rejects a non-string value for an object-backed string format', () => {
    const node = compileJsonSchemaRuntime({ format: 'date' });
    const result = validateJsonSchemaRuntime(node, 2020);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('format-date-error');
  });

  test('falls back to the default draft for an unknown override', () => {
    expect(compileJsonSchemaRuntime({ type: 'string' }, 'future-draft').schema).toEqual({
      type: 'string',
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
