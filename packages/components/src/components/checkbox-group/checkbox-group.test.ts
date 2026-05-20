/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: CheckboxGroup } = await import('./checkbox-group.svelte');
const { default: Wrapper } = await import('../../test/fixtures/checkbox-group-fixture.svelte');

describe('CheckboxGroup', () => {
  // Test 1: fieldset + legend
  test('renders a <fieldset> with the given legend', () => {
    const { container } = render(Wrapper, {
      legend: 'Notifications',
      options: [
        { id: 'cb-a', name: 'email', label: 'Email' },
        { id: 'cb-b', name: 'sms', label: 'SMS' },
      ],
    });
    expect(container.querySelector('fieldset')).not.toBeNull();
    expect(container.querySelector('legend')?.textContent?.trim()).toBe('Notifications');
  });

  // Test 2: each checkbox keeps its own name (no shared name)
  test('renders one checkbox per option, each keeping its own name', () => {
    const { container } = render(Wrapper, {
      options: [
        { id: 'cb-a', name: 'email', label: 'Email' },
        { id: 'cb-b', name: 'sms', label: 'SMS' },
        { id: 'cb-c', name: 'push', label: 'Push' },
      ],
    });
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    expect(checkboxes.length).toBe(3);
    expect(checkboxes[0]?.getAttribute('name')).toBe('email');
    expect(checkboxes[1]?.getAttribute('name')).toBe('sms');
    expect(checkboxes[2]?.getAttribute('name')).toBe('push');
  });

  // Test 3: description renders with correct id and aria-describedby
  test('description renders with the correct id and is referenced by aria-describedby on the fieldset', () => {
    const { container } = render(Wrapper, {
      description: 'Choose at least one',
      options: [{ id: 'cb-a', name: 'email', label: 'Email' }],
    });
    const fieldset = container.querySelector('fieldset') as HTMLFieldSetElement;
    const describedBy = fieldset.getAttribute('aria-describedby') ?? '';
    // Find the description element
    const descriptionEl = container.querySelector('.cinder-checkbox-group__description');
    expect(descriptionEl).not.toBeNull();
    expect(descriptionEl?.textContent?.trim()).toBe('Choose at least one');
    // The fieldset's aria-describedby must include the description element's id
    expect(descriptionEl?.id).toBeTruthy();
    expect(describedBy.split(' ')).toContain(descriptionEl?.id ?? '');
  });

  // Test 4: error renders with aria-live, contributes id to fieldset, sets aria-invalid
  test('error renders with aria-live="polite", contributes id to aria-describedby, and sets aria-invalid="true" on fieldset', () => {
    const { container } = render(Wrapper, {
      error: 'Select at least one option',
      options: [{ id: 'cb-a', name: 'email', label: 'Email' }],
    });
    const fieldset = container.querySelector('fieldset') as HTMLFieldSetElement;
    const errorEl = container.querySelector('.cinder-checkbox-group__error') as HTMLElement;
    expect(errorEl).not.toBeNull();
    expect(errorEl.getAttribute('aria-live')).toBe('polite');
    expect(errorEl.textContent?.trim()).toBe('Select at least one option');
    expect(fieldset.getAttribute('aria-invalid')).toBe('true');
    const describedBy = fieldset.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toContain(errorEl.id);
  });

  // Test 5: disabled propagates via native fieldset cascade
  test('disabled propagates via native fieldset cascade', () => {
    const { container } = render(Wrapper, {
      disabled: true,
      options: [
        { id: 'cb-a', name: 'email', label: 'Email' },
        { id: 'cb-b', name: 'sms', label: 'SMS' },
      ],
    });
    const fieldset = container.querySelector('fieldset') as HTMLFieldSetElement;
    // The fieldset itself must be disabled — this is the platform contract.
    // happy-dom does not reflect inherited disabled state onto descendant inputs
    // (input.disabled and :disabled both return false even when the parent fieldset
    // is disabled). The descendant cascade is tested at the browser layer.
    expect(fieldset.disabled).toBe(true);
  });

  // Test 6: required attribute rendering — both states
  test('required=true renders data-cinder-required; required=false omits it', () => {
    const { container: c1 } = render(Wrapper, {
      required: true,
      options: [{ id: 'cb-a', name: 'email', label: 'Email' }],
    });
    const fieldsetRequired = c1.querySelector('fieldset') as HTMLFieldSetElement;
    expect(fieldsetRequired.hasAttribute('data-cinder-required')).toBe(true);
    // No child input should have required set
    const inputs1 = Array.from(c1.querySelectorAll('input[type="checkbox"]'));
    inputs1.forEach((input) => {
      expect((input as HTMLInputElement).required).toBe(false);
    });

    const { container: c2 } = render(Wrapper, {
      required: false,
      options: [{ id: 'cb-b', name: 'email', label: 'Email' }],
    });
    const fieldsetNotRequired = c2.querySelector('fieldset') as HTMLFieldSetElement;
    expect(fieldsetNotRequired.hasAttribute('data-cinder-required')).toBe(false);
  });

  // Test 7: variant data attribute always present
  test('data-variant="default" is emitted by default', () => {
    const { container } = render(Wrapper, {
      options: [{ id: 'cb-a', name: 'email', label: 'Email' }],
    });
    const fieldset = container.querySelector('fieldset') as HTMLFieldSetElement;
    expect(fieldset.getAttribute('data-variant')).toBe('default');
  });

  test('data-variant="card" is emitted when variant="card"', () => {
    const { container } = render(Wrapper, {
      variant: 'card',
      options: [{ id: 'cb-a', name: 'email', label: 'Email' }],
    });
    const fieldset = container.querySelector('fieldset') as HTMLFieldSetElement;
    expect(fieldset.getAttribute('data-variant')).toBe('card');
  });

  // Test 8: value export smoke test — import the component directly rather
  // than the full index to avoid triggering compilation of all components.
  test('CheckboxGroup is exported as a function', () => {
    expect(typeof CheckboxGroup).toBe('function');
  });

  // aria-describedby absent when neither description nor error present
  test('aria-describedby is absent when neither description nor error is provided', () => {
    const { container } = render(Wrapper, {
      options: [{ id: 'cb-a', name: 'email', label: 'Email' }],
    });
    const fieldset = container.querySelector('fieldset') as HTMLFieldSetElement;
    expect(fieldset.hasAttribute('aria-describedby')).toBe(false);
  });

  // Both description and error contribute to aria-describedby simultaneously
  test('aria-describedby contains both description and error ids when both are provided', () => {
    const { container } = render(Wrapper, {
      description: 'Choose at least one',
      error: 'Selection required',
      options: [{ id: 'cb-a', name: 'email', label: 'Email' }],
    });
    const fieldset = container.querySelector('fieldset') as HTMLFieldSetElement;
    const descriptionEl = container.querySelector('.cinder-checkbox-group__description');
    const errorEl = container.querySelector('.cinder-checkbox-group__error');
    expect(descriptionEl).not.toBeNull();
    expect(errorEl).not.toBeNull();
    // Assert IDs are non-empty before using them in containment checks,
    // matching the pattern in Test 3. ?. + ?? '' would silently pass if IDs are empty.
    expect(descriptionEl?.id).toBeTruthy();
    expect(errorEl?.id).toBeTruthy();
    const parts = (fieldset.getAttribute('aria-describedby') ?? '').split(' ');
    expect(parts).toContain(descriptionEl!.id);
    expect(parts).toContain(errorEl!.id);
  });

  // Test 9: card variant DOM structure assertion
  test('card variant: items container has correct number of .cinder-checkbox-field children', () => {
    const { container } = render(Wrapper, {
      variant: 'card',
      options: [
        { id: 'cb-a', name: 'email', label: 'Email' },
        { id: 'cb-b', name: 'sms', label: 'SMS' },
        { id: 'cb-c', name: 'push', label: 'Push' },
      ],
    });
    const items = container.querySelector('.cinder-checkbox-group__items');
    expect(items).not.toBeNull();
    const directChildren = Array.from(items?.children ?? []);
    expect(directChildren.length).toBe(3);
    directChildren.forEach((child) => {
      expect(child.classList.contains('cinder-checkbox-field')).toBe(true);
    });
  });

  // Test 10: disabled-label selector contract
  test('disabled fieldset contains .cinder-checkbox-field__label elements as descendants', () => {
    const { container } = render(Wrapper, {
      disabled: true,
      options: [
        { id: 'cb-a', name: 'email', label: 'Email' },
        { id: 'cb-b', name: 'sms', label: 'SMS' },
      ],
    });
    const fieldset = container.querySelector('fieldset') as HTMLFieldSetElement;
    // Fieldset is [disabled]
    expect(fieldset.matches('[disabled]')).toBe(true);
    // Every label element is a descendant of the disabled fieldset
    const labels = Array.from(container.querySelectorAll('.cinder-checkbox-field__label'));
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect(fieldset.contains(label)).toBe(true);
    });
  });
});
