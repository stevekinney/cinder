/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

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

/** Build a minimal Svelte snippet that renders a text node inside a span. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

describe('Input group (leading/trailing addons)', () => {
  test('no group wrapper when no addons provided', () => {
    const { container } = render(Input, {
      props: { id: 'plain', value: '' },
    });
    expect(container.querySelector('.cinder-input-group')).toBeNull();
    expect(container.querySelector('.cinder-input')).not.toBeNull();
  });

  test('group with leading only — wrapper has data-leading, leading span present, trailing absent', () => {
    const { container } = render(Input, {
      props: {
        id: 'leading-only',
        value: '',
        leading: textSnippet('$'),
      },
    });
    const group = container.querySelector('.cinder-input-group');
    expect(group).not.toBeNull();
    expect(group?.hasAttribute('data-leading')).toBe(true);
    expect(group?.hasAttribute('data-trailing')).toBe(false);
    expect(container.querySelector('.cinder-input-group__leading')).not.toBeNull();
    expect(container.querySelector('.cinder-input-group__trailing')).toBeNull();
  });

  test('group with trailing only — wrapper has data-trailing, trailing span present, leading absent', () => {
    const { container } = render(Input, {
      props: {
        id: 'trailing-only',
        value: '',
        trailing: textSnippet('USD'),
      },
    });
    const group = container.querySelector('.cinder-input-group');
    expect(group).not.toBeNull();
    expect(group?.hasAttribute('data-trailing')).toBe(true);
    expect(group?.hasAttribute('data-leading')).toBe(false);
    expect(container.querySelector('.cinder-input-group__trailing')).not.toBeNull();
    expect(container.querySelector('.cinder-input-group__leading')).toBeNull();
  });

  test('group with both addons — both spans present, input inside group', () => {
    const { container } = render(Input, {
      props: {
        id: 'both-addons',
        value: '',
        leading: textSnippet('$'),
        trailing: textSnippet('.00'),
      },
    });
    const group = container.querySelector('.cinder-input-group');
    expect(group).not.toBeNull();
    expect(container.querySelector('.cinder-input-group__leading')).not.toBeNull();
    expect(container.querySelector('.cinder-input-group__trailing')).not.toBeNull();
    expect(container.querySelector('.cinder-input-group > .cinder-input')).not.toBeNull();
  });

  test('decorative addon containers have aria-hidden="true" by default', () => {
    const { container } = render(Input, {
      props: {
        id: 'decorative',
        value: '',
        leading: textSnippet('$'),
        trailing: textSnippet('USD'),
      },
    });
    const leadingSpan = container.querySelector('.cinder-input-group__leading');
    const trailingSpan = container.querySelector('.cinder-input-group__trailing');
    expect(leadingSpan?.getAttribute('aria-hidden')).toBe('true');
    expect(trailingSpan?.getAttribute('aria-hidden')).toBe('true');
  });

  test('leadingInteractive=true omits aria-hidden on leading container', () => {
    const { container } = render(Input, {
      props: {
        id: 'interactive-leading',
        value: '',
        leading: textSnippet('icon'),
        leadingInteractive: true,
      },
    });
    const leadingSpan = container.querySelector('.cinder-input-group__leading');
    expect(leadingSpan?.hasAttribute('aria-hidden')).toBe(false);
  });

  test('trailingInteractive=true omits aria-hidden on trailing container', () => {
    const { container } = render(Input, {
      props: {
        id: 'interactive-trailing',
        value: '',
        trailing: textSnippet('clear'),
        trailingInteractive: true,
      },
    });
    const trailingSpan = container.querySelector('.cinder-input-group__trailing');
    expect(trailingSpan?.hasAttribute('aria-hidden')).toBe(false);
  });

  test('error prop sets data-invalid on group; inner input has aria-invalid="true"', () => {
    const { container } = render(Input, {
      props: {
        id: 'invalid-group',
        value: '',
        leading: textSnippet('$'),
        error: 'Amount is required.',
      },
    });
    const group = container.querySelector('.cinder-input-group');
    expect(group?.getAttribute('data-invalid')).toBe('');
    const input = container.querySelector('#invalid-group');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  test('aria-invalid="true" via rest props (no error prop) sets data-invalid on group', () => {
    const { container } = render(Input, {
      props: {
        id: 'restprop-invalid',
        value: '',
        leading: textSnippet('$'),
        'aria-invalid': 'true',
      },
    });
    const group = container.querySelector('.cinder-input-group');
    expect(group?.getAttribute('data-invalid')).toBe('');
    const input = container.querySelector('#restprop-invalid');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  test('aria-invalid with non-"true" value does NOT set data-invalid on group', () => {
    const { container } = render(Input, {
      props: {
        id: 'grammar-invalid',
        value: '',
        leading: textSnippet('$'),
        'aria-invalid': 'grammar',
      },
    });
    const group = container.querySelector('.cinder-input-group');
    expect(group?.hasAttribute('data-invalid')).toBe(false);
  });

  test('disabled prop sets data-disabled on group; inner input is disabled', () => {
    const { container } = render(Input, {
      props: {
        id: 'disabled-group',
        value: '',
        trailing: textSnippet('USD'),
        disabled: true,
      },
    });
    const group = container.querySelector('.cinder-input-group');
    expect(group?.getAttribute('data-disabled')).toBe('');
    const input = container.querySelector('#disabled-group') as HTMLInputElement;
    expect(input?.disabled).toBe(true);
  });

  test('bind:value works inside group', async () => {
    const { container } = render(Input, {
      props: {
        id: 'grouped-value',
        value: '',
        leading: textSnippet('$'),
      },
    });
    const input = container.querySelector('#grouped-value') as HTMLInputElement;
    expect(input).not.toBeNull();
    await fireEvent.input(input, { target: { value: '42' } });
    expect(input.value).toBe('42');
  });

  test('aria-describedby still wires description and error ids when grouped', () => {
    const { container } = render(Input, {
      props: {
        id: 'grouped-described',
        value: '',
        leading: textSnippet('$'),
        description: 'Enter amount.',
        error: 'Amount is required.',
      },
    });
    const input = container.querySelector('#grouped-described');
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('grouped-described-description');
    expect(describedBy).toContain('grouped-described-error');
  });
});
