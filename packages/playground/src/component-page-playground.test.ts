import { describe, expect, test } from 'bun:test';

import { buildPlaygroundModel, buildSnippet } from './component-page-playground.ts';
import type { ComponentManifest, PropManifest } from './types.ts';

function manifest(props: PropManifest[]): ComponentManifest {
  return { name: 'Demo', kebabName: 'demo', file: 'demo.svelte', importPath: 'demo', props };
}

describe('buildPlaygroundModel', () => {
  test('classifies boolean/select/text/number props into controls', () => {
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'flag',
          control: { kind: 'boolean' },
          bindable: false,
          optional: true,
          defaultValue: true,
        },
        {
          name: 'variant',
          control: { kind: 'select', options: ['a', 'b'] },
          bindable: false,
          optional: true,
          defaultValue: 'b',
        },
        {
          name: 'title',
          control: { kind: 'text' },
          bindable: false,
          optional: true,
          defaultValue: 'hi',
        },
        {
          name: 'count',
          control: { kind: 'number' },
          bindable: false,
          optional: true,
          defaultValue: 3,
        },
      ]),
    );
    expect(model.controls).toEqual([
      { name: 'flag', kind: 'boolean', value: true },
      { name: 'variant', kind: 'select', options: ['a', 'b'], value: 'b' },
      { name: 'title', kind: 'text', value: 'hi' },
      { name: 'count', kind: 'number', value: 3 },
    ]);
    expect(model.skipped).toEqual([]);
    expect(model.hasUnsatisfiedRequired).toBe(false);
  });

  test('skips snippet/unknown props and lists them', () => {
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'flag',
          control: { kind: 'boolean' },
          bindable: false,
          optional: true,
          defaultValue: false,
        },
        { name: 'body', control: { kind: 'snippet' }, bindable: false, optional: true },
        {
          name: 'raw',
          control: { kind: 'unknown', rawType: 'Foo' },
          bindable: false,
          optional: true,
        },
      ]),
    );
    expect(model.controls.map((control) => control.name)).toEqual(['flag']);
    expect(model.skipped).toEqual(['body', 'raw']);
  });

  test('a required snippet (e.g. children) does NOT suppress the playground', () => {
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'multiple',
          control: { kind: 'boolean' },
          bindable: false,
          optional: true,
          defaultValue: false,
        },
        { name: 'children', control: { kind: 'snippet' }, bindable: false, optional: false },
      ]),
    );
    expect(model.hasUnsatisfiedRequired).toBe(false);
    expect(model.controls.map((control) => control.name)).toEqual(['multiple']);
    expect(model.skipped).toEqual(['children']);
  });

  test('a required non-snippet prop with no default suppresses the generated preview', () => {
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'variant',
          control: { kind: 'select', options: ['x'] },
          bindable: false,
          optional: true,
          defaultValue: 'x',
        },
        {
          name: 'value',
          control: { kind: 'unknown', rawType: 'T' },
          bindable: false,
          optional: false,
        },
      ]),
    );
    expect(model.hasUnsatisfiedRequired).toBe(true);
    expect(model.skipped).toContain('value');
  });

  test('a select with no defaultValue seeds its value to the first option', () => {
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'variant',
          control: { kind: 'select', options: ['primary', 'secondary'] },
          bindable: false,
          optional: true,
        },
      ]),
    );
    expect(model.controls[0]).toEqual({
      name: 'variant',
      kind: 'select',
      options: ['primary', 'secondary'],
      value: 'primary',
    });
  });
});

describe('buildSnippet', () => {
  const controls = buildPlaygroundModel(
    manifest([
      {
        name: 'multiple',
        control: { kind: 'boolean' },
        bindable: false,
        optional: true,
        defaultValue: false,
      },
      {
        name: 'size',
        control: { kind: 'select', options: ['sm', 'md'] },
        bindable: false,
        optional: true,
        defaultValue: 'md',
      },
    ]),
  ).controls;

  test('omits a false boolean and renders self-closing when no attributes', () => {
    expect(buildSnippet('Accordion', controls, { multiple: false, size: '' })).toBe(
      '<Accordion />',
    );
  });

  test('renders a true boolean as a bare attribute', () => {
    expect(buildSnippet('Accordion', controls, { multiple: true, size: '' })).toBe(
      '<Accordion multiple />',
    );
  });

  test('renders string attributes and stacks multiple onto separate lines', () => {
    expect(buildSnippet('Accordion', controls, { multiple: true, size: 'sm' })).toBe(
      '<Accordion\n  multiple\n  size="sm"\n/>',
    );
  });

  test('renders a number control as an unquoted expression attribute', () => {
    const numberControls = buildPlaygroundModel(
      manifest([
        {
          name: 'count',
          control: { kind: 'number' },
          bindable: false,
          optional: true,
          defaultValue: 0,
        },
      ]),
    ).controls;
    expect(buildSnippet('Comp', numberControls, { count: 42 })).toBe('<Comp count={42} />');
  });

  test('escapes a string value with attribute-breaking characters as an expression', () => {
    const textControls = buildPlaygroundModel(
      manifest([
        {
          name: 'label',
          control: { kind: 'text' },
          bindable: false,
          optional: true,
          defaultValue: '',
        },
      ]),
    ).controls;
    // A double-quote, ampersand, or angle bracket in a `name="..."` attribute
    // would produce invalid Svelte that won't copy-paste; fall back to a
    // JSON-escaped expression.
    expect(buildSnippet('Comp', textControls, { label: 'a "b" & <c>' })).toBe(
      '<Comp label={"a \\"b\\" & <c>"} />',
    );
    // A safe value keeps the plain quoted-attribute form.
    expect(buildSnippet('Comp', textControls, { label: 'plain' })).toBe('<Comp label="plain" />');
  });

  test('omits a control at its default value from the snippet', () => {
    // A select at its default value ('left') should produce a self-closing tag.
    const selectControls = buildPlaygroundModel(
      manifest([
        {
          name: 'align',
          control: { kind: 'select', options: ['left', 'center', 'right'] },
          bindable: false,
          optional: true,
          defaultValue: 'left',
        },
      ]),
    ).controls;
    expect(buildSnippet('Table', selectControls, { align: 'left' })).toBe('<Table />');
  });

  test('emits only controls that have changed from their default', () => {
    const mixedControls = buildPlaygroundModel(
      manifest([
        {
          name: 'align',
          control: { kind: 'select', options: ['left', 'center', 'right'] },
          bindable: false,
          optional: true,
          defaultValue: 'left',
        },
        {
          name: 'as',
          control: { kind: 'select', options: ['td', 'th'] },
          bindable: false,
          optional: true,
          defaultValue: 'td',
        },
      ]),
    ).controls;
    // Only 'align' changed; 'as' is still at its default 'td'.
    expect(buildSnippet('Table', mixedControls, { align: 'center', as: 'td' })).toBe(
      '<Table align="center" />',
    );
  });

  test('omits a number control at its default 0, emits it when changed', () => {
    const numberControls = buildPlaygroundModel(
      manifest([
        {
          name: 'count',
          control: { kind: 'number' },
          bindable: false,
          optional: true,
          defaultValue: 0,
        },
      ]),
    ).controls;
    expect(buildSnippet('Comp', numberControls, { count: 0 })).toBe('<Comp />');
    expect(buildSnippet('Comp', numberControls, { count: 42 })).toBe('<Comp count={42} />');
  });
});
