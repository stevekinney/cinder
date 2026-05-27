/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Collapsible } = await import('./collapsible.svelte');
const { default: BindableHarness } = await import('./collapsible-bindable-harness.svelte');
const { createRawSnippet } = await import('svelte');

function bodySnippet(text = 'panel body') {
  return createRawSnippet(() => ({
    render: () => `<p>${text}</p>`,
  }));
}

function trigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('.cinder-collapsible__trigger') as HTMLButtonElement;
}

function panel(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.cinder-collapsible__panel');
}

describe('Collapsible (uncontrolled)', () => {
  test('panel is absent initially and renders after clicking the trigger', async () => {
    const { container } = render(Collapsible, {
      trigger: 'Toggle me',
      children: bodySnippet(),
    });

    expect(panel(container)).toBeNull();
    expect(trigger(container).getAttribute('aria-expanded')).toBe('false');

    await fireEvent.click(trigger(container));

    expect(panel(container)).not.toBeNull();
    expect(panel(container)?.textContent).toContain('panel body');
    expect(trigger(container).getAttribute('aria-expanded')).toBe('true');
  });

  test('open panel wires aria-controls, region role, and aria-labelledby', async () => {
    const { container } = render(Collapsible, { trigger: 'Toggle', children: bodySnippet() });

    await fireEvent.click(trigger(container));

    const button = trigger(container);
    const region = panel(container);
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('region');
    expect(button.getAttribute('aria-controls')).toBe(region?.getAttribute('id') ?? null);
    expect(region?.getAttribute('aria-labelledby')).toBe(button.getAttribute('id'));
  });

  test('renders initially open when open=true and toggles closed on click', async () => {
    const { container } = render(Collapsible, {
      trigger: 'Toggle',
      open: true,
      children: bodySnippet(),
    });

    expect(panel(container)).not.toBeNull();

    await fireEvent.click(trigger(container));

    expect(panel(container)).toBeNull();
  });
});

describe('Collapsible (controlled)', () => {
  test('onToggle fires with the next state on each click', async () => {
    const onToggle = mock(() => {});
    const { container } = render(Collapsible, {
      trigger: 'Toggle',
      open: false,
      onToggle,
      children: bodySnippet(),
    });

    await fireEvent.click(trigger(container));
    expect(onToggle).toHaveBeenLastCalledWith(true);

    await fireEvent.click(trigger(container));
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  test('bind:open is two-way: trigger updates parent, parent updates panel', async () => {
    const { container, getByTestId } = render(BindableHarness);

    expect(getByTestId('open-readout').textContent).toBe('closed');
    expect(panel(container)).toBeNull();

    // Panel-driven: clicking the trigger flows up to the parent's state.
    await fireEvent.click(trigger(container));
    expect(getByTestId('open-readout').textContent).toBe('open');
    expect(panel(container)).not.toBeNull();

    // Parent-driven: the external button flows down into the panel.
    await fireEvent.click(getByTestId('external-toggle'));
    expect(getByTestId('open-readout').textContent).toBe('closed');
    expect(panel(container)).toBeNull();
  });
});

describe('Collapsible disabled', () => {
  test('disabled trigger is a real disabled button that does not toggle', async () => {
    const onToggle = mock(() => {});
    const { container } = render(Collapsible, {
      trigger: 'Toggle',
      disabled: true,
      onToggle,
      children: bodySnippet(),
    });

    const button = trigger(container);
    expect(button.disabled).toBe(true);

    await fireEvent.click(button);

    expect(panel(container)).toBeNull();
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('Collapsible trigger forms', () => {
  test('string trigger renders its label', () => {
    const { container } = render(Collapsible, { trigger: 'Plain label', children: bodySnippet() });

    expect(trigger(container).textContent).toContain('Plain label');
  });

  test('snippet trigger receives state and renders its content', () => {
    const triggerSnippet = createRawSnippet(
      (state: () => { open: boolean; disabled: boolean }) => ({
        render: () => `<span>${state().open ? 'Hide' : 'Show'}</span>`,
      }),
    );

    const { container } = render(Collapsible, {
      trigger: triggerSnippet,
      children: bodySnippet(),
    });

    expect(trigger(container).textContent).toContain('Show');
  });
});

describe('Collapsible keyboard semantics', () => {
  // happy-dom does not synthesize a click from keydown on a native <button>,
  // so we assert the trigger is a real enabled button — native Enter/Space
  // activation is the browser's responsibility. The keydown fires without error.
  test('trigger is a native enabled button with correct aria', async () => {
    const { container } = render(Collapsible, { trigger: 'Toggle', children: bodySnippet() });
    const button = trigger(container);

    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    await fireEvent.keyDown(button, { key: ' ', code: 'Space' });
  });
});

describe('Collapsible root', () => {
  test('reflects expanded and disabled data attributes', async () => {
    const { container } = render(Collapsible, {
      trigger: 'Toggle',
      disabled: true,
      children: bodySnippet(),
    });
    const root = container.querySelector('.cinder-collapsible');

    expect(root?.hasAttribute('data-cinder-expanded')).toBe(false);
    expect(root?.hasAttribute('data-cinder-disabled')).toBe(true);
  });

  test('merges class and forwards rest props onto the root', () => {
    const { container } = render(Collapsible, {
      trigger: 'Toggle',
      class: 'extra-class',
      'data-testid': 'collapsible-root',
      children: bodySnippet(),
    });
    const root = container.querySelector('.cinder-collapsible');

    expect(root?.classList.contains('extra-class')).toBe(true);
    expect(root?.getAttribute('data-testid')).toBe('collapsible-root');
  });
});
