/// <reference lib="dom" />
import { describe, expect, spyOn, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Input } = await import('./input.svelte');
const { default: FormFieldInputFixture } =
  await import('../test/fixtures/form-field-input-fixture.svelte');
const { default: FormFieldIdMismatchFixture } =
  await import('../test/fixtures/form-field-id-mismatch-fixture.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function idsIn(container: Element): string[] {
  return Array.from(container.querySelectorAll('[id]'), (element) => element.id);
}

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
    const descriptionElement = container.querySelector('#email-description');
    expect(descriptionElement).not.toBeNull();
    expect(descriptionElement?.textContent).toContain('We will never share your email.');
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
    const errorElement = container.querySelector('#email-error');
    expect(errorElement).not.toBeNull();
    expect(errorElement?.textContent).toContain('Enter a valid email address.');
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

  test('date type uses the native date input and renders the calendar affordance', () => {
    const { container } = render(Input, {
      props: { id: 'departure', value: '', type: 'date', label: 'Departure date' },
    });
    const input = container.querySelector('#departure');
    expect(input?.getAttribute('type')).toBe('date');
    expect(input?.hasAttribute('data-cinder-native-date')).toBe(true);
    expect(container.querySelector('.cinder-input-group')?.hasAttribute('data-native-date')).toBe(
      true,
    );
    expect(container.querySelector('.cinder-input-group__date-icon')).not.toBeNull();
  });

  test('date type does not replace a custom trailing addon', () => {
    const { container } = render(Input, {
      props: {
        id: 'custom-date',
        value: '',
        type: 'date',
        trailing: textSnippet('UTC'),
      },
    });
    expect(container.querySelector('.cinder-input-group__date-icon')).toBeNull();
    expect(container.querySelector('.cinder-input-group__trailing')?.textContent).toContain('UTC');
  });

  test('rest props are spread onto the input element', () => {
    const { container } = render(Input, {
      props: { id: 'rest', value: '', 'data-testid': 'my-input' },
    });
    expect(container.querySelector('[data-testid="my-input"]')).not.toBeNull();
  });
});

describe('Input context inheritance from FormField', () => {
  test('inherits aria-describedby from FormField context when own description/error are absent', () => {
    const { container } = render(FormFieldInputFixture, {
      props: { fieldId: 'ctx-field', fieldLabel: 'Label', fieldDescription: 'Helper text' },
    });
    const input = container.querySelector('#ctx-field');
    expect(input?.getAttribute('aria-describedby')).toBe('ctx-field-description');
  });

  test('inherits aria-invalid from FormField context when own error is absent', () => {
    const { container } = render(FormFieldInputFixture, {
      props: { fieldId: 'ctx-field', fieldLabel: 'Label', fieldError: 'Something went wrong' },
    });
    const input = container.querySelector('#ctx-field');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  test("own description prop wins over context's description", () => {
    const { container } = render(FormFieldInputFixture, {
      props: {
        fieldId: 'ctx-field',
        fieldLabel: 'Label',
        fieldDescription: 'Field description',
        inputDescription: 'Input description',
      },
    });
    const input = container.querySelector('#ctx-field');
    expect(input?.getAttribute('aria-describedby')).toBe('ctx-field-input-description');
    expect(idsIn(container).filter((id) => id === 'ctx-field-description')).toHaveLength(1);
    expect(idsIn(container).filter((id) => id === 'ctx-field-input-description')).toHaveLength(1);
  });

  test('partial override: Input description + FormField error produces joint aria-describedby', () => {
    const { container } = render(FormFieldInputFixture, {
      props: {
        fieldId: 'ctx-field',
        fieldLabel: 'Label',
        fieldError: 'Field error',
        inputDescription: 'Input helper',
      },
    });
    const input = container.querySelector('#ctx-field');
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('ctx-field-description');
    expect(describedBy).toContain('ctx-field-error');
    expect(idsIn(container).filter((id) => id === 'ctx-field-description')).toHaveLength(1);
    expect(idsIn(container).filter((id) => id === 'ctx-field-input-description')).toHaveLength(0);
    expect(idsIn(container).filter((id) => id === 'ctx-field-error')).toHaveLength(1);
  });

  test('own error prop uses a distinct id when FormField also renders an error', () => {
    const { container } = render(FormFieldInputFixture, {
      props: {
        fieldId: 'ctx-field',
        fieldLabel: 'Label',
        fieldError: 'Field error',
        inputError: 'Input error',
      },
    });
    const input = container.querySelector('#ctx-field');
    expect(input?.getAttribute('aria-describedby')).toBe('ctx-field-input-error');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(idsIn(container).filter((id) => id === 'ctx-field-error')).toHaveLength(1);
    expect(idsIn(container).filter((id) => id === 'ctx-field-input-error')).toHaveLength(1);
  });

  test('inherits required from FormField context when own required is absent', () => {
    const { container } = render(FormFieldInputFixture, {
      props: { fieldId: 'ctx-field', fieldLabel: 'Label', fieldRequired: true },
    });
    const input = container.querySelector('#ctx-field') as HTMLInputElement;
    expect(input?.required).toBe(true);
  });

  test('explicit required={false} overrides context required=true', () => {
    const { container } = render(FormFieldInputFixture, {
      props: {
        fieldId: 'ctx-field',
        fieldLabel: 'Label',
        fieldRequired: true,
        inputRequired: false,
      },
    });
    const input = container.querySelector('#ctx-field') as HTMLInputElement;
    expect(input?.required).toBe(false);
  });

  test('inherits disabled from FormField context when own disabled is absent', () => {
    const { container } = render(FormFieldInputFixture, {
      props: { fieldId: 'ctx-field', fieldLabel: 'Label', fieldDisabled: true },
    });
    const input = container.querySelector('#ctx-field') as HTMLInputElement;
    expect(input?.disabled).toBe(true);
  });

  test('explicit disabled={false} overrides context disabled=true', () => {
    const { container } = render(FormFieldInputFixture, {
      props: {
        fieldId: 'ctx-field',
        fieldLabel: 'Label',
        fieldDisabled: true,
        inputDisabled: false,
      },
    });
    const input = container.querySelector('#ctx-field') as HTMLInputElement;
    expect(input?.disabled).toBe(false);
  });

  test('context error marks grouped input wrapper invalid', () => {
    const { container } = render(FormFieldInputFixture, {
      props: {
        fieldId: 'ctx-field',
        fieldLabel: 'Label',
        fieldError: 'Field error',
        inputLeading: textSnippet('$'),
      },
    });
    expect(container.querySelector('.cinder-input-group')?.getAttribute('data-invalid')).toBe('');
  });

  test('context disabled marks grouped input wrapper disabled', () => {
    const { container } = render(FormFieldInputFixture, {
      props: {
        fieldId: 'ctx-field',
        fieldLabel: 'Label',
        fieldDisabled: true,
        inputLeading: textSnippet('$'),
      },
    });
    expect(container.querySelector('.cinder-input-group')?.getAttribute('data-disabled')).toBe('');
  });

  test('id mismatch fires console.warn', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(FormFieldIdMismatchFixture, {});
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = (warnSpy.mock.calls[0] as string[])[0];
      expect(message).toContain('field-id');
      expect(message).toContain('mismatched-input-id');
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('matching ids do not fire console.warn', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(FormFieldInputFixture, {
        props: { fieldId: 'matching-field', fieldLabel: 'Label' },
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

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

  test('aria-invalid={true} (boolean) via rest props sets data-invalid on group', () => {
    const { container } = render(Input, {
      props: {
        id: 'bool-invalid',
        value: '',
        leading: textSnippet('$'),
        'aria-invalid': true,
      },
    });
    const group = container.querySelector('.cinder-input-group');
    expect(group?.getAttribute('data-invalid')).toBe('');
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
