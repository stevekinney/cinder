/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: SegmentedControl } = await import('./segmented-control.svelte');
const { Check } = await import('./icons/index.ts');

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
    const changes: string[] = [];

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
        onchange: (value: string) => {
          changes.push(value);
        },
      },
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Rendered' }));
    expect(selected).toBe('rendered');
    expect(changes).toEqual(['rendered']);

    await fireEvent.click(screen.getByRole('radio', { name: 'Diff' }));
    expect(selected).toBe('rendered');
    expect(changes).toEqual(['rendered']);
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

  test('renders option icons without changing accessible names', () => {
    render(SegmentedControl, {
      props: {
        id: 'icon-view',
        value: 'source',
        label: 'Document view',
        options: [{ value: 'source', label: 'Source', icon: Check }],
      },
    });

    const option = screen.getByRole('radio', { name: 'Source' });
    expect(option.querySelector('.cinder-segmented-control-option-icon')).not.toBeNull();
  });

  test('can render tab semantics for panel switching', () => {
    render(SegmentedControl, {
      props: {
        id: 'review-view',
        value: 'source',
        label: 'Review view',
        variant: 'tablist',
        options: [{ value: 'source', label: 'Source', controls: 'source-panel' }],
      },
    });

    expect(screen.getByRole('tablist', { name: 'Review view' })).not.toBeNull();
    const tab = screen.getByRole('tab', { name: 'Source' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(tab.getAttribute('aria-controls')).toBe('source-panel');
  });
});
