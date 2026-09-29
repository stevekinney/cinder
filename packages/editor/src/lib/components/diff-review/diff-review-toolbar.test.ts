/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: DiffReviewToolbar } = await import('./diff-review-toolbar.svelte');

function stubClipboard(succeeds: boolean): void {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () => (succeeds ? Promise.resolve() : Promise.reject(new Error('denied'))),
    },
  });
}

describe('DiffReview component toolbar: gating', () => {
  test('a blocked gate replaces Copy/Download with the pending-draft message and a drafts link', async () => {
    let openedDrafts = false;
    const { getByText, queryByText } = render(DiffReviewToolbar, {
      filterQuery: '',
      onfilterchange: () => {},
      gate: { blocked: true, pendingCount: 2 },
      ongetcontent: () => ({ ok: true, value: 'content' }),
      onopendrafts: () => {
        openedDrafts = true;
      },
    });
    expect(getByText(/2 unsaved drafts must be saved or discarded before export\./)).not.toBeNull();
    expect(queryByText('Copy review')).toBeNull();
    await fireEvent.click(getByText('Review drafts'));
    expect(openedDrafts).toBe(true);
  });
});

describe('DiffReview component toolbar: copy', () => {
  test('a successful copy announces success and shows no error', async () => {
    stubClipboard(true);
    const { getByText, container } = render(DiffReviewToolbar, {
      filterQuery: '',
      onfilterchange: () => {},
      gate: { blocked: false, pendingCount: 0 },
      ongetcontent: () => ({ ok: true, value: '# Review feedback\n' }),
      onopendrafts: () => {},
    });
    await fireEvent.click(getByText('Copy review'));
    await Promise.resolve();
    await Promise.resolve();
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Copied review to clipboard.',
    );
    expect(container.querySelector('.diff-review-toolbar-error')).toBeNull();
  });

  test('a clipboard failure shows a visible, non-live-region error and no success announcement', async () => {
    stubClipboard(false);
    const { getByText, container } = render(DiffReviewToolbar, {
      filterQuery: '',
      onfilterchange: () => {},
      gate: { blocked: false, pendingCount: 0 },
      ongetcontent: () => ({ ok: true, value: '# Review feedback\n' }),
      onopendrafts: () => {},
    });
    await fireEvent.click(getByText('Copy review'));
    await Promise.resolve();
    await Promise.resolve();
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    expect(container.querySelector('.diff-review-toolbar-error')?.textContent).toContain(
      'Unable to copy the review to the clipboard',
    );
  });

  test('an export-content error (e.g. drafts-pending) surfaces the same visible error path', async () => {
    stubClipboard(true);
    const { getByText, container } = render(DiffReviewToolbar, {
      filterQuery: '',
      onfilterchange: () => {},
      gate: { blocked: false, pendingCount: 0 },
      ongetcontent: () => ({
        ok: false,
        error: { code: 'drafts-pending', path: '/drafts', message: 'blocked' },
      }),
      onopendrafts: () => {},
    });
    await fireEvent.click(getByText('Copy review'));
    expect(container.querySelector('.diff-review-toolbar-error')?.textContent).toBe('blocked');
  });
});

describe('DiffReview component toolbar: filter', () => {
  test('typing in the filter input calls onfilterchange with the new value', async () => {
    let seen = '';
    const { getByLabelText } = render(DiffReviewToolbar, {
      filterQuery: '',
      onfilterchange: (query: string) => {
        seen = query;
      },
      gate: { blocked: false, pendingCount: 0 },
      ongetcontent: () => ({ ok: true, value: '' }),
      onopendrafts: () => {},
    });
    await fireEvent.input(getByLabelText('Filter files by path'), { target: { value: 'foo' } });
    expect(seen).toBe('foo');
  });
});
