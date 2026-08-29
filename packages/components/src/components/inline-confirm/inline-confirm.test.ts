/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: InlineConfirm } = await import('./inline-confirm.svelte');

afterEach(cleanup);

describe('InlineConfirm', () => {
  test('standalone sidecar imports Button styles', () => {
    const css = readFileSync(new URL('./inline-confirm.css', import.meta.url), 'utf8');
    expect(
      css.startsWith(
        '@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;',
      ),
    ).toBe(true);
    expect(css).toContain("@import '../button/button.css';");
  });

  test('renders an in-flow named group without modal semantics and confirms', async () => {
    let confirmations = 0;
    const { getByRole, queryByRole } = render(InlineConfirm, {
      prompt: 'Delete this comment?',
      confirmLabel: 'Delete comment',
      open: true,
      destructive: true,
      onConfirm: () => confirmations++,
    });

    expect(getByRole('group', { name: 'Delete this comment?' })).not.toBeNull();
    expect(queryByRole('dialog')).toBeNull();
    await fireEvent.click(getByRole('button', { name: 'Delete comment' }));
    expect(confirmations).toBe(1);
    expect(queryByRole('group')).toBeNull();
  });

  test('focuses the safe cancel action and dismisses from Escape', async () => {
    let cancellations = 0;
    const { getByRole, queryByRole } = render(InlineConfirm, {
      prompt: 'Delete this comment?',
      confirmLabel: 'Delete comment',
      open: true,
      onCancel: () => cancellations++,
    });

    const cancel = getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(cancellations).toBe(1);
    expect(queryByRole('group')).toBeNull();
  });

  test('uses neutral styling by default and explicit danger styling when destructive', async () => {
    const { container, rerender } = render(InlineConfirm, {
      prompt: 'Archive this item?',
      confirmLabel: 'Archive',
      open: true,
    });
    const root = container.querySelector('.cinder-inline-confirm');
    expect(root?.hasAttribute('data-cinder-destructive')).toBe(false);
    const css = readFileSync(new URL('./inline-confirm.css', import.meta.url), 'utf8');
    expect(css).toContain('background: var(--cinder-status-neutral-background)');
    await rerender({ destructive: true });
    expect(root?.hasAttribute('data-cinder-destructive')).toBe(true);
    expect(css).toContain('.cinder-inline-confirm[data-cinder-destructive]');
  });
});
