/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

expect.extend(matchers as Parameters<typeof expect.extend>[0]);
setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: ParameterField } = await import('./parameter-field.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

describe('ParameterField', () => {
  test('renders the inherited value and unit without override state', () => {
    const { container, getByText } = render(ParameterField, {
      props: { id: 'temperature', label: 'Temperature', base: 0.7, unit: 'K' },
    });

    expect(getByText('Temperature')).toBeVisible();
    expect(getByText('0.7')).toBeVisible();
    expect(getByText('K')).toBeVisible();
    expect(container.querySelector('.cinder-parameter-field')).not.toHaveAttribute(
      'data-cinder-overridden',
    );
    expect(container.querySelector('.cinder-parameter-field__reset')).toBeNull();
  });

  test('marks an override and resets it to the documented default', async () => {
    const changes: Array<number | undefined> = [];
    const { container, getByRole } = render(ParameterField, {
      props: {
        id: 'temperature',
        label: 'Temperature',
        base: 0.7,
        override: 1.2,
        unit: 'K',
        onOverrideChange: (value: number | undefined) => changes.push(value),
      },
    });

    expect(container.querySelector('.cinder-parameter-field')).toHaveAttribute(
      'data-cinder-overridden',
    );
    expect(container.querySelector('.cinder-parameter-field__value')).toHaveTextContent('1.2 K');

    const reset = getByRole('button', { name: 'Reset to default' });
    expect(reset.getAttribute('aria-describedby')).not.toBeNull();
    await fireEvent.click(reset);

    await waitFor(() => {
      expect(changes).toEqual([undefined]);
      expect(container.querySelector('.cinder-parameter-field__value')).toHaveTextContent('0.7 K');
      expect(container.querySelector('.cinder-parameter-field')).not.toHaveAttribute(
        'data-cinder-overridden',
      );
    });
  });

  test('renders unsaved and experimental badges as textual status', () => {
    const { container, getByText } = render(ParameterField, {
      props: {
        id: 'temperature',
        label: 'Temperature',
        base: 0.7,
        unsaved: true,
        experimental: true,
      },
    });

    expect(getByText('Unsaved')).toBeVisible();
    expect(getByText('Experimental')).toBeVisible();
    expect(container.querySelector('.cinder-parameter-field')).toHaveAttribute(
      'data-cinder-unsaved',
    );
  });

  test('publishes the visible label to the editor region', () => {
    const { container } = render(ParameterField, {
      props: {
        id: 'temperature',
        label: 'Temperature',
        base: 0.7,
      },
    });

    expect(
      container.querySelector('.cinder-parameter-field__editor')?.getAttribute('aria-labelledby'),
    ).toBe('temperature-label');
    expect(container.querySelector('output')).toHaveAccessibleName('Temperature');
  });
});
