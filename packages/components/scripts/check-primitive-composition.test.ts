import { describe, expect, test } from 'bun:test';

import {
  findPrimitiveCompositionViolations,
  shouldCheckComponentSource,
} from './check-primitive-composition.ts';

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
        'display: grid; grid-template-columns: 1fr;',
        'bento-grid/bento-grid.css',
      ),
    ).toEqual([]);
  });

  test('rejects a new grid occurrence in a tracked stylesheet', () => {
    expect(
      findPrimitiveCompositionViolations(
        '.first { display: grid; grid-template-columns: 1fr; } .second { display: grid; grid-template-columns: 1fr; }',
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
        "<script>const layoutStyle = 'display: grid; grid-template-columns: 1fr 1fr';</script><div style={layoutStyle}></div>",
        'new-grid/new-grid.svelte',
      ),
    ).toHaveLength(1);
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
        floatingCss,
        'new-menu/new-menu.css',
        '<div class="other cinder-_floating-surface"></div><div class="menu"></div>',
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

  test('excludes unpublished Svelte fixtures and type tests', () => {
    expect(shouldCheckComponentSource('input/input.fixture.svelte')).toBe(false);
    expect(shouldCheckComponentSource('select/select.type-test.svelte')).toBe(false);
    expect(shouldCheckComponentSource('context-menu/_context-menu-test-harness.svelte')).toBe(
      false,
    );
    expect(shouldCheckComponentSource('input/input.svelte')).toBe(true);
  });
});
