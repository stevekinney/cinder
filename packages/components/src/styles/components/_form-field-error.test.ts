/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { injectStrippedStyles } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: FormField } = await import('../../components/form-field/form-field.svelte');
const { createRawSnippet } = await import('svelte');

const sharedErrorCss = await Bun.file(new URL('./_form-field-error.css', import.meta.url)).text();

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

afterEach(() => cleanup());

describe('shared _form-field-error.css', () => {
  test('declares the collapsed-when-errorless rule using the sr-only pattern, not visibility:hidden', () => {
    // CIN-315 review follow-up: this rule used to be duplicated per-component
    // in Select/Combobox/MultiSelect; it now lives here once, imported by the
    // required `cinder/styles` base so every FormFieldFrame consumer inherits
    // it without a per-component copy. It must NOT use `visibility: hidden`
    // (or `display: none`) — both remove an element from the accessibility
    // tree immediately (see navigation-bar.a11y.md), which would silently
    // defeat the fix: a live region that isn't in the AT tree cannot
    // announce the error→populated transition either.
    const declarationBlock = sharedErrorCss.slice(
      sharedErrorCss.indexOf('.cinder-form-field__error:not([data-cinder-error]) {'),
    );
    expect(declarationBlock).toContain(
      '.cinder-form-field__error:not([data-cinder-error]) {\n    position: absolute;',
    );
    expect(declarationBlock).not.toContain('visibility: hidden');
    expect(declarationBlock).not.toContain('display: none');
    // Mirrors the shared `.cinder-sr-only` utility's exact technique
    // (styles/utilities.css): 1px box + clip, not visibility.
    expect(declarationBlock).toContain('clip: rect(0, 0, 0, 0);');
  });

  test('removes the errorless live region from layout while keeping it exposed to assistive technology', () => {
    const removeStyles = injectStrippedStyles(sharedErrorCss);
    try {
      const { container } = render(FormField, {
        props: { id: 'no-error-computed', label: 'Name', children: emptySnippet },
      });
      const errorRegion = container.querySelector('.cinder-form-field__error');
      expect(errorRegion).not.toBeNull();
      expect(errorRegion?.getAttribute('data-cinder-error')).toBeNull();
      expect(errorRegion?.getAttribute('aria-live')).toBe('polite');
      // Not removed from the accessibility tree: no aria-hidden, and (per
      // navigation-bar.a11y.md) neither `display: none` nor
      // `visibility: hidden` — either would pull the live region out of the
      // AT tree exactly like this ticket's original bug.
      expect(errorRegion?.getAttribute('aria-hidden')).toBeNull();

      const computed = getComputedStyle(errorRegion as Element);
      expect(computed.display).not.toBe('none');
      expect(computed.visibility).not.toBe('hidden');
      // Computed collapse, not a screenshot: out of flow (position:absolute,
      // no reserved space or flex/grid gap contribution) and visually
      // clipped to nothing, via the same mechanism as `.cinder-sr-only`.
      expect(computed.position).toBe('absolute');
      expect(computed.width).toBe('1px');
      expect(computed.height).toBe('1px');
      expect(computed.overflow).toBe('hidden');
      expect(computed.clip).toBe('rect(0, 0, 0, 0)');
      expect(computed.whiteSpace).toBe('nowrap');
    } finally {
      removeStyles();
    }
  });

  test('restores normal flow and full visibility once an error is set', () => {
    const removeStyles = injectStrippedStyles(sharedErrorCss);
    try {
      const { container } = render(FormField, {
        props: {
          id: 'with-error-computed',
          label: 'Name',
          error: 'Required',
          children: emptySnippet,
        },
      });
      const errorRegion = container.querySelector('.cinder-form-field__error');
      expect(errorRegion?.getAttribute('data-cinder-error')).toBe('');

      const computed = getComputedStyle(errorRegion as Element);
      expect(computed.position).not.toBe('absolute');
      expect(computed.clip).not.toBe('rect(0, 0, 0, 0)');
    } finally {
      removeStyles();
    }
  });
});
