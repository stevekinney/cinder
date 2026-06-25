/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SpeedDialFixture } = await import('./speed-dial.fixture.svelte');

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
    render(SpeedDialFixture);
    const trigger = screen.getByRole('button', { name: 'Quick actions' });

    await fireEvent.click(trigger);
    await flushQueuedFocus();
    expect(screen.getByTestId('open-state').textContent).toBe('open');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create' }));

    await fireEvent.click(trigger);
    expect(screen.getByTestId('open-state').textContent).toBe('closed');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
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
