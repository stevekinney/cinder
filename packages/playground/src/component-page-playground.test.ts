import { describe, expect, test } from 'bun:test';

import { buildPlaygroundModel, buildSnippet } from './component-page-playground.ts';
import type { ComponentManifest, PropManifest } from './types.ts';

function manifest(props: PropManifest[]): ComponentManifest {
  return { name: 'Demo', kebabName: 'demo', file: 'demo.svelte', importPath: 'demo', props };
}

function compoundManifest(props: PropManifest[]): ComponentManifest {
  return { ...manifest(props), isCompound: true };
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
      { name: 'flag', hasDefault: true, kind: 'boolean', value: true },
      { name: 'variant', hasDefault: true, kind: 'select', options: ['a', 'b'], value: 'b' },
      { name: 'title', hasDefault: true, kind: 'text', value: 'hi' },
      { name: 'count', hasDefault: true, kind: 'number', value: 3 },
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
    // `children` is synthesized into an editable text control (not skipped) so
    // the live preview renders a labelled instance instead of an empty shell.
    expect(model.controls.map((control) => control.name)).toEqual(['multiple', 'children']);
    expect(model.skipped).toEqual([]);
  });

  test('the synthesized children control is a text control seeded with the component name', () => {
    const model = buildPlaygroundModel(
      manifest([
        { name: 'children', control: { kind: 'snippet' }, bindable: false, optional: false },
      ]),
    );
    const childrenControl = model.controls.find((control) => control.name === 'children');
    expect(childrenControl).toEqual({
      name: 'children',
      hasDefault: false,
      kind: 'text',
      isChildren: true,
      value: 'Demo',
    });
  });

  test('a compound component does NOT synthesize a text children control', () => {
    // Accordion-shaped: a `multiple` boolean plus a required structured-children
    // snippet. The compound flag means `children` are `<Accordion.Item>` elements,
    // not plain text, so seeding the display name would render a broken preview.
    const model = buildPlaygroundModel(
      compoundManifest([
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
    // `children` is skipped (shown as "not adjustable here"), never synthesized,
    // and the remaining `multiple` control keeps the playground visible.
    expect(model.controls.map((control) => control.name)).toEqual(['multiple']);
    expect(model.skipped).toEqual(['children']);
    expect(model.controls.find((control) => control.name === 'children')).toBeUndefined();
    expect(model.hasUnsatisfiedRequired).toBe(false);
  });

  test('a compound component whose only prop is children yields no controls', () => {
    // With children skipped and nothing else adjustable, the playground model is
    // empty so the page suppresses the generated Playground section entirely and
    // leans on the Examples/Overview previews for real usage.
    const model = buildPlaygroundModel(
      compoundManifest([
        { name: 'children', control: { kind: 'snippet' }, bindable: false, optional: false },
      ]),
    );
    expect(model.controls).toEqual([]);
    expect(model.skipped).toEqual(['children']);
  });

  test('a non-children snippet prop stays non-adjustable (skipped)', () => {
    const model = buildPlaygroundModel(
      manifest([{ name: 'header', control: { kind: 'snippet' }, bindable: false, optional: true }]),
    );
    expect(model.controls).toEqual([]);
    expect(model.skipped).toEqual(['header']);
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
      hasDefault: false,
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
    // `size` stays at its 'md' default (a select is never empty at runtime), so
    // it is omitted; `multiple` is at its `false` default, so it is too.
    expect(buildSnippet('Accordion', controls, { multiple: false, size: 'md' })).toBe(
      '<Accordion />',
    );
  });

  test('renders a true boolean as a bare attribute', () => {
    expect(buildSnippet('Accordion', controls, { multiple: true, size: 'md' })).toBe(
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

  test('emits name="" when a text prop with a non-empty default is cleared', () => {
    // Regression: clearing a non-empty default to '' is a real state change, so
    // the snippet must preserve `label=""`. Omitting it would silently revert to
    // the default ('Submit') when pasted, contradicting the live UI.
    const withDefault = buildPlaygroundModel(
      manifest([
        {
          name: 'label',
          control: { kind: 'text' },
          bindable: false,
          optional: true,
          defaultValue: 'Submit',
        },
      ]),
    ).controls;
    // Cleared to '' (differs from the 'Submit' default) → emitted as label="".
    expect(buildSnippet('Comp', withDefault, { label: '' })).toBe('<Comp label="" />');
    // Still at the default → omitted.
    expect(buildSnippet('Comp', withDefault, { label: 'Submit' })).toBe('<Comp />');
  });

  test('omits an empty string when the prop has no default or an empty default', () => {
    // No manifest default: the seeded '' is noise — `name=""` adds nothing.
    const noDefault = buildPlaygroundModel(
      manifest([{ name: 'label', control: { kind: 'text' }, bindable: false, optional: true }]),
    ).controls;
    expect(buildSnippet('Comp', noDefault, { label: '' })).toBe('<Comp />');

    // Explicit empty-string default: '' equals the default → still omitted.
    const emptyDefault = buildPlaygroundModel(
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
    expect(buildSnippet('Comp', emptyDefault, { label: '' })).toBe('<Comp />');
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

  test('emits name={false} when a boolean defaulting to true is toggled off', () => {
    // Regression: omitting the prop would render the default `true`, so a snippet
    // that drops a user-selected `false` silently contradicts the live UI.
    const trueByDefault = buildPlaygroundModel(
      manifest([
        {
          name: 'closable',
          control: { kind: 'boolean' },
          bindable: false,
          optional: true,
          defaultValue: true,
        },
      ]),
    ).controls;
    // At its `true` default → omitted (omitting renders `true`, the same state).
    expect(buildSnippet('Modal', trueByDefault, { closable: true })).toBe('<Modal />');
    // Toggled to `false` → must be explicit, not dropped.
    expect(buildSnippet('Modal', trueByDefault, { closable: false })).toBe(
      '<Modal closable={false} />',
    );
  });

  test('keeps a synthesized seed visible when the prop has no manifest default', () => {
    // Regression: a control without a manifest default seeds a placeholder
    // (first option / `0` / `false`) that is NOT the component's real default,
    // so it must stay in the snippet rather than being elided as if it were one.
    const noDefault = buildPlaygroundModel(
      manifest([
        {
          name: 'variant',
          control: { kind: 'select', options: ['primary', 'secondary'] },
          bindable: false,
          optional: true,
        },
        {
          name: 'disabled',
          control: { kind: 'boolean' },
          bindable: false,
          optional: true,
        },
        {
          name: 'count',
          control: { kind: 'number' },
          bindable: false,
          optional: true,
        },
      ]),
    ).controls;
    // The seeded values (first option / `false` / `0`) are surfaced explicitly,
    // because we cannot prove they match the component's own defaults.
    expect(
      buildSnippet('Widget', noDefault, { variant: 'primary', disabled: false, count: 0 }),
    ).toBe('<Widget\n  variant="primary"\n  disabled={false}\n  count={0}\n/>');
  });

  test('renders a children control as element content, not an attribute', () => {
    const withChildren = buildPlaygroundModel(
      manifest([
        { name: 'children', control: { kind: 'snippet' }, bindable: false, optional: false },
      ]),
    ).controls;
    // Seeded with the component name → open/close pair, not self-closing.
    expect(buildSnippet('Badge', withChildren, { children: 'Badge' })).toBe('<Badge>Badge</Badge>');
    // Edited content flows through.
    expect(buildSnippet('Badge', withChildren, { children: 'Beta' })).toBe('<Badge>Beta</Badge>');
    // Cleared children → minimal self-closing form (no empty open/close pair).
    expect(buildSnippet('Badge', withChildren, { children: '' })).toBe('<Badge />');
  });

  test('escapes children text so the copied snippet stays valid Svelte', () => {
    const withChildren = buildPlaygroundModel(
      manifest([
        { name: 'children', control: { kind: 'snippet' }, bindable: false, optional: false },
      ]),
    ).controls;
    // `<`, `&`, and `{` are special in Svelte text content; escape them so the
    // pasted snippet renders the literal text the live preview shows.
    expect(buildSnippet('Badge', withChildren, { children: '<strong>x</strong>' })).toBe(
      '<Badge>&lt;strong>x&lt;/strong></Badge>',
    );
    expect(buildSnippet('Badge', withChildren, { children: 'a & b' })).toBe(
      '<Badge>a &amp; b</Badge>',
    );
    expect(buildSnippet('Badge', withChildren, { children: '{count}' })).toBe(
      '<Badge>&lbrace;count}</Badge>',
    );
  });

  test('combines attribute controls with children content', () => {
    const mixed = buildPlaygroundModel(
      manifest([
        {
          name: 'variant',
          control: { kind: 'select', options: ['neutral', 'danger'] },
          bindable: false,
          optional: true,
          defaultValue: 'neutral',
        },
        { name: 'children', control: { kind: 'snippet' }, bindable: false, optional: false },
      ]),
    ).controls;
    // One attribute + children → single-attribute open/close form.
    expect(buildSnippet('Badge', mixed, { variant: 'danger', children: 'Beta' })).toBe(
      '<Badge variant="danger">Beta</Badge>',
    );
    // Attribute at its default is omitted; children still render as content.
    expect(buildSnippet('Badge', mixed, { variant: 'neutral', children: 'Beta' })).toBe(
      '<Badge>Beta</Badge>',
    );
  });
});
