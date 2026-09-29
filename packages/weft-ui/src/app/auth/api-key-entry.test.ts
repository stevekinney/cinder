import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for the reject-mode API-key entry surface (plan §6, T1.1).
 * `bun test` + happy-dom + `@testing-library/svelte` (plan §11.2).
 *
 * Reads the submit button's `.disabled` property directly rather than a
 * jest-dom `toBeDisabled()` matcher — this project doesn't import the
 * `bun:test` `Matchers` type augmentation `@testing-library/jest-dom` ships
 * (`tests/setup.ts` extends `expect` at runtime only), so `toBeDisabled()`
 * doesn't typecheck here even though it works at runtime.
 */
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ApiKeyEntry from './api-key-entry.svelte';

function submitButton(getByRole: (role: string, options: { name: string }) => HTMLElement) {
  return requireElement(getByRole('button', { name: 'Continue' }), HTMLButtonElement);
}

describe('ApiKeyEntry', () => {
  test('renders the API key field and a disabled submit button with no input', async () => {
    const { getByLabelText, getByRole } = render(ApiKeyEntry, {
      props: { onSubmit: async () => {} },
    });

    expect(getByLabelText(/API key/)).not.toBeNull();
    expect(submitButton(getByRole).disabled).toBe(true);
  });

  test('submits the trimmed key and calls onSubmit', async () => {
    const submitted: string[] = [];
    const { getByLabelText, getByRole } = render(ApiKeyEntry, {
      props: {
        onSubmit: async (apiKey: string) => {
          submitted.push(apiKey);
        },
      },
    });

    const input = requireElement(getByLabelText(/API key/), HTMLInputElement);
    await fireEvent.input(input, { target: { value: '  operator-key  ' } });
    await fireEvent.click(getByRole('button', { name: 'Continue' }));

    expect(submitted).toEqual(['operator-key']);
  });

  test('does not submit a blank or whitespace-only key', async () => {
    const submitted: string[] = [];
    const { getByLabelText, getByRole } = render(ApiKeyEntry, {
      props: {
        onSubmit: async (apiKey: string) => {
          submitted.push(apiKey);
        },
      },
    });

    const input = requireElement(getByLabelText(/API key/), HTMLInputElement);
    await fireEvent.input(input, { target: { value: '   ' } });
    expect(submitButton(getByRole).disabled).toBe(true);

    submitted.length = 0;
    expect(submitted).toEqual([]);
  });

  test('shows an inline error when onSubmit rejects, and re-enables the form', async () => {
    const { getByLabelText, getByRole, getByText } = render(ApiKeyEntry, {
      props: {
        onSubmit: async () => {
          throw new Error('Invalid API key.');
        },
      },
    });

    const input = requireElement(getByLabelText(/API key/), HTMLInputElement);
    await fireEvent.input(input, { target: { value: 'wrong-key' } });
    await fireEvent.click(getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(getByText('Invalid API key.')).not.toBeNull();
    });
    expect(submitButton(getByRole).disabled).toBe(false);
  });

  test('a non-Error rejection falls back to a generic message', async () => {
    const { getByLabelText, getByRole, getByText } = render(ApiKeyEntry, {
      props: {
        onSubmit: async () => {
          throw 'nope';
        },
      },
    });

    const input = requireElement(getByLabelText(/API key/), HTMLInputElement);
    await fireEvent.input(input, { target: { value: 'wrong-key' } });
    await fireEvent.click(getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(getByText('Could not verify this API key.')).not.toBeNull();
    });
  });
});
