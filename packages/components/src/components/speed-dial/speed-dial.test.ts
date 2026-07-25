/// <reference lib="dom" />
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: SpeedDialFixture } = await import('./speed-dial.fixture.svelte');
const speedDialSource = readFileSync(new URL('./speed-dial.svelte', import.meta.url), 'utf8');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

async function flushQueuedFocus(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SpeedDial', () => {
  test('renders group, trigger, and toolbar semantics', () => {
    const { container } = render(SpeedDialFixture);

    const group = screen.getByRole('group', { name: 'Quick actions' });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });

    expect(group.classList.contains('cinder-speed-dial')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
    expect(trigger.getAttribute('aria-controls')).toBe(toolbar.id);
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
    expect(container.querySelector('.cinder-speed-dial')?.hasAttribute('data-cinder-open')).toBe(
      false,
    );
  });

  test('empty aria-label falls back to the default accessible name', () => {
    render(SpeedDialFixture, { props: { ariaLabel: '   ' } });

    expect(screen.getByRole('group', { name: 'Quick actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quick actions' })).toBeTruthy();
  });

  test('trigger click opens and closes through bind:open', async () => {
    const { container } = render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
    expect(screen.getByTestId('open-state').textContent).toBe('open');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create' }));
    expect(container.querySelector('.cinder-speed-dial')?.contains(toolbar)).toBe(false);
    expect(toolbar.parentElement?.parentElement).toBe(document.body);

    await fireEvent.click(trigger);
    expect(screen.getByTestId('open-state').textContent).toBe('closed');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  test('portaled actions preserve scoped tokens and color scheme', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });
    trigger.style.setProperty('--cinder-surface-raised', 'hotpink');
    trigger.style.colorScheme = 'dark';

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });

    const portalScope = toolbar.parentElement!;
    await waitFor(() => {
      expect(portalScope.style.getPropertyValue('--cinder-surface-raised')).toBe('hotpink');
      expect(portalScope.style.colorScheme).toBe('dark');
    });
    expect(toolbar.style.getPropertyValue('--cinder-surface-raised')).toBe('');

    trigger.setAttribute('style', '--cinder-surface-raised: rebeccapurple; color-scheme: light;');

    await waitFor(() => {
      expect(portalScope.style.getPropertyValue('--cinder-surface-raised')).toBe('rebeccapurple');
      expect(portalScope.style.colorScheme).toBe('light');
    });
  });

  test('changing direction while open preserves the focused action', async () => {
    const view = render(SpeedDialFixture, { props: { direction: 'up' } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const share = screen.getByRole('button', { name: 'Share' });
    const focusSpy = spyOn(HTMLElement.prototype, 'focus');
    share.focus();
    focusSpy.mockClear();

    try {
      await view.rerender({ direction: 'left', open: true });
      await flushQueuedFocus();
      expect(focusSpy).not.toHaveBeenCalled();
    } finally {
      focusSpy.mockRestore();
    }
  });

  test('direction controls data attributes and toolbar orientation', () => {
    const { container } = render(SpeedDialFixture, { props: { direction: 'left' } });
    const root = container.querySelector('.cinder-speed-dial');
    const toolbar = screen.getByRole('toolbar', { name: 'Actions' });
    expect(root?.getAttribute('data-cinder-direction')).toBe('left');
    expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
  });

  test('action activation calls the handler and closes the dial', async () => {
    const onAction = mock(() => {});
    render(SpeedDialFixture, { props: { onAction } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onAction).toHaveBeenCalledWith('create');
    expect(screen.getByTestId('open-state').textContent).toBe('closed');
  });

  test('keyboard navigation skips disabled actions', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    const share = screen.getByRole('button', { name: 'Share' });

    expect(document.activeElement).toBe(create);
    await fireEvent.keyDown(create, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(share);
  });

  test('up direction keyboard navigation follows the visual stack', async () => {
    render(SpeedDialFixture, { props: { archiveDisabled: false } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    const archive = screen.getByRole('button', { name: 'Archive' });

    expect(document.activeElement).toBe(create);
    await fireEvent.keyDown(create, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(archive);

    await fireEvent.keyDown(archive, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(create);
  });

  test('left direction keyboard navigation follows the visual row', async () => {
    render(SpeedDialFixture, { props: { archiveDisabled: false, direction: 'left' } });
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    const archive = screen.getByRole('button', { name: 'Archive' });

    expect(document.activeElement).toBe(create);
    await fireEvent.keyDown(create, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(archive);

    await fireEvent.keyDown(archive, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(create);
  });

  test('keyboard order follows resolved placement and spacing uses CSS layout', () => {
    expect(speedDialSource).toMatch(
      /getKeyboardNavigationButtons[\s\S]*?resolvedDirection === 'up' \|\| resolvedDirection === 'left'/,
    );
    expect(speedDialSource).toContain("if (side === 'top') return 'up';");
    expect(speedDialSource).toContain("if (side === 'bottom') return 'down';");
    expect(speedDialSource).toContain("probe.style.inlineSize = 'var(--cinder-space-3)'");
    expect(speedDialSource).toContain('probe.getBoundingClientRect().width');
  });

  test('Escape closes the dial and restores focus to the trigger', async () => {
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    const create = screen.getByRole('button', { name: 'Create' });
    await fireEvent.keyDown(create, { key: 'Escape' });
    await flushQueuedFocus();

    expect(screen.getByTestId('open-state').textContent).toBe('closed');
    expect(document.activeElement).toBe(trigger);
  });

  test('outside click dismisses an open dial and restores focus when an action is active', async () => {
    const { container } = render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    expect(screen.getByTestId('open-state').textContent).toBe('open');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create' }));

    await fireEvent.click(document.body);
    await flushQueuedFocus();
    expect(screen.getByTestId('open-state').textContent).toBe('closed');
    expect(container.querySelector('.cinder-speed-dial')?.hasAttribute('data-cinder-open')).toBe(
      false,
    );
    expect(document.activeElement).toBe(trigger);
  });

  test('hidden prop makes the root inert and the trigger unfocusable', () => {
    const { container } = render(SpeedDialFixture, { props: { hidden: true } });
    const group = container.querySelector('.cinder-speed-dial') as HTMLElement;
    const trigger = screen.getByRole('button', { name: 'Quick actions', hidden: true });

    expect(group.hasAttribute('hidden')).toBe(true);
    expect(group.getAttribute('aria-hidden')).toBe('true');
    expect(group.hasAttribute('inert')).toBe(true);
    expect(trigger.hasAttribute('disabled')).toBe(true);
    expect(trigger.getAttribute('tabindex')).toBe('-1');
  });

  test('namespace export exposes SpeedDial.Action while flat export remains importable', async () => {
    const [{ default: SpeedDial, SpeedDial: NamedSpeedDial }, { default: SpeedDialAction }] =
      await Promise.all([import('./index.ts'), import('../speed-dial-action/index.ts')]);

    expect(SpeedDial).toBe(NamedSpeedDial);
    expect(SpeedDial.Action).toBe(SpeedDialAction);
  });

  test('index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(typeof module.default.Action).toBe('function');
  });

  test('defines a runtime accessible label fallback for generated previews', async () => {
    const source = await Bun.file(new URL('./speed-dial.svelte', import.meta.url)).text();
    expect(source).toContain("const defaultAriaLabel = 'Quick actions'");
    expect(source).toContain("'aria-label': ariaLabel = defaultAriaLabel");
  });
});
