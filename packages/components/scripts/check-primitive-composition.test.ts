import { describe, expect, test } from 'bun:test';

import {
  findPrimitiveCompositionViolations,
  missingMigrationRecordPaths,
  shouldCheckComponentSource,
} from './check-primitive-composition.ts';
import { cssPrimitiveCounts } from './primitive-composition-css.ts';
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
  });

  test('recognizes value-first width range media conditions', () => {
    expect(
      findPrimitiveCompositionViolations(
        '@media (40rem < width) { .layout { display: grid; } } @media (width <= 40rem) { .layout { grid-template-columns: 1fr; } }',
        'new-layout/new-layout.css',
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
