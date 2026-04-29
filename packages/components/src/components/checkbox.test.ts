/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Checkbox } = await import('./checkbox.svelte');

describe('Checkbox', () => {
  test('renders a native input[type=checkbox] with the given id', () => {
    const { container } = render(Checkbox, { id: 'agree' });
    const input = container.querySelector('#agree');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('type')).toBe('checkbox');
  });

  test('label prop creates a <label> with for attribute', () => {
    const { container } = render(Checkbox, {
      id: 'tos',
      label: 'I agree to the terms',
    });
    const label = container.querySelector('label');
    expect(label?.getAttribute('for')).toBe('tos');
    expect(label?.textContent?.trim()).toBe('I agree to the terms');
  });

  test('checked prop is reflected on the input', () => {
    const { container } = render(Checkbox, { id: 'c', checked: true });
    const input = container.querySelector('#c') as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  test('disabled prop forwards to the input', () => {
    const { container } = render(Checkbox, { id: 'c', disabled: true });
    const input = container.querySelector('#c') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  test('description wires aria-describedby pointing to the description element', () => {
    const { container } = render(Checkbox, {
      id: 'c',
      description: 'Newsletter',
    });
    const input = container.querySelector('#c');
    expect(input?.getAttribute('aria-describedby')).toBe('c-description');
    expect(container.querySelector('#c-description')).not.toBeNull();
  });

  test('error sets aria-invalid="true" and adds the error id to aria-describedby', () => {
    const { container } = render(Checkbox, {
      id: 'c',
      error: 'Required',
    });
    const input = container.querySelector('#c');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe('c-error');
    expect(container.querySelector('#c-error')).not.toBeNull();
  });

  test('description and error both appear in aria-describedby', () => {
    const { container } = render(Checkbox, {
      id: 'c',
      description: 'Optional',
      error: 'Required',
    });
    const input = container.querySelector('#c');
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('c-description');
    expect(describedBy).toContain('c-error');
  });

  test('user click toggles bound checked', async () => {
    const { container } = render(Checkbox, { id: 'c', checked: false });
    const input = container.querySelector('#c') as HTMLInputElement;
    expect(input.checked).toBe(false);
    await fireEvent.click(input);
    expect(input.checked).toBe(true);
  });

  test('indeterminate prop applies as a DOM property', () => {
    const { container } = render(Checkbox, {
      id: 'c',
      checked: false,
      indeterminate: true,
    });
    const input = container.querySelector('#c') as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
  });

  test('indeterminate is suppressed when checked is true', () => {
    const { container } = render(Checkbox, {
      id: 'c',
      checked: true,
      indeterminate: true,
    });
    const input = container.querySelector('#c') as HTMLInputElement;
    expect(input.indeterminate).toBe(false);
  });

  test('rest props (e.g. name, value) are spread onto the input', () => {
    const { container } = render(Checkbox, {
      id: 'agree',
      name: 'agreement',
      value: 'yes',
    });
    const input = container.querySelector('#agree') as HTMLInputElement;
    expect(input.name).toBe('agreement');
    expect(input.value).toBe('yes');
  });

  test('class prop merges with cinder-checkbox', () => {
    const { container } = render(Checkbox, {
      id: 'c',
      class: 'extra',
    });
    const input = container.querySelector('#c') as HTMLInputElement;
    expect(input.classList.contains('cinder-checkbox')).toBe(true);
    expect(input.classList.contains('extra')).toBe(true);
  });
});
