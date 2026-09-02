/// <reference lib="dom" />
import { describe, expect, spyOn, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { injectStrippedStyles } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Input } = await import('./input.svelte');
const { default: InputFormResetFixture } =
  await import('../../test/fixtures/input-form-reset-fixture.svelte');
const { default: FormFieldInputFixture } =
  await import('../../test/fixtures/form-field-input-fixture.svelte');
const { default: FormFieldIdMismatchFixture } =
  await import('../../test/fixtures/form-field-id-mismatch-fixture.svelte');
const { default: InputAddonToggleFixture } =
  await import('../../test/fixtures/input-addon-toggle-fixture.svelte');

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
  test('keeps leading addons close to the input value', async () => {
    const css = await Bun.file(new URL('./input.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-input-group--leading > \.cinder-input\s*\{[^}]*padding-inline-start:\s*var\(--cinder-space-1\);/,
    );
    expect(css).toMatch(
      /\.cinder-input-group__leading,[\s\S]*?padding-inline-end:\s*var\(--cinder-space-1\);/,
    );
  });

  test('code variant applies shared monospace metrics via the token set', async () => {
    const css = await Bun.file(new URL('./input.css', import.meta.url)).text();

    expect(css).toMatch(
      /\.cinder-input\[data-cinder-variant='code'\]\s*\{[^}]*font-family:\s*var\(--cinder-font-mono\);[^}]*font-size:\s*var\(--cinder-text-sm\);[^}]*line-height:\s*var\(--cinder-leading-normal\);[^}]*tab-size:\s*var\(--cinder-type-tab-size\);/,
    );
  });

  test('code variant does NOT apply monospace metrics to the field wrapper itself — only the control and the lock rule below get them', async () => {
    // The field wrapper hosts the label, description, error, and any
    // addons — none of those should go mono. Only .cinder-input (the
    // control) and the inherit-lock rule (for a hypothetical <code>
    // overlay) carry the metric values; the bare wrapper selector must not.
    const css = await Bun.file(new URL('./input.css', import.meta.url)).text();

    expect(css).not.toMatch(
      /\.cinder-input-field\[data-cinder-variant='code'\]\s*\{[^}]*font-family:/,
    );
  });

  test('code variant locks any inner <code> element to the SAME explicit metrics as the control, excluding addon slots', async () => {
    // <input> is a void element and can never host a <code> descendant, so
    // the inherit-lock rule is scoped to the field wrapper, not .cinder-input.
    // It declares the same explicit font-family/size/line-height/tab-size
    // as the control (not `font: inherit`) so a future overlay <code>
    // matches the control without the wrapper itself needing to carry any
    // metric declarations — the wrapper's label/description/error/addons
    // stay in their ordinary font. It excludes the leading/trailing addon
    // slots so a consumer's own addon content (e.g. a <code> badge) keeps
    // its own styling.
    const css = await Bun.file(new URL('./input.css', import.meta.url)).text();

    expect(css).toMatch(
      /\.cinder-input-field\[data-cinder-variant='code'\]\s*:where\(code\):not\(\s*\.cinder-input-group__leading,\s*\.cinder-input-group__leading \*,\s*\.cinder-input-group__trailing,\s*\.cinder-input-group__trailing \*\s*\)\s*\{\s*all:\s*unset;[^}]*font-family:\s*var\(--cinder-font-mono\);[^}]*font-size:\s*var\(--cinder-text-sm\);[^}]*line-height:\s*var\(--cinder-leading-normal\);[^}]*tab-size:\s*var\(--cinder-type-tab-size\);\s*\}/,
    );
  });

  test('code variant propagates data-cinder-variant onto the field wrapper', () => {
    const { container } = render(Input, {
      props: { id: 'pattern', value: '', label: 'Pattern', variant: 'code' },
    });
    const field = container.querySelector('.cinder-input-field');

    expect(field?.getAttribute('data-cinder-variant')).toBe('code');
  });

  test('code variant does not reset a <code> element rendered inside a leading/trailing addon', () => {
    const { container } = render(Input, {
      props: {
        id: 'amount',
        value: '',
        label: 'Amount',
        variant: 'code',
        leading: createRawSnippet(() => ({
          render: () => '<span><code class="my-addon-code">USD</code></span>',
        })),
      },
    });

    const addonCode = container.querySelector('.cinder-input-group__leading code');
    expect(addonCode).not.toBeNull();
    expect(addonCode?.classList.contains('my-addon-code')).toBe(true);
  });

  test('standalone FormField presentation is included by the Input sidecar', async () => {
    const css = await Bun.file(new URL('./input.css', import.meta.url)).text();

    expect(css).toContain("@import '../form-field/form-field.css';");

    const { container } = render(Input, {
      props: {
        id: 'styled-field',
        label: 'Name',
        description: 'Shown below',
        error: 'Required',
        required: true,
        disabled: true,
        value: '',
      },
    });

    expect(container.querySelector('.cinder-form-field__label')).not.toBeNull();
    expect(container.querySelector('.cinder-form-field__description')).not.toBeNull();
    expect(container.querySelector('.cinder-form-field__error')).not.toBeNull();
    expect(
      container.querySelector('.cinder-form-field__label')?.hasAttribute('data-disabled'),
    ).toBe(true);
    expect(container.querySelector('.cinder-_required-marker')).not.toBeNull();
  });

  test('attaches the native input and cleans up on unmount', () => {
    let attachedInput: HTMLInputElement | undefined;
    let cleanupCalls = 0;

    const { unmount } = render(Input, {
      props: {
        id: 'attached-input',
        value: '',
        inputAttachment: (node: HTMLInputElement) => {
          attachedInput = node;
          return () => {
            cleanupCalls += 1;
          };
        },
      },
    });

    expect(attachedInput).toBeInstanceOf(HTMLInputElement);
    expect(attachedInput?.id).toBe('attached-input');

    unmount();

    expect(cleanupCalls).toBe(1);
  });

  test('preserves native event and ARIA forwarding with an attachment', async () => {
    let calls = 0;
    const { container } = render(Input, {
      props: {
        id: 'attached-forwarding',
        value: '',
        inputAttachment: () => {},
        'aria-label': 'Search records',
        oninput: () => {
          calls += 1;
        },
      },
    });
    const input = container.querySelector('#attached-forwarding') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe('Search records');
    await fireEvent.input(input, { target: { value: 'records' } });
    expect(calls).toBe(1);
  });

  test('marks its root as a full-width layout participant', () => {
    const { container } = render(Input, { props: { id: 'name', value: '' } });

    expect(
      container.querySelector('.cinder-input-field')?.hasAttribute('data-cinder-full-width'),
    ).toBe(true);
  });

  test('defaults to variant="default"', () => {
    const { container } = render(Input, { props: { id: 'name', value: '' } });
    const input = container.querySelector('#name') as HTMLInputElement;

    expect(input.getAttribute('data-cinder-variant')).toBe('default');
  });

  test('variant="code" sets data-cinder-variant="code" on the input', () => {
    const { container } = render(Input, {
      props: { id: 'pattern', value: '', variant: 'code' },
    });
    const input = container.querySelector('#pattern') as HTMLInputElement;

    expect(input.getAttribute('data-cinder-variant')).toBe('code');
  });

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

  test('labelVisible={false} keeps label in the DOM, applies sr-only class, and preserves label association', () => {
    const { container } = render(Input, {
      props: { id: 'demo-token', value: '', label: 'Demo token', labelVisible: false },
    });
    const label = container.querySelector('label[for="demo-token"]');
    const input = container.querySelector('#demo-token') as HTMLInputElement;
    expect(label).not.toBeNull();
    expect(label?.classList.contains('cinder-sr-only')).toBe(true);
    expect(input.labels?.[0]?.getAttribute('for')).toBe('demo-token');
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

  test('labelVisible={false} does not change description/error aria-describedby wiring', () => {
    const { container } = render(Input, {
      props: {
        id: 'hidden-label-described',
        value: '',
        label: 'Demo token',
        labelVisible: false,
        description: 'Paste your invite token.',
        error: 'Token is invalid.',
      },
    });
    const input = container.querySelector('#hidden-label-described');
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('hidden-label-described-description');
    expect(describedBy).toContain('hidden-label-described-error');
  });

  test('the error live region is mounted before any error is set (CIN-315: FormFieldFrame defaults to errorMountedOnDemand=false)', () => {
    // Input wraps FormFieldFrame in `{#if label || description || error}` (a
    // separate known limitation, not fixed here), so a label is required for
    // FormFieldFrame to render at all in this test.
    const { container } = render(Input, {
      props: { id: 'no-error-yet', label: 'Name', value: '' },
    });
    expect(container.querySelector('.cinder-form-field__error')).not.toBeNull();
  });

  test('the errorless live region has no layout footprint (shared _form-field-error.css, CIN-315 follow-up)', async () => {
    const inputCss = await Bun.file(new URL('./input.css', import.meta.url)).text();
    const sharedErrorCss = await Bun.file(
      new URL('../../styles/components/_form-field-error.css', import.meta.url),
    ).text();
    const removeStyles = injectStrippedStyles(inputCss, sharedErrorCss);
    try {
      const { container } = render(Input, {
        props: { id: 'no-error-computed', label: 'Name', value: '' },
      });
      const errorRegion = container.querySelector('.cinder-form-field__error');
      expect(errorRegion).not.toBeNull();
      const computed = getComputedStyle(errorRegion as Element);
      // Sr-only pattern (CIN-315 review follow-up), not visibility:hidden —
      // visibility:hidden removes an element from the accessibility tree
      // (navigation-bar.a11y.md), which would defeat the announcement fix.
      expect(computed.position).toBe('absolute');
      expect(computed.visibility).not.toBe('hidden');
      expect(computed.display).not.toBe('none');
      expect(computed.clip).toBe('rect(0, 0, 0, 0)');
    } finally {
      removeStyles();
    }
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

  test('onValueChangeRequest can transform the proposed value before it is written', async () => {
    const { container } = render(Input, {
      props: { id: 'name', value: '', onValueChangeRequest: (next: string) => next.toUpperCase() },
    });
    const input = container.querySelector('#name') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'Alice' } });

    expect(input.value).toBe('ALICE');
  });

  test('onValueChangeRequest can veto the native edit and re-sync the input value', async () => {
    const { container } = render(Input, {
      props: { id: 'name', value: 'Alice', onValueChangeRequest: () => 'Alice' },
    });
    const input = container.querySelector('#name') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'Alice!' } });

    expect(input.value).toBe('Alice');
  });

  test('consumer oninput runs without replacing the bindable update path', async () => {
    let calls = 0;
    const { container } = render(Input, {
      props: {
        id: 'name',
        value: '',
        oninput: () => {
          calls += 1;
        },
      },
    });
    const input = container.querySelector('#name') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'Alice' } });

    expect(input.value).toBe('Alice');
    expect(calls).toBe(1);
  });

  test('native form reset syncs the bindable value', async () => {
    const { container, getByTestId } = render(InputFormResetFixture, {
      props: {
        inputAttachment: () => {},
      },
    });
    const input = container.querySelector('#name') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'Bob' } });
    expect(getByTestId('value').textContent).toBe('Bob');

    (getByTestId('form') as HTMLFormElement).reset();

    await waitFor(() => expect(getByTestId('value').textContent).toBe(''));
    expect(input.value).toBe('');
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

  test('number type renders a native number input without group affordances', () => {
    const { container } = render(Input, {
      props: { id: 'quantity', value: '', type: 'number', label: 'Quantity' },
    });
    const input = container.querySelector('#quantity');
    expect(input?.getAttribute('type')).toBe('number');
    expect(input?.hasAttribute('data-cinder-native-date')).toBe(false);
    expect(container.querySelector('.cinder-input-group')).toBeNull();
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
    const input = container.querySelector('#custom-date');
    expect(input?.hasAttribute('data-cinder-native-date')).toBe(false);
    expect(container.querySelector('.cinder-input-group')?.hasAttribute('data-native-date')).toBe(
      false,
    );
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
    // The Input's own description gets a distinct namespaced id and is listed
    // first; the FormField's context description id is still composed in (the
    // FormField renders that element, so it must remain referenced). This
    // matches Textarea/Select — Input previously dropped the context id, the
    // outlier behavior the shared resolver migration corrects.
    expect(input?.getAttribute('aria-describedby')).toBe(
      'ctx-field-input-description ctx-field-description',
    );
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
    // Own error id first, context error id composed in second — both elements
    // exist (Input renders its own error <p>, FormField renders its error <p>),
    // so both must be referenced. Mirrors Textarea's contract.
    expect(input?.getAttribute('aria-describedby')).toBe('ctx-field-input-error ctx-field-error');
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

  test('without addons the input sits in a boxless host, not a group', async () => {
    const { container } = render(Input, {
      props: { id: 'hosted', value: '' },
    });
    const host = container.querySelector('.cinder-input-host');
    expect(host).not.toBeNull();
    expect(host?.classList.contains('cinder-input-group')).toBe(false);
    const hostedInputs = Array.from(host?.children ?? []).filter((child) =>
      child.matches('input.cinder-input'),
    );
    expect(hostedInputs).toHaveLength(1);
    // The host is the frame's direct child and carries the full-width marker,
    // which is what access-gate.css's
    // `:has(> .cinder-form-field > [data-cinder-full-width])` keys on.
    expect(host?.parentElement?.classList.contains('cinder-form-field')).toBe(true);
    expect(host?.hasAttribute('data-cinder-full-width')).toBe(true);

    const css = await Bun.file(new URL('./input.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-input-host\s*\{[^}]*display:\s*contents;[^}]*border-color:\s*var\(--cinder-border\);[^}]*\}/,
    );
    // The host and the group are the same element, so the group's border-color
    // transition would otherwise run from `currentcolor` when an addon appears.
    expect(css).toMatch(
      /\.cinder-input-host\[data-invalid\]\s*\{[^}]*border-color:\s*var\(--cinder-status-danger-solid\);/,
    );
    expect(css).toMatch(
      /\.cinder-input-host\[data-disabled\]\s*\{[^}]*border-color:\s*var\(--cinder-border-muted\);/,
    );
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
    expect(leadingSpan?.classList.contains('cinder-_truncate')).toBe(true);
    expect(trailingSpan?.classList.contains('cinder-_truncate')).toBe(true);
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
    expect(leadingSpan?.classList.contains('cinder-_truncate')).toBe(false);
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
    expect(trailingSpan?.classList.contains('cinder-_truncate')).toBe(false);
  });

  test('groupClassName applies to the grouped control frame', () => {
    const { container } = render(Input, {
      props: {
        id: 'group-class',
        value: '',
        trailing: textSnippet('USD'),
        groupClassName: 'custom-group',
      },
    });

    expect(container.querySelector('.cinder-input-group.custom-group')).not.toBeNull();
    expect(container.querySelector('input.custom-group')).toBeNull();
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

describe('Input — required marker', () => {
  test('renders the shared required marker on a standalone (no FormField) Input', () => {
    const { container } = render(Input, {
      props: { id: 'req-input', value: '', label: 'Name', required: true },
    });
    const marker = container.querySelector('.cinder-_required-marker');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
    expect(marker?.textContent).toBe('*');
  });

  test('omits the marker when not required', () => {
    const { container } = render(Input, {
      props: { id: 'opt-input', value: '', label: 'Name' },
    });
    expect(container.querySelector('.cinder-_required-marker')).toBeNull();
  });
});

describe('Input keeps its native element across addon toggles', () => {
  const hosts = ['bare', 'field', 'field-with-own-label'] as const;

  function nativeInput(container: Element): HTMLInputElement {
    const inputs = container.querySelectorAll<HTMLInputElement>('input.cinder-input');
    // Exactly one, not just "the first": under happy-dom a torn-down `{#if}`
    // arm can leave its nodes connected, so an identity check alone would pass
    // against the stale element while a second, freshly created <input> sits
    // beside it. (A real browser removes the old arm and recreates the input;
    // the Vite-served Playwright probe in the PR is the authoritative check.)
    expect(inputs).toHaveLength(1);
    const input = inputs[0];
    if (!input) throw new Error('expected the native <input> to be rendered');
    return input;
  }

  test('control: a rerender that touches no addon keeps the same element', async () => {
    // Proves the harness first: if `rerender` remounted the tree, every
    // identity assertion below would fail for a reason that has nothing to do
    // with Input, and a green run after the fix would prove nothing.
    const { container, rerender } = render(InputAddonToggleFixture, {
      props: { id: 'control', host: 'bare' },
    });
    const before = nativeInput(container);
    await rerender({ error: 'Required' });
    expect(container.querySelector('.cinder-input-field__error')?.textContent).toContain(
      'Required',
    );
    expect(nativeInput(container)).toBe(before);
  });

  for (const host of hosts) {
    test(`${host}: toggling trailing on and off keeps the same <input>`, async () => {
      const { container, rerender } = render(InputAddonToggleFixture, {
        props: { id: `trailing-${host}`, host },
      });
      const before = nativeInput(container);
      expect(container.querySelector('.cinder-input-group')).toBeNull();

      await rerender({ trailing: textSnippet('.com') });
      expect(container.querySelector('.cinder-input-group')).not.toBeNull();
      expect(container.querySelector('.cinder-input-group__trailing')?.textContent).toContain(
        '.com',
      );
      expect(nativeInput(container)).toBe(before);

      await rerender({ trailing: undefined });
      expect(container.querySelector('.cinder-input-group')).toBeNull();
      expect(nativeInput(container)).toBe(before);
    });

    test(`${host}: toggling leading on and off keeps the same <input>`, async () => {
      const { container, rerender } = render(InputAddonToggleFixture, {
        props: { id: `leading-${host}`, host },
      });
      const before = nativeInput(container);

      await rerender({ leading: textSnippet('https://') });
      expect(container.querySelector('.cinder-input-group__leading')?.textContent).toContain(
        'https://',
      );
      expect(nativeInput(container)).toBe(before);

      await rerender({ leading: undefined });
      expect(container.querySelector('.cinder-input-group')).toBeNull();
      expect(nativeInput(container)).toBe(before);
    });

    test(`${host}: switching type to date (which adds the calendar affordance) keeps the same <input>`, async () => {
      const { container, rerender } = render(InputAddonToggleFixture, {
        props: { id: `date-${host}`, host },
      });
      const before = nativeInput(container);

      await rerender({ type: 'date' });
      expect(container.querySelector('.cinder-input-group__date-icon')).not.toBeNull();
      expect(nativeInput(container)).toBe(before);

      await rerender({ type: 'text' });
      expect(container.querySelector('.cinder-input-group')).toBeNull();
      expect(nativeInput(container)).toBe(before);
    });
  }

  test('focus and the selection range survive the trailing addon appearing', async () => {
    const { container, rerender } = render(InputAddonToggleFixture, {
      props: { id: 'selection', host: 'bare' },
    });
    const input = nativeInput(container);
    input.focus();
    input.setSelectionRange(2, 5);
    expect(document.activeElement).toBe(input);

    await rerender({ trailing: textSnippet('.com') });
    expect(nativeInput(container)).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(5);
  });
});
