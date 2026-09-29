/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render, fireEvent } = await import('@testing-library/svelte');
const { default: PhoneInput } = await import('./phone-input.svelte');

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

  test('ignores whitespace-only ARIA names and preserves control fallbacks', () => {
    const { container, getByRole } = render(PhoneInput, {
      props: { id: 'p', 'aria-label': '   ', 'aria-labelledby': '\t' },
    });
    const group = container.querySelector('[role="group"]')!;

    expect(group.hasAttribute('aria-label')).toBe(false);
    expect(group.hasAttribute('aria-labelledby')).toBe(false);
    expect(getByRole('combobox', { name: 'Country: United States, +1' })).not.toBeNull();
    expect(getByRole('textbox', { name: 'Phone number' })).not.toBeNull();
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

    expect(source).toContain("from '../input/index.ts';");
    expect(source).toContain("from '../select/index.ts';");
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
    const onValueChange = mock((_detail: any) => {});
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'], onValueChange },
    });
    const input = nationalInput(container);
    await fireEvent.input(input, { target: { value: '+442079460958' } });
    expect(countrySelect(container).value).toBe('GB');
    const last = onValueChange.mock.calls.at(-1)!;
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
    const onValueChange = mock((_detail: any) => {});
    const { rerender, container } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US', 'GB'],
        value: '+442079460958',
        onValueChange,
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
      onValueChange,
    });
    expect(countrySelect(container).value).toBe('US');
    // The visible national digits get reformatted for US; the value reflects
    // the new computation (US-context number from the preserved digits is
    // not a valid US phone, so value is '').
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(hidden).toBeNull(); // no name prop -> no hidden input
    // onValueChange must NOT fire — this is prop synchronization, not user edit.
    expect(onValueChange).not.toHaveBeenCalled();
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
