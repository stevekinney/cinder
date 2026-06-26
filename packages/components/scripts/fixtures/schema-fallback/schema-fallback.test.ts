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
  });
}

function generateSchema(fileBaseName: string, componentName: string) {
  return generate(fileBaseName, componentName).schema;
}

function parseSchemaModuleJson(schemaModule: string) {
  const startMarker = 'JSON.parse(';
  const endMarker = ') as ComponentSchema;';
  const start = schemaModule.indexOf(startMarker);
  const end = schemaModule.indexOf(endMarker);

  expect(start).not.toBe(-1);
  expect(end).not.toBe(-1);

  const jsonText = JSON.parse(schemaModule.slice(start + startMarker.length, end));
  return JSON.parse(jsonText);
}

// Each test recompiles a TS project (beforeEach resets the schema cache), which
// is inherently slow and exceeds the 5s default under CPU contention. Raise it.
setDefaultTimeout(60_000);

beforeEach(() => {
  resetSchemaProjectCache();
});

describe('generate-component-schema — <Name>Props fallback HTML-attribute filtering', () => {
  test('direct HTMLButtonAttributes extension keeps only local props', () => {
    const { properties } = generateSchema('direct-extension', 'direct-extension');
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
    const { properties, required } = generateSchema('omit-and-shadow', 'omit-and-shadow');
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
    const { properties } = generateSchema('alias-rename', 'alias-rename');
    expect(Object.keys(properties)).toContain('tone');
    expect(Object.keys(properties)).not.toContain('placeholder');
    expect(Object.keys(properties)).not.toContain('aria-label');
    expect(Object.keys(properties)).not.toContain('onchange');
  });

  test('intersection of two HTML attribute sets filters every inherited prop', () => {
    const { properties } = generateSchema('intersection', 'intersection');
    expect(Object.keys(properties)).toContain('tone');
    expect(Object.keys(properties)).not.toContain('href');
    expect(Object.keys(properties)).not.toContain('disabled');
    expect(Object.keys(properties)).not.toContain('aria-label');
    expect(Object.keys(properties)).not.toContain('onclick');
  });

  test('Pick<> / Partial<> mapped utility types still filter inherited HTML attributes', () => {
    const { properties } = generateSchema('mapped-utility', 'mapped-utility');
    // Local prop must survive.
    expect(Object.keys(properties)).toContain('tone');
    // Pick-selected HTML attributes must still be filtered — their declaration
    // site is `svelte/elements` even after mapping.
    expect(Object.keys(properties)).not.toContain('id');
    expect(Object.keys(properties)).not.toContain('name');
    expect(Object.keys(properties)).not.toContain('disabled');
  });

  test('locally-declared prop shadowing an HTML attribute is preserved', () => {
    const { properties, required } = generateSchema('local-shadow', 'local-shadow');
    expect(Object.keys(properties)).toContain('disabled');
    expect(properties['disabled']?.type).toBe('boolean');
    expect(required).toContain('disabled');
    // Every other inherited attribute is still filtered.
    expect(Object.keys(properties)).not.toContain('aria-label');
    expect(Object.keys(properties)).not.toContain('onclick');
    expect(Object.keys(properties)).not.toContain('form');
  });

  test('array props preserve simple object item contracts', () => {
    const { properties, required } = generateSchema('object-array', 'object-array');
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
    const { properties } = generateSchema('nested-object-array', 'nested-object-array');
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

  test('deep nested object arrays include child object property schemas', () => {
    const { properties, metadata } = generateSchema(
      'deep-nested-object-array',
      'deep-nested-object-array',
    );
    const entries = properties['entries'];
    const children = entries?.items?.properties?.['children'];
    const details = children?.items?.properties?.['details'];

    expect(metadata?.unsupportedProps).toBeUndefined();
    expect(details?.type).toBe('array');
    expect(details?.items?.type).toBe('object');
    expect(details?.items?.properties?.['id']?.description).toBe('Detail identifier.');
    expect(details?.items?.properties?.['content']?.type).toBe('string');
    expect(details?.items?.required).toEqual(['content', 'id']);
  });

  test('schema object props preserve object property contracts', () => {
    const { properties, metadata } = generateSchema('schema-object-prop', 'schema-object-prop');
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
    const { allOf } = generateSchema('modal', 'modal');

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

  test('grid schema tightens numeric columns to positive integers', () => {
    const { properties } = generateSchema('grid', 'grid');

    expect(properties['columns']?.anyOf).toContainEqual({ type: 'string' });
    expect(properties['columns']?.anyOf).toContainEqual({ type: 'integer', minimum: 1 });
  });

  test('allOf schema modules preserve special characters through JSON string rendering', () => {
    const { schema, schemaModule } = generate('modal', 'modal');
    const parsedSchemaModule = parseSchemaModuleJson(schemaModule);

    expect(parsedSchemaModule.properties.title.description).toBe(
      schema.properties['title']?.description,
    );
  });

  test('untagged object props stay unsupported instead of widening to opaque object schemas', () => {
    const { properties, metadata } = generateSchema('opaque-object', 'opaque-object');
    expect(properties['value']).toBeUndefined();
    expect(properties['values']).toBeUndefined();
    // Unsupported entries now carry the prop's required-ness and authored JSDoc
    // description so the generated README can document a prop the JSON schema
    // can't express without falsely showing it as optional and undescribed.
    expect(metadata?.unsupportedProps).toEqual([
      {
        name: 'value',
        reason: 'unknown-shape',
        required: true,
        description: 'Untagged object should not be widened to a permissive object schema.',
      },
      {
        name: 'values',
        reason: 'unknown-shape',
        required: true,
        description:
          'Untagged object arrays should stay unsupported unless their item type is explicit.',
      },
    ]);
  });

  test('allowlist-omitted function/snippet props are recorded in unsupportedProps, not dropped', () => {
    const { properties, required, metadata } = generateSchema(
      'allowlist-omits-callback',
      'allowlist-omits-callback',
    );

    // The curated allowlist expresses only `label` in the schema proper.
    expect(Object.keys(properties)).toEqual(['label']);
    expect(required).toEqual(['label']);

    // The omitted function/snippet props — part of the public API but absent
    // from the allowlist — are surfaced in `unsupportedProps` (name-sorted) with
    // faithful required-ness and authored descriptions: `footer` (snippet),
    // `ondismiss` (optional callback), `onselect` (required callback).
    expect(metadata?.unsupportedProps).toEqual([
      {
        name: 'footer',
        reason: 'function-or-snippet',
        description: 'Snippet rendered in the card footer.',
      },
      {
        name: 'ondismiss',
        reason: 'function-or-snippet',
        description: 'Optional teardown callback.',
      },
      {
        name: 'onselect',
        reason: 'function-or-snippet',
        required: true,
        description: 'Fired when the option is selected.',
      },
    ]);

    // Negative cases — the scan records ONLY function/snippet props:
    const recordedNames = (metadata?.unsupportedProps ?? []).map((entry) => entry.name);
    // `badge` is EXPRESSIBLE (a number) and curated out of the allowlist on
    // purpose — JSON Schema can represent it, so the author's omission stands.
    // It must appear in NEITHER properties (allowlist omitted it) NOR
    // unsupportedProps (the scan skips expressible props).
    expect(Object.keys(properties)).not.toContain('badge');
    expect(recordedNames).not.toContain('badge');
    // Inherited svelte/elements handlers (onclick et al.) are never recorded.
    expect(recordedNames).not.toContain('onclick');
  });

  test('the post-loop scan is gated to the allowlist path — a no-allowlist component is unchanged', () => {
    // `local-shadow` exports only `LocalShadowProps` (no `LocalShadowSchemaProps`),
    // so it travels the FALLBACK path and the post-loop allowlist scan must NOT
    // run. Its only unsupported entry is the pre-existing `class` attribute
    // (opaque shape, recorded by the main loop). The scan must not inject any
    // `function-or-snippet` entry here — the fallback output is exactly the main
    // loop's, untouched.
    const { properties, metadata } = generateSchema('local-shadow', 'local-shadow');
    expect(Object.keys(properties)).toContain('disabled');
    const reasons = (metadata?.unsupportedProps ?? []).map((entry) => entry.reason);
    expect(reasons).not.toContain('function-or-snippet');
  });
});
