import { describe, expect, test } from 'bun:test';

import { findPrimitiveCompositionViolations } from './check-primitive-composition.ts';

describe('primitive composition guard', () => {
  test('rejects a new raw form control', () => {
    expect(
      findPrimitiveCompositionViolations('<input />', 'new-control/new-control.svelte'),
    ).toHaveLength(1);
  });

  test('allows a tracked raw-control offender', () => {
    expect(
      findPrimitiveCompositionViolations('<input />', 'autocomplete/autocomplete.svelte'),
    ).toEqual([]);
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

  test('rejects a layered floating surface without the shared sidecar', () => {
    expect(
      findPrimitiveCompositionViolations(
        'position: absolute; z-index: 1;',
        'new-menu/new-menu.css',
      ),
    ).toHaveLength(1);
  });

  test('allows a floating surface that imports the shared sidecar', () => {
    expect(
      findPrimitiveCompositionViolations(
        "@import '../_internal/_floating-surface.css'; position: absolute; z-index: 1;",
        'new-menu/new-menu.css',
      ),
    ).toEqual([]);
  });

  test('rejects an untracked hand-rolled field wrapper', () => {
    expect(
      findPrimitiveCompositionViolations(
        '<label>Label</label><p>description</p><p>error</p>',
        'new-field/new-field.svelte',
      ),
    ).toHaveLength(1);
  });
});
