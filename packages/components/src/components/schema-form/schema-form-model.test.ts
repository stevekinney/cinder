import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  arrayValueAtPath,
  collectJsonFields,
  createSchemaFormModel,
  decodeEnumValue,
  defaultValueForField,
  encodeEnumValue,
  getValueAtPath,
  initialValueForField,
  isJsonSchemaObject,
  isStandardSchema,
  jsonSchemaFromStandardSchema,
  pathId,
  pathKey,
  pruneUndefined,
  rebaseFieldPath,
  setValueAtPath,
  type JsonSchemaObject,
} from './schema-form-model.ts';

describe('schema-form model', () => {
  const schema = {
    type: 'object',
    title: 'Payload',
    properties: {
      name: { type: 'string', title: 'Name', description: 'Visible name.' },
      count: { type: 'integer', title: 'Count' },
      active: { type: 'boolean', title: 'Active' },
      mode: { type: 'string', title: 'Mode', enum: ['fast', 'safe'] },
      tags: { type: 'array', title: 'Tags', items: { type: 'string', title: 'Tag' } },
      nested: {
        type: 'object',
        title: 'Nested',
        properties: { owner: { type: 'string', title: 'Owner' } },
        required: ['owner'],
      },
      raw: { title: 'Raw payload', oneOf: [{ type: 'string' }, { type: 'number' }] },
    },
    required: ['name', 'count', 'active', 'mode', 'nested'],
  } satisfies JsonSchemaObject;

  test('detects JSON Schema and Standard Schema inputs', () => {
    const standard = z.object({ name: z.string() });
    expect(isJsonSchemaObject(schema)).toBe(true);
    expect(isStandardSchema(standard)).toBe(true);
    expect(isJsonSchemaObject(standard)).toBe(false);
  });

  test('extracts an inspectable JSON Schema from Zod Standard Schema', () => {
    const standard = z.object({ name: z.string().min(1), count: z.number().int() });
    const extracted = jsonSchemaFromStandardSchema(standard);
    expect(extracted?.['type']).toBe('object');
    expect(extracted?.['properties']).toMatchObject({
      name: { type: 'string', minLength: 1 },
      count: { type: 'integer' },
    });
  });

  test('ignores invalid or throwing Standard Schema JSON Schema converters', () => {
    const nonObjectSchema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => ({ value }),
        jsonSchema: {
          input: () => 'not-json-schema',
          output: () => ({}),
        },
      },
    } as const;
    const throwingSchema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => ({ value }),
        jsonSchema: {
          input: () => {
            throw new Error('cannot inspect');
          },
          output: () => ({}),
        },
      },
    } as const;

    expect(jsonSchemaFromStandardSchema(nonObjectSchema)).toBeNull();
    expect(jsonSchemaFromStandardSchema(throwingSchema)).toBeNull();
  });

  test('builds fields for every supported field type and preserves raw JSON fallbacks', () => {
    const model = createSchemaFormModel(schema);
    expect(model.field.kind).toBe('object');
    expect(model.field.label).toBe('Payload');
    expect(model.field.fields.map((field) => [field.key, field.kind])).toEqual([
      ['name', 'string'],
      ['count', 'integer'],
      ['active', 'boolean'],
      ['mode', 'enum'],
      ['tags', 'array'],
      ['nested', 'object'],
      ['raw', 'json'],
    ]);

    const mode = model.field.fields.find((field) => field.key === 'mode');
    expect(mode?.options).toEqual([
      { label: 'fast', value: 'fast', encodedValue: '"fast"' },
      { label: 'safe', value: 'safe', encodedValue: '"safe"' },
    ]);

    const tags = model.field.fields.find((field) => field.key === 'tags');
    expect(tags?.item?.kind).toBe('string');

    const rawFields = collectJsonFields(model.field);
    expect(rawFields.map((field) => field.key)).toEqual(['raw']);
  });

  test('builds raw JSON fields for non-object subschemas and honors nullable type arrays', () => {
    const model = createSchemaFormModel({
      type: 'object',
      properties: {
        invalid: false,
        optionalName: { type: ['null', 'string'], title: 'Optional name' },
      },
    });

    expect(model.field.fields.map((field) => [field.key, field.kind])).toEqual([
      ['invalid', 'json'],
      ['optionalName', 'string'],
    ]);
  });

  test('falls back to a raw JSON field when a Standard Schema cannot expose JSON Schema', () => {
    const standard = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => ({ value }),
      },
    } as const;

    const model = createSchemaFormModel(standard);
    expect(model.field.kind).toBe('json');
    expect(model.field.description).toContain('cannot be inspected');
  });

  test('creates defaults and preserves caller-provided initial values', () => {
    const model = createSchemaFormModel(schema);
    expect(defaultValueForField(model.field)).toEqual({
      name: '',
      count: undefined,
      active: false,
      mode: 'fast',
      tags: [],
      nested: { owner: '' },
      raw: null,
    });

    const initial = { name: 'Ada', count: 2, active: true, mode: 'safe' };
    expect(initialValueForField(model.field, initial)).toEqual({
      ...initial,
      tags: [],
      nested: { owner: '' },
      raw: null,
    });
  });

  test('seeds omitted fields in partial initial object and array values', () => {
    const model = createSchemaFormModel({
      type: 'object',
      properties: {
        name: { type: 'string', default: 'Ada' },
        active: { type: 'boolean' },
        nested: {
          type: 'object',
          properties: {
            owner: { type: 'string', default: 'Grace' },
            count: { type: 'integer' },
          },
        },
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', default: 'email' },
              value: { type: 'string' },
            },
          },
        },
      },
    });

    expect(
      initialValueForField(model.field, {
        active: true,
        nested: { count: 2 },
        contacts: [{ value: 'ada@example.com' }],
        extra: 'preserved',
      }),
    ).toEqual({
      name: 'Ada',
      active: true,
      nested: { owner: 'Grace', count: 2 },
      contacts: [{ kind: 'email', value: 'ada@example.com' }],
      extra: 'preserved',
    });
  });

  test('reads, writes, prunes, and lists values by schema paths', () => {
    const value = { nested: { owner: 'Ada' }, tags: ['one'], missing: undefined };
    expect(getValueAtPath(value, ['nested', 'owner'])).toBe('Ada');
    expect(setValueAtPath(value, ['nested', 'owner'], 'Grace')).toEqual({
      nested: { owner: 'Grace' },
      tags: ['one'],
      missing: undefined,
    });
    expect(arrayValueAtPath(value, ['tags'])).toEqual(['one']);
    expect(arrayValueAtPath(value, ['nested'])).toEqual([]);
    expect(pruneUndefined(value)).toEqual({ nested: { owner: 'Ada' }, tags: ['one'] });
  });

  test('rebases array item field paths for a concrete index', () => {
    const model = createSchemaFormModel(schema);
    const tags = model.field.fields.find((field) => field.key === 'tags');
    expect(tags?.item).toBeDefined();
    const item = rebaseFieldPath(tags!.item!, ['tags', '2']);
    expect(item.path).toEqual(['tags', '2']);
  });

  test('encodes path and enum values for DOM-safe ids and select values', () => {
    expect(pathKey(['a/b', 'c~d'])).toBe('a~1b/c~0d');
    expect(pathId(['a/b', 'c~d'])).toBe('a-b-c-d');
    expect(decodeEnumValue(encodeEnumValue(true))).toBe(true);
    expect(decodeEnumValue(encodeEnumValue(2))).toBe(2);
    expect(decodeEnumValue(encodeEnumValue(null))).toBeNull();
    expect(() => decodeEnumValue('{"not":"primitive"}')).toThrow();
  });
});
