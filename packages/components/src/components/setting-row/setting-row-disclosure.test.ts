import { setupHappyDom } from '@lostgradient/testing';
import { expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';
setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: Disclosure } = await import('./setting-row-disclosure.svelte');
test('disclosure exposes expanded and controls', () => {
  const { container } = render(Disclosure, {
    props: {
      expanded: true,
      controls: 'details',
      children: createRawSnippet(() => ({ render: () => '<span>Details</span>' })),
    },
  });
  const button = container.querySelector('button');
  expect(button?.getAttribute('aria-expanded')).toBe('true');
  expect(button?.getAttribute('aria-controls')).toBe('details');
});
