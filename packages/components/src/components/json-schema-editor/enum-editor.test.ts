/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: EnumEditor } = await import('./enum-editor.svelte');

afterEach(() => cleanup());

describe('EnumEditor', () => {
  test('renders every enum value in an editable semantic table', () => {
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft', 'published'],
      onValuesChange: () => {},
    });

    expect(screen.getByRole('table', { name: 'Enum values' })).not.toBeNull();
    const firstValue = screen.getByRole('textbox', { name: 'Enum value 1' });
    const secondValue = screen.getByRole('textbox', { name: 'Enum value 2' });
    expect(firstValue).toBeInstanceOf(HTMLInputElement);
    expect(secondValue).toBeInstanceOf(HTMLInputElement);
    if (!(firstValue instanceof HTMLInputElement) || !(secondValue instanceof HTMLInputElement)) {
      throw new Error('Enum values must render as inputs.');
    }
    expect(firstValue.value).toBe('"draft"');
    expect(secondValue.value).toBe('"published"');
    expect(screen.getByRole('button', { name: 'Move enum value 1 up' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  test('renders a description input per row, defaulting to empty', () => {
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft', 'published'],
      descriptions: ['Not yet visible', ''],
      onValuesChange: () => {},
    });

    expect(
      screen.getByRole('textbox', { name: 'Enum value 1 description' }),
    ).toHaveProperty('value', 'Not yet visible');
    expect(
      screen.getByRole('textbox', { name: 'Enum value 2 description' }),
    ).toHaveProperty('value', '');
  });

  test('editing a description commits both arrays with the value array untouched', async () => {
    let latestValues: unknown[] = [];
    let latestDescriptions: string[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft', 'published'],
      descriptions: ['', ''],
      onValuesChange: (values: unknown[], descriptions: string[]) => {
        latestValues = values;
        latestDescriptions = descriptions;
      },
    });

    await fireEvent.input(screen.getByRole('textbox', { name: 'Enum value 1 description' }), {
      target: { value: 'Not yet visible' },
    });

    expect(latestValues).toEqual(['draft', 'published']);
    expect(latestDescriptions).toEqual(['Not yet visible', '']);
  });

  test('reordering moves the description alongside its value', async () => {
    let latestValues: unknown[] = [];
    let latestDescriptions: string[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft', 'published'],
      descriptions: ['Not yet visible', 'Live'],
      onValuesChange: (values: unknown[], descriptions: string[]) => {
        latestValues = values;
        latestDescriptions = descriptions;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move enum value 2 up' }));

    expect(latestValues).toEqual(['published', 'draft']);
    expect(latestDescriptions).toEqual(['Live', 'Not yet visible']);
  });

  test('removing a value removes its description at the same index', async () => {
    let latestValues: unknown[] = [];
    let latestDescriptions: string[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft', 'published', 'archived'],
      descriptions: ['Not yet visible', 'Live', 'Retired'],
      onValuesChange: (values: unknown[], descriptions: string[]) => {
        latestValues = values;
        latestDescriptions = descriptions;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Remove enum value 2' }));

    expect(latestValues).toEqual(['draft', 'archived']);
    expect(latestDescriptions).toEqual(['Not yet visible', 'Retired']);
  });

  test('adding a value appends an empty description', async () => {
    let latestValues: unknown[] = [];
    let latestDescriptions: string[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft'],
      descriptions: ['Not yet visible'],
      onValuesChange: (values: unknown[], descriptions: string[]) => {
        latestValues = values;
        latestDescriptions = descriptions;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add enum value' }));

    expect(latestValues).toHaveLength(2);
    expect(latestDescriptions).toEqual(['Not yet visible', '']);
  });

  test('commits valid JSON values and keeps invalid row text local', async () => {
    let values: unknown[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft'],
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    const input = screen.getByRole('textbox', { name: 'Enum value 1' });
    await fireEvent.input(input, { target: { value: '42' } });
    expect(values).toEqual([42]);

    await fireEvent.input(input, { target: { value: '{' } });
    expect(values).toEqual([42]);
    expect(screen.getByText('Enter a valid JSON value.')).not.toBeNull();
  });

  test('reorders values and identifies each reorder control', async () => {
    let values: unknown[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft', 'published'],
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move enum value 2 up' }));

    expect(values).toEqual(['published', 'draft']);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Enum value 1' }));
  });

  test('does not commit non-finite values or remove the final value', async () => {
    let values: unknown[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft'],
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    await fireEvent.input(screen.getByRole('textbox', { name: 'Enum value 1' }), {
      target: { value: '1e400' },
    });

    expect(values).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Enum value 1' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Remove enum value 1' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  test('announces enum removals', async () => {
    let values: unknown[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft', 'published'],
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Remove enum value 2' }));

    expect(values).toEqual(['draft']);
    expect(screen.getByText('Removed enum value 2. 1 value remains.')).not.toBeNull();
  });

  test('announces and focuses an added enum row', async () => {
    let values: unknown[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft'],
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Add enum value' }));

    expect(values).toEqual(['draft', '']);
    expect(screen.getByText('Added enum value 2 of 2.')).not.toBeNull();
  });

  test('keeps duplicate values local and disables reordering while a draft is invalid', async () => {
    let values: unknown[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: ['draft', 'published'],
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    await fireEvent.input(screen.getByRole('textbox', { name: 'Enum value 2' }), {
      target: { value: '"draft"' },
    });

    expect(values).toEqual([]);
    expect(screen.getByRole('button', { name: 'Move enum value 2 up' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Remove enum value 1' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByText('Enum values must be unique.')).not.toBeNull();
  });

  test('retains an invalid row draft when a sibling value is committed', async () => {
    let values: unknown[] = ['draft', 'published'];
    let drafts: Record<number, { text: string; error: 'invalid-json' | 'duplicate' }> = {};
    const onValuesChange = (next: unknown[]) => {
      values = next;
    };
    const view = render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values,
      drafts,
      onDraftsChange: (next: typeof drafts) => {
        drafts = next;
      },
      onValuesChange,
    });

    const firstInput = screen.getByRole('textbox', { name: 'Enum value 1' });
    const secondInput = screen.getByRole('textbox', { name: 'Enum value 2' });
    await fireEvent.input(secondInput, { target: { value: '{' } });
    await fireEvent.input(firstInput, { target: { value: '"review"' } });
    await view.rerender({
      idPrefix: 'status-enum',
      path: '/status/enum',
      values,
      drafts,
      onDraftsChange: (next: typeof drafts) => {
        drafts = next;
      },
      onValuesChange,
    });

    const invalidInput = screen.getByRole('textbox', { name: 'Enum value 2' });
    expect(values).toEqual(['review', 'published']);
    expect(invalidInput).toHaveProperty('value', '{');
    expect(invalidInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a valid JSON value.')).not.toBeNull();
  });

  test('does not resurrect a stale draft on a row added back at the same index', async () => {
    let values: unknown[] = ['draft', 'published'];
    let drafts: Record<number, { text: string; error: 'invalid-json' | 'duplicate' }> = {};
    const view = render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values,
      drafts,
      historyRevision: 0,
      onDraftsChange: (next: typeof drafts) => {
        drafts = next;
      },
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    // Leave an invalid draft on the second row.
    await fireEvent.input(screen.getByRole('textbox', { name: 'Enum value 2' }), {
      target: { value: '{' },
    });
    expect(screen.getByText('Enter a valid JSON value.')).not.toBeNull();
    expect(drafts[1]).toEqual({ text: '{', error: 'invalid-json' });

    // Simulate an undo that shrinks `values` back to one entry while bumping
    // historyRevision — the row the draft pointed at no longer exists. The
    // stale draft is invisible here (nothing renders index 1), which is
    // exactly why it can survive undetected without the fix.
    values = ['draft'];
    await view.rerender({
      idPrefix: 'status-enum',
      path: '/status/enum',
      values,
      drafts,
      historyRevision: 1,
      onDraftsChange: (next: typeof drafts) => {
        drafts = next;
      },
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });
    expect(screen.queryByText('Enter a valid JSON value.')).toBeNull();

    // A property list re-adding a value lands it back at index 1, passing
    // the SAME `drafts` object prop back down (the parent only ever prunes
    // by rebasing, it doesn't know this row is "new"). Without the fix, the
    // stale index-1 draft resurrects and this brand-new valid row inherits
    // an error it never earned.
    values = ['draft', ''];
    await view.rerender({
      idPrefix: 'status-enum',
      path: '/status/enum',
      values,
      drafts,
      historyRevision: 1,
      onDraftsChange: (next: typeof drafts) => {
        drafts = next;
      },
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    expect(screen.queryByText('Enter a valid JSON value.')).toBeNull();
    expect(
      screen.getByRole('textbox', { name: 'Enum value 2' }).getAttribute('aria-invalid'),
    ).toBeNull();
  });

  test('produces the correct final announcement across two moves with identical text', async () => {
    // Regression coverage for the functional half of clearing the live
    // region before re-setting it: two consecutive moves that happen to
    // produce the exact same announcement string must both still leave the
    // region holding that string, not some stale intermediate value. Whether
    // assistive technology actually re-announces an unchanged-looking string
    // is a timing property happy-dom's MutationObserver doesn't reliably
    // surface — that half is manual-verification-only, per the a11y record.
    let values: unknown[] = ['a', 'b', 'c'];
    const view = render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values,
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move enum value 3 up' }));
    await tick();
    expect(screen.getByText('Moved enum value 3 to position 2 of 3.')).not.toBeNull();

    await view.rerender({
      idPrefix: 'status-enum',
      path: '/status/enum',
      values,
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move enum value 3 up' }));
    await tick();

    expect(screen.getByText('Moved enum value 3 to position 2 of 3.')).not.toBeNull();
  });

  test('treats object values with different member order as duplicates', async () => {
    let values: unknown[] = [];
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: [{ a: 1, b: 2 }, { label: 'other' }],
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    await fireEvent.input(screen.getByRole('textbox', { name: 'Enum value 2' }), {
      target: { value: '{"b":2,"a":1}' },
    });

    expect(values).toEqual([]);
  });

  test('resolves only one of several drafts that would otherwise duplicate each other', async () => {
    let values: unknown[] = [];
    let drafts: Record<number, { text: string; error: 'invalid-json' | 'duplicate' }> = {};
    render(EnumEditor, {
      idPrefix: 'status-enum',
      path: '/status/enum',
      values: [1, 2, 4],
      drafts: {
        0: { text: '3', error: 'duplicate' },
        1: { text: '3', error: 'duplicate' },
      },
      onDraftsChange: (next: typeof drafts) => {
        drafts = next;
      },
      onValuesChange: (next: unknown[]) => {
        values = next;
      },
    });

    expect(values).toEqual([3, 2, 4]);
    expect(drafts).toEqual({ 1: { text: '3', error: 'duplicate' } });
  });
});
