/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Input } = await import('./input.svelte');

describe('Input rendering', () => {
  test('renders with required id prop', () => {
    const { container } = render(Input, {
      props: { id: 'test-input', value: '' },
    });
    const input = container.querySelector('#test-input');
    expect(input).not.toBeNull();
  });

  test('label prop creates a <label> with correct for attribute', () => {
    const { container } = render(Input, {
      props: { id: 'username', value: '', label: 'Username' },
    });
    const label = container.querySelector('label');
    expect(label).not.toBeNull();
    expect(label?.getAttribute('for')).toBe('username');
    expect(label?.textContent?.trim()).toBe('Username');
  });

  test('no <label> element rendered when label prop is omitted', () => {
    const { container } = render(Input, {
      props: { id: 'email', value: '' },
    });
    expect(container.querySelector('label')).toBeNull();
  });

  test('description wires aria-describedby on input', () => {
    const { container } = render(Input, {
      props: { id: 'email', value: '', description: 'We will never share your email.' },
    });
    const input = container.querySelector('#email');
    expect(input?.getAttribute('aria-describedby')).toBe('email-description');
    const descriptionEl = container.querySelector('#email-description');
    expect(descriptionEl).not.toBeNull();
    expect(descriptionEl?.textContent).toContain('We will never share your email.');
  });

  test('error wires aria-invalid="true" on input', () => {
    const { container } = render(Input, {
      props: { id: 'email', value: '', error: 'Enter a valid email address.' },
    });
    const input = container.querySelector('#email');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  test('error wires aria-describedby pointing to error element', () => {
    const { container } = render(Input, {
      props: { id: 'email', value: '', error: 'Enter a valid email address.' },
    });
    const input = container.querySelector('#email');
    expect(input?.getAttribute('aria-describedby')).toBe('email-error');
    const errorEl = container.querySelector('#email-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Enter a valid email address.');
  });

  test('both description and error are listed in aria-describedby', () => {
    const { container } = render(Input, {
      props: {
        id: 'email',
        value: '',
        description: 'Use your work email.',
        error: 'Enter a valid email address.',
      },
    });
    const input = container.querySelector('#email');
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('email-description');
    expect(describedBy).toContain('email-error');
  });

  test('no aria-invalid when error prop is absent', () => {
    const { container } = render(Input, {
      props: { id: 'email', value: '' },
    });
    const input = container.querySelector('#email');
    expect(input?.getAttribute('aria-invalid')).toBeNull();
  });

  test('on user input, bound value updates', async () => {
    const { container } = render(Input, {
      props: { id: 'name', value: '' },
    });
    const input = container.querySelector('#name') as HTMLInputElement;
    expect(input).not.toBeNull();
    await fireEvent.input(input, { target: { value: 'Alice' } });
    // After firing the input event, the native element value should reflect the change.
    expect(input.value).toBe('Alice');
  });

  test('applies class prop alongside cinder-input', () => {
    const { container } = render(Input, {
      props: { id: 'search', value: '', class: 'my-custom-class' },
    });
    const input = container.querySelector('#search');
    expect(input?.classList.contains('cinder-input')).toBe(true);
    expect(input?.classList.contains('my-custom-class')).toBe(true);
  });

  test('disabled prop is forwarded to the input element', () => {
    const { container } = render(Input, {
      props: { id: 'locked', value: '', disabled: true },
    });
    const input = container.querySelector('#locked') as HTMLInputElement;
    expect(input?.disabled).toBe(true);
  });

  test('root wrapper has class cinder-input-field', () => {
    const { container } = render(Input, {
      props: { id: 'field', value: '' },
    });
    expect(container.querySelector('.cinder-input-field')).not.toBeNull();
  });

  test('default type is "text"', () => {
    const { container } = render(Input, {
      props: { id: 'plain', value: '' },
    });
    const input = container.querySelector('#plain');
    expect(input?.getAttribute('type')).toBe('text');
  });

  test('type prop is forwarded to the input element', () => {
    const { container } = render(Input, {
      props: { id: 'pass', value: '', type: 'password' },
    });
    const input = container.querySelector('#pass');
    expect(input?.getAttribute('type')).toBe('password');
  });

  test('rest props are spread onto the input element', () => {
    const { container } = render(Input, {
      props: { id: 'rest', value: '', 'data-testid': 'my-input' },
    });
    expect(container.querySelector('[data-testid="my-input"]')).not.toBeNull();
  });
});
