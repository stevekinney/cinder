/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

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
});
