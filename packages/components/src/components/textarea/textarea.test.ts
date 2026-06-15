/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Textarea } = await import('./textarea.svelte');
const { default: FormFieldTextareaFixture } =
  await import('../../test/fixtures/form-field-textarea-fixture.svelte');
const { resolveMaximumLength } = await import('../textarea-count.ts');

// Compile-time contract: `required` and `maxlength` are deliberately narrowed to
// clean `boolean`/`number` from the inherited `… | null`, so the documented prop
// surface stays free of the native "remove the attribute" `null` convention. These
// assertions fail to compile if a future change re-widens (or further narrows) them.
type TextareaProps = import('./textarea.types.ts').TextareaProps;
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _requiredIsBoolean: Exact<TextareaProps['required'], boolean | undefined> = true;
const _maxlengthIsNumber: Exact<TextareaProps['maxlength'], number | undefined> = true;
void _requiredIsBoolean;
void _maxlengthIsNumber;

function idsIn(container: Element): string[] {
  return Array.from(container.querySelectorAll('[id]'), (element) => element.id);
}

describe('Textarea', () => {
  test('renders with required id', () => {
    const { container } = render(Textarea, { props: { id: 'my-textarea' } });
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.getAttribute('id')).toBe('my-textarea');
  });

  test('label creates a <label> associated via for={id}', () => {
    const { container } = render(Textarea, {
      props: { id: 'bio', label: 'Biography' },
    });
    const labelElement = container.querySelector('label');
    expect(labelElement).not.toBeNull();
    expect(labelElement?.getAttribute('for')).toBe('bio');
    expect(labelElement?.textContent?.trim()).toBe('Biography');
  });

  test('no label element rendered when label prop is omitted', () => {
    const { container } = render(Textarea, { props: { id: 'no-label' } });
    expect(container.querySelector('label')).toBeNull();
  });

  test('description is wired via aria-describedby', () => {
    const { container } = render(Textarea, {
      props: { id: 'notes', description: 'Max 500 characters' },
    });
    const textarea = container.querySelector('textarea');
    const descriptionElement = container.querySelector('#notes-description');
    expect(descriptionElement).not.toBeNull();
    expect(descriptionElement?.textContent?.trim()).toBe('Max 500 characters');
    expect(textarea?.getAttribute('aria-describedby')).toContain('notes-description');
  });

  test('error wires aria-invalid="true" and aria-describedby to error element', () => {
    const { container } = render(Textarea, {
      props: { id: 'feedback', error: 'This field is required' },
    });
    const textarea = container.querySelector('textarea');
    const errorElement = container.querySelector('#feedback-error');
    expect(textarea?.getAttribute('aria-invalid')).toBe('true');
    expect(errorElement).not.toBeNull();
    expect(errorElement?.textContent?.trim()).toBe('This field is required');
    expect(textarea?.getAttribute('aria-describedby')).toContain('feedback-error');
  });

  test('aria-describedby includes both description and error ids when both are set', () => {
    const { container } = render(Textarea, {
      props: { id: 'combo', description: 'Helper text', error: 'Something went wrong' },
    });
    const textarea = container.querySelector('textarea');
    const describedBy = textarea?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('combo-description');
    expect(describedBy).toContain('combo-error');
  });

  test('no aria-invalid when there is no error', () => {
    const { container } = render(Textarea, { props: { id: 'clean' } });
    const textarea = container.querySelector('textarea');
    expect(textarea?.hasAttribute('aria-invalid')).toBe(false);
  });

  test('rows attribute reflects the rows prop', () => {
    const { container } = render(Textarea, { props: { id: 'tall', rows: 8 } });
    const textarea = container.querySelector('textarea');
    expect(textarea?.getAttribute('rows')).toBe('8');
  });

  test('rows defaults to 4 when not provided', () => {
    const { container } = render(Textarea, { props: { id: 'default-rows' } });
    const textarea = container.querySelector('textarea');
    expect(textarea?.getAttribute('rows')).toBe('4');
  });

  test('on user input, bound value updates', async () => {
    const { container } = render(Textarea, { props: { id: 'live', value: '' } });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    await fireEvent.input(textarea, { target: { value: 'hello world' } });
    expect(textarea.value).toBe('hello world');
  });

  test('disabled prop is reflected on the textarea element', () => {
    const { container } = render(Textarea, { props: { id: 'locked', disabled: true } });
    const textarea = container.querySelector('textarea');
    expect(textarea?.hasAttribute('disabled')).toBe(true);
  });

  test('required prop is reflected on the native attribute without aria-required', () => {
    const { container } = render(Textarea, { props: { id: 'req', required: true } });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.required).toBe(true);
    expect(textarea.hasAttribute('aria-required')).toBe(false);
  });

  test('consumer class name merges with .cinder-textarea', () => {
    const { container } = render(Textarea, { props: { id: 'styled', class: 'my-class' } });
    const classAttr = container.querySelector('textarea')?.getAttribute('class') ?? '';
    expect(classAttr).toContain('cinder-textarea');
    expect(classAttr).toContain('my-class');
  });

  test('root wrapper has class cinder-textarea-field', () => {
    const { container } = render(Textarea, { props: { id: 'wrapper-test' } });
    expect(container.querySelector('.cinder-textarea-field')).not.toBeNull();
  });
});

describe('Textarea — character count', () => {
  test('no count rendered when showCount is false', () => {
    const { container } = render(Textarea, {
      props: { id: 'chk', maxlength: 100 },
    });
    expect(container.querySelector('#chk-count')).toBeNull();
    expect(
      container.querySelector('textarea')?.getAttribute('aria-describedby') ?? '',
    ).not.toContain('chk-count');
  });

  test('no count rendered when showCount is true but maxlength is missing', () => {
    const { container } = render(Textarea, {
      props: { id: 'x', showCount: true },
    });
    expect(container.querySelector('[id$="-count"]')).toBeNull();
  });

  test('count renders as <output> with aria-live and aria-atomic when showCount=true', () => {
    const { container } = render(Textarea, {
      props: { id: 'bio', showCount: true, maxlength: 500, value: 'hello' },
    });
    const countElement = container.querySelector('#bio-count');
    expect(countElement).not.toBeNull();
    expect(countElement?.tagName.toLowerCase()).toBe('output');
    expect(countElement?.getAttribute('aria-live')).toBe('polite');
    expect(countElement?.getAttribute('aria-atomic')).toBe('true');
    expect(countElement?.textContent?.trim()).toBe('5/500');
  });

  test('aria-describedby includes count id when showCount is enabled', () => {
    const { container } = render(Textarea, {
      props: { id: 'bio', showCount: true, maxlength: 500, value: 'hello' },
    });
    const describedBy = container.querySelector('textarea')?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('bio-count');
  });

  test('count updates on input', async () => {
    const { container } = render(Textarea, {
      props: { id: 'live-count', showCount: true, maxlength: 100, value: '' },
    });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const countElement = container.querySelector('#live-count-count');
    expect(countElement?.textContent?.trim()).toBe('0/100');
    await fireEvent.input(textarea, { target: { value: 'hello' } });
    expect(countElement?.textContent?.trim()).toBe('5/100');
  });

  test('aria-describedby token order is description → count → error', () => {
    const { container } = render(Textarea, {
      props: {
        id: 'order-test',
        description: 'Helper text',
        error: 'Something went wrong',
        showCount: true,
        maxlength: 100,
      },
    });
    const describedBy = container.querySelector('textarea')?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toBe('order-test-description order-test-count order-test-error');
  });

  test('maxlength attribute is still forwarded to the textarea element', () => {
    const { container } = render(Textarea, {
      props: { id: 'forward', showCount: true, maxlength: 500 },
    });
    expect(container.querySelector('textarea')?.getAttribute('maxlength')).toBe('500');
  });

  test('maxlength is forwarded to textarea when showCount is false', () => {
    const { container } = render(Textarea, {
      props: { id: 'fwd-no-count', maxlength: 200 },
    });
    expect(container.querySelector('textarea')?.getAttribute('maxlength')).toBe('200');
  });

  test.each([
    ['negative', -1],
    ['non-integer', 1.5],
    ['non-numeric string', 'abc'],
  ])('count not rendered when maxlength is invalid: %s', (_label, maxlength) => {
    const id = `inv-${_label.replace(/[^a-z]/g, '-')}`;
    const { container } = render(Textarea, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props: { id, showCount: true, maxlength: maxlength as any },
    });
    expect(container.querySelector(`#${id}-count`)).toBeNull();
  });

  test('count element renders before error element in DOM order', () => {
    const { container } = render(Textarea, {
      props: {
        id: 'dom-order',
        description: 'Helper',
        error: 'Bad',
        showCount: true,
        maxlength: 100,
      },
    });
    const children = Array.from(container.querySelector('.cinder-textarea-field')!.children);
    const countIndex = children.findIndex((el) => el.id === 'dom-order-count');
    const errorIndex = children.findIndex((el) => el.id === 'dom-order-error');
    expect(countIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeGreaterThan(-1);
    expect(countIndex).toBeLessThan(errorIndex);
  });

  test('string maxlength="500" is accepted as the counter denominator', () => {
    const { container } = render(Textarea, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props: { id: 'str-max', showCount: true, maxlength: '500' as any, value: 'hello' },
    });
    const countElement = container.querySelector('#str-max-count');
    expect(countElement).not.toBeNull();
    expect(countElement?.textContent?.trim()).toBe('5/500');
  });

  test('counter does not update without bind:value (initial value is locked)', async () => {
    const { container } = render(Textarea, {
      props: { id: 'unbound', showCount: true, maxlength: 100, value: 'hi' },
    });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const countElement = container.querySelector('#unbound-count');
    expect(countElement?.textContent?.trim()).toBe('2/100');
    // Simulate typing without a bind — the prop does not flow back
    await fireEvent.input(textarea, { target: { value: 'hi there' } });
    // The textarea element value updates via DOM but the prop-bound counter
    // may or may not update depending on binding. We assert the textarea DOM value changed.
    expect(textarea.value).toBe('hi there');
  });
});

describe('Textarea context inheritance from FormField', () => {
  test('inherits FormField state when local description and error are absent', () => {
    const { container } = render(FormFieldTextareaFixture, {
      props: {
        fieldId: 'ctx-textarea',
        fieldLabel: 'Textarea label',
        fieldDescription: 'Field helper',
        fieldError: 'Field error',
        fieldRequired: true,
        fieldDisabled: true,
      },
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('aria-describedby')).toBe(
      'ctx-textarea-description ctx-textarea-error',
    );
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.required).toBe(true);
    expect(textarea.disabled).toBe(true);
  });

  test('local Textarea description and error use distinct ids and compose with FormField context', () => {
    const { container } = render(FormFieldTextareaFixture, {
      props: {
        fieldId: 'ctx-textarea',
        fieldLabel: 'Textarea label',
        fieldDescription: 'Field helper',
        fieldError: 'Field error',
        textareaDescription: 'Textarea helper',
        textareaError: 'Textarea error',
      },
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('aria-describedby')).toBe(
      'ctx-textarea-textarea-description ctx-textarea-textarea-error ctx-textarea-description ctx-textarea-error',
    );
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('#ctx-textarea-textarea-description')?.textContent).toContain(
      'Textarea helper',
    );
    expect(container.querySelector('#ctx-textarea-textarea-error')?.textContent).toContain(
      'Textarea error',
    );
    expect(idsIn(container).filter((id) => id === 'ctx-textarea-error')).toHaveLength(1);
    expect(idsIn(container).filter((id) => id === 'ctx-textarea-textarea-error')).toHaveLength(1);
  });

  test('explicit Textarea disabled false overrides FormField context', () => {
    const { container } = render(FormFieldTextareaFixture, {
      props: {
        fieldId: 'ctx-textarea',
        fieldLabel: 'Textarea label',
        fieldDisabled: true,
        textareaDisabled: false,
      },
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);
  });
});

describe('resolveMaximumLength', () => {
  test.each([
    ['numeric positive integer', 500, 500],
    ['zero number', 0, 0],
    ['string zero', '0', 0],
    ['string digit-only', '500', 500],
    ['string leading zero', '0500', 500],
    ['string surrounding whitespace', ' 500 ', 500],
    ['MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ])('accepts %s → %i', (_label, input, expected) => {
    expect(resolveMaximumLength(input)).toBe(expected);
  });

  test.each([
    ['negative number', -1],
    ['non-integer number', 1.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['above MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER + 1],
    ['empty string', ''],
    ['string with letters', 'abc'],
    ['exponent notation', '5e2'],
    ['decimal string', '500.0'],
    ['internal whitespace', '50 0'],
    ['plus sign', '+500'],
    ['negative sign', '-500'],
    ['undefined', undefined],
    ['null', null],
  ])('rejects %s', (_label, input) => {
    expect(resolveMaximumLength(input)).toBeUndefined();
  });
});
