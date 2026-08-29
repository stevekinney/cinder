/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: InlineConfirm } = await import('./inline-confirm.svelte');

afterEach(cleanup);

describe('InlineConfirm', () => {
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
});
