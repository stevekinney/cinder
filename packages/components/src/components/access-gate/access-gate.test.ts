/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import type { AccessGateProps } from './access-gate.types.ts';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: AccessGate } = await import('./access-gate.svelte');
const { default: AccessGateDynamicFixture } =
  await import('../../test/fixtures/access-gate-dynamic-fixture.svelte');
const { default: AccessGateFocusFixture } =
  await import('../../test/fixtures/access-gate-focus-fixture.svelte');
const { default: AccessGateStatefulFixture } =
  await import('../../test/fixtures/access-gate-stateful-fixture.svelte');
const { createRawSnippet, tick } = await import('svelte');
const { checkBuildFlagHydrationSafety } = await import('../../test/hydration-safety.ts');

const accessGateSsrFixturePath = new URL(
  '../../test/fixtures/access-gate-ssr-fixture.svelte',
  import.meta.url,
).pathname;

function markupSnippet(markup: string) {
  return createRawSnippet(() => ({
    render: () => markup,
  }));
}

describe('AccessGate', () => {
  afterEach(() => {
    cleanup();
  });

  test('granted inline gates render children without an extra wrapper', () => {
    const { container } = render(AccessGate, {
      granted: true,
      reason: 'Requires scope: workflows:cancel',
      children: markupSnippet('<button type="button">Cancel</button>'),
    });

    const button = container.querySelector<HTMLButtonElement>('button');
    const passthrough = container.querySelector<HTMLElement>('.cinder-access-gate__passthrough');
    expect(container.querySelector('.cinder-access-gate')).toBeNull();
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(passthrough);
    expect(passthrough?.getAttribute('role')).toBeNull();
    expect(passthrough?.getAttribute('tabindex')).toBeNull();
    expect(passthrough?.firstElementChild).toBe(button);
    expect(button?.disabled).toBe(false);
  });

  test('denied inline gates disable native controls and associate the reason', async () => {
    const { container, getByRole } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: workflows:cancel',
      children: markupSnippet('<button type="button">Cancel workflow</button>'),
    });

    await tick();

    const button = getByRole('button', { name: 'Cancel workflow' }) as HTMLButtonElement;
    const reason = container.querySelector('.cinder-access-gate__inline-reason');

    expect(button.disabled).toBe(true);
    expect(reason).not.toBeNull();
    expect(reason?.textContent).toContain('Requires scope: workflows:cancel');
    expect(button.getAttribute('aria-describedby')?.split(/\s+/)).toContain(reason!.id);
  });

  test('denied inline gates preserve existing descriptions while adding the reason', async () => {
    const { container, getByRole } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: runs:purge',
      children: markupSnippet(
        '<button type="button" aria-describedby="existing-hint">Purge run</button>',
      ),
    });

    await tick();

    const button = getByRole('button', { name: 'Purge run' }) as HTMLButtonElement;
    const reason = container.querySelector('.cinder-access-gate__inline-reason');
    const describedBy = button.getAttribute('aria-describedby')?.split(/\s+/) ?? [];

    expect(reason).not.toBeNull();
    expect(describedBy).toContain('existing-hint');
    expect(describedBy).toContain(reason!.id);
  });

  test('denied inline gates remove custom controls from sequential focus and activation', async () => {
    const { container } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: workflows:suspend',
      children: markupSnippet(
        '<span><a href="/runs/123/suspend">Suspend</a><span role="button" tabindex="0">Suspend custom</span></span>',
      ),
    });

    await tick();

    const link = container.querySelector<HTMLAnchorElement>('a');
    const customControl = container.querySelector<HTMLElement>('[role="button"]');
    let linkActivations = 0;
    let customActivations = 0;
    link?.addEventListener('click', () => {
      linkActivations += 1;
    });
    customControl?.addEventListener('click', () => {
      customActivations += 1;
    });
    customControl?.addEventListener('pointerdown', () => {
      customActivations += 1;
    });
    customControl?.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') {
        customActivations += 1;
      }
    });
    customControl?.addEventListener('keyup', (event) => {
      if (event.key !== 'Tab') {
        customActivations += 1;
      }
    });

    expect(link?.getAttribute('aria-disabled')).toBe('true');
    expect(link?.getAttribute('tabindex')).toBe('-1');
    expect(link?.hasAttribute('href')).toBe(false);
    expect(customControl?.getAttribute('aria-disabled')).toBe('true');
    expect(customControl?.getAttribute('tabindex')).toBe('-1');

    const linkClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    link?.dispatchEvent(linkClick);
    const customClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    customControl?.dispatchEvent(customClick);
    const pointerDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    customControl?.dispatchEvent(pointerDown);
    const enterKey = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    });
    customControl?.dispatchEvent(enterKey);
    const enterKeyUp = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    });
    customControl?.dispatchEvent(enterKeyUp);
    const spaceKey = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: ' ',
    });
    customControl?.dispatchEvent(spaceKey);
    const arrowKey = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowRight',
    });
    customControl?.dispatchEvent(arrowKey);
    const tabKey = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
    });
    customControl?.dispatchEvent(tabKey);
    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: 'x',
    });
    customControl?.dispatchEvent(beforeInput);

    expect(linkActivations).toBe(0);
    expect(customActivations).toBe(0);
    expect(linkClick.defaultPrevented).toBe(true);
    expect(customClick.defaultPrevented).toBe(true);
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(enterKey.defaultPrevented).toBe(true);
    expect(enterKeyUp.defaultPrevented).toBe(true);
    expect(spaceKey.defaultPrevented).toBe(true);
    expect(arrowKey.defaultPrevented).toBe(true);
    expect(tabKey.defaultPrevented).toBe(false);
    expect(beforeInput.defaultPrevented).toBe(true);
  });

  test('denied inline gates disable controls inserted after mount', async () => {
    const { container, getByRole } = render(AccessGateDynamicFixture, {});

    await fireEvent.click(getByRole('button', { name: 'Reveal denied action' }));
    const button = getByRole('button', { name: 'Dynamic cancel' }) as HTMLButtonElement;
    const customControl = getByRole('button', { name: 'Dynamic custom cancel' });
    const reason = container.querySelector('.cinder-access-gate__inline-reason');
    let activations = 0;
    customControl.addEventListener('click', () => {
      activations += 1;
    });

    await waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(customControl.getAttribute('aria-disabled')).toBe('true');
    });
    expect(button.getAttribute('aria-describedby')?.split(/\s+/)).toContain(reason!.id);
    expect(customControl.getAttribute('aria-describedby')?.split(/\s+/)).toContain(reason!.id);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    customControl.dispatchEvent(click);
    const enterKey = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    });
    customControl.dispatchEvent(enterKey);

    expect(activations).toBe(0);
    expect(click.defaultPrevented).toBe(true);
    expect(enterKey.defaultPrevented).toBe(true);

    await fireEvent.click(getByRole('button', { name: 'Hide denied action' }));

    await waitFor(() => {
      expect(button.isConnected).toBe(false);
      expect(customControl.isConnected).toBe(false);
    });
    expect(button.disabled).toBe(true);
    expect(customControl.getAttribute('aria-disabled')).toBe('true');
    expect(customControl.getAttribute('tabindex')).toBe('-1');
  });

  test('denied inline gates blur a focused control when access is revoked', async () => {
    const { getByRole } = render(AccessGateFocusFixture, {});
    const customControl = getByRole('button', { name: 'Focusable cancel' });

    customControl.focus();
    expect(document.activeElement).toBe(customControl);

    await fireEvent.click(getByRole('button', { name: 'Deny scope' }));

    await waitFor(() => {
      expect(customControl.isConnected).toBe(false);
    });
    const deniedControl = getByRole('button', { name: 'Focusable cancel' });
    expect(deniedControl).not.toBe(customControl);
    expect(deniedControl.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).not.toBe(customControl);
  });

  test('denied inline gates disable common interactive descendants', async () => {
    const { container } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: workflows:update',
      children: markupSnippet(
        '<span><details open><summary>Advanced action</summary><span>Details</span></details><span contenteditable="true">Editable action</span><span role="slider" tabindex="0">Priority</span></span>',
      ),
    });

    await tick();

    const summary = container.querySelector<HTMLElement>('summary');
    const editable = container.querySelector<HTMLElement>('[contenteditable]');
    const slider = container.querySelector<HTMLElement>('[role="slider"]');

    expect(summary?.getAttribute('aria-disabled')).toBe('true');
    expect(summary?.getAttribute('tabindex')).toBe('-1');
    expect(editable?.getAttribute('aria-disabled')).toBe('true');
    expect(editable?.getAttribute('tabindex')).toBe('-1');
    expect(slider?.getAttribute('aria-disabled')).toBe('true');
    expect(slider?.getAttribute('tabindex')).toBe('-1');

    const summaryClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    summary?.dispatchEvent(summaryClick);
    const editableKey = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    });
    editable?.dispatchEvent(editableKey);
    const sliderKey = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowRight',
    });
    slider?.dispatchEvent(sliderKey);

    expect(summaryClick.defaultPrevented).toBe(true);
    expect(editableKey.defaultPrevented).toBe(true);
    expect(sliderKey.defaultPrevented).toBe(true);
  });

  test('denied inline gates preserve child-owned state updates after grant', async () => {
    const { container, getByRole } = render(AccessGateStatefulFixture, {});

    await tick();

    let button = getByRole('button', { name: 'Stateful cancel' }) as HTMLButtonElement;
    let link = container.querySelector<HTMLAnchorElement>('a');
    let customControl = getByRole('button', { name: 'Stateful custom cancel' });
    const reason = container.querySelector('.cinder-access-gate__inline-reason');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')?.split(/\s+/)).toContain('initial-hint');
    expect(button.getAttribute('aria-describedby')?.split(/\s+/)).toContain(reason!.id);
    expect(link).not.toBeNull();
    expect(link!.hasAttribute('href')).toBe(false);
    expect(link!.getAttribute('tabindex')).toBe('-1');
    expect(link!.getAttribute('aria-disabled')).toBe('true');
    expect(customControl.getAttribute('tabindex')).toBe('-1');
    expect(customControl.getAttribute('aria-disabled')).toBe('true');
    expect(customControl.getAttribute('aria-describedby')?.split(/\s+/)).toContain(
      'custom-initial-hint',
    );
    expect(customControl.getAttribute('aria-describedby')?.split(/\s+/)).toContain(reason!.id);

    await fireEvent.click(getByRole('button', { name: 'Update child state' }));

    await waitFor(() => {
      const describedBy = button.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
      expect(describedBy).toContain('updated-hint');
      expect(describedBy).toContain(reason!.id);
      expect(link?.getAttribute('aria-describedby')?.split(/\s+/)).toContain('link-updated-hint');
      expect(customControl.getAttribute('aria-describedby')?.split(/\s+/)).toContain(
        'custom-updated-hint',
      );
    });
    expect(button.disabled).toBe(true);
    expect(link?.hasAttribute('href')).toBe(false);
    expect(customControl.getAttribute('tabindex')).toBe('-1');
    expect(customControl.getAttribute('aria-disabled')).toBe('true');

    await fireEvent.click(getByRole('button', { name: 'Grant scope' }));

    await waitFor(() => {
      expect(container.querySelector('.cinder-access-gate')).toBeNull();
    });
    button = getByRole('button', { name: 'Stateful cancel' }) as HTMLButtonElement;
    link = getByRole('link', { name: 'Stateful link cancel' }) as HTMLAnchorElement;
    customControl = getByRole('button', { name: 'Stateful custom cancel' });
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-describedby')).toBe('updated-hint');
    expect(link.getAttribute('href')).toBe('/runs/123/review');
    expect(link.getAttribute('aria-describedby')).toBe('link-updated-hint');
    expect(link.hasAttribute('tabindex')).toBe(false);
    expect(link.hasAttribute('aria-disabled')).toBe(false);
    expect(customControl.getAttribute('tabindex')).toBe('2');
    expect(customControl.getAttribute('aria-disabled')).toBe('false');
    expect(customControl.getAttribute('aria-describedby')).toBe('custom-updated-hint');
  });

  test('denied inline gates server-render visible controls with a hydration activation guard', async () => {
    const { buildFlagInvariant, serverHtml: body } =
      await checkBuildFlagHydrationSafety(accessGateSsrFixturePath);

    expect(buildFlagInvariant).toBe(true);
    expect(body).toContain('inert');
    expect(body).toContain('Cancel workflow');
    expect(body).toContain('Requires scope: workflows:cancel');
  });

  test('denied-state wrappers keep owned accessibility attributes ahead of rest props', () => {
    const runtimeProps = {
      granted: false,
      reason: 'Requires scope: workflows:cancel',
      role: 'presentation',
      'aria-describedby': 'consumer-description',
      'aria-labelledby': 'consumer-label',
      children: markupSnippet('<button type="button">Cancel</button>'),
    } as unknown as AccessGateProps;
    const { container } = render(AccessGate, runtimeProps);

    const gate = container.querySelector('.cinder-access-gate');
    const title = container.querySelector('.cinder-sr-only');
    const reason = container.querySelector('.cinder-access-gate__inline-reason');
    expect(gate?.getAttribute('role')).toBe('group');
    expect(gate?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(gate?.getAttribute('aria-describedby')).toBe(reason?.id);
  });

  test('denied section placeholders keep owned accessibility attributes ahead of rest props', () => {
    const runtimeProps = {
      granted: false,
      variant: 'section',
      reason: 'Requires scope: storage:admin',
      requirement: 'storage:admin',
      role: 'presentation',
      'aria-describedby': 'consumer-description',
      'aria-labelledby': 'consumer-label',
    } as unknown as AccessGateProps;
    const { container } = render(AccessGate, runtimeProps);

    const section = container.querySelector('.cinder-access-gate');
    const title = container.querySelector('.cinder-access-gate__section-title');
    const reason = container.querySelector('.cinder-access-gate__section-reason');
    const requirement = container.querySelector('.cinder-access-gate__requirement');
    const describedBy = section?.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
    expect(section?.tagName).toBe('SECTION');
    expect(section?.getAttribute('role')).toBeNull();
    expect(section?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(describedBy).toContain(reason!.id);
    expect(describedBy).toContain(requirement!.id);
  });

  test('denied section gates replace children with a locked placeholder', () => {
    const { container, queryByText, getByText } = render(AccessGate, {
      granted: false,
      variant: 'section',
      reason: 'Requires scope: storage:admin',
      requirement: 'storage:admin',
      children: markupSnippet('<button type="button">Delete bucket</button>'),
    });

    const section = container.querySelector('.cinder-access-gate');
    const requirement = container.querySelector('.cinder-access-gate__requirement');

    expect(queryByText('Delete bucket')).toBeNull();
    expect(getByText('Section locked')).not.toBeNull();
    expect(getByText('Requires scope: storage:admin')).not.toBeNull();
    expect(getByText('storage:admin')).not.toBeNull();
    expect(requirement).not.toBeNull();
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-cinder-variant')).toBe('section');
    expect(section?.tagName).toBe('SECTION');
    expect(section!.getAttribute('aria-describedby')?.split(/\s+/)).toContain(requirement!.id);
  });

  test('denied-state wrappers merge custom classes', () => {
    const { container } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: workflows:cancel',
      class: 'custom-access-state',
      children: markupSnippet('<button type="button">Cancel</button>'),
    });

    const gate = container.querySelector('.cinder-access-gate');
    expect(gate?.classList.contains('custom-access-state')).toBe(true);
  });
});
