/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { injectStrippedStyles } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/radio-group-fixture.svelte');
const { default: Radio } = await import('./radio.svelte');

const options = [
  { id: 'r-a', value: 'a', label: 'Option A' },
  { id: 'r-b', value: 'b', label: 'Option B' },
];

describe('Radio', () => {
  test('throws when rendered outside a RadioGroup', () => {
    expect(() =>
      render(Radio, {
        props: {
          id: 'lonely',
          value: 'x',
          label: 'Lonely',
          children: createRawSnippet(() => ({ render: () => '<span></span>', setup: () => {} })),
        },
      }),
    ).toThrow(/missing_context/);
  });

  test('renders a native <input type="radio"> per option sharing the group name', () => {
    const { container } = render(Wrapper, { name: 'choice', value: 'a', options });
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios).toHaveLength(2);
    expect(radios.every((radio) => radio.getAttribute('name') === 'choice')).toBe(true);
  });

  test('checked state reflects the selected group value', () => {
    const { container } = render(Wrapper, { name: 'choice', value: 'b', options });
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios[0]?.checked).toBe(false);
    expect(radios[1]?.checked).toBe(true);
  });

  test('each radio is associated with its label via for/id', () => {
    const { container } = render(Wrapper, { name: 'choice', value: 'a', options });
    const label = container.querySelector('label[for="r-a"]');
    expect(label).not.toBeNull();
    expect(container.querySelector('#r-a')).not.toBeNull();
  });

  test('the error live region is mounted before any error is set (CIN-315: FormFieldFrame defaults to errorMountedOnDemand=false)', () => {
    const { container } = render(Wrapper, { name: 'choice', value: 'a', options });
    expect(container.querySelector('.cinder-form-field__error')).not.toBeNull();
  });

  test('the errorless live region has no layout footprint (shared _form-field-error.css, CIN-315 follow-up)', async () => {
    const radioCss = await Bun.file(new URL('./radio.css', import.meta.url)).text();
    const radioGroupCss = await Bun.file(
      new URL('../radio-group/radio-group.css', import.meta.url),
    ).text();
    const sharedErrorCss = await Bun.file(
      new URL('../../styles/components/_form-field-error.css', import.meta.url),
    ).text();
    const removeStyles = injectStrippedStyles(radioCss, radioGroupCss, sharedErrorCss);
    try {
      const { container } = render(Wrapper, { name: 'choice', value: 'a', options });
      const errorRegion = container.querySelector('.cinder-form-field__error');
      const computed = getComputedStyle(errorRegion as Element);
      expect(computed.position).toBe('absolute');
      expect(computed.visibility).toBe('hidden');
    } finally {
      removeStyles();
    }
  });
});
