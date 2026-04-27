/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

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

  test('trigger wrapper has aria-describedby that matches the tooltip id', () => {
    const { container } = render(Tooltip, {
      props: {
        text: 'Tooltip content',
        children: triggerSnippet,
      },
    });
    const wrapper = container.querySelector('.cinder-tooltip-wrapper');
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(wrapper?.getAttribute('aria-describedby')).toBe(tooltip?.getAttribute('id'));
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

  test('tooltip becomes hidden on blur', async () => {
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

    // Then hide
    await fireEvent.blur(wrapper);
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
});
