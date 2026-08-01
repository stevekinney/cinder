import { describe, expect, test } from 'bun:test';

import {
  findPrimitiveCompositionViolations,
  missingMigrationRecordPaths,
  shouldCheckComponentSource,
} from './check-primitive-composition.ts';
import { conditionalQueryBranches, cssPrimitiveCounts } from './primitive-composition-css.ts';
import {
  allowedFieldWrapperCounts,
  allowedFloatingCounts,
  allowedGridCounts,
  allowedRawControlSignatures,
} from './primitive-composition-migrations.ts';
import { primitiveCompositionSourceRoots } from './primitive-composition-runner.ts';

describe('primitive composition guard', () => {
  test('rejects a new raw form control', () => {
    expect(
      findPrimitiveCompositionViolations('<input />', 'new-control/new-control.svelte'),
    ).toHaveLength(1);
  });

  test('allows a tracked raw-control offender', () => {
    expect(findPrimitiveCompositionViolations('<input />', 'pin-input/pin-input.svelte')).toEqual(
      [],
    );
  });

  test('keeps the footer grid migration baseline at two tracked definitions', () => {
    expect(allowedGridCounts.get('footer/footer.css')).toBe(2);
  });

  test('tracks only the remaining date field-wrapper migrations', () => {
    expect(allowedFieldWrapperCounts.get('date-picker/date-picker.svelte')).toBe(2);
    expect(allowedFieldWrapperCounts.has('date-range-field/date-range-field.svelte')).toBe(false);
  });

  test('does not retain completed internal-layer floating migrations', () => {
    for (const filePath of [
      'checkbox/checkbox.css',
      'meter/meter.css',
      'radio-group/radio-group.css',
      'slider/slider.css',
    ]) {
      expect(allowedFloatingCounts.has(filePath)).toBe(false);
    }
  });

  test('ignores hidden submission inputs and controls mentioned in comments', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<!-- <input> --><input type="hidden" name="value" />',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
  });

  test('resolves hidden attributes from static object spreads', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<input {...{ type: 'hidden' }} />",
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
  });

  test('applies a later spread over an earlier static hidden type', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<input type="hidden" {...{ type: \'text\' }} />',
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('applies a later static hidden type over an earlier visible spread', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<input {...{ type: \'text\' }} type="hidden" />',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
  });

  test('invalidates prior hidden proof after an unresolvable dynamic spread', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<input type="hidden" {...attrs} />',
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('invalidates prior hidden proof after a nested dynamic spread', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<script>const attrs = { hidden: false };</script><input hidden {...{ ...attrs }} />',
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('resolves nested static hidden spreads', () => {
    for (const source of [
      "<input {...{ type: 'text', ...{ type: 'hidden' } }} />",
      "<input {...{ type: 'text', ...{ ...{ type: 'hidden' } } }} />",
    ])
      expect(findPrimitiveCompositionViolations(source, 'new-control/new-control.svelte')).toEqual(
        [],
      );
  });

  test('allows a later static hidden type to re-establish proof after a dynamic spread', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<input {...attrs} type="hidden" />',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
  });

  test('ignores expression-backed static hidden input types', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<input type={\'hidden\'} name="value" />',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '<script>const proxyType = \'hidden\';</script><input type={proxyType} name="value" />',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
  });

  test('only treats type hidden as hidden on input elements', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<select type="hidden"></select>',
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '<textarea type="hidden"></textarea>',
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('ignores native controls hidden with the hidden attribute', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<input type="checkbox" hidden name="value" />',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
    for (const value of ['', 'hidden', 'false']) {
      expect(
        findPrimitiveCompositionViolations(
          `<input type="checkbox" hidden="${value}" name="value" />`,
          'new-control/new-control.svelte',
        ),
      ).toEqual([]);
    }
    expect(
      findPrimitiveCompositionViolations(
        '<input type="checkbox" hidden={true} name="value" />',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '<input type="checkbox" hidden={false} name="value" />',
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('resolves immutable hidden bindings', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<script>const hiddenProxy = true;</script><input hidden={hiddenProxy} />',
        'hidden-proxy/hidden-proxy.svelte',
      ),
    ).toEqual([]);
  });

  test('does not count canonical component tags as native controls', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<Input /><Select /><Textarea />',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
  });

  test('counts static and statically traceable svelte:element controls', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<svelte:element this={'input'} />",
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>const tag = 'select';</script><svelte:element this={tag} />",
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<svelte:element this={'INPUT'} />",
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; tag = 'input';</script><svelte:element this={tag} />",
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('detects a polymorphic tag assignment made from an inline template handler', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = $state('div');</script><button onclick={() => tag = 'input'}>x</button><svelte:element this={tag} />",
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('counts raw controls in literal polymorphic expression branches', () => {
    for (const source of [
      "<svelte:element this={editable ? 'input' : 'div'} />",
      "<svelte:element this={editable && 'select'} />",
      "<svelte:element this={editable || 'textarea'} />",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'new-control/new-control.svelte'),
      ).toHaveLength(1);
  });

  test('counts raw controls in mutable polymorphic expression branches', () => {
    for (const source of [
      "<script>let tag = 'div'; tag = editable ? 'input' : 'div';</script><svelte:element this={tag} />",
      "<script>const inputTag = 'input'; let tag = 'div'; tag = editable ? inputTag : 'div';</script><svelte:element this={tag} />",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'new-control/new-control.svelte'),
      ).toHaveLength(1);
  });

  test('counts raw controls assigned through ternary branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; editable ? (tag = 'input') : (tag = 'div');</script><svelte:element this={tag} />",
        'new-control/new-control.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; true ? (tag = 'div') : (tag = 'input');</script><svelte:element this={tag} />",
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves conditional predecessors before compound tag composition', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = ''; if (custom) tag = 'custom-'; tag += 'input';</script><svelte:element this={tag} />",
        'compound-tag/compound-tag.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves skipped paths through conditional compound composition', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = ''; if (custom) tag += 'custom-'; tag += 'input';</script><svelte:element this={tag} />",
        'conditional-compound/conditional-compound.svelte',
      ),
    ).toHaveLength(1);
  });

  test('rejects an added raw control in a tracked file', () => {
    expect(
      findPrimitiveCompositionViolations('<input /><input />', 'pin-input/pin-input.svelte'),
    ).toHaveLength(1);
  });

  test('rejects a completed raw-control migration that remains tracked', () => {
    expect(
      findPrimitiveCompositionViolations('<Input />', 'pin-input/pin-input.svelte'),
    ).toHaveLength(1);
  });

  test('rejects an untracked hand-rolled grid', () => {
    expect(
      findPrimitiveCompositionViolations(
        'display: grid; grid-template-columns: 1fr;',
        'new-grid/new-grid.css',
      ),
    ).toHaveLength(1);
  });

  test('allows a tracked grid migration offender', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.first { display: grid; grid-template-columns: 1fr; } .second { display: grid; grid-template-columns: 1fr; }',
        'bento-grid/bento-grid.css',
      ),
    ).toEqual([]);
  });

  test('tracks the existing sortable-list row grid', () => {
    expect(
      findPrimitiveCompositionViolations(
        [
          '.item { display: grid; grid-template-columns: minmax(0, 1fr) auto; }',
          '.preview { position: fixed; z-index: 1; }',
        ].join(' '),
        'sortable-list/sortable-list.css',
      ),
    ).toEqual([]);
  });

  test('tracks the source-diff-viewer line grid without counting its grid container', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.lines { display: grid; } .line { display: grid; grid-template-columns: 1fr 1fr; }',
        'source-diff-viewer/source-diff-viewer.css',
      ),
    ).toEqual([]);
  });

  test('rejects a new grid occurrence in a tracked stylesheet', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.first { display: grid; grid-template-columns: 1fr; } .second { display: grid; grid-template-columns: 1fr; } .third { display: grid; grid-template-columns: 1fr; }',
        'bento-grid/bento-grid.css',
      ),
    ).toHaveLength(1);
  });

  test('counts every selector-list branch in a tracked stylesheet', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.first { display: grid; grid-template-columns: 1fr; } .second, .third { display: grid; grid-template-columns: 1fr; }',
        'bento-grid/bento-grid.css',
      ),
    ).toHaveLength(1);
  });

  test('does not combine grid declarations from separate CSS rules or comments', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout { display: grid; } .columns { grid-template-columns: 1fr; } /* display: grid; grid-template-columns: 1fr; */',
        'new-grid/new-grid.css',
      ),
    ).toEqual([]);
  });

  test('combines grid declarations from selectors that can match the same element', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout { display: grid; } .layout.columns { grid-template-columns: 1fr 1fr; }',
        'new-grid/new-grid.css',
      ),
    ).toHaveLength(1);
  });

  test('counts every compatible grid display and template pairing', () => {
    expect(
      cssPrimitiveCounts(
        '.layout { display: grid; } .layout.compact { grid-template-columns: 1fr; } .layout.wide { grid-template-columns: 1fr 1fr; }',
      ).grid,
    ).toBe(2);
  });

  test('associates matching type, id, and attribute selectors across rules', () => {
    for (const source of [
      '#layout { display: grid; } #layout[data-columns] { grid-template-columns: 1fr; }',
      'main { display: grid; } main[data-columns] { grid-template-columns: 1fr; }',
      '[data-layout] { display: grid; } [data-layout][data-columns] { grid-template-columns: 1fr; }',
    ])
      expect(cssPrimitiveCounts(source).grid).toBe(1);
  });

  test('associates class-only and tag-only selectors across rules', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout { display: grid; } section { grid-template-columns: 1fr; }',
        'new-layout/new-layout.css',
      ),
    ).toHaveLength(1);
  });

  test('associates tag-only selectors with id and attribute selectors across rules', () => {
    for (const source of [
      'section { display: grid; } #layout { grid-template-columns: 1fr; }',
      'section { display: grid; } [data-layout] { grid-template-columns: 1fr; }',
    ])
      expect(cssPrimitiveCounts(source).grid).toBe(1);
  });

  test('rejects tag-to-attribute anchors with contradictory repeated constraints', () => {
    expect(
      findPrimitiveCompositionViolations(
        "section { display: grid; } [data-state='a'][data-state='b'] { grid-template-columns: 1fr; }",
        'contradictory-attribute-anchor/contradictory-attribute-anchor.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "section { display: grid; } [data-state='alpha'][data-state^='a'] { grid-template-columns: 1fr; }",
        'satisfiable-attribute-anchor/satisfiable-attribute-anchor.css',
      ),
    ).toHaveLength(1);
  });

  test('resolves repeated prefix, suffix, and language attribute constraints', () => {
    for (const source of [
      "section { display: grid; } [data-state^='ab'][data-state^='ac'] { grid-template-columns: 1fr; }",
      "section { display: grid; } [data-state$='ab'][data-state$='ac'] { grid-template-columns: 1fr; }",
      "section { display: grid; } [lang|='en'][lang|='fr'] { grid-template-columns: 1fr; }",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'incompatible-attribute-ranges.css'),
      ).toEqual([]);
    for (const source of [
      "section { display: grid; } [data-state^='a'][data-state^='ab'] { grid-template-columns: 1fr; }",
      "section { display: grid; } [data-state$='a'][data-state$='ba'] { grid-template-columns: 1fr; }",
      "section { display: grid; } [lang|='en'][lang|='en-US'] { grid-template-columns: 1fr; }",
      "section { display: grid; } [data-state^='AB' i][data-state^='ab'] { grid-template-columns: 1fr; }",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'compatible-attribute-ranges.css'),
      ).toHaveLength(1);
  });

  test('recognizes row, area, auto-column, and grid shorthand layouts', () => {
    for (const property of [
      'grid-template-rows',
      'grid-template-areas',
      'grid-auto-columns',
      'grid-auto-rows',
      'grid',
    ])
      expect(cssPrimitiveCounts(`.layout { display: grid; ${property}: initial; }`).grid).toBe(1);
  });

  test('recognizes every grid-defining property in inline styles', () => {
    for (const property of [
      'grid',
      'grid-template',
      'grid-template-areas',
      'grid-template-columns',
      'grid-template-rows',
      'grid-auto-columns',
      'grid-auto-rows',
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<div style="display: grid; ${property}: initial"></div>`,
          'new-grid/new-grid.svelte',
        ),
      ).toHaveLength(1);
  });

  test('scans published component styles outside the component tree', () => {
    expect(primitiveCompositionSourceRoots.map(({ relativePrefix }) => relativePrefix)).toContain(
      'styles/components',
    );
  });

  test('does not combine declarations from conflicting attribute selectors', () => {
    expect(
      cssPrimitiveCounts(
        "[data-layout='grid'] { display: grid; } [data-layout='list'] { grid-template-columns: 1fr; }",
      ).grid,
    ).toBe(0);
  });

  test('combines mixed-sensitivity attribute selectors symmetrically', () => {
    for (const source of [
      ".layout[data-state='A'] { display: grid; } .layout[data-state='a' i] { grid-template-columns: 1fr; }",
      ".layout[data-state='a' i] { display: grid; } .layout[data-state='A'] { grid-template-columns: 1fr; }",
      ".layout[data-state='ALPHA'] { display: grid; } .layout[data-state^='al' i] { grid-template-columns: 1fr; }",
      ".layout[data-state^='Al'] { display: grid; } .layout[data-state='ALPHA' i] { grid-template-columns: 1fr; }",
    ])
      expect(cssPrimitiveCounts(source).grid).toBe(1);
  });

  test('does not combine declarations from different conditional scopes', () => {
    expect(
      cssPrimitiveCounts(
        '@media (min-width: 800px) { .layout { display: grid; } } @media (max-width: 799px) { .layout { grid-template-columns: 1fr; } }',
      ).grid,
    ).toBe(0);
    expect(
      cssPrimitiveCounts(
        '@media (min-width: 800px) { .layout { display: grid; } } @media (orientation: landscape) { .layout { grid-template-columns: 1fr; } }',
      ).grid,
    ).toBe(1);
    expect(
      cssPrimitiveCounts(
        '@media (max-width: 48rem) { .layout { display: grid; } } @media (min-width: 64rem) { .layout { grid-template-columns: 1fr; } }',
      ).grid,
    ).toBe(0);
  });

  test('preserves comma-separated conditional query branches', () => {
    expect(
      cssPrimitiveCounts(
        '@media (max-width: 40rem), (min-width: 80rem) { .layout { display: grid; grid-template-columns: 1fr; } }',
      ).grid,
    ).toBe(1);
    expect(
      cssPrimitiveCounts(
        '@media (max-width: 40rem), (min-width: 80rem) { .layout { display: grid; } } @media (min-width: 60rem) and (max-width: 70rem) { .layout { grid-template-columns: 1fr; } }',
      ).grid,
    ).toBe(0);
  });

  test('preserves conditional query branches joined with or', () => {
    expect(
      cssPrimitiveCounts(
        '@media (width < 40rem) or (width > 80rem) { .layout { display: grid; } } @media (width < 40rem) or (width > 80rem) { .layout { grid-template-columns: 1fr; } }',
      ).grid,
    ).toBe(1);
  });

  test('rejects a hand-rolled grid in an inline style', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<div style="display: grid; grid-template-columns: 1fr 1fr"></div>',
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '<div style:display="grid" style:grid-template-columns={columns}></div>',
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '<div style="display: grid" style:grid-template-columns={columns}></div>',
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '<svelte:element this={\'div\'} style="display: grid" style:grid-template-columns={columns} />',
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>const layoutStyle = 'display: grid; grid-template-columns: 1fr 1fr';</script><div style={layoutStyle}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr' }}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>const layoutStyle = { display: 'grid', gridTemplateColumns: columns };</script><div style={layoutStyle}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves each reachable branch of a conditional style directive value', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let active = false;</script><div style:display={active ? 'grid' : 'block'} style:grid-template-columns=\"1fr\"></div>",
        'new-layout/new-layout.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let active = false;</script><div style:display={active ? 'block' : 'inline-block'} style:grid-template-columns=\"1fr\"></div>",
        'new-layout/new-layout.svelte',
      ),
    ).toEqual([]);
  });

  test('resolves top-level writes to mutable style-object bindings', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; layout = { display: 'block' };</script><div style={layout}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toEqual([]);
  });

  test('resolves a write to a mutable style-object binding made inside a handler', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function enable() { layout = { display: 'grid', gridTemplateColumns: '1fr' }; }</script><div style={layout} onclick={enable}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not attribute a handler-local shadowed binding write to the outer style object', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function enable() { let layout = { display: 'grid', gridTemplateColumns: '1fr' }; }</script><div style={layout} onclick={enable}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toEqual([]);
  });

  test('keeps the initializer reachable when a handler later resets a mutable style object', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; function reset() { layout = { display: 'block' }; }</script><div style={layout} onclick={reset}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
  });

  test('still applies last-write-wins for purely sequential top-level reassignment', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; layout = { display: 'block' };</script><div style={layout}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toEqual([]);
  });

  test('resolves a conditional/logical expression assigned to a mutable style-object binding', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; layout = dense ? { display: 'grid', gridTemplateColumns: '1fr' } : { display: 'block' };</script><div style={layout}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; layout = dense && { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
  });

  test('short-circuits statically unreachable style-object branches', () => {
    for (const expression of [
      "false && { display: 'grid', gridTemplateColumns: '1fr' }",
      "true || { display: 'grid', gridTemplateColumns: '1fr' }",
      "'block' ?? { display: 'grid', gridTemplateColumns: '1fr' }",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<div style={${expression}}></div>`,
          'short-circuit-style/short-circuit-style.svelte',
        ),
      ).toEqual([]);
  });

  test('ignores statically unreachable style-object assignments', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; if (false) layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'unreachable-style-assignment/unreachable-style-assignment.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let undefined = dynamic; let layout = { display: 'block' }; if (undefined) layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'unreachable-style-assignment/unreachable-style-assignment.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let undefined; let layout = { display: 'block' }; if (undefined) layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'unreachable-style-assignment/unreachable-style-assignment.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; if (getReady()) layout = { display: 'grid', gridTemplateColumns: '1fr' }; if (state.ready) layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'unknown-style-condition/unknown-style-condition.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves top-level conditional style-object assignment branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; dense ? layout = { display: 'grid', gridTemplateColumns: '1fr' } : layout = { display: 'block' };</script><div style={layout}></div>",
        'conditional-style/conditional-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('propagates all reachable mutable style aliases', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let base = { display: 'block' }; function enable() { base = { display: 'grid', gridTemplateColumns: '1fr' }; } let layout; function assign() { layout = base; }</script><div style={layout}></div>",
        'alias-style/alias-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('resolves a top-level mutable style alias initializer', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>const gridStyle = { display: 'grid', gridTemplateColumns: '1fr' }; let layout = gridStyle;</script><div style={layout}></div>",
        'alias-style/alias-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('resolves function-local style aliases', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function enable() { const gridStyle = { display: 'grid', gridTemplateColumns: '1fr' }; layout = gridStyle; }</script><div style={layout} onclick={enable}></div>",
        'callback-style-alias/callback-style-alias.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>const gridStyle = { display: 'block' }; let layout = gridStyle; function enable() { const gridStyle = { display: 'grid', gridTemplateColumns: '1fr' }; layout = gridStyle; }</script><div style={layout} onclick={enable}></div>",
        'callback-style-alias/callback-style-alias.svelte',
      ),
    ).toHaveLength(1);
    for (const functionBody of [
      "{ const gridStyle = { display: 'grid', gridTemplateColumns: '1fr' }; } layout = gridStyle;",
      "layout = gridStyle; const gridStyle = { display: 'grid', gridTemplateColumns: '1fr' };",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let layout = { display: 'block' }; function enable() { ${functionBody} }</script><div style={layout} onclick={enable}></div>`,
          'callback-style-alias/callback-style-alias.svelte',
        ),
      ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function define() { const gridStyle = { display: 'grid', gridTemplateColumns: '1fr' }; } function enable() { layout = gridStyle; }</script><div style={layout} onclick={enable}></div>",
        'callback-style-alias/callback-style-alias.svelte',
      ),
    ).toEqual([]);
  });

  test('keeps only the terminal write within a conditional branch', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; if (dense) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; layout = { display: 'block' }; }</script><div style={layout}></div>",
        'terminal-branch/terminal-branch.svelte',
      ),
    ).toEqual([]);
  });

  test('retains a style binding introduced only inside a conditional branch', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout; if (dense) layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'conditional-binding/conditional-binding.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not restore a prior style binding after an unresolved branch overwrite', () => {
    for (const conditionalWrite of [
      "if (dense) layout = Object.freeze({ display: 'block' }); else layout = { display: 'block' };",
      "dense ? layout = Object.freeze({ display: 'block' }) : layout = { display: 'block' };",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; ${conditionalWrite}</script><div style={layout}></div>`,
          'unknown-branch-style/unknown-branch-style.svelte',
        ),
      ).toEqual([]);
  });

  test('keeps outer style-object declarations after every conditional alias branch becomes unresolved', () => {
    for (const conditionalWrite of [
      "if (dense) layout = Object.freeze({ display: 'block' }); else layout = Object.seal({ display: 'block' });",
      "dense ? layout = Object.freeze({ display: 'block' }) : layout = Object.seal({ display: 'block' });",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let layout = { display: 'block' }; ${conditionalWrite}</script><div style={{ ...layout, display: 'grid', gridTemplateColumns: '1fr' }}></div>`,
          'unknown-conditional-alias/unknown-conditional-alias.svelte',
        ),
      ).toHaveLength(1);
  });

  test('resolves style-object bindings wrapped in a TypeScript `as const` assertion', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script lang=\"ts\">const layoutStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr' } as const;</script><div style={layoutStyle}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script lang=\"ts\">let layout = { display: 'block' } as const; layout = { display: 'grid', gridTemplateColumns: '1fr' } as const;</script><div style={layout}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script lang=\"ts\">const layoutStyle = { display: 'grid' as const, gridTemplateColumns: '1fr' };</script><div style={layoutStyle}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
  });

  test('rejects a tracked raw-control substitution with the same count', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<textarea class="cinder-approval-card__textarea cinder-approval-card__textarea--reason" id="reason" rows="3" value={reason}></textarea><input type="checkbox" checked={rememberResolution} />',
        'approval-card/approval-card-actions.svelte',
      ),
    ).toEqual([
      expect.objectContaining({
        message:
          'A tracked raw-control identity changed; migrate it or update the explicit migration record.',
      }),
    ]);
  });

  test('rejects a layered floating surface without the shared sidecar', () => {
    expect(
      findPrimitiveCompositionViolations(
        'position: absolute; z-index: 1;',
        'new-menu/new-menu.css',
      ),
    ).toHaveLength(1);
  });

  test('ignores positioned internal layers that are not panel-like surfaces', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<div class="checkbox-indicator" style="position: absolute; z-index: 1"></div>',
        'new-control/new-control.svelte',
      ),
    ).toEqual([]);
  });

  test('ignores a positioned summary overlay stacked above a transparent native control', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.field__summary { position: absolute; z-index: 1; }',
        'new-control/new-control.css',
      ),
    ).toEqual([]);
  });

  test('does not exempt a panel-like class that merely contains the word "summary"', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.cinder-order-summary-panel { position: absolute; z-index: 1; }',
        'new-panel/new-panel.css',
      ),
    ).toHaveLength(1);
  });

  test('allows a floating surface composed on the matching rendered element', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.menu { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
        '<div class="menu cinder-_floating-surface"></div>',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '.cinder-dropdown-menu { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
        [
          '<div class="unrelated"></div>',
          '<div class="cinder-dropdown-menu cinder-_floating-surface"></div>',
        ],
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '.menu { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
        `<script>import { classNames } from '../../utilities/class-names.ts'; let className;</script><div class={classNames('cinder-_floating-surface', 'menu', className)}></div>`,
      ),
    ).toEqual([]);
  });

  test('scopes the floating-surface exemption to the matching rendered element', () => {
    const floatingCss = '.menu { position: absolute; z-index: 1; }';
    expect(
      findPrimitiveCompositionViolations(
        floatingCss,
        'new-menu/new-menu.css',
        '<div class="menu cinder-_floating-surface"></div>',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        floatingCss,
        'new-menu/new-menu.css',
        '<!-- cinder-_floating-surface --><div class="other"></div>',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '.cinder-_floating-surface, .local-menu { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
        '<div class="cinder-_floating-surface"></div>',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '.menu.copy { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
        '<div class="menu cinder-_floating-surface"></div><div class="menu copy"></div>',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        floatingCss,
        'new-menu/new-menu.css',
        '<div class="other cinder-_floating-surface"></div><div class="menu"></div>',
      ),
    ).toHaveLength(1);
  });

  test('requires the complete selector target to match a shared floating element', () => {
    for (const source of [
      '.menu[data-local] { position: absolute; z-index: 1; }',
      '#local.menu { position: absolute; z-index: 1; }',
      'section.menu { position: absolute; z-index: 1; }',
    ])
      expect(
        findPrimitiveCompositionViolations(
          source,
          'new-menu/new-menu.css',
          '<div class="menu cinder-_floating-surface"></div>',
        ),
      ).toHaveLength(1);

    expect(
      findPrimitiveCompositionViolations(
        'div#local.menu[data-local] { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
        '<div id="local" class="menu cinder-_floating-surface" data-local></div>',
      ),
    ).toEqual([]);
  });

  test('preserves functional pseudo-class constraints on floating targets', () => {
    const sharedMarkup = '<div class="menu cinder-_floating-surface"></div>';
    expect(
      findPrimitiveCompositionViolations(
        '.menu:not(.cinder-_floating-surface) { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
        sharedMarkup,
      ),
    ).toHaveLength(1);
    for (const pseudoClass of ['is', 'where']) {
      expect(
        findPrimitiveCompositionViolations(
          `.menu:${pseudoClass}(.cinder-_floating-surface, .other) { position: absolute; z-index: 1; }`,
          'new-menu/new-menu.css',
          sharedMarkup,
        ),
      ).toEqual([]);
    }
  });

  test('does not pair mutually exclusive functional selectors', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout:not([data-list]) { display: grid; } .layout[data-list] { grid-template-columns: 1fr; }',
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
  });

  test('does not use negated alternatives as shared selector anchors', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout:not(.disabled) { display: grid; } .disabled { grid-template-columns: 1fr; }',
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
  });

  test('keeps negated tagged selectors disjoint', () => {
    expect(
      findPrimitiveCompositionViolations(
        'input { display: grid; } .layout:not(input) { grid-template-columns: 1fr; }',
        'negated-tag/negated-tag.css',
      ),
    ).toEqual([]);
  });

  test('allows overlap when a negation excludes only a compound selector', () => {
    expect(
      findPrimitiveCompositionViolations(
        'input { display: grid; } input:not(.disabled) { grid-template-columns: 1fr; }',
        'compound-negation/compound-negation.css',
      ),
    ).toHaveLength(1);
  });

  test('allows overlap when a tagless selector negates a compound tag', () => {
    expect(
      findPrimitiveCompositionViolations(
        'input { display: grid; } .layout:not(input.disabled) { grid-template-columns: 1fr; }',
        'compound-negation/compound-negation.css',
      ),
    ).toHaveLength(1);
  });

  test('distinguishes attribute constraints inside a negated compound tag', () => {
    expect(
      findPrimitiveCompositionViolations(
        "input[data-state='a'] { display: grid; } .layout[data-state='a']:not(input[data-state='b']) { grid-template-columns: 1fr; }",
        'compound-negation/compound-negation.css',
      ),
    ).toHaveLength(1);
  });

  test('distinguishes case sensitivity in negated attribute constraints', () => {
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-state='A' i] { display: grid; } .layout:not([data-state='A']) { grid-template-columns: 1fr; }",
        'case-insensitive-negation/case-insensitive-negation.css',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-state='A'] { display: grid; } .layout:not([data-state='A' i]) { grid-template-columns: 1fr; }",
        'case-insensitive-negation/case-insensitive-negation.css',
      ),
    ).toEqual([]);
  });

  test('allows a negated selector to overlap a generic peer', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout:not(.disabled) { display: grid; } .layout { grid-template-columns: 1fr; }',
        'new-layout/new-layout.css',
      ),
    ).toHaveLength(1);
  });

  test('compares non-equality attribute constraints', () => {
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-mode~='grid'] { display: grid; } .layout[data-mode='list'] { grid-template-columns: 1fr; }",
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
  });

  test('preserves ancestor constraints when pairing selectors', () => {
    expect(
      findPrimitiveCompositionViolations(
        '#compact > .layout { display: grid; } #wide > .layout { grid-template-columns: 1fr; }',
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
  });

  test('keeps mutually exclusive media types separate', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media print { .layout { display: grid; } } @media screen { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
  });

  test('ignores rules whose nested conditional scope is internally contradictory', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media (min-width: 800px) { @media (max-width: 799px) { .layout { display: grid; grid-template-columns: 1fr; } } }',
        'contradictory-nested-media/contradictory-nested-media.css',
      ),
    ).toEqual([]);
  });

  test('preserves important declarations over later normal declarations', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout { display: grid !important; display: block; grid-template-columns: 1fr; }',
        'important-grid/important-grid.css',
      ),
    ).toHaveLength(1);
  });

  test('reads only actual Svelte style blocks', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<script>const example = `<style>.layout { display: grid; grid-template-columns: 1fr }</style>`;</script><div />',
        'new-layout/new-layout.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '<style>.layout { display: grid; grid-template-columns: 1fr }</style><div />',
        'new-layout/new-layout.svelte',
      ),
    ).toHaveLength(1);
  });

  test('allows local floating targets in Svelte style blocks', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<div class="menu cinder-_floating-surface" /><style>.menu { position: absolute; z-index: 1 }</style>',
        'menu/menu.svelte',
      ),
    ).toEqual([]);
  });

  test('tracks captured outer polymorphic assignments', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function edit() { tag = 'input'; }</script><svelte:element this={tag} />",
        'polymorphic/polymorphic.svelte',
      ),
    ).toHaveLength(1);
  });

  test('keeps grid style branches independent', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let dense = true;</script><div style={dense ? { display: 'grid', gridTemplateColumns: '1fr' } : { display: 'block' }} />",
        'new-layout/new-layout.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let dense = true;</script><div style={dense ? { display: 'grid' } : { gridTemplateColumns: '1fr' }} />",
        'new-layout/new-layout.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '<script>let raised = true;</script><div class="menu" style={raised ? { position: \'absolute\' } : { zIndex: 1 }} />',
        'new-layout/new-layout.svelte',
      ),
    ).toEqual([]);
  });

  test('resolves conditional style bindings', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>const layout = dense ? { display: 'grid', gridTemplateColumns: '1fr' } : {};</script><div style={layout} />",
        'new-layout/new-layout.svelte',
      ),
    ).toHaveLength(1);
  });

  test('matches pseudo-only selectors', () => {
    expect(
      findPrimitiveCompositionViolations(
        ':where(.layout) { display: grid; } .layout { grid-template-columns: 1fr; }',
        'new-layout/new-layout.css',
      ),
    ).toHaveLength(1);
  });

  test('treats media all as overlapping screen', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media all { .layout { display: grid; } } @media screen { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toHaveLength(1);
  });

  test('ignores shadowed polymorphic assignments', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function helper() { let tag = 'div'; tag = 'input'; }</script><svelte:element this={tag} />",
        'polymorphic/polymorphic.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function helper(tag) { tag = 'input'; }</script><svelte:element this={tag} />",
        'polymorphic/polymorphic.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function helper({ tag }) { tag = 'input'; }</script><svelte:element this={tag} />",
        'polymorphic/polymorphic.svelte',
      ),
    ).toEqual([]);
  });

  test('detects a real outer write even when an unrelated nested function shadows the name', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function outer() { tag = 'input'; function inner() { let tag = 'x'; } }</script><svelte:element this={tag} />",
        'polymorphic/polymorphic.svelte',
      ),
    ).toHaveLength(1);
  });

  test('respects block scope: a nested block-local declaration does not shadow a sibling write', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function outer(condition) { if (condition) { let tag = 'span'; } tag = 'input'; }</script><svelte:element this={tag} />",
        'polymorphic/polymorphic.svelte',
      ),
    ).toHaveLength(1);
  });

  test('respects block scope: a write inside the declaring block stays shadowed', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function outer(condition) { if (condition) { let tag = 'span'; tag = 'input'; } }</script><svelte:element this={tag} />",
        'polymorphic/polymorphic.svelte',
      ),
    ).toEqual([]);
  });

  test('counts literal HtmlTag field composition', () => {
    expect(
      findPrimitiveCompositionViolations(
        "{@html '<label>Name</label><p>Help</p><p>Error</p>'}",
        'html-field/html-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('inspects every reachable mutable HtmlTag field binding', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let markup = '<div></div>'; if (custom) markup = '<label>Name</label><p>Help</p><p>Error</p>'; else markup = '<div></div>';</script>{@html markup}",
        'html-field/html-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('matches completed compound pseudo alternatives', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout:is(.wide).layout { display: grid; } .layout { grid-template-columns: 1fr; }',
        'new-layout/new-layout.css',
      ),
    ).toHaveLength(1);
  });

  test('keeps negated media types disjoint', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media not screen { .layout { display: grid; } } @media screen { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
  });

  test('allows negated media types to overlap different positive types', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media not screen { .layout { display: grid; } } @media print { .layout { grid-template-columns: 1fr; } }',
        'negated-media-overlap/negated-media-overlap.css',
      ),
    ).toHaveLength(1);
  });

  test('treats not all media branches as unreachable', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media not all { .layout { display: grid; } } .layout { grid-template-columns: 1fr; }',
        'unreachable-media/unreachable-media.css',
      ),
    ).toEqual([]);
  });

  test('resolves TypeScript native tag assertions', () => {
    expect(
      findPrimitiveCompositionViolations(
        `<script lang="ts">const tag = 'input' as const;</script><svelte:element this={tag} />`,
        'polymorphic/polymorphic.svelte',
      ),
    ).toHaveLength(1);
  });

  test('resolves a TypeScript-asserted polymorphic label tag for field-wrapper evidence', () => {
    expect(
      findPrimitiveCompositionViolations(
        `<script lang="ts">const tag = 'label' as const;</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>`,
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('recognizes static class objects', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<div class={{ menu: true, 'cinder-_floating-surface': true }} /><style>.menu { position: absolute; z-index: 1 }</style>",
        'menu/menu.svelte',
      ),
    ).toEqual([]);
  });

  test('requires the same shared target for both floating selectors', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.menu { position: absolute; } .menu.copy { z-index: 1; }',
        'menu/menu.css',
        '<div class="menu cinder-_floating-surface" /><div class="menu copy" />',
      ),
    ).toHaveLength(1);
  });

  test('counts literal HtmlTag controls', () => {
    expect(
      findPrimitiveCompositionViolations(
        '{@html \'<input aria-label="Name">\'}',
        'html-control/html-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('keeps mutable polymorphic binding lookup lexical', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function helper() { let tag = 'input'; }</script><svelte:element this={tag} />",
        'polymorphic/polymorphic.svelte',
      ),
    ).toEqual([]);
  });

  test('follows mutable polymorphic field tags', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; tag = 'label';</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'mutable-field/mutable-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('ignores assignments to shadowed field tags', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function helper() { let tag = 'span'; tag = 'label'; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'shadowed-field/shadowed-field.svelte',
      ),
    ).toEqual([]);
  });

  test('tracks outer field-tag assignments after a block-scoped shadow', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function setTag() { if (local) { let tag = 'span'; } tag = 'label'; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'block-shadow-field/block-shadow-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('retains both reachable field-tag values across if branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; if (custom) tag = 'label'; else tag = 'span';</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'conditional-field/conditional-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('retains both reachable field-tag values across ternary branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; custom ? (tag = 'label') : (tag = 'span');</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'conditional-field/conditional-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('keeps loop-initializer field tags scoped to the loop', () => {
    for (const loop of [
      "for (let tag = 'span'; ready; ready = false) { tag = 'label'; }",
      "for (let tag of tags) { tag = 'label'; }",
      "for (let tag in tags) { tag = 'label'; }",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'div'; ${loop}</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>`,
          'loop-shadow-field/loop-shadow-field.svelte',
        ),
      ).toEqual([]);
  });

  test('does not report an intermediate raw-control compound tag value', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = ''; if (custom) tag += 'input'; tag += '-wrapper';</script><svelte:element this={tag} />",
        'compound-control/compound-control.svelte',
      ),
    ).toEqual([]);
  });

  test('does not report a raw-control value overwritten inside one conditional branch', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; if (custom) { tag = 'input'; tag = 'div'; }</script><svelte:element this={tag} />",
        'terminal-conditional-control/terminal-conditional-control.svelte',
      ),
    ).toEqual([]);
  });

  test('does not retain an intermediate field tag overwritten inside one conditional branch', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; if (custom) { tag = 'label'; tag = 'span'; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'terminal-conditional-field/terminal-conditional-field.svelte',
      ),
    ).toEqual([]);
  });

  test('clears field-tag evidence after an unresolvable overwrite', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'label'; tag = dynamicTag;</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'dynamic-field-tag/dynamic-field-tag.svelte',
      ),
    ).toEqual([]);
  });

  test('clears field-tag evidence after an unresolvable var redeclaration initializer', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>var tag = 'label'; var tag = dynamicTag;</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'dynamic-field-tag/dynamic-field-tag.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves field-tag evidence across a var redeclaration without an initializer', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>var tag = 'label'; var tag;</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'mutable-field/mutable-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('counts field wrappers in every reachable raw HTML candidate', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let markup = '<span>Ready</span>'; function show() { markup = '<label>Name</label><p>Description</p><p>Error message</p>'; }</script>{@html markup}",
        'mutable-html-field/mutable-html-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('counts controls in every reachable raw HTML candidate', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let markup = '<div></div>'; function show() { markup = '<input aria-label=\"Name\">'; }</script><button onclick={show}>Show</button>{@html markup}",
        'mutable-html-control/mutable-html-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('keeps raw HTML field evidence isolated by reachable candidate', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let markup = '<label>Name</label><p>Help</p>'; function show() { markup = '<p>Error message</p>'; }</script>{@html markup}",
        'branched-html-field/branched-html-field.svelte',
      ),
    ).toEqual([]);
  });

  test('resolves function-local aliases assigned to mutable field tags', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show() { const fieldTag = 'label'; tag = fieldTag; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'local-field-alias/local-field-alias.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not treat renamed object-pattern keys as field-tag shadows', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show({ tag: localTag }) { tag = 'label'; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'renamed-field-parameter/renamed-field-parameter.svelte',
      ),
    ).toHaveLength(1);
  });

  test('resolves mutable field aliases in source order', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let fieldTag = 'span'; fieldTag = 'label'; let tag = fieldTag;</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'ordered-field-alias/ordered-field-alias.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves callback field-tag states declared before their binding', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>function show() { tag = 'label'; } let tag = 'div';</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'forward-field-callback/forward-field-callback.svelte',
      ),
    ).toHaveLength(1);
  });

  test('resolves later-declared aliases inside deferred field callbacks', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>function show() { tag = fieldTag; } let fieldTag = 'label'; let tag = 'div';</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'forward-field-alias/forward-field-alias.svelte',
      ),
    ).toHaveLength(1);
  });

  test('tracks field-tag assignments from inline handlers', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div';</script><button onclick={() => tag = 'label'}>Show</button><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'inline-field-handler/inline-field-handler.svelte',
      ),
    ).toHaveLength(1);
  });

  test('tracks compound field-tag assignments', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'lab'; tag += 'el';</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'compound-field-tag/compound-field-tag.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not overwrite field tags after an abrupt function exit', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function setTag() { tag = 'label'; return; tag = 'span'; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'returning-field-handler/returning-field-handler.svelte',
      ),
    ).toHaveLength(1);
  });

  test('scopes catch parameters while preserving outer field-tag writes', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; try {} catch (tag) { tag = 'span'; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'catch-field-shadow/catch-field-shadow.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; try {} catch (error) { tag = 'label'; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'catch-field-shadow/catch-field-shadow.svelte',
      ),
    ).toHaveLength(1);
  });

  test('uses literal truthiness for field-tag logical assignments', () => {
    for (const expression of ["0 && (tag = 'label')", "'ready' || (tag = 'label')"])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'div'; ${expression};</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>`,
          'logical-field-tag/logical-field-tag.svelte',
        ),
      ).toEqual([]);
    for (const expression of [
      "1 && (tag = 'label')",
      "'' || (tag = 'label')",
      "ready && (tag = 'label')",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'div'; ${expression};</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>`,
          'logical-field-tag/logical-field-tag.svelte',
        ),
      ).toHaveLength(1);
  });

  test('uses assigned values for field-tag logical short-circuiting', () => {
    for (const source of [
      "let tag = 'div'; (tag = 'span') || (tag = 'label');",
      "let tag = 'div'; (tag = 'span') ?? (tag = 'label');",
      "let tag = 'div'; const next = 'span'; (tag = next) || (tag = 'label');",
      "let tag = 'div'; const next = 'span'; (tag = next) ?? (tag = 'label');",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>${source}</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>`,
          'logical-assignment-field-tag/logical-assignment-field-tag.svelte',
        ),
      ).toEqual([]);
  });

  test('applies statically determined nullish field-tag writes', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'label'; null ?? (tag = 'span');</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'nullish-field-tag/nullish-field-tag.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'label'; '' ?? (tag = 'span');</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'nullish-field-tag/nullish-field-tag.svelte',
      ),
    ).toHaveLength(1);
  });

  test('stops field-tag traversal after a nested abrupt block', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show() { { tag = 'label'; return; } tag = 'span'; }</script><svelte:element this={tag} /><p>Description</p><p>Error message</p>",
        'nested-return-field-tag/nested-return-field-tag.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves raw controls from abruptly terminated handler branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function setTag() { if (custom) { tag = 'input'; return; } tag = 'div'; }</script><svelte:element this={tag} />",
        'returning-control-handler/returning-control-handler.svelte',
      ),
    ).toHaveLength(1);
  });

  test('ignores raw controls in statically unreachable branches and loops', () => {
    for (const statement of [
      "if (false) tag = 'input';",
      "while (false) tag = 'input';",
      "for (; false;) tag = 'input';",
      "for (const item of []) tag = 'input';",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'div'; ${statement}</script><svelte:element this={tag} />`,
          'unreachable-control-write/unreachable-control-write.svelte',
        ),
      ).toEqual([]);
  });

  test('treats immediately invoked tag writes as synchronous', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; (() => { tag = 'div'; })();</script><svelte:element this={tag} />",
        'invoked-control-write/invoked-control-write.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves the skipped path through mutable control loops', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; for (const item of items) tag = 'div';</script><svelte:element this={tag} />",
        'loop-control-write/loop-control-write.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves the skipped path through logical control writes', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; ready && (tag = 'div');</script><svelte:element this={tag} />",
        'logical-control-write/logical-control-write.svelte',
      ),
    ).toHaveLength(1);
  });

  test('uses JavaScript truthiness for literal logical control writes', () => {
    for (const expression of ["0 && (tag = 'div')", "'ready' || (tag = 'div')"])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'input'; ${expression};</script><svelte:element this={tag} />`,
          'literal-logical-control-write/literal-logical-control-write.svelte',
        ),
      ).toHaveLength(1);
  });

  test('applies statically guaranteed logical control writes', () => {
    for (const expression of [
      "true && (tag = 'div')",
      "false || (tag = 'div')",
      "null ?? (tag = 'div')",
      "undefined ?? (tag = 'div')",
      "void 0 ?? (tag = 'div')",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'input'; ${expression};</script><svelte:element this={tag} />`,
          'guaranteed-logical-control-write/guaranteed-logical-control-write.svelte',
        ),
      ).toEqual([]);
  });

  test('tracks logical assignment operators on control tags', () => {
    for (const source of [
      "let tag = ''; tag ||= 'input';",
      "let tag = 'ready'; tag &&= 'input';",
      "let tag; tag ??= 'input';",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>${source}</script><svelte:element this={tag} />`,
          'logical-assignment-control/logical-assignment-control.svelte',
        ),
      ).toHaveLength(1);
  });

  test('respects shadowed undefined loop tests and terminal exits', () => {
    for (const initializer of ['true', 'dynamicValue'])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let undefined = ${initializer}; let layout = { display: 'block' }; for (; undefined;) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; break; }</script><div style={layout}></div>`,
          'shadowed-undefined-loop/shadowed-undefined-loop.svelte',
        ),
      ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; for (let undefined = false; undefined;) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; break; }</script><div style={layout}></div>",
        'shadowed-undefined-loop/shadowed-undefined-loop.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let undefined = true; let layout = { display: 'block' }; for (let undefined = false; undefined;) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; break; }</script><div style={layout}></div>",
        'shadowed-undefined-loop/shadowed-undefined-loop.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let undefined; let layout = { display: 'block' }; for (; undefined;) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; break; }</script><div style={layout}></div>",
        'shadowed-undefined-loop/shadowed-undefined-loop.svelte',
      ),
    ).toEqual([]);
    for (const exit of ['return;', 'throw new Error()'])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let layout = { display: 'block' }; function show() { for (; ready;) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; ${exit} } }</script><button onclick={show}>Show</button><div style={layout}></div>`,
          'terminal-loop-exit/terminal-loop-exit.svelte',
        ),
      ).toHaveLength(1);
  });

  test('preserves style-object states from conditional loop breaks', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; for (; ready; layout = { display: 'block' }) { if (stop) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; break; } layout = { display: 'block' }; }</script><div style={layout}></div>",
        'conditional-break-style/conditional-break-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves style-object states from labeled switch breaks', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; target: switch (kind) { case 'edit': for (; ready; layout = { display: 'block' }) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; break target; } default: layout = { display: 'block' }; }</script><div style={layout}></div>",
        'labeled-switch-break-style/labeled-switch-break-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('ignores style-object writes after an unconditional switch break', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; switch (mode) { case 'block': layout = { display: 'block' }; break; layout = { display: 'grid', gridTemplateColumns: '1fr' }; }</script><div style={layout}></div>",
        'switch-break-style/switch-break-style.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; switch (1) { case 1: layout = { display: 'block' }; break; case 2: layout = { display: 'grid', gridTemplateColumns: '1fr' }; }</script><div style={layout}></div>",
        'switch-break-style/switch-break-style.svelte',
      ),
    ).toEqual([]);
    for (const [initializer, unreachableCase] of [
      ["'block'", "'grid'"],
      ['1', '2'],
      ['true', 'false'],
      ['null', "'grid'"],
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>const mode = ${initializer}; let layout = { display: 'block' }; switch (mode) { case ${unreachableCase}: layout = { display: 'grid', gridTemplateColumns: '1fr' }; break; default: layout = { display: 'block' }; }</script><div style={layout}></div>`,
          'switch-break-style/switch-break-style.svelte',
        ),
      ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; switch (mode) { case 1: layout = { display: 'block' }; break; }</script><div style={layout}></div>",
        'switch-break-style/switch-break-style.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>const mode = 'match'; let layout = { display: 'block' }; switch (mode) { default: layout = { display: 'grid', gridTemplateColumns: '1fr' }; case 'match': layout = { display: 'block' }; }</script><div style={layout}></div>",
        'switch-break-style/switch-break-style.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>const match = 'yes'; const block = { display: 'block' }; const grid = { display: 'grid', gridTemplateColumns: '1fr' }; let layout = block; switch ('yes') { case match: layout = grid; break; case 'yes': layout = block; }</script><div style={layout}></div>",
        'switch-break-style/switch-break-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not treat a shadowed undefined binding as nullish', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; function show(undefined = 'provided') { undefined ?? (tag = 'div'); }</script><svelte:element this={tag} />",
        'shadowed-undefined-control/shadowed-undefined-control.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; function unrelated(undefined) {} undefined ?? (tag = 'div');</script><svelte:element this={tag} />",
        'shadowed-undefined-control/shadowed-undefined-control.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; ((undefined = 'provided') => { undefined ?? (tag = 'div'); })();</script><svelte:element this={tag} />",
        'shadowed-undefined-control/shadowed-undefined-control.svelte',
      ),
    ).toHaveLength(1);
    for (const statement of [
      "function show() { var undefined = 'provided'; undefined ?? (tag = 'div'); } show();",
      "try { throw 'provided'; } catch (undefined) { undefined ?? (tag = 'div'); }",
      "switch (0) { default: { let undefined = 'provided'; undefined ?? (tag = 'div'); } }",
      "for (let undefined = 'provided'; undefined;) { undefined ?? (tag = 'div'); break; }",
      "for (let undefined of ['provided']) { undefined ?? (tag = 'div'); }",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'input'; ${statement}</script><svelte:element this={tag} />`,
          'shadowed-undefined-control/shadowed-undefined-control.svelte',
        ),
      ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; for (let undefined of ['provided']) { undefined ?? (tag = 'div'); } undefined ?? (tag = 'div');</script><svelte:element this={tag} />",
        'shadowed-undefined-control/shadowed-undefined-control.svelte',
      ),
    ).toEqual([]);
  });

  test('tracks mutable control writes in default parameters', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show(unused = (tag = 'input')) {}</script><button onclick={() => show()}>Show</button><svelte:element this={tag} />",
        'default-parameter-control/default-parameter-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('evaluates default parameters before body var shadowing', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show(unused = (tag = 'input')) { var tag; }</script><button onclick={() => show()}>Show</button><svelte:element this={tag} />",
        'default-parameter-scope/default-parameter-scope.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show(unused = 1) { var tag; tag = 'input'; }</script><button onclick={() => show()}>Show</button><svelte:element this={tag} />",
        'default-parameter-scope/default-parameter-scope.svelte',
      ),
    ).toEqual([]);
  });

  test('keeps parameter defaults inside the parameter binding scope', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show(unused = (tag = 'input'), tag) {}</script><button onclick={() => show()}>Show</button><svelte:element this={tag} />",
        'default-parameter-shadow/default-parameter-shadow.svelte',
      ),
    ).toEqual([]);
  });

  test('only executes IIFE defaults when arguments are absent or undefined', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; ((unused = (tag = 'input')) => {})('provided');</script><svelte:element this={tag} />",
        'iife-default-argument/iife-default-argument.svelte',
      ),
    ).toEqual([]);
    for (const argument of ['', 'undefined'])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'div'; ((unused = (tag = 'input')) => {})${argument ? `(${argument})` : '()'};</script><svelte:element this={tag} />`,
          'iife-default-argument/iife-default-argument.svelte',
        ),
      ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; let maybe; ((unused = (tag = 'div')) => {})(maybe);</script><svelte:element this={tag} />",
        'iife-default-argument/iife-default-argument.svelte',
      ),
    ).toHaveLength(1);
  });

  test('applies guaranteed loop writes without retaining stale control states', () => {
    for (const source of [
      "<script>let tag = 'input'; for (tag = 'div'; false; ) {}</script><svelte:element this={tag} />",
      "<script>let tag = 'input'; do { tag = 'div'; } while (false);</script><svelte:element this={tag} />",
      "<script>let tag = 'div'; for (const tag of ['input']) {}</script><svelte:element this={tag} />",
      "<script>let tag = 'input'; while (true) { tag = 'div'; break; }</script><svelte:element this={tag} />",
      "<script>let tag = 'input'; for (; true; ) { tag = 'div'; break; }</script><svelte:element this={tag} />",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'loop-control-state/loop-control-state.svelte'),
      ).toEqual([]);
  });

  test('does not execute a loop update after an unconditional break', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; for (; true; tag = 'div') { tag = 'input'; break; }</script><svelte:element this={tag} />",
        'loop-break-update/loop-break-update.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves control states from conditional loop breaks', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; for (; ready; tag = 'div') { tag = 'input'; if (stop) break; ready = false; }</script><svelte:element this={tag} />",
        'conditional-break-control/conditional-break-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not retain non-breaking loop states as interrupted states', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; for (; ready; tag = 'div') { if (stop) { tag = 'div'; break; } tag = 'input'; ready = false; }</script><svelte:element this={tag} />",
        'conditional-break-control/conditional-break-control.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves raw controls from labeled breaks targeting outer loops', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; outer: for (; ready; tag = 'div') { for (; other; other = false) { tag = 'input'; break outer; } }</script><svelte:element this={tag} />",
        'labeled-break-control/labeled-break-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves raw controls from labeled breaks targeting plain blocks', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; outer: { if (ready) { tag = 'input'; break outer; } tag = 'div'; }</script><svelte:element this={tag} />",
        'labeled-break-block-control/labeled-break-block-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('applies do-while tests to continue states', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; do { tag = 'input'; continue; } while ((tag = 'div', false));</script><svelte:element this={tag} />",
        'do-while-continue-control/do-while-continue-control.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves raw controls across initializer-free var redeclarations', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>var tag = 'input'; var tag;</script><svelte:element this={tag} />",
        'var-control-redeclaration/var-control-redeclaration.svelte',
      ),
    ).toHaveLength(1);
  });

  test('merges mutable control switch cases', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; switch (kind) { case 'edit': tag = 'input'; break; default: tag = 'div'; }</script><svelte:element this={tag} />",
        'switch-control-write/switch-control-write.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not fall through after a block-wrapped switch break', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; switch (kind) { case 'edit': { tag = 'input'; break; } default: tag = 'div'; }</script><svelte:element this={tag} />",
        'switch-block-break/switch-block-break.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves control states from conditional switch breaks', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; switch (kind) { case 'edit': if (stop) { tag = 'input'; break; } tag = 'div'; default: tag = 'div'; }</script><svelte:element this={tag} />",
        'switch-conditional-break/switch-conditional-break.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves callback-derived style states across later top-level writes', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function enable() { layout = { display: 'grid', gridTemplateColumns: '1fr' }; } layout = { display: 'block' };</script><div style={layout}></div>",
        'future-style-state/future-style-state.svelte',
      ),
    ).toHaveLength(1);
  });

  test('keeps loop-local style aliases from shadowing the outer binding', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function enable() { for (let layout of layouts) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; } }</script><div style={layout}></div>",
        'loop-local-style-alias/loop-local-style-alias.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; for (let layout = { display: 'block' }; ready; layout = { display: 'block' }) {}</script><div style={layout}></div>",
        'loop-local-style-alias/loop-local-style-alias.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; for (let layout = { display: 'block' }; ready; ) {} layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'post-loop-style-write/post-loop-style-write.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves optional loop paths for mutable style objects', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; for (const item of items) layout = { display: 'block' };</script><div style={layout}></div>",
        'optional-loop-style/optional-loop-style.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; for (; false; layout = { display: 'grid', gridTemplateColumns: '1fr' }) {}</script><div style={layout}></div>",
        'optional-loop-style/optional-loop-style.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; for (; ready; layout = { display: 'grid', gridTemplateColumns: '1fr' }) {}</script><div style={layout}></div>",
        'optional-loop-style/optional-loop-style.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; for (const item of []) layout = { display: 'block' };</script><div style={layout}></div>",
        'empty-loop-style/empty-loop-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('keeps guaranteed loop initialization and post-loop writes ordered', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; for (layout = { display: 'block' }; false; ) {}</script><div style={layout}></div>",
        'guaranteed-loop-style/guaranteed-loop-style.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; for (const item of []) {} layout = { display: 'grid', gridTemplateColumns: '1fr' };</script><div style={layout}></div>",
        'post-loop-style/post-loop-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('resolves style aliases from source-ordered mutable state', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let base = { display: 'block' }; base = { display: 'grid', gridTemplateColumns: '1fr' }; let layout = base;</script><div style={layout}></div>",
        'ordered-style-alias/ordered-style-alias.svelte',
      ),
    ).toHaveLength(1);
  });

  test('keeps post-block callback style writes outside lexical shadows', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function enable() { if (local) { let layout = { display: 'grid', gridTemplateColumns: '1fr' }; } layout = { display: 'grid', gridTemplateColumns: '1fr' }; }</script><div style={layout}></div>",
        'block-style-shadow/block-style-shadow.svelte',
      ),
    ).toHaveLength(1);
  });

  test('rejects compound-negation anchors contradicted by the merged selector', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.foo:not(input.bar) { display: grid; } input.bar { grid-template-columns: 1fr; }',
        'split-compound-negation/split-compound-negation.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        'input { display: grid; } .foo:not(input.bar) { grid-template-columns: 1fr; }',
        'valid-compound-negation/valid-compound-negation.css',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-state='a']:not([data-state='a']) { display: grid; } .layout { grid-template-columns: 1fr; }",
        'split-compound-negation/split-compound-negation.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-state='abc']:not([data-state^='a']) { display: grid; } .layout { grid-template-columns: 1fr; }",
        'split-compound-negation/split-compound-negation.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-state='abc']:not([data-state^='b']) { display: grid; } .layout { grid-template-columns: 1fr; }",
        'split-compound-negation/split-compound-negation.css',
      ),
    ).toHaveLength(1);
  });

  test('marks repeated conflicting IDs in one compound selector impossible', () => {
    expect(
      findPrimitiveCompositionViolations(
        '#compact#wide { display: grid; grid-template-columns: 1fr; }',
        'conflicting-ids/conflicting-ids.css',
      ),
    ).toEqual([]);
  });

  test('recognizes modern width range media conditions', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media (width < 40rem) { .layout { display: grid; } } @media (width >= 64rem) { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
  });

  test('keeps strict range endpoints disjoint', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media (width < 40rem) { .layout { display: grid; } } @media (width >= 40rem) { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '@media (width <= 40rem) { .layout { display: grid; } } @media (width >= 40rem) { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '@media (width < 40rem) { .layout { display: grid; } } @media (width > 39.9999995rem) { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toHaveLength(1);
  });

  test('recognizes value-first width range media conditions', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media (40rem < width) { .layout { display: grid; } } @media (width <= 40rem) { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toEqual([]);
  });

  test('inverts negated width feature bounds', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media not (width > 800px) { .layout { display: grid; } } @media (width > 800px) { .layout { grid-template-columns: 1fr; } }',
        'negated-width/negated-width.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '@media not (width > 800px) { .layout { display: grid; } } @media (width <= 800px) { .layout { grid-template-columns: 1fr; } }',
        'negated-width/negated-width.css',
      ),
    ).toHaveLength(1);
  });

  test('ignores comment text when splitting top-level media or branches', () => {
    expect(conditionalQueryBranches('(width > 800px) /* or */ and (width < 400px)')).toEqual([
      expect.stringContaining('and'),
    ]);
    expect(
      findPrimitiveCompositionViolations(
        '@media (width > 800px) /* or */ and (width < 400px) { .layout { display: grid; } .layout { grid-template-columns: 1fr; } }',
        'commented-or/commented-or.css',
      ),
    ).toEqual([]);
  });

  test('allows bounds from differently named containers to overlap', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@container sidebar (max-width: 40rem) { .layout { display: grid; } } @container main (min-width: 64rem) { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
      ),
    ).toHaveLength(1);
  });

  test('recognizes conditional style-object grid branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        `<script>let dense = true;</script><div style={dense ? { display: 'grid', gridTemplateColumns: '1fr' } : {}}></div>`,
        'new-layout/new-layout.svelte',
      ),
    ).toHaveLength(1);
  });

  test('keeps static classes from mixed class attributes', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.menu { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
        '<script>let extraClass;</script><div class="menu cinder-_floating-surface {extraClass}"></div>',
      ),
    ).toEqual([]);
  });

  test('resolves all static style directive branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<div style:position={anchored ? 'absolute' : 'fixed'} style:z-index=\"1\"></div>",
        'new-menu/new-menu.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not combine floating declarations from separate CSS rules', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.icon { position: absolute; } .item { z-index: 1; }',
        'new-menu/new-menu.css',
      ),
    ).toEqual([]);
  });

  test('combines floating declarations from selectors that can match the same element', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.menu { position: absolute; } .menu[data-open] { z-index: 1; }',
        'new-menu/new-menu.css',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '.menu { position: absolute; } .other { z-index: 1; }',
        'new-menu/new-menu.css',
      ),
    ).toEqual([]);
  });

  test('does not exempt similarly prefixed floating classes', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.cinder-_floating-surface-copy { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
      ),
    ).toHaveLength(1);
  });

  test('ignores non-layering z-index values and pseudo-element targets', () => {
    for (const value of ['auto', 'inherit', 'initial', 'unset', 'revert', 'revert-layer']) {
      expect(
        findPrimitiveCompositionViolations(
          `.menu { position: absolute; z-index: ${value}; }`,
          'new-menu/new-menu.css',
        ),
      ).toEqual([]);
    }
    expect(
      findPrimitiveCompositionViolations(
        '.button::before { position: absolute; z-index: 1; }',
        'new-menu/new-menu.css',
      ),
    ).toEqual([]);
  });

  test('ignores layout declarations inside keyframes', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@keyframes enter { from { position: absolute; z-index: 0; display: grid; grid-template-columns: 1fr; } }',
        'new-animation/new-animation.css',
      ),
    ).toEqual([]);
  });

  test('rejects a hand-rolled floating surface in an inline style', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<div style="position: absolute; z-index: 1"></div>',
        'new-menu/new-menu.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '<div style="position: absolute; z-index: {layer}"></div>',
        'new-menu/new-menu.svelte',
      ),
    ).toHaveLength(1);
  });

  test('recognizes a statically enabled shared floating class directive', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<div class:cinder-_floating-surface={true} style="position: absolute; z-index: 1"></div>',
        'new-menu/new-menu.svelte',
      ),
    ).toEqual([]);
  });

  test('detects inline-grid and grid-template shorthand', () => {
    expect(
      findPrimitiveCompositionViolations(
        'display: inline-grid; grid-template: "main aside" / 1fr auto;',
        'new-grid/new-grid.css',
      ),
    ).toHaveLength(1);
  });

  test('rejects an untracked hand-rolled field wrapper', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label>Label</label><p>description</p><p>error</p>',
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('recognizes alternate help and validation field names', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label>Label</label><p>{helpText}</p><p>{validationMessage}</p>',
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('tracks field-wrapper occurrences in migration files', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label>Label<input /></label><p>description</p><p>error</p>',
        'input/input.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '<label>First<input /></label><label>Second</label><p>description</p><p>error</p>',
        'input/input.svelte',
      ),
    ).toHaveLength(1);
  });

  test('ignores field-wrapper language in scripts and comments', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<script>const docs = `<label> description error`;</script><!-- <label> description error -->',
        'new-field/new-field.svelte',
      ),
    ).toEqual([]);
  });

  test('ignores event handler names in field evidence', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label onclick={showHelp}>Sort</label><button onclick={clearError}>Clear</button>',
        'events/events.svelte',
      ),
    ).toEqual([]);
  });

  test('does not associate a separate label with canonical FormField evidence', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label>Unrelated</label><FormField helpText="Help" error="Error" />',
        'new-field/new-field.svelte',
      ),
    ).toEqual([]);
  });

  test('does not include an IfBlock source slice in field evidence', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label>Unrelated</label>{#if active}<FormField description="Help" error="Error" />{/if}',
        'new-field/new-field.svelte',
      ),
    ).toEqual([]);
  });

  test('traverses field markup nested inside unrelated wrapper components', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<Card><label>Name</label><p>Help</p><p>Error</p></Card>',
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('still inspects a FormField child snippet for a hand-rolled wrapper', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<FormField>{#snippet children()}<label>Name</label><p>Help</p><p>Error</p>{/snippet}</FormField>',
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not mistake a canonical FormField’s own props for hand-rolled evidence', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<FormField label="Name" description="Help text" error="Required"><Input /></FormField>',
        'new-field/new-field.svelte',
      ),
    ).toEqual([]);
  });

  test('does not treat wrapper component props as rendered field evidence', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<Card description={helpText} error={errorMessage}><label>Sort</label></Card>',
        'new-field/new-field.svelte',
      ),
    ).toEqual([]);
  });

  test('recognizes grouped messages next to their direct label', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label>Name</label><div><p>Help</p><p>Error</p></div>',
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('recognizes statically resolved polymorphic labels', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<svelte:element this={'label'}>Name</svelte:element><p>Help</p><p>Error</p>",
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('counts only labels in the field subtree that supplies help and error evidence', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<div><label>Unrelated</label></div><div><label>Field</label><p>Help</p><p>Error</p></div>',
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('does not merge zero-label help and error evidence into a sibling label', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<header><label>Sort</label></header><section><p>Help</p><p>Error log</p></section>',
        'new-field/new-field.svelte',
      ),
    ).toEqual([]);
  });

  test('resolves aliases declared inside control callbacks', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show() { const controlTag = 'input'; tag = controlTag; }</script><svelte:element this={tag} />",
        'callback-control-alias/callback-control-alias.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show(ready) { if (ready) { const controlTag = 'input'; tag = controlTag; } }</script><svelte:element this={tag} />",
        'callback-control-alias/callback-control-alias.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show(ready) { if (ready) { const controlTag = 'input'; const metadata = {}; tag = controlTag; } }</script><svelte:element this={tag} />",
        'callback-control-alias/callback-control-alias.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>const controlTag = 'div'; let tag = 'div'; function show(ready) { if (ready) { const controlTag = 'input'; } tag = controlTag; }</script><svelte:element this={tag} />",
        'callback-control-alias/callback-control-alias.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show() { tag = controlTag; const controlTag = 'input'; }</script><svelte:element this={tag} />",
        'callback-control-alias/callback-control-alias.svelte',
      ),
    ).toEqual([]);
  });

  test('publishes explicit callback writes that equal the declaration-time value', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; function show() { tag = 'input'; } tag = 'div';</script><button onclick={show}>Show</button><svelte:element this={tag} />",
        'callback-control-write/callback-control-write.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves mutable control states that leave loops through continue', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; for (let i = 0; i < 1; i++) { if (true) { tag = 'input'; continue; } tag = 'div'; }</script><svelte:element this={tag} />",
        'continue-control-state/continue-control-state.svelte',
      ),
    ).toHaveLength(1);
  });

  test('evaluates switch case tests before merging control branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; switch ('no') { case (tag = 'input'): break; }</script><svelte:element this={tag} />",
        'switch-test-control/switch-test-control.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; switch (1) { case 1: break; case (tag = 'input'): break; }</script><svelte:element this={tag} />",
        'switch-test-control/switch-test-control.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; switch (1) { case 1: tag = 'div'; case (tag = 'input'): break; }</script><svelte:element this={tag} />",
        'switch-test-control/switch-test-control.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>const match = 'yes'; let tag = 'div'; switch ('yes') { case match: tag = 'input'; break; case 'yes': tag = 'div'; }</script><svelte:element this={tag} />",
        'switch-test-control/switch-test-control.svelte',
      ),
    ).toHaveLength(1);
  });

  test('discards synchronous IIFE return states after later writes', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; (() => { tag = 'input'; return; })(); tag = 'div';</script><svelte:element this={tag} />",
        'iife-return-control/iife-return-control.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves field tags from conditionally returning branches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; function show() { if (true) { tag = 'label'; return; } tag = 'span'; }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'conditional-return-field/conditional-return-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('preserves zero-entry field-tag loop states', () => {
    for (const loop of [
      "for (const item of []) tag = 'span';",
      "for (const item of [...[]]) tag = 'span';",
      "for (const item of items) tag = 'span';",
      "for (const key in object) tag = 'span';",
      "for (; ready;) tag = 'span';",
      "while (ready) tag = 'span';",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'label'; ${loop}</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>`,
          'zero-entry-field-loop/zero-entry-field-loop.svelte',
        ),
      ).toHaveLength(1);

    for (const loop of [
      "while (true) { tag = 'span'; break; }",
      "for (;;) { tag = 'span'; break; }",
      "for (;; tag = 'label') { tag = 'span'; break; }",
      "for (const item of [1]) tag = 'span';",
      "for (const item of [,]) tag = 'span';",
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'label'; ${loop}</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>`,
          'guaranteed-entry-field-loop/guaranteed-entry-field-loop.svelte',
        ),
      ).toEqual([]);
  });

  test('keeps only terminal style writes within one callback', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function enable() { layout = { display: 'grid', gridTemplateColumns: '1fr' }; layout = { display: 'block' }; }</script><div style={layout} onclick={enable}></div>",
        'terminal-callback-style/terminal-callback-style.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves terminal style states from independent callbacks', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function enable() { layout = { display: 'grid', gridTemplateColumns: '1fr' }; } function disable() { layout = { display: 'block' }; }</script><div style={layout} onclick={enable} onkeydown={disable}></div>",
        'independent-callback-style/independent-callback-style.svelte',
      ),
    ).toHaveLength(1);
  });

  test('discards synchronous nested style writes before a later terminal write', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; function outer() { (() => { layout = { display: 'grid', gridTemplateColumns: '1fr' }; })(); layout = { display: 'block' }; }</script><div style={layout} onclick={outer}></div>",
        'nested-callback-style/nested-callback-style.svelte',
      ),
    ).toEqual([]);
  });

  test('rejects selector pairs under incompatible direct parents', () => {
    expect(
      findPrimitiveCompositionViolations(
        'section > .layout { display: grid; } article > .layout { grid-template-columns: 1fr; }',
        'direct-parent-grid/direct-parent-grid.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        'section.foo > .layout { display: grid; } article.bar > .layout { grid-template-columns: 1fr; }',
        'direct-parent-grid/direct-parent-grid.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        'main section > .layout { display: grid; } main article > .layout { grid-template-columns: 1fr; }',
        'direct-parent-grid/direct-parent-grid.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        'main section > .layout { display: grid; } aside section > .layout { grid-template-columns: 1fr; }',
        'direct-parent-grid/direct-parent-grid.css',
      ),
    ).toHaveLength(1);
  });

  test('merges try and catch as alternative control states', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; try { tag = 'input'; } catch { tag = 'div'; }</script><svelte:element this={tag} />",
        'try-catch-control/try-catch-control.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; try { throw 0; } catch (tag) { tag = 'input'; }</script><svelte:element this={tag} />",
        'try-catch-control/try-catch-control.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'input'; try { tag = 'div'; } finally {}</script><svelte:element this={tag} />",
        'try-catch-control/try-catch-control.svelte',
      ),
    ).toEqual([]);
  });

  test('merges field-tag switch exits independently', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'span'; function show(kind) { switch (kind) { case 'edit': tag = 'label'; break; default: tag = 'span'; } }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'switch-field-state/switch-field-state.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'span'; function show() { switch ('no') { default: tag = 'span'; break; case (tag = 'label'): break; } }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'switch-field-state/switch-field-state.svelte',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'span'; function show() { switch ('no') { default: tag = 'label'; break; case (tag = 'span'): tag = 'div'; } }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'switch-field-state/switch-field-state.svelte',
      ),
    ).toHaveLength(1);
  });

  test('stops field switch cases after conditionals whose branches both break', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'span'; function show(kind) { switch (kind) { case 1: if (stop) break; else break; tag = 'label'; } }</script><svelte:element this={tag} onclick={show}>Name</svelte:element><p>Help</p><p>Error</p>",
        'switch-field-state/switch-field-state.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves potentially matching field switch entries before literal matches', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>const match = 'yes'; let tag = 'span'; switch ('yes') { case match: tag = 'label'; break; case 'yes': tag = 'span'; }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'switch-field-state/switch-field-state.svelte',
      ),
    ).toHaveLength(1);
  });

  test('invalidates static field booleans assigned through destructuring', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<script>let ready = true; ({ ready } = { ready: false });</script>{#if ready}<div>Okay</div>{:else}<label>Name</label><p>Help</p><p>Error</p>{/if}',
        'destructured-field-boolean/destructured-field-boolean.svelte',
      ),
    ).toHaveLength(1);
  });

  test('analyzes each-block field fallbacks without leaking body bindings', () => {
    expect(
      findPrimitiveCompositionViolations(
        '{#each [] as item}<div>{item}</div>{:else}<label>Name</label><p>Help</p><p>Error</p>{/each}',
        'each-fallback-field/each-fallback-field.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '<script>const ready = true;</script>{#each [] as ready}<div>Okay</div>{:else}{#if ready}<label>Name</label><p>Help</p><p>Error</p>{/if}{/each}',
        'each-fallback-field/each-fallback-field.svelte',
      ),
    ).toHaveLength(1);
  });

  test('applies field loop updates only to non-break paths', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let ready = true; let tag = 'span'; for (; ready; tag = 'span') { tag = 'label'; if (stop) break; ready = false; }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'break-field-loop/break-field-loop.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let ready = true; let tag = 'span'; for (; ready; tag = 'label') { tag = 'span'; if (stop) break; ready = false; }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'break-field-loop/break-field-loop.svelte',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>let ready = true; let tag = 'span'; outer: for (; ready; tag = 'span') { tag = 'label'; if (stop) break outer; ready = false; }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'break-field-loop/break-field-loop.svelte',
      ),
    ).toHaveLength(1);
    for (const nestedBreak of ['switch (mode) { case 1: break; }', 'for (;;) { break; }'])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let ready = true; let tag = 'span'; for (; ready; tag = 'span') { tag = 'label'; ${nestedBreak} ready = false; }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>`,
          'nested-break-field-loop/nested-break-field-loop.svelte',
        ),
      ).toEqual([]);
  });

  test('keeps mutually exclusive template field evidence separate', () => {
    expect(
      findPrimitiveCompositionViolations(
        '{#if ready}<label>Name</label>{:else}<p>Help</p><p>Error</p>{/if}',
        'template-field-branches/template-field-branches.svelte',
      ),
    ).toEqual([]);
    for (const source of [
      '{#if false}<label>Name</label><p>Help</p><p>Error</p>{:else}<div>Okay</div>{/if}',
      '<script>const ready = false;</script>{#if ready}<label>Name</label><p>Help</p><p>Error</p>{:else}<div>Okay</div>{/if}',
      '<script>let ready = true;</script>{#if ready}<p>Help</p><p>Error</p>{:else}<label>Name</label><p>Help</p><p>Error</p>{/if}',
      '<script>let ready = false; function helper() { let ready = true; ready = false; }</script>{#if ready}<label>Name</label><p>Help</p><p>Error</p>{:else}<div>Okay</div>{/if}',
      '<script>let ready = false; try {} catch (ready) { ready = true; }</script>{#if ready}<label>Name</label><p>Help</p><p>Error</p>{:else}<div>Okay</div>{/if}',
      '<script>let ready = false; for (let ready = true; ready; ready = false) {}</script>{#if ready}<label>Name</label><p>Help</p><p>Error</p>{:else}<div>Okay</div>{/if}',
      '<script>let ready = false; switch (0) { case 0: let ready = true; ready = false; break; }</script>{#if ready}<label>Name</label><p>Help</p><p>Error</p>{:else}<div>Okay</div>{/if}',
    ])
      expect(
        findPrimitiveCompositionViolations(
          source,
          'template-field-branches/template-field-branches.svelte',
        ),
      ).toEqual([]);
    for (const source of [
      '<script>let ready = false; ready = true;</script>{#if ready}<label>Name</label><p>Help</p><p>Error</p>{:else}<div>Okay</div>{/if}',
      '<script>var ready = false; { var ready; ready = true; }</script>{#if ready}<label>Name</label><p>Help</p><p>Error</p>{:else}<div>Okay</div>{/if}',
    ])
      expect(
        findPrimitiveCompositionViolations(
          source,
          'template-field-branches/template-field-branches.svelte',
        ),
      ).toHaveLength(1);
  });

  test('applies switch-wide lexical shadowing to control tags', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; switch (1) { case 1: let tag = 'input'; break; }</script><svelte:element this={tag} />",
        'switch-control-shadow/switch-control-shadow.svelte',
      ),
    ).toEqual([]);
  });

  test('excludes impossible switch entries and applies finalizers to returned control states', () => {
    for (const source of [
      "<script>let tag = 'div'; switch ('yes') { case match: tag = 'div'; break; case 'no': tag = 'input'; break; case 'yes': tag = 'div'; }</script><svelte:element this={tag} />",
      "<script>let tag = 'div'; function show() { try { tag = 'input'; return; } finally { tag = 'div'; } }</script><svelte:element this={tag} onclick={show} />",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'control-flow/control-flow.svelte'),
      ).toEqual([]);
  });

  test('treats truthy static hidden spread values as boolean attributes', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<input {...{ hidden: 'false' }} />",
        'hidden-spread/hidden-spread.svelte',
      ),
    ).toEqual([]);
  });

  test('preserves IIFE returns and skips defaults for definitely supplied values', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'div'; (() => { if (custom) { tag = 'input'; return; } tag = 'div'; })();</script><svelte:element this={tag} />",
        'iife-control-flow/iife-control-flow.svelte',
      ),
    ).toHaveLength(1);
    for (const argument of [
      '{}',
      '[]',
      'function supplied() {}',
      'class Supplied {}',
      '`supplied`',
      'new Object()',
    ])
      expect(
        findPrimitiveCompositionViolations(
          `<script>let tag = 'div'; ((value = (tag = 'input')) => {})(${argument});</script><svelte:element this={tag} />`,
          'iife-default/iife-default.svelte',
        ),
      ).toEqual([]);
  });

  test('preserves try prefixes, local alias alternatives, and pre-await control states', () => {
    for (const source of [
      "<script>let tag = 'div'; function show() { try { tag = 'input'; risky(); tag = 'div'; } catch {} }</script><svelte:element this={tag} onclick={show} />",
      "<script>let tag = 'div'; function show() { const next = ready ? 'input' : 'div'; tag = next; }</script><svelte:element this={tag} onclick={show} />",
      "<script>let tag = 'div'; async function show() { tag = 'input'; await tick(); tag = 'div'; }</script><svelte:element this={tag} onclick={show} />",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'observable-control/observable-control.svelte'),
      ).toHaveLength(1);
  });

  test('inspects static alternatives in raw HTML expressions', () => {
    expect(
      findPrimitiveCompositionViolations(
        `{@html ready ? '<input aria-label="Name">' : '<div></div>'}`,
        'raw-html-alternatives/raw-html-alternatives.svelte',
      ),
    ).toHaveLength(1);
  });

  test('models field-tag ternaries, try-catch paths, and bare-block shadowing', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let tag = 'span'; true ? (tag = 'span') : (tag = 'label');</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
        'field-control-flow/field-control-flow.svelte',
      ),
    ).toEqual([]);
    for (const source of [
      "<script>let tag = 'span'; function show() { try { tag = 'label'; } catch { tag = 'span'; } }</script><svelte:element this={tag} onclick={show}>Name</svelte:element><p>Help</p><p>Error</p>",
      "<script>let tag = 'label'; { let tag = 'span'; }</script><svelte:element this={tag}>Name</svelte:element><p>Help</p><p>Error</p>",
      "<script>let tag = 'span'; function show() { if (custom) { if (cancel) return; tag = 'label'; } }</script><svelte:element this={tag} onclick={show}>Name</svelte:element><p>Help</p><p>Error</p>",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'field-control-flow/field-control-flow.svelte'),
      ).toHaveLength(1);
  });

  test('respects template-local shadows when pruning field IfBlocks', () => {
    for (const source of [
      '<script>const ready = true;</script>{#each items as ready}{#if ready}<div>Okay</div>{:else}<label>Name</label><p>Help</p><p>Error</p>{/if}{/each}',
      '<script>const ready = true;</script>{#snippet render(ready)}{#if ready}<div>Okay</div>{:else}<label>Name</label><p>Help</p><p>Error</p>{/if}{/snippet}',
      '<script>const ready = true;</script>{#await promise then ready}{#if ready}<div>Okay</div>{:else}<label>Name</label><p>Help</p><p>Error</p>{/if}{/await}',
    ])
      expect(
        findPrimitiveCompositionViolations(
          source,
          'template-field-shadow/template-field-shadow.svelte',
        ),
      ).toHaveLength(1);
  });

  test('deduplicates equivalent field-evidence branch combinations', () => {
    const branches = Array.from(
      { length: 20 },
      (_, index) => `{#if condition${index}}<span></span>{:else}<span></span>{/if}`,
    ).join('');
    expect(
      findPrimitiveCompositionViolations(
        `<label>Name</label>${branches}<p>Help</p><p>Error</p>`,
        'field-branch-stress/field-branch-stress.svelte',
      ),
    ).toHaveLength(1);
  });

  test('models style ternaries, try-catch paths, continue, and block scope', () => {
    expect(
      findPrimitiveCompositionViolations(
        "<script>let layout = { display: 'block' }; true ? (layout = { display: 'block' }) : (layout = { display: 'grid', gridTemplateColumns: '1fr' });</script><div style={layout}></div>",
        'style-control-flow/style-control-flow.svelte',
      ),
    ).toEqual([]);
    for (const source of [
      "<script>let layout = { display: 'block' }; function enable() { try { layout = { display: 'grid', gridTemplateColumns: '1fr' }; } catch { layout = { display: 'block' }; } }</script><div style={layout} onclick={enable}></div>",
      "<script>let layout = { display: 'block' }; function enable() { for (const item of [1]) { layout = { display: 'grid', gridTemplateColumns: '1fr' }; continue; layout = { display: 'block' }; } }</script><div style={layout} onclick={enable}></div>",
      "<script>let layout = { display: 'grid', gridTemplateColumns: '1fr' }; { let layout = { display: 'block' }; }</script><div style={layout}></div>",
    ])
      expect(
        findPrimitiveCompositionViolations(source, 'style-control-flow/style-control-flow.svelte'),
      ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        "<script>var layout = { display: 'grid', gridTemplateColumns: '1fr' }; { var layout = { display: 'block' }; }</script><div style={layout}></div>",
        'style-control-flow/style-control-flow.svelte',
      ),
    ).toEqual([]);
  });

  test('marks conflicting functional tag constraints impossible', () => {
    expect(
      findPrimitiveCompositionViolations(
        'input:is(select) { display: grid; grid-template-columns: 1fr; }',
        'functional-tag-conflict/functional-tag-conflict.css',
      ),
    ).toEqual([]);
  });

  test('retains every repeated attribute constraint when checking contradictions', () => {
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-x^='a'][data-x$='b'][data-x='cb'] { display: grid; grid-template-columns: 1fr; }",
        'repeated-attribute-constraints/repeated-attribute-constraints.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-x^='a'][data-x$='b'][data-x='ab'] { display: grid; grid-template-columns: 1fr; }",
        'repeated-attribute-constraints/repeated-attribute-constraints.css',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-x='ab'] { display: grid; } .layout:not([data-x^='b'][data-x='ab']) { grid-template-columns: 1fr; }",
        'repeated-attribute-constraints/repeated-attribute-constraints.css',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        ".layout[data-x='ab'] { display: grid; } .layout:not([data-x^='a'][data-x='ab']) { grid-template-columns: 1fr; }",
        'repeated-attribute-constraints/repeated-attribute-constraints.css',
      ),
    ).toEqual([]);
  });

  test('respects nested functional constraints in negated alternatives', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.layout:not(:is(.disabled)) { display: grid; grid-template-columns: 1fr; }',
        'nested-functional-negation/nested-functional-negation.css',
      ),
    ).toHaveLength(1);
    expect(
      findPrimitiveCompositionViolations(
        '.layout:not(:is(.layout)) { display: grid; grid-template-columns: 1fr; }',
        'nested-functional-negation/nested-functional-negation.css',
      ),
    ).toEqual([]);
    expect(
      findPrimitiveCompositionViolations(
        '.layout:not(:not(.disabled)) { display: grid; grid-template-columns: 1fr; }',
        'nested-functional-negation/nested-functional-negation.css',
      ),
    ).toHaveLength(1);
  });

  test('excludes unpublished Svelte fixtures and type tests', () => {
    expect(shouldCheckComponentSource('input/input.fixture.svelte')).toBe(false);
    expect(shouldCheckComponentSource('data-grid/data-grid-selection-bind-fixture.svelte')).toBe(
      false,
    );
    expect(shouldCheckComponentSource('data-grid/data-grid-selection-bind-fixtures.svelte')).toBe(
      false,
    );
    expect(shouldCheckComponentSource('select/select.type-test.svelte')).toBe(false);
    expect(shouldCheckComponentSource('context-menu/_context-menu-test-harness.svelte')).toBe(
      false,
    );
    expect(shouldCheckComponentSource('collapsible/collapsible-bindable-harness.svelte')).toBe(
      false,
    );
    expect(shouldCheckComponentSource('tab-panel/tab-panel-aria-labelledby-harness.svelte')).toBe(
      false,
    );
    expect(
      shouldCheckComponentSource('copy-button/__test-helpers__/copy-state-wrapper.svelte'),
    ).toBe(false);
    expect(shouldCheckComponentSource('input/input.svelte')).toBe(true);
  });

  test('reports migration records whose source file disappeared', () => {
    expect(missingMigrationRecordPaths(new Set())).toContain('pin-input/pin-input.svelte');
    expect(missingMigrationRecordPaths(new Set(['pin-input/pin-input.svelte']))).not.toContain(
      'pin-input/pin-input.svelte',
    );
  });

  test('tracks a raw-control-signature-only path in the missing-migration-record set', () => {
    const syntheticPath = '__test-only__/synthetic-signature.svelte';
    allowedRawControlSignatures.set(syntheticPath, ['input']);
    try {
      expect(missingMigrationRecordPaths(new Set())).toContain(syntheticPath);
      expect(missingMigrationRecordPaths(new Set([syntheticPath]))).not.toContain(syntheticPath);
    } finally {
      allowedRawControlSignatures.delete(syntheticPath);
    }
  });
});
