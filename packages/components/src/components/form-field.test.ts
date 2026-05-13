/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: FormField } = await import('./form-field.svelte');
const { default: FormFieldProbe } = await import('../test/fixtures/form-field-probe.svelte');

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

describe('FormField rendering', () => {
  test('renders a <label> with correct for and id attributes', () => {
    const { container } = render(FormField, {
      props: { id: 'username', label: 'Username', children: emptySnippet },
    });
    const label = container.querySelector('label');
    expect(label).not.toBeNull();
    expect(label?.getAttribute('for')).toBe('username');
    expect(label?.getAttribute('id')).toBe('username-label');
    expect(label?.textContent?.trim()).toBe('Username');
  });

  test('renders description <p> with correct id when description is provided', () => {
    const { container } = render(FormField, {
      props: {
        id: 'email',
        label: 'Email',
        description: 'Use your work email.',
        children: emptySnippet,
      },
    });
    const descriptionEl = container.querySelector('#email-description');
    expect(descriptionEl).not.toBeNull();
    expect(descriptionEl?.textContent).toContain('Use your work email.');
  });

  test('renders error <p> with correct id and aria-live when error is provided', () => {
    const { container } = render(FormField, {
      props: { id: 'email', label: 'Email', error: 'Enter a valid email.', children: emptySnippet },
    });
    const errorEl = container.querySelector('#email-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Enter a valid email.');
    expect(errorEl?.getAttribute('aria-live')).toBe('polite');
  });

  test('does not render description element when description is omitted', () => {
    const { container } = render(FormField, {
      props: { id: 'name', label: 'Name', children: emptySnippet },
    });
    expect(container.querySelector('[id$="-description"]')).toBeNull();
  });

  test('does not render error element when error is omitted', () => {
    const { container } = render(FormField, {
      props: { id: 'name', label: 'Name', children: emptySnippet },
    });
    expect(container.querySelector('[id$="-error"]')).toBeNull();
  });

  test('renders required marker with aria-hidden when required is set', () => {
    const { container } = render(FormField, {
      props: { id: 'name', label: 'Name', required: true, children: emptySnippet },
    });
    const marker = container.querySelector('.cinder-form-field__required');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
  });

  test('does not render required marker when required is false', () => {
    const { container } = render(FormField, {
      props: { id: 'name', label: 'Name', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-form-field__required')).toBeNull();
  });

  test('applies class prop alongside cinder-form-field', () => {
    const { container } = render(FormField, {
      props: { id: 'name', label: 'Name', class: 'custom-class', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-form-field');
    expect(root?.classList.contains('custom-class')).toBe(true);
  });

  test('root wrapper has class cinder-form-field', () => {
    const { container } = render(FormField, {
      props: { id: 'name', label: 'Name', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-form-field')).not.toBeNull();
  });

  test('label has data-disabled attribute when disabled is true', () => {
    const { container } = render(FormField, {
      props: { id: 'name', label: 'Name', disabled: true, children: emptySnippet },
    });
    const label = container.querySelector('label');
    expect(label?.hasAttribute('data-disabled')).toBe(true);
  });

  test('label does not have data-disabled attribute when disabled is false', () => {
    const { container } = render(FormField, {
      props: { id: 'name', label: 'Name', children: emptySnippet },
    });
    const label = container.querySelector('label');
    expect(label?.hasAttribute('data-disabled')).toBe(false);
  });
});

describe('FormField context via probe', () => {
  test('probe reports controlId and labelId', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-control-id')).toBe('test-field');
    expect(probe?.getAttribute('data-label-id')).toBe('test-field-label');
  });

  test('probe reports describedBy as undefined when neither description nor error is set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-described-by')).toBeNull();
  });

  test('probe reports describedBy with description id when description is set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test', description: 'Helper text' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-described-by')).toBe('test-field-description');
  });

  test('probe reports describedBy with error id when error is set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test', error: 'Something went wrong' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-described-by')).toBe('test-field-error');
  });

  test('probe reports describedBy with both ids when description and error are set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test', description: 'Helper', error: 'Broken' },
    });
    const probe = container.querySelector('[data-probe]');
    const describedBy = probe?.getAttribute('data-described-by') ?? '';
    expect(describedBy).toContain('test-field-description');
    expect(describedBy).toContain('test-field-error');
  });

  test('probe reports invalid as "true" when error is set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test', error: 'Error message' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-invalid')).toBe('true');
  });

  test('probe reports invalid as undefined when no error', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-invalid')).toBeNull();
  });

  test('probe reports required as "true" when required is set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test', required: true },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-required')).toBe('true');
  });

  test('probe reports required as undefined when required is not set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-required')).toBeNull();
  });

  test('probe reports disabled as "true" when disabled is set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test', disabled: true },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-disabled')).toBe('true');
  });

  test('probe reports disabled as undefined when disabled is not set', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-disabled')).toBeNull();
  });

  test('labelId in context resolves to an element that exists in the DOM', () => {
    const { container } = render(FormFieldProbe, {
      props: { id: 'test-field', label: 'Test' },
    });
    const probe = container.querySelector('[data-probe]');
    const labelId = probe?.getAttribute('data-label-id');
    expect(labelId).toBe('test-field-label');
    expect(container.querySelector(`#${labelId}`)).not.toBeNull();
  });

  test('reactive update: changing error prop updates describedBy in probe', async () => {
    const { container, rerender } = render(FormFieldProbe, {
      props: { id: 'reactive-field', label: 'Reactive' },
    });
    const probe = container.querySelector('[data-probe]');
    expect(probe?.getAttribute('data-described-by')).toBeNull();

    await rerender({ id: 'reactive-field', label: 'Reactive', error: 'New error' });

    expect(probe?.getAttribute('data-described-by')).toBe('reactive-field-error');
    expect(probe?.getAttribute('data-invalid')).toBe('true');
  });
});
