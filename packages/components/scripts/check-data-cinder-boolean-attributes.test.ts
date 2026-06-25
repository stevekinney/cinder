import { describe, expect, test } from 'bun:test';

import { findBooleanAttributeViolations } from './check-data-cinder-boolean-attributes';

describe('check-data-cinder-boolean-attributes', () => {
  test('flags quoted boolean string ternary branches', () => {
    const source = `<div data-cinder-open={open ? 'true' : 'false'} />`;

    expect(findBooleanAttributeViolations(source, 'fixture.svelte')).toEqual([
      "fixture.svelte:1: data-cinder-open={open ? 'true' : 'false'}",
    ]);
  });

  test('flags unquoted boolean ternary branches', () => {
    const source = `<div data-cinder-selected={selected ? true : false} />`;

    expect(findBooleanAttributeViolations(source, 'fixture.svelte')).toEqual([
      'fixture.svelte:1: data-cinder-selected={selected ? true : false}',
    ]);
  });

  test('allows presence semantics', () => {
    const source = `<div data-cinder-open={open ? '' : undefined} />`;

    expect(findBooleanAttributeViolations(source, 'fixture.svelte')).toEqual([]);
  });
});
