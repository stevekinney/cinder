/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Checkbox } = await import('./checkbox.svelte');
const { default: FormFieldCheckboxFixture } =
  await import('../../test/fixtures/form-field-checkbox-fixture.svelte');

describe('Checkbox', () => {
  test('renders a native input[type=checkbox] with the given id', () => {
    const { container } = render(Checkbox, { id: 'agree' });
    const input = container.querySelector('#agree');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('type')).toBe('checkbox');
  });

  test('resolves a stable id from $props.id() when no id prop is given', () => {
    // resolveFieldControl falls back to the $props.id() generated id; without it a
    // standalone checkbox with no id prop would render id={undefined} and break for=/id=.
    const { container } = render(Checkbox, { label: 'Agree' });
    const input = container.querySelector('input[type="checkbox"]');
    const id = input?.getAttribute('id');
    expect(id).toBeTruthy();
    // The <label> for must point at the same generated id.
    expect(container.querySelector('label')?.getAttribute('for')).toBe(id);
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

describe('Checkbox indicator', () => {
  test('renders exactly one aria-hidden indicator element per checkbox', () => {
    const { container } = render(Checkbox, { id: 'ind' });
    const indicators = container.querySelectorAll('.cinder-checkbox-field__indicator');
    expect(indicators.length).toBe(1);
    expect(indicators[0]!.getAttribute('aria-hidden')).toBe('true');
  });

  test('indicator is a sibling of the input inside the control wrapper', () => {
    const { container } = render(Checkbox, { id: 'ind2' });
    const wrapper = container.querySelector('.cinder-checkbox-field__control');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.querySelector('input#ind2')).not.toBeNull();
    expect(wrapper!.querySelector('.cinder-checkbox-field__indicator')).not.toBeNull();
  });
});

describe('Checkbox — FormField context wiring', () => {
  test('inherits aria-describedby from FormField description', () => {
    const { container } = render(FormFieldCheckboxFixture, {
      props: {
        fieldId: 'agree',
        fieldLabel: 'Agreement',
        fieldDescription: 'Read the terms before proceeding',
      },
    });
    const input = container.querySelector('#agree') as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toBe('agree-description');
  });

  test('inherits aria-invalid and aria-describedby from FormField error', () => {
    const { container } = render(FormFieldCheckboxFixture, {
      props: {
        fieldId: 'agree',
        fieldLabel: 'Agreement',
        fieldError: 'You must agree to continue',
      },
    });
    const input = container.querySelector('#agree') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('agree-error');
  });

  test('inherits disabled state from FormField context', () => {
    const { container } = render(FormFieldCheckboxFixture, {
      props: {
        fieldId: 'agree',
        fieldLabel: 'Agreement',
        disabled: true,
      },
    });
    const input = container.querySelector('#agree') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  test('inherits required state from FormField context (sets the native required attr)', () => {
    const { container } = render(FormFieldCheckboxFixture, {
      props: {
        fieldId: 'agree',
        fieldLabel: 'Agreement',
        required: true,
      },
    });
    const input = container.querySelector('#agree') as HTMLInputElement;
    // A required FormField must make the control actually required for validation + AT,
    // not just show the visual marker.
    expect(input.required).toBe(true);
  });

  test('id wiring: id, label[for], and aria-describedby all use the resolved id', () => {
    const { container } = render(FormFieldCheckboxFixture, {
      props: {
        fieldId: 'agree',
        fieldLabel: 'Agreement',
        fieldDescription: 'Terms',
        checkboxLabel: 'I agree',
      },
    });
    const input = container.querySelector('#agree') as HTMLInputElement;
    const label = container.querySelector('label[for="agree"]');
    expect(input).not.toBeNull();
    expect(label).not.toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe('agree-description');
  });

  test('omitting Checkbox id inherits the FormField controlId (context-inheritance path)', () => {
    // When the Checkbox omits `id`, resolveFieldControl uses the FormField's controlId,
    // so the input id and the FormField's label[for] still agree.
    const { container } = render(FormFieldCheckboxFixture, {
      props: {
        fieldId: 'agree',
        fieldLabel: 'Agreement',
        checkboxLabel: 'I agree',
        inheritId: true,
      },
    });
    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.id).toBe('agree');
    expect(container.querySelector('label[for="agree"]')).not.toBeNull();
  });
});

describe('Checkbox — required marker', () => {
  test('renders the shared required marker on a standalone Checkbox', () => {
    const { container } = render(Checkbox, {
      props: { id: 'req-checkbox', label: 'Agree', required: true },
    });
    const marker = container.querySelector('.cinder-_required-marker');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
    expect(marker?.textContent).toBe('*');
  });
});
