/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render, fireEvent } = await import('@testing-library/svelte');
const { default: PhoneInput } = await import('./phone-input.svelte');
const { default: FormFieldPhoneInputFixture } =
  await import('../../test/fixtures/form-field-phone-input-fixture.svelte');

afterEach(cleanup);

function nationalInput(container: Element): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="tel"]')!;
}

function countrySelect(container: Element): HTMLSelectElement {
  return container.querySelector<HTMLSelectElement>('select')!;
}

describe('PhoneInput onValueChange', () => {
  test('valid US number emits E.164 with reason "valid"', async () => {
    const onValueChange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', onValueChange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '4155550132' } });
    expect(onValueChange).toHaveBeenCalled();
    const lastCall = onValueChange.mock.calls.at(-1)!;
    const [detail] = lastCall as [any];
    expect(detail.value).toBe('+14155550132');
    expect(detail.reason).toBe('valid');
    expect(detail.isValid).toBe(true);
  });

  test('cleared input emits "" with reason "empty"', async () => {
    const onValueChange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', value: '+14155550132', onValueChange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '' } });
    const lastCall = onValueChange.mock.calls.at(-1)!;
    const [detail] = lastCall as [any];
    expect(detail.value).toBe('');
    expect(detail.reason).toBe('empty');
  });

  test('incomplete number emits "" without clearing visible digits', async () => {
    const onValueChange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', onValueChange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '415' } });
    const lastCall = onValueChange.mock.calls.at(-1)!;
    const [detail] = lastCall as [any];
    expect(detail.value).toBe('');
    expect(input.value).not.toBe('');
  });

  test('switching country fires onValueChange with the new country', async () => {
    const onValueChange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'], onValueChange },
    });
    const select = countrySelect(container);
    await fireEvent.change(select, { target: { value: 'GB' } });
    const lastCall = onValueChange.mock.calls.at(-1)!;
    const [detail] = lastCall as [any];
    expect(detail.country).toBe('GB');
  });

  test('onValueChange does NOT fire on external value synchronization', async () => {
    const onValueChange = mock((_detail: any) => {});
    const { rerender } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', value: '+14155550132', onValueChange },
    });
    await rerender({ id: 'p', label: 'Phone', value: '+442079460958', onValueChange });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test('onValueChange does NOT fire on external country synchronization', async () => {
    const onValueChange = mock((_detail: any) => {});
    const { rerender } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', country: 'US', onValueChange },
    });
    await rerender({ id: 'p', label: 'Phone', country: 'GB', onValueChange });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test('external country synchronization recomputes the hidden value from the visible digits', async () => {
    const onValueChange = mock((_detail: any) => {});
    const { container, rerender } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        name: 'phone',
        country: 'US',
        value: '+14155550132',
        onValueChange,
      },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe('+14155550132');

    await rerender({
      id: 'p',
      label: 'Phone',
      name: 'phone',
      country: 'GB',
      value: '+14155550132',
      onValueChange,
    });

    expect(hidden.value).toBe('');
    expect(countrySelect(container).value).toBe('GB');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('PhoneInput external E.164 parsing', () => {
  test('parses an external E.164 value into the dropdown + visible field', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', value: '+442079460958' },
    });
    expect(countrySelect(container).value).toBe('GB');
    expect(nationalInput(container).value).toContain('020');
  });
});

describe('PhoneInput error / disabled / required', () => {
  test('error sets aria-invalid on the group and renders the message', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', error: 'Enter a valid phone number.' },
    });
    const group = container.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('#p-error')?.textContent).toContain(
      'Enter a valid phone number.',
    );
  });

  test('disabled disables both controls and the hidden input', () => {
    const { container } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        disabled: true,
        name: 'phone',
        value: '+14155550132',
      },
    });
    expect(countrySelect(container).disabled).toBe(true);
    expect(nationalInput(container).disabled).toBe(true);
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.disabled).toBe(true);
  });

  test('required is mirrored to the national input', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', required: true },
    });
    expect(nationalInput(container).required).toBe(true);
    expect(countrySelect(container).required).toBe(true);
  });

  test('explicit required=false overrides required FormField context for both controls', () => {
    const { container } = render(FormFieldPhoneInputFixture, {
      props: {
        fieldId: 'phone',
        fieldLabel: 'Phone',
        fieldRequired: true,
        phoneRequired: false,
      },
    });

    expect(countrySelect(container).required).toBe(false);
    expect(nationalInput(container).required).toBe(false);
  });
});

describe('PhoneInput allow-list expansion', () => {
  test('expanding the allow-list to include the value-country restores it from the fallback', async () => {
    const { container, rerender } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US'],
        value: '+442079460958', // GB number, but GB is not in allow-list yet
      },
    });
    // GB is disallowed: fallback to US.
    expect(countrySelect(container).value).toBe('US');
    // Now expand the allow-list to include GB — the component should
    // re-detect the country and reformat the visible field.
    await rerender({
      id: 'p',
      label: 'Phone',
      countries: ['US', 'GB'],
      value: '+442079460958',
    });
    expect(countrySelect(container).value).toBe('GB');
    expect(nationalInput(container).value).toContain('020');
  });
});
