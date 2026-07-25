import { describe, expect, test } from 'bun:test';

import {
  findPrimitiveCompositionViolations,
  missingMigrationRecordPaths,
  shouldCheckComponentSource,
} from './check-primitive-composition.ts';
import { cssPrimitiveCounts } from './primitive-composition-css.ts';
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

  test('ignores hidden submission inputs and controls mentioned in comments', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<!-- <input> --><input type="hidden" name="value" />',
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

  test('resolves top-level writes to mutable style-object bindings', () => {
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

  test('rejects a layered floating surface without the shared sidecar', () => {
    expect(
      findPrimitiveCompositionViolations(
        'position: absolute; z-index: 1;',
        'new-menu/new-menu.css',
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

  test('does not associate a separate label with canonical FormField evidence', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label>Unrelated</label><FormField helpText="Help" error="Error" />',
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
});
