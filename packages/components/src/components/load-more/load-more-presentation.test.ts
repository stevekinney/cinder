import { describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { setupLoadMoreTests } from './load-more-test-support.ts';

setupHappyDom();
setupLoadMoreTests(cleanup);

const { default: LoadMore } = await import('./load-more.svelte');

describe('LoadMore', () => {
  test('calls onError when onLoadMore rejects', async () => {
    let seen: unknown;
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: async () => {
          throw new Error('failed');
        },
        onError: (error: unknown) => {
          seen = error;
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(seen).toBeInstanceOf(Error);
    });
  });

  test('announces the end-of-list message when hasMore is false on initial mount', async () => {
    // statusText is `$derived(hasMore ? '' : endOfListMessage)`, so an initially-exhausted
    // list announces its state — more correct than staying silent for an empty list. The
    // shared VisuallyHiddenLiveRegion blanks-then-sets on the next task (setTimeout(0), so a
    // repeated message still re-announces), so waitFor until the text lands.
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: () => {},
        hasMore: false,
        endOfListMessage: 'All caught up',
      },
    });
    await waitFor(() => {
      expect(getByRole('status').textContent?.trim()).toBe('All caught up');
    });
  });

  test('announces the end-of-list message only after hasMore transitions to false', async () => {
    const rendered = render(LoadMore, {
      props: {
        onLoadMore: () => {},
        hasMore: true,
        endOfListMessage: 'Nothing else to load',
      },
    });

    expect(rendered.getByRole('status').textContent?.trim()).toBe('');

    await rendered.rerender({
      onLoadMore: () => {},
      hasMore: false,
      endOfListMessage: 'Nothing else to load',
    });

    await waitFor(() => {
      expect(rendered.getByRole('status').textContent?.trim()).toBe('Nothing else to load');
    });
  });

  test('disables the button while loading unless the component is in retry mode', () => {
    const { getByRole } = render(LoadMore, {
      props: {
        onLoadMore: () => {},
        loading: true,
      },
    });

    const button = requiredInstance(getByRole('button', { name: 'Load more' }), HTMLButtonElement);
    expect(button.disabled).toBe(true);
  });

  test('shows a busy state while awaiting onLoadMore before the parent flips loading', async () => {
    let resolveRequest: (() => void) | undefined;

    const { container, getByRole } = render(LoadMore, {
      props: {
        onLoadMore: () =>
          new Promise<void>((resolve) => {
            resolveRequest = resolve;
          }),
      },
    });

    const button = requiredInstance(getByRole('button', { name: 'Load more' }), HTMLButtonElement);

    await fireEvent.click(button);

    await waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true');
      expect(container.querySelector('.cinder-load-more__spinner')).toBeDefined();
    });

    resolveRequest?.();

    await waitFor(() => {
      expect(button.disabled).toBe(false);
      expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('false');
    });
  });
});
