/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');

afterEach(() => cleanup());

describe('SelectionPopover', () => {
  test('renders the collapsed selection action when open', () => {
    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
      },
    });

    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });

  test('expands, submits trimmed comment text, and resets', async () => {
    const submitted: string[] = [];

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        oncommentsubmit: (body: string) => submitted.push(body),
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await fireEvent.input(screen.getByPlaceholderText('Add a comment...'), {
      target: { value: '  Please clarify this.  ' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }));

    expect(submitted).toEqual(['Please clarify this.']);
    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });

  test('Escape closes when collapsed and cancels when expanded', async () => {
    let closed = false;
    let canceled = false;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        onclose: () => {
          closed = true;
        },
        oncancel: () => {
          canceled = true;
        },
      },
    });

    const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' });
    await fireEvent.keyDown(toolbar, { key: 'Escape' });
    expect(closed).toBe(true);

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await fireEvent.keyDown(toolbar, { key: 'Escape' });
    expect(canceled).toBe(true);
  });
});
