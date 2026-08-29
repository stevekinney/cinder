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
    const { container } = render(FindBar, {
      id: 'find',
      onPrevious: () => {},
      onNext: () => {},
      onDismiss: () => {},
    });
    expect(container.querySelector('input')).not.toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Previous match"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next match"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Close find bar"]')).not.toBeNull();
  });

  test('omits actions without callbacks', () => {
    const { container } = render(FindBar, { id: 'find' });

    expect(container.querySelector('[aria-label="Previous match"]')).toBeNull();
    expect(container.querySelector('[aria-label="Next match"]')).toBeNull();
    expect(container.querySelector('[aria-label="Close find bar"]')).toBeNull();
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

  test('debounces the user query rather than a later controlled replacement', async () => {
    jest.useFakeTimers();
    const onQueryChange = mock(() => {});
    const { container, rerender } = render(FindBar, {
      value: '',
      debounceMs: 10,
      onQueryChange,
    });
    const input = container.querySelector('input') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'user query' } });
    await rerender({ value: 'programmatic replacement', debounceMs: 10, onQueryChange });
    jest.advanceTimersByTime(10);

    expect(onQueryChange).toHaveBeenCalledWith('user query');
    expect(onQueryChange).not.toHaveBeenCalledWith('programmatic replacement');
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

  test('notifies the host when a controlled eligible value is shortened below the minimum', async () => {
    const onQueryChange = mock(() => {});
    const { rerender } = render(FindBar, {
      value: 'abcd',
      minQueryLength: 3,
      onQueryChange,
    });

    await rerender({ value: 'ab', minQueryLength: 3, onQueryChange });
    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  test('reconciles eligibility when the minimum query length changes', async () => {
    const onQueryChange = mock(() => {});
    const { rerender } = render(FindBar, {
      value: 'abcd',
      minQueryLength: 3,
      onQueryChange,
    });

    await rerender({ value: 'abcd', minQueryLength: 5, onQueryChange });

    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  test('CSS sidecar imports composed primitive styles', () => {
    const css = readFileSync(new URL('./find-bar.css', import.meta.url), 'utf8');

    expect(css).toContain("@import '../button/button.css';");
    expect(css).toContain("@import '../input/input.css';");
  });
});
