/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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

  test.each([
    { label: 'Cmd+Enter', modifier: { metaKey: true } },
    { label: 'Ctrl+Enter', modifier: { ctrlKey: true } },
  ])('$label submits the comment and collapses the composer', async ({ modifier }) => {
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
    const textarea = screen.getByPlaceholderText('Add a comment...');
    await fireEvent.input(textarea, { target: { value: '  Looks good.  ' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', ...modifier });

    expect(submitted).toEqual(['Looks good.']);
    // The composer must be unmounted, not merely "trigger present alongside form".
    expect(screen.queryByPlaceholderText('Add a comment...')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });

  test('restores focus to the prior trigger after keyboard-activated submit', async () => {
    const submitted: string[] = [];
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    try {
      render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80 },
          oncommentsubmit: (body: string) => submitted.push(body),
        },
      });

      // Keyboard-activate the toolbar so handleExpand captures the external
      // trigger as the focus-restore target. (A pointer click in a real
      // browser would move focus to the icon button first, which is a
      // separate code path.)
      const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' });
      expect(document.activeElement).toBe(outside);
      await fireEvent.keyDown(toolbar, { key: 'Enter' });

      const textarea = screen.getByPlaceholderText('Add a comment...');
      await fireEvent.input(textarea, { target: { value: 'Looks good.' } });
      await fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

      expect(submitted).toEqual(['Looks good.']);
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });

  test('Escape from the focused textarea cancels the composer', async () => {
    let canceled = false;

    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
        oncancel: () => {
          canceled = true;
        },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const textarea = screen.getByPlaceholderText('Add a comment...');
    textarea.focus();
    await fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(canceled).toBe(true);
    expect(screen.queryByPlaceholderText('Add a comment...')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add comment' })).not.toBeNull();
  });
});
