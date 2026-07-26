/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render, fireEvent, waitFor } = await import('@testing-library/svelte');
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

  test('country select accessible name includes the full selected country', () => {
    const { getByRole } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });
    expect(getByRole('combobox', { name: 'Phone Country: United States, +1' })).not.toBeNull();
  });

  test('visible country summary stays compact while options retain full names', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', country: 'AE', countries: ['US', 'AE'] },
    });

    expect(container.querySelector('.cinder-phone-input__country-summary')?.textContent).toBe(
      'AE +971',
    );
    expect(Array.from(countrySelect(container).options, (option) => option.textContent)).toContain(
      'United Arab Emirates +971',
    );
  });

  test('multiple instances prefix child controls with their field label', () => {
    const home = render(PhoneInput, { props: { id: 'home', label: 'Home phone' } });
    const work = render(PhoneInput, { props: { id: 'work', label: 'Work phone' } });

    expect(
      home.getByRole('combobox', { name: 'Home phone Country: United States, +1' }),
    ).not.toBeNull();
    expect(home.getByRole('textbox', { name: 'Home phone Phone number' })).not.toBeNull();
    expect(
      work.getByRole('combobox', { name: 'Work phone Country: United States, +1' }),
    ).not.toBeNull();
    expect(work.getByRole('textbox', { name: 'Work phone Phone number' })).not.toBeNull();
  });

  test('loads the shared Input and Select styled entries without painting another chevron', () => {
    const source = readFileSync(new URL('./phone-input.svelte', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./phone-input.css', import.meta.url), 'utf8');
    const { container } = render(PhoneInput, { props: { id: 'p', label: 'Phone' } });

    expect(source).toContain("from '@lostgradient/cinder/input'");
    expect(source).toContain("from '@lostgradient/cinder/select'");
    expect(styles).not.toContain('background-image');
    expect(styles).toContain('.cinder-phone-input__country .cinder-select option');
    expect(styles).toContain('text-indent: 0;');
    expect(container.querySelectorAll('.cinder-select-field__chevron')).toHaveLength(1);
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

  test('external E.164 outside allow-list holds the visible text and marks the group invalid via error prop', () => {
    const { container } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['GB'],
        value: '+14155550132',
        error: 'Number must be a UK phone number.',
      },
    });
    expect(nationalInput(container).value).toBe('+14155550132');
    const group = container.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(countrySelect(container).getAttribute('aria-invalid')).toBe('true');
  });

  test('typing a `+`-prefixed E.164 string re-detects the country', async () => {
    const onchange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'], onchange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '+442079460958' } });
    expect(countrySelect(container).value).toBe('GB');
    const last = onchange.mock.calls.at(-1)!;
    const [detail] = last as [any];
    expect(detail.country).toBe('GB');
    expect(detail.reason).toBe('valid');
  });

  test('shrinking the allow-list after mount falls back to the first allowed country', async () => {
    const { container, rerender } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'], country: 'GB' },
    });
    expect(countrySelect(container).value).toBe('GB');
    await rerender({ id: 'p', label: 'Phone', countries: ['US'], country: 'GB' });
    expect(countrySelect(container).value).toBe('US');
  });

  test('shrinking the allow-list also recomputes the bindable value', async () => {
    const onchange = mock((_detail: any) => {});
    const { rerender, container } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US', 'GB'],
        value: '+442079460958',
        onchange,
      },
    });
    expect(countrySelect(container).value).toBe('GB');
    // Now narrow the allow-list to exclude GB. The component should fall
    // back to US AND clear the stale GB E.164 from the bindable value.
    await rerender({
      id: 'p',
      label: 'Phone',
      countries: ['US'],
      value: '+442079460958',
      onchange,
    });
    expect(countrySelect(container).value).toBe('US');
    // The visible national digits get reformatted for US; the value reflects
    // the new computation (US-context number from the preserved digits is
    // not a valid US phone, so value is '').
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(hidden).toBeNull(); // no name prop -> no hidden input
    // onchange must NOT fire — this is prop synchronization, not user edit.
    expect(onchange).not.toHaveBeenCalled();
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
    const onchange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', onchange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '4155550132' } });
    expect(onchange).toHaveBeenCalled();
    const lastCall = onchange.mock.calls.at(-1)!;
    const [detail] = lastCall as [any];
    expect(detail.value).toBe('+14155550132');
    expect(detail.reason).toBe('valid');
    expect(detail.isValid).toBe(true);
  });

  test('cleared input emits "" with reason "empty"', async () => {
    const onchange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', value: '+14155550132', onchange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '' } });
    const lastCall = onchange.mock.calls.at(-1)!;
    const [detail] = lastCall as [any];
    expect(detail.value).toBe('');
    expect(detail.reason).toBe('empty');
  });

  test('incomplete number emits "" without clearing visible digits', async () => {
    const onchange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', onchange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '415' } });
    const lastCall = onchange.mock.calls.at(-1)!;
    const [detail] = lastCall as [any];
    expect(detail.value).toBe('');
    expect(input.value).not.toBe('');
  });

  test('switching country fires onchange with the new country', async () => {
    const onchange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'], onchange },
    });
    const select = countrySelect(container);
    await fireEvent.change(select, { target: { value: 'GB' } });
    const lastCall = onchange.mock.calls.at(-1)!;
    const [detail] = lastCall as [any];
    expect(detail.country).toBe('GB');
  });

  test('onchange does NOT fire on external value synchronization', async () => {
    const onchange = mock((_detail: any) => {});
    const { rerender } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', value: '+14155550132', onchange },
    });
    await rerender({ id: 'p', label: 'Phone', value: '+442079460958', onchange });
    expect(onchange).not.toHaveBeenCalled();
  });

  test('onchange does NOT fire on external country synchronization', async () => {
    const onchange = mock((_detail: any) => {});
    const { rerender } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', country: 'US', onchange },
    });
    await rerender({ id: 'p', label: 'Phone', country: 'GB', onchange });
    expect(onchange).not.toHaveBeenCalled();
  });

  test('external country synchronization recomputes the hidden value from the visible digits', async () => {
    const onchange = mock((_detail: any) => {});
    const { container, rerender } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        name: 'phone',
        country: 'US',
        value: '+14155550132',
        onchange,
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
      onchange,
    });

    expect(hidden.value).toBe('');
    expect(countrySelect(container).value).toBe('GB');
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

describe('PhoneInput form reset', () => {
  test('preserves newer external value and country updates after reset dispatch', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', name: 'phone', value: '+14155552671', country: 'US' },
      target: form,
    });
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await rendered.rerender({
      id: 'p',
      label: 'Phone',
      name: 'phone',
      value: '+442079460958',
      country: 'GB',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(countrySelect(rendered.container).value).toBe('GB');
    expect(rendered.container.querySelector('input[type="hidden"]')?.getAttribute('value')).toBe(
      '+442079460958',
    );
  });
  test('restores the initial national formatting on reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: {
        id: 'p',
        label: 'Phone',
        country: 'US',
        value: '4155550132',
      },
    });
    const input = nationalInput(rendered.container);

    await waitFor(() => expect(input.value).toBe('(415) 555-0132'));
    await fireEvent.input(input, { target: { value: '2025550123' } });
    expect(input.value).toBe('(202) 555-0123');

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(countrySelect(rendered.container).value).toBe('US');
    expect(input.value).toBe('(415) 555-0132');
    rendered.unmount();
    form.remove();
  });

  test('resynchronizes an untouched non-first initial country on reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'], country: 'GB' },
    });
    expect(countrySelect(rendered.container).value).toBe('GB');
    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(countrySelect(rendered.container).value).toBe('GB');
    expect(
      rendered.container.querySelector('.cinder-phone-input__country-summary')?.textContent,
    ).toContain('GB');
    rendered.unmount();
    form.remove();
  });

  test('does not reset when the reset event is canceled', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US', 'GB'],
        value: '+14155550132',
      },
    });
    const input = nationalInput(rendered.container);
    await fireEvent.input(input, { target: { value: '2025550123' } });
    const editedDisplay = input.value;
    let resetCanceled = false;
    form.addEventListener('reset', (event) => {
      event.preventDefault();
      resetCanceled = event.defaultPrevented;
    });

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resetCanceled).toBe(true);
    expect(input.value).toBe(editedDisplay);
    rendered.unmount();
    form.remove();
  });

  test('preserves a disallowed initial E.164 value literally on reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US'],
        value: '+442079460958',
      },
    });
    const input = nationalInput(rendered.container);
    await fireEvent.input(input, { target: { value: '2025550123' } });

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(countrySelect(rendered.container).value).toBe('US');
    expect(input.value).toBe('+442079460958');
    rendered.unmount();
    form.remove();
  });

  test('restores the rendered fallback country for a disallowed initial E.164 value', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US', 'CA'],
        country: 'CA',
        value: '+442079460958',
      },
    });
    const input = nationalInput(rendered.container);

    await waitFor(() => expect(countrySelect(rendered.container).value).toBe('US'));
    await fireEvent.input(input, { target: { value: '4165550123' } });
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(countrySelect(rendered.container).value).toBe('US');
    expect(input.value).toBe('+442079460958');
    rendered.unmount();
    form.remove();
  });
});

describe('PhoneInput hidden form value', () => {
  test('hidden input carries the canonical E.164 string for a valid number', async () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', name: 'phone' },
    });
    await fireEvent.input(nationalInput(container), { target: { value: '4155550132' } });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe('+14155550132');
  });

  test('hidden input does not emit a stale E.164 after country changes externally without a value update', async () => {
    // Regression for cursor/bugbot: if a consumer changes `country` without
    // updating `value`, the prior E.164 belongs to the previous country and
    // must not be submitted under the new selection.
    const { container, rerender } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        name: 'phone',
        countries: ['US', 'GB'],
        country: 'US',
        value: '+14155550132',
      },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe('+14155550132');
    await rerender({
      id: 'p',
      label: 'Phone',
      name: 'phone',
      countries: ['US', 'GB'],
      country: 'GB',
      value: '+14155550132',
    });
    // The stored E.164 still parses as US, but the user is now looking at a
    // GB dropdown — submission must not carry the prior US number through.
    expect(hidden.value).toBe('');
  });

  test('non-strict E.164 value (free-form text) is never forwarded to the hidden input', () => {
    // libphonenumber can extract a phone number from arbitrary text like
    // "call +1 415 555 0132" — the hidden form value must NOT carry such
    // input through unchanged. parseE164Value enforces a strict `^\+\d+$`
    // grammar, so the hidden value should be empty.
    const { container } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        name: 'phone',
        value: 'call +1 415 555 0132',
      },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe('');
  });
});

describe('PhoneInput keyboard tab order', () => {
  test('country select precedes the national input in DOM order', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone' },
    });
    const select = countrySelect(container);
    const input = nationalInput(container);
    // DOCUMENT_POSITION_FOLLOWING (4) means select comes before input.
    expect(select.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
  });

  test('neither control has a tabindex override', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone' },
    });
    expect(countrySelect(container).getAttribute('tabindex')).toBeNull();
    expect(nationalInput(container).getAttribute('tabindex')).toBeNull();
  });
});
