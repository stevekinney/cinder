/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Tooltip } = await import('./tooltip.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

const triggerSnippet = createRawSnippet(() => ({
  render: () => `<button type="button">Hover me</button>`,
  setup: () => {},
}));

describe('Tooltip', () => {
  test('renders children (trigger) content', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: textSnippet('Trigger'),
      },
    });
    expect(container.textContent).toContain('Trigger');
  });

  test('tooltip element is present but aria-hidden="true" initially', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute('aria-hidden')).toBe('true');
  });

  test('focusable trigger inside wrapper has aria-describedby that matches the tooltip id', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    // aria-describedby must be on the element that receives focus, not the wrapper.
    const trigger = container.querySelector<HTMLElement>('button');
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(trigger?.getAttribute('aria-describedby')).toBe(tooltip?.getAttribute('id'));
  });

  test('tooltip becomes visible on focusin (aria-hidden="false")', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;
    await fireEvent.focusIn(wrapper);

    await waitFor(() => {
      const tooltip = container.querySelector('[role="tooltip"]');
      expect(tooltip?.getAttribute('aria-hidden')).toBe('false');
    });
  });

  test('tooltip becomes hidden on focusout', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    // Show first
    await fireEvent.focusIn(wrapper);
    await waitFor(() => {
      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe(
        'false',
      );
    });

    // Then hide — focusout bubbles from any descendant losing focus.
    await fireEvent.focusOut(wrapper);
    await waitFor(() => {
      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('data-cinder-placement reflects the placement prop', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        placement: 'bottom',
        children: triggerSnippet,
      },
    });
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.getAttribute('data-cinder-placement')).toBe('bottom');
  });

  test('defaults to placement "top" when placement prop is omitted', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.getAttribute('data-cinder-placement')).toBe('top');
  });

  test('tooltip text content is rendered', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'This is the tooltip text',
        children: triggerSnippet,
      },
    });
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent?.trim()).toBe('This is the tooltip text');
  });

  test('shows tooltip on mouseenter and hides on mouseleave', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Hover tooltip',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await fireEvent.mouseEnter(wrapper);
    await waitFor(() => {
      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe(
        'false',
      );
    });

    await fireEvent.mouseLeave(wrapper);
    await waitFor(() => {
      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('Escape hides a visible tooltip (WAI-ARIA APG dismiss requirement)', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Dismissible tooltip',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await fireEvent.focusIn(wrapper);
    await waitFor(() => {
      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe(
        'false',
      );
    });

    await fireEvent.keyDown(wrapper, { key: 'Escape' });
    await waitFor(() => {
      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('Escape on document hides a tooltip opened by hover', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Dismissible hover tooltip',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    await fireEvent.mouseEnter(wrapper);
    await waitFor(() => {
      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe(
        'false',
      );
    });

    await fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('Escape cancels a pending tooltip before the show delay completes', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const pendingTimers = new Map<number, () => void>();
    let nextTimerId = 0;

    globalThis.setTimeout = ((handler: TimerHandler) => {
      nextTimerId += 1;
      pendingTimers.set(nextTimerId, () => {
        if (typeof handler === 'function') handler();
      });
      return nextTimerId;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((id: number | undefined) => {
      if (typeof id === 'number') pendingTimers.delete(id);
    }) as typeof clearTimeout;

    try {
      const { container } = render(Tooltip, {
        props: {
          text: 'Pending tooltip',
          children: triggerSnippet,
        },
      });
      const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

      await fireEvent.mouseEnter(wrapper);
      await fireEvent.keyDown(document, { key: 'Escape' });
      for (const runTimer of pendingTimers.values()) {
        runTimer();
      }

      expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  test('Escape on a hidden tooltip is a no-op', async () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Already hidden',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper') as HTMLElement;

    expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');
    await fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('aria-hidden')).toBe('true');
  });
});
