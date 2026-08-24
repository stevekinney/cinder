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
  test('declares the collapsed-when-errorless rule against the base class', () => {
    // CIN-315 review follow-up: this rule used to be duplicated per-component
    // in Select/Combobox/MultiSelect; it now lives here once, imported by the
    // required `cinder/styles` base so every FormFieldFrame consumer inherits
    // it without a per-component copy.
    expect(sharedErrorCss).toContain(
      '.cinder-form-field__error:not([data-cinder-error]) {\n    position: absolute;',
    );
  });

  test('removes the errorless live region from layout while keeping it in the accessibility tree', () => {
    const removeStyles = injectStrippedStyles(sharedErrorCss);
    try {
      const { container } = render(FormField, {
        props: { id: 'no-error-computed', label: 'Name', children: emptySnippet },
      });
      const errorRegion = container.querySelector('.cinder-form-field__error');
      expect(errorRegion).not.toBeNull();
      expect(errorRegion?.getAttribute('data-cinder-error')).toBeNull();
      expect(errorRegion?.getAttribute('aria-live')).toBe('polite');

      const computed = getComputedStyle(errorRegion as Element);
      // Computed collapse, not a screenshot: out of flow (no reserved space
      // or flex/grid gap contribution) while still present for AT.
      expect(computed.position).toBe('absolute');
      expect(computed.visibility).toBe('hidden');
      expect(computed.height).toBe('0px');
      expect(computed.overflow).toBe('hidden');
    } finally {
      removeStyles();
    }
  });

  test('restores normal flow and visibility once an error is set', () => {
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
      expect(computed.visibility).not.toBe('hidden');
    } finally {
      removeStyles();
    }
  });
});
