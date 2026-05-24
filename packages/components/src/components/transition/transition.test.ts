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

  test('initial present=false + forceMount=true stays closed/exited and does not fire onExitComplete', async () => {
    // Regression for Codex round 1 finding H2: the previous implementation initialized
    // `isMounted = present || forceMount` then ran the main effect with `present=false`, falling
    // into the exit branch and emitting `exiting` / calling `onExitComplete`. The plan requires
    // the initial state to be closed/exited without a transition.
    let exitCount = 0;
    const { container } = render(Presence, {
      props: {
        present: false,
        forceMount: true,
        children: transitionChildren,
        onExitComplete: () => {
          exitCount += 1;
        },
      },
    });

    await tick();
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    const wrapper = container.querySelector('[data-cinder-state]') as HTMLDivElement;
    expect(wrapper.dataset['cinderState']).toBe('closed');
    expect(wrapper.dataset['cinderPresence']).toBe('exited');
    expect(exitCount).toBe(0);
  });

  test('ignores bubbling transitionend events from descendants', async () => {
    // Regression: `handleExitEvent` previously only checked `event.target !== wrapper`, which is
    // always true when `wrapper` is `undefined`. A wrapped event from a child could fall through.
    const { container, rerender } = render(Presence, {
      props: { present: true, children: transitionChildren },
    });

    await tick();
    await rerender({ present: false, children: transitionChildren });

    const wrapper = container.querySelector('[data-cinder-state]');
    // Dispatch a transitionend on a descendant; should NOT complete the exit early.
    const child = wrapper?.querySelector('[data-testid="presence-child"]') as HTMLElement | null;
    child?.dispatchEvent(new Event('transitionend', { bubbles: true }));

    // The wrapper should still be in the DOM (exit not completed by a child event).
    expect(container.querySelector('[data-cinder-state]')).not.toBeNull();
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
