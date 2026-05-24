/// <reference lib="dom" />
import { beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { Presence, Transition } = await import('./index.ts');

const transitionChildren = createRawSnippet(() => ({
  render: () => '<div data-testid="presence-child">Transition child</div>',
}));

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('Presence', () => {
  test('sets open state attributes while present', async () => {
    const { container } = render(Presence, {
      props: {
        present: true,
        children: transitionChildren,
      },
    });

    await tick();

    const wrapper = container.querySelector('[data-cinder-state]') as HTMLDivElement;
    expect(wrapper.dataset['cinderState']).toBe('open');
    expect(wrapper.dataset['cinderPresence']).toBe('entering');
  });

  test('keeps the wrapper mounted when forceMount is true', async () => {
    const { container, rerender } = render(Presence, {
      props: {
        present: true,
        forceMount: true,
        children: transitionChildren,
      },
    });

    await rerender({
      present: false,
      forceMount: true,
      children: transitionChildren,
    });
    await tick();

    const wrapper = container.querySelector('[data-cinder-state]') as HTMLDivElement;
    expect(wrapper.dataset['cinderState']).toBe('closed');
    expect(wrapper.dataset['cinderPresence']).toBe('exiting');
  });

  test('unmounts after a zero-duration exit and calls onExitComplete', async () => {
    let exitCount = 0;
    const { container, rerender } = render(Presence, {
      props: {
        present: true,
        children: transitionChildren,
        onExitComplete: () => {
          exitCount += 1;
        },
      },
    });

    await rerender({
      present: false,
      children: transitionChildren,
      onExitComplete: () => {
        exitCount += 1;
      },
    });
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    expect(container.querySelector('[data-testid="presence-child"]')).toBeNull();
    expect(exitCount).toBe(1);
  });
});

describe('Transition', () => {
  test('renders through a provided Svelte transition function while shown', async () => {
    const { getByTestId } = render(Transition, {
      props: {
        show: true,
        children: transitionChildren,
        transition: (_node: Element, parameters: unknown) => {
          const { duration } = parameters as { duration: number };
          return { duration };
        },
        transitionParameters: { duration: 1 },
      },
    });

    await tick();

    expect(getByTestId('presence-child')).not.toBeNull();
  });
});
