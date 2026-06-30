/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { CollapsibleTriggerState } from './collapsible.types.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

beforeEach(() => {
  document.body.replaceChildren();
});

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});
const { default: Collapsible } = await import('./collapsible.svelte');
const { default: BindableHarness } = await import('./collapsible-bindable-harness.svelte');
const { default: SnippetTriggerHarness } =
  await import('./collapsible-snippet-trigger-harness.svelte');
const { default: OpenPropHarness } = await import('./collapsible-open-prop-harness.svelte');
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

function triggerLabel(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.cinder-collapsible__label > span[id]');
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
    expect(region?.getAttribute('aria-labelledby')).toBe(
      triggerLabel(container)?.getAttribute('id') ?? null,
    );
  });

  test('omits aria-controls while closed so the reference never dangles', async () => {
    // The panel is removed from the DOM when closed (the {#if} has no Transition
    // layer keeping it mounted). aria-controls={open ? panelId : undefined} must
    // therefore drop the attribute entirely when closed — pointing aria-controls
    // at a non-existent id is an invalid ARIA reference. This component is the
    // sole owner of that behavior since the Transition removal (bbb08520, #253).
    const { container } = render(Collapsible, { trigger: 'Toggle', children: bodySnippet() });

    // Closed by default: no panel in the DOM, no aria-controls on the trigger.
    expect(panel(container)).toBeNull();
    expect(trigger(container).hasAttribute('aria-controls')).toBe(false);

    // Open → aria-controls appears and resolves to the live panel id.
    await fireEvent.click(trigger(container));
    const openPanelId = panel(container)?.getAttribute('id') ?? null;
    expect(openPanelId).not.toBeNull();
    expect(trigger(container).getAttribute('aria-controls')).toBe(openPanelId);

    // Close again → the panel unmounts and aria-controls is dropped, not left
    // pointing at the now-absent panel.
    await fireEvent.click(trigger(container));
    expect(panel(container)).toBeNull();
    expect(trigger(container).hasAttribute('aria-controls')).toBe(false);
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

  test('rapid open→close→open settles to the final state', async () => {
    // Interrupting the slide transition cancels the in-flight animation. The
    // panel's presence must reflect the last toggle, not a stale animation that
    // resolved after being cancelled.
    const { container } = render(Collapsible, { trigger: 'Toggle', children: bodySnippet() });

    await fireEvent.click(trigger(container)); // open
    await fireEvent.click(trigger(container)); // close
    await fireEvent.click(trigger(container)); // open

    expect(panel(container)).not.toBeNull();
    expect(trigger(container).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Collapsible (controlled)', () => {
  test('ontoggle fires with the next state on each click', async () => {
    const ontoggle = mock(() => {});
    const { container } = render(Collapsible, {
      trigger: 'Toggle',
      open: false,
      ontoggle,
      children: bodySnippet(),
    });

    await fireEvent.click(trigger(container));
    expect(ontoggle).toHaveBeenLastCalledWith(true);
    expect(panel(container)).not.toBeNull();

    await fireEvent.click(trigger(container));
    expect(ontoggle).toHaveBeenLastCalledWith(false);
    expect(panel(container)).toBeNull();
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

  test('open prop updates from parent keep panel state in sync', async () => {
    const { container, getByTestId } = render(OpenPropHarness);

    expect(panel(container)).toBeNull();

    await fireEvent.click(getByTestId('parent-open'));
    expect(panel(container)).not.toBeNull();

    await fireEvent.click(getByTestId('parent-close'));
    expect(panel(container)).toBeNull();

    await fireEvent.click(trigger(container));
    expect(panel(container)).not.toBeNull();
  });
});

describe('Collapsible disabled', () => {
  test('disabled trigger is a real disabled button that does not toggle', async () => {
    const ontoggle = mock(() => {});
    const { container } = render(Collapsible, {
      trigger: 'Toggle',
      disabled: true,
      ontoggle,
      children: bodySnippet(),
    });

    const button = trigger(container);
    expect(button.disabled).toBe(true);

    await fireEvent.click(button);

    expect(panel(container)).toBeNull();
    expect(ontoggle).not.toHaveBeenCalled();
  });
});

describe('Collapsible trigger forms', () => {
  test('string trigger renders its label', () => {
    const { container } = render(Collapsible, { trigger: 'Plain label', children: bodySnippet() });

    expect(trigger(container).textContent).toContain('Plain label');
  });

  test('snippet trigger renders its content', () => {
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

  test('snippet trigger re-renders reactively on toggle', async () => {
    // A real `{#snippet}` (not createRawSnippet, which renders once) is needed
    // to prove the label reacts to the `{ open }` state it receives.
    const { container } = render(SnippetTriggerHarness);

    expect(trigger(container).textContent).toContain('Show');

    await fireEvent.click(trigger(container));
    expect(trigger(container).textContent).toContain('Hide');
  });

  test('forwards a static triggerAriaLabel to the trigger button', () => {
    const { container } = render(Collapsible, {
      trigger: 'Visible label',
      triggerAriaLabel: 'Screen reader label',
      children: bodySnippet(),
    });

    expect(trigger(container).getAttribute('aria-label')).toBe('Screen reader label');
  });

  test('triggerAriaLabel function re-renders reactively on toggle', async () => {
    const { container } = render(Collapsible, {
      trigger: 'Visible label',
      triggerAriaLabel: ({ open }: CollapsibleTriggerState) =>
        open ? 'Collapse details' : 'Expand details',
      children: bodySnippet(),
    });

    expect(trigger(container).getAttribute('aria-label')).toBe('Expand details');

    await fireEvent.click(trigger(container));
    expect(trigger(container).getAttribute('aria-label')).toBe('Collapse details');
  });

  test('omits trigger aria-label when triggerAriaLabel resolves to whitespace', async () => {
    const { container } = render(Collapsible, {
      trigger: 'Visible label',
      triggerAriaLabel: ({ open }: CollapsibleTriggerState) => (open ? ' ' : '   '),
      children: bodySnippet(),
    });

    expect(trigger(container).hasAttribute('aria-label')).toBe(false);

    await fireEvent.click(trigger(container));
    expect(trigger(container).hasAttribute('aria-label')).toBe(false);
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

    // No manual onkeydown handler exists: keydown alone must not toggle (a real
    // browser activates via the synthesized click, which happy-dom omits). This
    // guards against a future regression that adds a keydown-only toggle.
    expect(panel(container)).toBeNull();
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
