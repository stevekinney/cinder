/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: PhoneInput } = await import('./phone-input.svelte');

function nationalInput(container: Element): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="tel"]')!;
}

function countrySelect(container: Element): HTMLSelectElement {
  return container.querySelector<HTMLSelectElement>('select')!;
}

describe('PhoneInput rendering', () => {
  test('renders country select and tel input', () => {
    const { container } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });
    expect(countrySelect(container)).not.toBeNull();
    expect(nationalInput(container)).not.toBeNull();
  });

  test('group has role="group" with labelled-by reference', () => {
    const { container } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });
    const group = container.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-labelledby')).toBe('p-label');
  });

  test('country select and national input have separate accessible names', () => {
    const { container } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });
    const select = countrySelect(container);
    const input = nationalInput(container);
    expect(select.getAttribute('aria-labelledby')).toBe('p-country-label');
    expect(input.getAttribute('aria-labelledby')).toBe('p-national-label');
    expect(container.querySelector('#p-country-label')?.textContent).toBe('Country code');
    expect(container.querySelector('#p-national-label')?.textContent).toBe('Phone number');
  });

  test('country defaults to US', () => {
    const { container } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });
    expect(countrySelect(container).value).toBe('US');
  });

  test('countries allow-list narrows the dropdown', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'] },
    });
    const options = Array.from(container.querySelectorAll<HTMLOptionElement>('option')).map(
      (option) => option.value,
    );
    expect(options).toEqual(['US', 'GB']);
  });

  test('hidden input only rendered when name is provided', () => {
    const { container: noName } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });
    expect(noName.querySelector('input[type="hidden"]')).toBeNull();

    const { container: withName } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', name: 'phone', value: '+14155550132' },
    });
    const hidden = withName.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.getAttribute('name')).toBe('phone');
    expect(hidden.value).toBe('+14155550132');
  });
});

describe('PhoneInput country allow-list behavior', () => {
  test('external country outside allow-list falls back to first allowed country', () => {
    const { container } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        country: 'CA',
        countries: ['US', 'GB'],
      },
    });
    expect(countrySelect(container).value).toBe('US');
  });

  test('external E.164 outside allow-list keeps hidden submitted value empty', () => {
    const { container } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['GB'],
        name: 'phone',
        value: '+14155550132',
      },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe('');
  });
});

describe('PhoneInput as-you-type formatting', () => {
  test('US digits are formatted as the user types', async () => {
    const { container } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '4155550132' } });
    expect(input.value).toBe('(415) 555-0132');
  });

  test('GB digits use national formatting after switching country', async () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', country: 'GB' },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '02079460958' } });
    expect(input.value).toContain('020');
  });

  test('switching country reformats existing digits', async () => {
    const { container } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '02079460958' } });
    const select = countrySelect(container);
    await fireEvent.change(select, { target: { value: 'GB' } });
    expect(input.value).toContain('020');
  });
});

describe('PhoneInput onchange', () => {
  test('valid US number emits E.164 with reason "valid"', async () => {
    const onchange = mock((_value: string, _detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', onchange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '4155550132' } });
    expect(onchange).toHaveBeenCalled();
    const lastCall = onchange.mock.calls.at(-1)!;
    const [emittedValue, detail] = lastCall as [string, any];
    expect(emittedValue).toBe('+14155550132');
    expect(detail.reason).toBe('valid');
    expect(detail.isValid).toBe(true);
  });

  test('cleared input emits "" with reason "empty"', async () => {
    const onchange = mock((_value: string, _detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', value: '+14155550132', onchange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '' } });
    const lastCall = onchange.mock.calls.at(-1)!;
    const [emittedValue, detail] = lastCall as [string, any];
    expect(emittedValue).toBe('');
    expect(detail.reason).toBe('empty');
  });

  test('incomplete number emits "" without clearing visible digits', async () => {
    const onchange = mock((_value: string, _detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', onchange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '415' } });
    const lastCall = onchange.mock.calls.at(-1)!;
    const [emittedValue] = lastCall as [string, any];
    expect(emittedValue).toBe('');
    expect(input.value).not.toBe('');
  });

  test('switching country fires onchange with the new country', async () => {
    const onchange = mock((_value: string, _detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'], onchange },
    });
    const select = countrySelect(container);
    await fireEvent.change(select, { target: { value: 'GB' } });
    const lastCall = onchange.mock.calls.at(-1)!;
    const [, detail] = lastCall as [string, any];
    expect(detail.country).toBe('GB');
  });

  test('onchange does NOT fire on external value synchronization', async () => {
    const onchange = mock((_value: string, _detail: any) => {});
    const { rerender } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', value: '+14155550132', onchange },
    });
    await rerender({ id: 'p', label: 'Phone', value: '+442079460958', onchange });
    expect(onchange).not.toHaveBeenCalled();
  });

  test('onchange does NOT fire on external country synchronization', async () => {
    const onchange = mock((_value: string, _detail: any) => {});
    const { rerender } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', country: 'US', onchange },
    });
    await rerender({ id: 'p', label: 'Phone', country: 'GB', onchange });
    expect(onchange).not.toHaveBeenCalled();
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
  });
});
