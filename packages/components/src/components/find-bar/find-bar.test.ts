/// <reference lib="dom" />
import { afterEach, describe, expect, jest, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: FindBar } = await import('./find-bar.svelte');
describe('FindBar', () => {
  afterEach(() => {
    jest.useRealTimers();
    cleanup();
  });
  test('renders accessible controls', () => {
    const { container } = render(FindBar, { id: 'find' });
    expect(container.querySelector('input')).not.toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Previous match"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next match"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Close find bar"]')).not.toBeNull();
  });

  test('clears stale results immediately and dispatches eligible queries after the debounce', async () => {
    let resolveQueryChange: (value: string) => void;
    const queryChanged = new Promise<string>((resolve) => {
      resolveQueryChange = resolve;
    });
    const onQueryChange = mock((query: string) => resolveQueryChange(query));
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
    expect(await queryChanged).toBe('new query');
    expect(onQueryChange).toHaveBeenCalledWith('new query');
  });

  test('uses an undebounced keydown path for match navigation', async () => {
    const onNext = mock(() => {});
    const onPrevious = mock(() => {});
    const { container } = render(FindBar, {
      value: 'query',
      matchCount: 2,
      onNext,
      onPrevious,
    });
    const input = container.querySelector('input') as HTMLInputElement;

    await fireEvent.keyDown(input, { key: 'Enter' });
    await fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  test('does not navigate when the query is ineligible', async () => {
    const onNext = mock(() => {});
    const { container } = render(FindBar, { onNext, minQueryLength: 3, matchCount: 2 });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'ab' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNext).not.toHaveBeenCalled();
  });

  test('notifies the host when a previously eligible query becomes ineligible', async () => {
    jest.useFakeTimers();
    const onQueryChange = mock(() => {});
    const { container } = render(FindBar, { onQueryChange, minQueryLength: 3, debounceMs: 1 });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'abcd' } });
    jest.advanceTimersByTime(1);
    await fireEvent.input(input, { target: { value: 'ab' } });
    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  test('CSS sidecar imports composed primitive styles', () => {
    const css = readFileSync(new URL('./find-bar.css', import.meta.url), 'utf8');

    expect(css).toContain("@import '../button/button.css';");
    expect(css).toContain("@import '../input/input.css';");
  });
});
