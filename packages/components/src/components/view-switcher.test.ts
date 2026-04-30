/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

type ViewType = 'editor' | 'diff' | 'summary';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: ViewSwitcher } = await import('./view-switcher.svelte');

afterEach(() => cleanup());

describe('ViewSwitcher', () => {
  test('renders editor, diff, and summary tabs', () => {
    render(ViewSwitcher, {
      props: {
        id: 'review-view',
        value: 'editor',
        showDiff: true,
        showSummary: true,
      },
    });

    expect(screen.getByRole('tab', { name: 'Editor' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Diff' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Summary' })).not.toBeNull();
  });

  test('clicking a tab updates the bindable value and calls onchange', async () => {
    let selected: ViewType = 'editor';
    const changes: ViewType[] = [];

    render(ViewSwitcher, {
      props: {
        id: 'review-view',
        get value() {
          return selected;
        },
        set value(nextValue: ViewType) {
          selected = nextValue;
        },
        onchange: (view: ViewType) => changes.push(view),
      },
    });

    await fireEvent.click(screen.getByRole('tab', { name: 'Diff' }));

    expect(selected as string).toBe('diff');
    expect(changes).toEqual(['diff']);
  });

  test('arrow navigation selects the next tab', async () => {
    let selected: ViewType = 'editor';

    render(ViewSwitcher, {
      props: {
        id: 'review-view',
        get value() {
          return selected;
        },
        set value(nextValue: ViewType) {
          selected = nextValue;
        },
      },
    });

    await fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(selected as string).toBe('diff');
  });
});
