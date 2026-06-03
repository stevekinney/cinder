/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/dropdown-compound-fixture.svelte');
const { default: DropdownTrigger } = await import('./dropdown-trigger.svelte');

describe('DropdownTrigger', () => {
  test('throws when rendered outside a Dropdown', () => {
    expect(() =>
      render(DropdownTrigger, {
        props: {
          children: createRawSnippet(() => ({ render: () => '<span>x</span>', setup: () => {} })),
        },
      }),
    ).toThrow(/missing_context/);
  });

  test('renders a button with aria-haspopup="menu"', () => {
    const { container } = render(Fixture);
    const trigger = container.querySelector('.cinder-dropdown-trigger');
    expect(trigger?.tagName.toLowerCase()).toBe('button');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
  });

  test('aria-expanded reflects the open state and flips on click', async () => {
    const { container } = render(Fixture);
    const trigger = container.querySelector('.cinder-dropdown-trigger') as HTMLElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await fireEvent.click(trigger);
    await waitFor(() => {
      expect(
        container.querySelector('.cinder-dropdown-trigger')?.getAttribute('aria-expanded'),
      ).toBe('true');
    });
  });
});
