import { join } from 'node:path';

import { beforeEach, describe, expect, test } from 'bun:test';

import {
  generateSchemaForComponent,
  resetSchemaProjectCache,
} from '../../generate-component-schema.ts';

const fixturesDirectory = import.meta.dir;

function generate(fileBaseName: string, componentName: string) {
  return generateSchemaForComponent({
    typesFilePath: join(fixturesDirectory, `${fileBaseName}.ts`),
    componentName,
    depthToSrc: 2,
  }).schema;
}

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
});
