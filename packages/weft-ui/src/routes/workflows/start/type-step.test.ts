import { requireElement } from '../../../../tests/dom-test-support.ts';

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import TypeStep from './type-step.svelte';

describe('TypeStep', () => {
  test('Continue is disabled with no value typed', async () => {
    const { getByRole } = render(TypeStep, {
      props: {
        knownTypes: [],
        registryLoading: false,
        value: '',
        onValueChange: () => {},
        onContinue: () => {},
      },
    });

    expect(
      requireElement(getByRole('button', { name: 'Next: configure' }), HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('Continue is enabled once a value is present', async () => {
    const { getByRole } = render(TypeStep, {
      props: {
        knownTypes: ['order-processing'],
        registryLoading: false,
        value: 'order-processing',
        onValueChange: () => {},
        onContinue: () => {},
      },
    });

    expect(
      requireElement(getByRole('button', { name: 'Next: configure' }), HTMLButtonElement).disabled,
    ).toBe(false);
  });

  test('shows the fallback hint when the registry has no known types', async () => {
    const { getByText } = render(TypeStep, {
      props: {
        knownTypes: [],
        registryLoading: false,
        value: '',
        onValueChange: () => {},
        onContinue: () => {},
      },
    });

    expect(getByText(/enter the exact workflow type name/)).not.toBeNull();
  });

  test('clicking Continue calls onContinue', async () => {
    let continued = false;
    const { getByRole } = render(TypeStep, {
      props: {
        knownTypes: [],
        registryLoading: false,
        value: 'order-processing',
        onValueChange: () => {},
        onContinue: () => {
          continued = true;
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Next: configure' }));
    expect(continued).toBe(true);
  });

  test('typed free text survives losing focus when the registry has no known types (regression: Combobox reverts uncommitted text on blur)', async () => {
    let value = '';
    const { getByLabelText, rerender } = render(TypeStep, {
      props: {
        knownTypes: [],
        registryLoading: false,
        value,
        onValueChange: (next) => {
          value = next;
        },
        onContinue: () => {},
      },
    });

    const input = requireElement(getByLabelText('Workflow type'), HTMLInputElement);
    await fireEvent.input(input, { target: { value: 'order-processing' } });
    expect(value).toBe('order-processing');
    await rerender({
      knownTypes: [],
      registryLoading: false,
      value,
      onValueChange: (next: string) => {
        value = next;
      },
      onContinue: () => {},
    });
    await fireEvent.blur(input);

    expect(requireElement(getByLabelText('Workflow type'), HTMLInputElement).value).toBe(
      'order-processing',
    );
  });
});
