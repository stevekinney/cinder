/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

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
});
