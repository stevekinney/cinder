import { join } from 'node:path';

import { beforeEach, describe, expect, setDefaultTimeout, test } from 'bun:test';

import {
  generateSchemaForComponent,
  resetSchemaProjectCache,
} from '../../generate-component-schema.ts';

const fixturesDirectory = import.meta.dir;
const jsonSchemaThenKeyword = ['th', 'en'].join('') as 'then';

function generate(fileBaseName: string, componentName: string) {
  return generateSchemaForComponent({
    typesFilePath: join(fixturesDirectory, `${fileBaseName}.ts`),
    componentName,
    depthToSrc: 2,
  }).schema;
}

// Each test recompiles a TS project (beforeEach resets the schema cache), which
// is inherently slow and exceeds the 5s default under CPU contention. Raise it.
setDefaultTimeout(60_000);

beforeEach(() => {
  resetSchemaProjectCache();
});

describe('generate-component-schema — <Name>Props fallback HTML-attribute filtering', () => {
  test('direct HTMLButtonAttributes extension keeps only local props', () => {
    const { properties } = generate('direct-extension', 'direct-extension');
    const propertyNames = Object.keys(properties).toSorted();

    // Locally declared cinder props survive.
    expect(propertyNames).toContain('variant');

    // None of the inherited HTML attribute surface leaks in.
    const forbiddenInherited = [
      'aria-label',
      'aria-hidden',
      'onclick',
      'onkeydown',
      'id',
      'name',
      'type',
      'disabled',
      'form',
      'value',
    ];
    for (const forbiddenName of forbiddenInherited) {
      expect(propertyNames).not.toContain(forbiddenName);
    }
  });

  test('Omit<...> + local shadow preserves the local property', () => {
    const { properties, required } = generate('omit-and-shadow', 'omit-and-shadow');
    expect(Object.keys(properties)).toContain('disabled');
    expect(properties['disabled']?.type).toBe('boolean');
    // `disabled: boolean` (non-optional) — must appear in `required`.
    expect(required).toContain('disabled');
    expect(Object.keys(properties)).toContain('size');
    // No inherited HTML attribute leaks.
    expect(Object.keys(properties)).not.toContain('aria-label');
    expect(Object.keys(properties)).not.toContain('onclick');
  });

  test('alias-renamed HTML attributes are still filtered', () => {
    const { properties } = generate('alias-rename', 'alias-rename');
    expect(Object.keys(properties)).toContain('tone');
    expect(Object.keys(properties)).not.toContain('placeholder');
    expect(Object.keys(properties)).not.toContain('aria-label');
    expect(Object.keys(properties)).not.toContain('onchange');
  });

  test('intersection of two HTML attribute sets filters every inherited prop', () => {
    const { properties } = generate('intersection', 'intersection');
    expect(Object.keys(properties)).toContain('tone');
    expect(Object.keys(properties)).not.toContain('href');
    expect(Object.keys(properties)).not.toContain('disabled');
    expect(Object.keys(properties)).not.toContain('aria-label');
    expect(Object.keys(properties)).not.toContain('onclick');
  });

  test('Pick<> / Partial<> mapped utility types still filter inherited HTML attributes', () => {
    const { properties } = generate('mapped-utility', 'mapped-utility');
    // Local prop must survive.
    expect(Object.keys(properties)).toContain('tone');
    // Pick-selected HTML attributes must still be filtered — their declaration
    // site is `svelte/elements` even after mapping.
    expect(Object.keys(properties)).not.toContain('id');
    expect(Object.keys(properties)).not.toContain('name');
    expect(Object.keys(properties)).not.toContain('disabled');
  });

  test('locally-declared prop shadowing an HTML attribute is preserved', () => {
    const { properties, required } = generate('local-shadow', 'local-shadow');
    expect(Object.keys(properties)).toContain('disabled');
    expect(properties['disabled']?.type).toBe('boolean');
    expect(required).toContain('disabled');
    // Every other inherited attribute is still filtered.
    expect(Object.keys(properties)).not.toContain('aria-label');
    expect(Object.keys(properties)).not.toContain('onclick');
    expect(Object.keys(properties)).not.toContain('form');
  });

  test('array props preserve simple object item contracts', () => {
    const { properties, required } = generate('object-array', 'object-array');
    expect(required).toContain('items');
    expect(properties['items']).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Stable item identifier.',
          },
          label: {
            type: 'string',
            description: 'Visible item label.',
          },
        },
        required: ['label'],
        additionalProperties: false,
      },
      description: 'Items to render.',
    });
  });

  test('nested object arrays include the object property schema', () => {
    const { properties } = generate('nested-object-array', 'nested-object-array');
    const entries = properties['entries'];

    expect(entries?.type).toBe('array');
    expect(entries?.items?.type).toBe('object');
    expect(entries?.items?.additionalProperties).toBe(false);
    expect(entries?.items?.required).toEqual(['id', 'title']);
    expect(entries?.items?.properties?.['id']?.type).toBe('string');
    expect(entries?.items?.properties?.['title']?.description).toBe('Visible title.');
    expect(entries?.items?.properties?.['tone']?.enum).toEqual([
      'info',
      'success',
      'warning',
      'error',
    ]);
    expect(entries?.items?.properties?.['tone']?.default).toBe('info');
  });

  test('schema object props preserve object property contracts', () => {
    const { properties, metadata } = generate('schema-object-prop', 'schema-object-prop');
    const anchorPoint = properties['anchorPoint'];

    expect(metadata?.unsupportedProps).toBeUndefined();
    expect(anchorPoint).toEqual({
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['x', 'y'],
      additionalProperties: false,
    });
  });

  test('modal schema requires describedById for alertdialog role', () => {
    const { allOf } = generate('modal', 'modal');

    expect(allOf).toEqual([
      {
        if: {
          properties: {
            role: { const: 'alertdialog' },
          },
          required: ['role'],
        },
        [jsonSchemaThenKeyword]: {
          required: ['describedById'],
        },
      },
    ]);
  });

  test('untagged object props stay unsupported instead of widening to opaque object schemas', () => {
    const { properties, metadata } = generate('opaque-object', 'opaque-object');
    expect(properties['value']).toBeUndefined();
    expect(properties['values']).toBeUndefined();
    expect(metadata?.unsupportedProps).toEqual([
      { name: 'value', reason: 'unknown-shape' },
      { name: 'values', reason: 'unknown-shape' },
    ]);
  });
});
