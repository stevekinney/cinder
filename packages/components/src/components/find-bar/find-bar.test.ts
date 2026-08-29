/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: FindBar } = await import('./find-bar.svelte');
describe('FindBar', () => {
  afterEach(cleanup);
  test('renders accessible controls', () => {
    const { container } = render(FindBar, { id: 'find' });
    expect(container.querySelector('input')).not.toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Previous match"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next match"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Close find bar"]')).not.toBeNull();
  });

  test('clears stale results immediately and dispatches eligible queries after the debounce', async () => {
    const onQueryChange = mock(() => {});
    const { container } = render(FindBar, {
      id: 'find',
      value: 'old query',
      matchCount: 4,
      activeIndex: 2,
      debounceMs: 1,
      onQueryChange,
    });
    const input = container.querySelector('input') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'new query' } });
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(onQueryChange).toHaveBeenCalledWith('new query');
  });

  test('uses an undebounced keydown path for match navigation', async () => {
    const onNext = mock(() => {});
    const onPrevious = mock(() => {});
    const { container } = render(FindBar, { onNext, onPrevious });
    const input = container.querySelector('input') as HTMLInputElement;

    await fireEvent.keyDown(input, { key: 'Enter' });
    await fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });
});
