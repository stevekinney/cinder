import { expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { fireEvent, render } = await import('@testing-library/svelte');
const { default: Disclosure } = await import('./setting-row-disclosure.svelte');
test('disclosure exposes expanded and controls and toggles on activation', async () => {
  let expanded = false;
  const { container } = render(Disclosure, {
    props: {
      get expanded() {
        return expanded;
      },
      set expanded(value: boolean) {
        expanded = value;
      },
      controls: 'details',
      children: createRawSnippet(() => ({ render: () => '<span>Details</span>' })),
    },
  });
  const button = container.querySelector('button');
  expect(button?.getAttribute('aria-expanded')).toBe('false');
  expect(button?.getAttribute('aria-controls')).toBe('details');
  await fireEvent.click(button!);
  await tick();
  expect(expanded).toBe(true);
});
