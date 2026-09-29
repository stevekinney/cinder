import { requireElement } from '../../../../tests/dom-test-support.ts';

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ConfigureStep from './configure-step.svelte';
import { EMPTY_ADVANCED_START_OPTIONS } from './start-wizard-state.ts';

const BASE_PROPS = {
  advanced: EMPTY_ADVANCED_START_OPTIONS,
  onAdvancedChange: () => {},
  onBack: () => {},
};

describe('ConfigureStep', () => {
  test('renders raw JSON mode when there is no schema', async () => {
    const { getByLabelText } = render(ConfigureStep, {
      props: {
        ...BASE_PROPS,
        schema: undefined,
        mode: 'json',
        onModeChange: () => {},
        rawText: '',
        onRawTextChange: () => {},
        onContinue: () => {},
      },
    });

    expect(getByLabelText('Payload (JSON)')).not.toBeNull();
  });

  test('shows a validation error for invalid JSON and disables Continue', async () => {
    const { getByLabelText, getByRole } = render(ConfigureStep, {
      props: {
        ...BASE_PROPS,
        schema: undefined,
        mode: 'json',
        onModeChange: () => {},
        rawText: '{not json',
        onRawTextChange: () => {},
        onContinue: () => {},
      },
    });

    const textarea = getByLabelText('Payload (JSON)');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(
      requireElement(getByRole('button', { name: 'Continue to review' }), HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  test('valid JSON enables Continue and calls onContinue with the parsed value', async () => {
    let continued: unknown;
    const { getByRole } = render(ConfigureStep, {
      props: {
        ...BASE_PROPS,
        schema: undefined,
        mode: 'json',
        onModeChange: () => {},
        rawText: '{"orderId":"ord-1"}',
        onRawTextChange: () => {},
        onContinue: (value: unknown) => {
          continued = value;
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Continue to review' }));
    expect(continued).toEqual({ orderId: 'ord-1' });
  });

  test('renders the Form/JSON toggle when a schema is present', async () => {
    const { getByRole } = render(ConfigureStep, {
      props: {
        ...BASE_PROPS,
        schema: { type: 'object', properties: { orderId: { type: 'string' } } },
        mode: 'form',
        onModeChange: () => {},
        rawText: '',
        onRawTextChange: () => {},
        onContinue: () => {},
      },
    });

    expect(getByRole('radio', { name: 'Form' })).not.toBeNull();
    expect(getByRole('radio', { name: 'JSON' })).not.toBeNull();
  });

  test('Back calls onBack', async () => {
    let wentBack = false;
    const { getByRole } = render(ConfigureStep, {
      props: {
        ...BASE_PROPS,
        onBack: () => {
          wentBack = true;
        },
        schema: undefined,
        mode: 'json',
        onModeChange: () => {},
        rawText: '',
        onRawTextChange: () => {},
        onContinue: () => {},
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Back' }));
    expect(wentBack).toBe(true);
  });
});
