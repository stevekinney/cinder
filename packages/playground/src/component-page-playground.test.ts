import { describe, expect, test } from 'bun:test';

import { buildPlaygroundModel, buildSnippet } from './component-page-playground.ts';
import { previewRecipeFor } from './component-page-preview-recipes.ts';
import type { ComponentManifest, ObjectShape, PropManifest } from './types.ts';

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
    expect(model.unsatisfiedRequired).toEqual([]);
    expect(model.requiresExamplePlayground).toBe(false);
  });

  test('names every required prop it could not synthesize', () => {
    // The page has to tell the reader WHY a generated snippet is missing, so the
    // model reports the blocking prop NAMES, not just that there were some. A
    // bare boolean left the page with nothing honest to say, and it printed
    // "This component has no adjustable props" — false here, since `label` is
    // adjustable and present.
    const model = buildPlaygroundModel(
      manifest([
        { name: 'label', control: { kind: 'text' }, bindable: false, optional: true },
        {
          name: 'items',
          control: { kind: 'unknown', rawType: 'Item[]' },
          bindable: false,
          optional: false,
        },
        {
          name: 'row',
          control: { kind: 'snippet' },
          bindable: false,
          optional: false,
        },
        // Optional and defaulted props never block, however exotic their type.
        {
          name: 'formatter',
          control: { kind: 'unknown', rawType: '(value: number) => string' },
          bindable: false,
          optional: true,
        },
      ]),
    );
    expect(model.unsatisfiedRequired).toEqual(['items', 'row']);
    expect(model.hasUnsatisfiedRequired).toBe(true);
    expect(model.controls.map((control) => control.name)).toEqual(['label']);
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

  test('uses a contract-valid BarChart preview seed instead of disconnected generic values', () => {
    const model = buildPlaygroundModel({
      ...manifest([
        {
          name: 'data',
          control: {
            kind: 'array',
            rawType: 'BarChartDatum[]',
            element: { fields: [], degenerate: true },
          },
          bindable: false,
          optional: false,
        },
        { name: 'categoryKey', control: { kind: 'text' }, bindable: false, optional: false },
        {
          name: 'series',
          control: {
            kind: 'array',
            rawType: 'BarChartSeries[]',
            element: { fields: [], degenerate: true },
          },
          bindable: false,
          optional: false,
        },
      ]),
      name: 'Bar chart',
      kebabName: 'bar-chart',
    });

    expect(model.controls).toContainEqual(
      expect.objectContaining({ name: 'categoryKey', value: 'month' }),
    );
    expect(model.seeds.map(({ name, value }) => ({ name, value }))).toEqual([
      {
        name: 'data',
        value: [
          { month: 'January', revenue: 42 },
          { month: 'February', revenue: 58 },
          { month: 'March', revenue: 73 },
        ],
      },
      {
        name: 'series',
        value: [{ id: 'revenue', label: 'Revenue', valueKey: 'revenue' }],
      },
    ]);
  });

  test('uses stable DataTable row identities in its explicit preview seed', () => {
    const model = buildPlaygroundModel({
      ...manifest([
        {
          name: 'columns',
          control: {
            kind: 'array',
            rawType: 'DataTableColumn[]',
            element: { fields: [], degenerate: true },
          },
          bindable: false,
          optional: false,
        },
        {
          name: 'rows',
          control: {
            kind: 'array',
            rawType: 'DataTableRow[]',
            element: { fields: [], degenerate: true },
          },
          bindable: false,
          optional: false,
        },
      ]),
      name: 'Data table',
      kebabName: 'data-table',
    });

    expect(model.seeds.map(({ name, value }) => ({ name, value }))).toEqual([
      {
        name: 'columns',
        value: [
          { key: 'name', label: 'Name', rowHeader: true },
          { key: 'role', label: 'Role' },
        ],
      },
      {
        name: 'rows',
        value: [
          { id: 'ada', name: 'Ada Lovelace', role: 'Engineer' },
          { id: 'grace', name: 'Grace Hopper', role: 'Admiral' },
        ],
      },
    ]);
  });

  test('uses complete shortcut entries in the KeyboardShortcuts preview seed', () => {
    const model = buildPlaygroundModel({
      ...manifest([
        {
          name: 'groups',
          control: {
            kind: 'array',
            rawType: 'KeyboardShortcutGroup[]',
            element: { fields: [], degenerate: true },
          },
          bindable: false,
          optional: false,
        },
      ]),
      name: 'Keyboard shortcuts',
      kebabName: 'keyboard-shortcuts',
    });

    expect(model.seeds.map(({ name, value }) => ({ name, value }))).toEqual([
      {
        name: 'groups',
        value: [
          {
            label: 'General',
            shortcuts: [{ action: 'Open command palette', keys: ['Meta', 'K'] }],
          },
        ],
      },
    ]);
  });

  test('a non-children snippet prop stays non-adjustable (skipped)', () => {
    const model = buildPlaygroundModel(
      manifest([{ name: 'header', control: { kind: 'snippet' }, bindable: false, optional: true }]),
    );
    expect(model.controls).toEqual([]);
    expect(model.skipped).toEqual(['header']);
  });

  test('a required non-children snippet prop suppresses the generated preview', () => {
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'open',
          control: { kind: 'boolean' },
          bindable: true,
          optional: true,
          defaultValue: false,
        },
        { name: 'items', control: { kind: 'snippet' }, bindable: false, optional: false },
      ]),
    );
    expect(model.hasUnsatisfiedRequired).toBe(true);
    expect(model.skipped).toEqual(['items']);
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

  test.each([
    ['Autocomplete', 'autocomplete', '@lostgradient/cinder/autocomplete', 'behavior'],
    ['Spectrogram', 'spectrogram', '@lostgradient/cinder/spectrogram', 'behavior'],
    ['Backdrop', 'backdrop', '@lostgradient/cinder/backdrop', 'behavior'],
    ['Alert dialog', 'alert-dialog', '@lostgradient/cinder/alert-dialog', 'behavior'],
    ['Confirm dialog', 'confirm-dialog', '@lostgradient/cinder/confirm-dialog', 'behavior'],
    ['Command menu', 'command-menu', '@lostgradient/cinder/command-menu', 'behavior'],
    ['Button group', 'button-group', '@lostgradient/cinder/button-group', 'structured-children'],
    [
      'Checkbox group',
      'checkbox-group',
      '@lostgradient/cinder/checkbox-group',
      'structured-children',
    ],
    ['Form field', 'form-field', '@lostgradient/cinder/form-field', 'structured-children'],
    ['Form section', 'form-section', '@lostgradient/cinder/form-section', 'structured-children'],
    ['Scroll area', 'scroll-area', '@lostgradient/cinder/scroll-area', 'structured-children'],
    [
      'Segmented control',
      'segmented-control',
      '@lostgradient/cinder/segmented-control',
      'structured-children',
    ],
    [
      'Side navigation',
      'side-navigation',
      '@lostgradient/cinder/side-navigation',
      'structured-children',
    ],
    ['Sidebar', 'sidebar', '@lostgradient/cinder/sidebar', 'structured-children'],
  ] as const)(
    'marks %s as example-only when authored examples are required',
    (name, kebabName, importPath, examplePlaygroundReason) => {
      const model = buildPlaygroundModel({
        name,
        kebabName,
        file: `${kebabName}.svelte`,
        importPath,
        props: [
          { name: 'value', control: { kind: 'text' }, bindable: true, optional: true },
          {
            name: 'dataSource',
            control: { kind: 'unknown', rawType: `${name}DataSource` },
            bindable: false,
            optional: true,
          },
        ],
      });
      expect(model.controls.map((control) => control.name)).toEqual(['value']);
      expect(model.requiresExamplePlayground).toBe(true);
      expect(model.examplePlaygroundReason).toBe(examplePlaygroundReason);
    },
  );

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

  test('required text controls seed readable defaults', () => {
    const model = buildPlaygroundModel(
      manifest([
        { name: 'id', control: { kind: 'text' }, bindable: false, optional: false },
        { name: 'label', control: { kind: 'text' }, bindable: false, optional: false },
      ]),
    );
    expect(model.hasUnsatisfiedRequired).toBe(false);
    expect(model.controls).toEqual([
      { name: 'id', hasDefault: false, kind: 'text', value: 'demo-example' },
      { name: 'label', hasDefault: false, kind: 'text', value: 'Demo' },
    ]);
  });
});

describe('structural seeds', () => {
  test('satisfies a required array-of-object prop instead of blocking on it', () => {
    // The motivating case: a required `items: Item[]` used to be `unknown`, which
    // counted as unsynthesizable and deleted the component's whole Playground
    // section. It is now satisfied by a synthesized placeholder.
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'items',
          control: {
            kind: 'array',
            rawType: 'Item[]',
            element: {
              fields: [
                { name: 'id', shape: { kind: 'string' } },
                { name: 'label', shape: { kind: 'string' } },
              ],
              degenerate: false,
            },
          },
          bindable: false,
          optional: false,
        },
      ]),
    );
    expect(model.hasUnsatisfiedRequired).toBe(false);
    expect(model.unsatisfiedRequired).toEqual([]);
    expect(model.skipped).toEqual([]);
    // Three elements, so a list renders as a real multi-item instance.
    expect(model.seeds).toHaveLength(1);
    expect(model.seeds[0]?.value).toEqual([
      { id: 'one', label: 'Label one' },
      { id: 'two', label: 'Label two' },
      { id: 'three', label: 'Label three' },
    ]);
  });

  test('synthesizes a NESTED array as an array, not as its own internals', () => {
    // Arrays are objects to the type checker, so a nested `shortcuts: Entry[]`
    // used to fall through to the object branch and serialize the ARRAY's own
    // members as if they were data — `shortcuts: { length: 10, '__@unscopables@38': {} }`
    // reached the copyable snippet for KeyboardShortcuts.
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'groups',
          control: {
            kind: 'array',
            rawType: 'Group[]',
            element: {
              fields: [
                { name: 'label', shape: { kind: 'string' } },
                {
                  name: 'shortcuts',
                  shape: {
                    kind: 'array',
                    element: {
                      fields: [{ name: 'action', shape: { kind: 'string' } }],
                      degenerate: false,
                    },
                  },
                },
              ],
              degenerate: false,
            },
          },
          bindable: false,
          optional: false,
        },
      ]),
    );
    const seeded = model.seeds[0]?.value as Array<Record<string, unknown>> | undefined;
    const first = seeded?.[0];
    expect(Array.isArray(first?.['shortcuts'])).toBe(true);
    expect(first?.['shortcuts']).toEqual([{ action: 'Action one' }, { action: 'Action two' }]);
    expect(model.seeds[0]?.source).toContain("shortcuts: [{ action: 'Action one' }");
  });

  test('never seeds an optional or defaulted structural prop', () => {
    // `buildSnippet` always emits seeds and `toMountProps` always passes them,
    // so seeding a prop the component did not require OVERWRITES its own
    // behavior: `ChoiceGrid.values` (optional, defaults to `[]`) got invented
    // data, and `PhoneInput.countries` (optional) had its full 245-country list
    // replaced by three. Same rule as the synthesized `''`/`0` control values.
    const element: ObjectShape = {
      fields: [{ name: 'label', shape: { kind: 'string' } }],
      degenerate: false,
    };
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'optionalItems',
          control: { kind: 'array', rawType: 'Item[]', element },
          bindable: false,
          optional: true,
        },
        {
          name: 'defaultedItems',
          control: { kind: 'array', rawType: 'Item[]', element },
          bindable: false,
          optional: false,
          defaultValue: [],
        },
        {
          name: 'requiredItems',
          control: { kind: 'array', rawType: 'Item[]', element },
          bindable: false,
          optional: false,
        },
      ]),
    );
    // Only the prop that would otherwise BLOCK the preview is seeded.
    expect(model.seeds.map((seed) => seed.name)).toEqual(['requiredItems']);
    // The other two are surfaced as non-adjustable rather than silently faked.
    expect(model.skipped).toEqual(['optionalItems', 'defaultedItems']);
    expect(model.hasUnsatisfiedRequired).toBe(false);
  });

  test('never invents a member for an index-signature-only record', () => {
    // `MatrixChartDatum = Record<string, string | number>` has no named field,
    // and the component's sibling props name KEYS of the datum — so any datum
    // invented here would contradict them. Seed the empty array instead and let
    // the component show its real empty state.
    const model = buildPlaygroundModel(
      manifest([
        {
          name: 'data',
          control: {
            kind: 'array',
            rawType: 'Datum[]',
            element: { fields: [], degenerate: true },
          },
          bindable: false,
          optional: false,
        },
      ]),
    );
    expect(model.seeds[0]?.value).toEqual([{}, {}, {}]);
    expect(model.seeds[0]?.source).toBe('[{}, {}, {}]');
  });

  test('emits seeds as Svelte source, inline when short and as a preamble when long', () => {
    const shortSeed = buildPlaygroundModel(
      manifest([
        {
          name: 'keys',
          control: { kind: 'array', rawType: 'string[]', element: { kind: 'string' } },
          bindable: false,
          optional: false,
        },
      ]),
    );
    // Short enough to read inline as an expression attribute.
    expect(buildSnippet('Widget', shortSeed.controls, {}, shortSeed.seeds)).toContain('keys={[');

    const longSeed = buildPlaygroundModel(
      manifest([
        {
          name: 'items',
          control: {
            kind: 'array',
            rawType: 'Item[]',
            element: {
              fields: [
                { name: 'identifier', shape: { kind: 'string' } },
                { name: 'description', shape: { kind: 'string' } },
              ],
              degenerate: false,
            },
          },
          bindable: false,
          optional: false,
        },
      ]),
    );
    const snippet = buildSnippet('Widget', longSeed.controls, {}, longSeed.seeds, 'pkg/widget');
    // A nine-field object array inline is not how anyone writes this.
    expect(snippet).toContain("import { Widget } from 'pkg/widget';");
    expect(snippet).toContain('const items = [');
    expect(snippet).toContain('<Widget {items} />');
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

  test('keeps an accessible recipe baseline until its empty control changes it', () => {
    const labelControl = buildPlaygroundModel(
      manifest([
        {
          name: 'ariaLabel',
          control: { kind: 'text' },
          bindable: false,
          optional: true,
        },
      ]),
    ).controls;

    expect(
      buildSnippet('Progress', labelControl, { ariaLabel: '' }, [], undefined, {
        ariaLabel: 'Loading progress',
      }),
    ).toBe('<Progress ariaLabel="Loading progress" />');
    expect(
      buildSnippet('Progress', labelControl, { ariaLabel: 'Upload progress' }, [], undefined, {
        ariaLabel: 'Loading progress',
      }),
    ).toBe('<Progress ariaLabel="Upload progress" />');
  });

  test('keeps recipe children in the generated snippet when no text control exists', () => {
    expect(
      buildSnippet(
        'Marquee',
        [],
        {},
        [],
        undefined,
        { label: 'Announcements' },
        '{#snippet children()}Announcement{/snippet}',
      ),
    ).toBe('<Marquee label="Announcements">{#snippet children()}Announcement{/snippet}</Marquee>');
  });

  test.each([
    ['masonry', 'Masonry', 'Item 1'],
    ['aspect-ratio', 'AspectRatio', 'Aspect-ratio content'],
    ['surface', 'Surface', 'This Surface, at the selected tone'],
  ])('copies the %s recipe children with its preview', (recipeName, exportName, content) => {
    const recipe = previewRecipeFor(recipeName);
    expect(recipe?.snippetChildren).toBeDefined();
    expect(
      buildSnippet(exportName, [], {}, [], undefined, recipe?.props, recipe?.snippetChildren),
    ).toContain(content);
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
    // The seeded values are surfaced explicitly, because we cannot prove they
    // match the component's own defaults — EXCEPT the empty placeholders `''`
    // and `0`, which the generator invented for props that declared no default
    // at all. Emitting those claims the reader asked for them: `Image` seeded
    // `width={0} height={0}` and collapsed the element to nothing however good
    // its `src` was. `toMountProps` drops the same two, so the live preview and
    // the copyable snippet stay in agreement.
    expect(
      buildSnippet('Widget', noDefault, { variant: 'primary', disabled: false, count: 0 }),
    ).toBe('<Widget\n  variant="primary"\n  disabled={false}\n/>');
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
