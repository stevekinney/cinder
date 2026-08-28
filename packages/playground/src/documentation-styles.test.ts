import { describe, expect, test } from 'bun:test';

import {
  DOCUMENTATION_CINDER_COMPONENTS,
  LANDING_CINDER_COMPONENTS,
  buildDocumentationStylesheet,
  buildLandingStylesheet,
} from './documentation-styles.ts';

describe('documentation stylesheet', () => {
  test('bundles the shared documentation primitives into one stylesheet', async () => {
    const stylesheet = await buildDocumentationStylesheet();

    expect(stylesheet).toContain('.cinder-button');
    expect(stylesheet).toContain('.cinder-table__body');
    expect(stylesheet).toContain('.cinder-accordion-item');
    expect(stylesheet).toContain('.cinder-json-token-key');
    expect(stylesheet).not.toContain('@import');
    // Vercel serves static CSS compressed. The cache-disabled transfer budget
    // is measured on those response bytes, not the decoded stylesheet size.
    expect(Bun.gzipSync(stylesheet).byteLength).toBeLessThan(100_000);
  });

  test('accounts for every Cinder primitive rendered by the documentation page', () => {
    expect(DOCUMENTATION_CINDER_COMPONENTS).toEqual([
      'accordion',
      'alert',
      'badge',
      'button',
      'callout',
      'code-block',
      'collapsible',
      'color-picker',
      'color-swatch-picker',
      'copy-button',
      'kbd',
      'input',
      'popover',
      'status-dot',
      'table',
      'toggle',
      'tooltip',
    ]);
  });
});

describe('landing stylesheet', () => {
  test('omits documentation-only component families', async () => {
    const stylesheet = await buildLandingStylesheet();

    expect(LANDING_CINDER_COMPONENTS).toEqual([
      'button',
      'code-block',
      'color-picker',
      'color-swatch-picker',
      'copy-button',
      'form-field',
      'input',
      'popover',
      'tooltip',
    ]);
    expect(stylesheet).toContain('.cinder-button');
    expect(stylesheet).toContain('--cinder-code-block');
    expect(stylesheet).toContain('.cinder-color-picker');
    // A bare `--cinder-table` substring check would false-positive on the
    // unrelated `--cinder-table-of-contents-*` custom properties (global
    // :root tokens present in every stylesheet), which share the "table"
    // prefix but belong to a different component. `.cinder-table__body` is
    // Table's own class selector -- unambiguous, and the same selector the
    // sibling "documentation stylesheet" test above uses to confirm Table
    // styles ARE present there.
    expect(stylesheet).not.toContain('.cinder-table__body');
  });
});
