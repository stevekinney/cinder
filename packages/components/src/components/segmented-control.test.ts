/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SegmentedControl } = await import('./segmented-control.svelte');

afterEach(() => cleanup());

const options = [
  { value: 'source', label: 'Source' },
  { value: 'rendered', label: 'Rendered' },
  { value: 'diff', label: 'Diff', disabled: true },
] as const;

describe('SegmentedControl', () => {
  test('renders accessible radio options', () => {
    render(SegmentedControl, {
      props: {
        id: 'document-view',
        value: 'source',
        label: 'Document view',
        options,
      },
    });

    expect(screen.getByRole('radiogroup', { name: 'Document view' })).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Source' }).getAttribute('aria-checked')).toBe('true');
  });

  test('clicking an enabled option updates the bindable value', async () => {
    let selected = 'source';

    render(SegmentedControl, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(nextValue: string) {
          selected = nextValue;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Rendered' }));
    expect(selected).toBe('rendered');

    await fireEvent.click(screen.getByRole('radio', { name: 'Diff' }));
    expect(selected).toBe('rendered');
  });

  test('arrow navigation moves selection while skipping disabled options', async () => {
    let selected = 'source';

    render(SegmentedControl, {
      props: {
        id: 'document-view',
        get value() {
          return selected;
        },
        set value(nextValue: string) {
          selected = nextValue;
        },
        label: 'Document view',
        options,
      },
    });

    await fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(selected).toBe('rendered');

    await fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(selected).toBe('source');
  });
});
