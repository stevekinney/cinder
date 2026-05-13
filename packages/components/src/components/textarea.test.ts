/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Textarea } = await import('./textarea.svelte');
const { resolveMaximumLength } = await import('./textarea-count.ts');

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

  test('zero maxlength is accepted as the counter denominator', () => {
    const { container } = render(Textarea, {
      props: { id: 'zero-max', showCount: true, maxlength: 0, value: '' },
    });
    const countElement = container.querySelector('#zero-max-count');
    expect(countElement).not.toBeNull();
    expect(countElement?.textContent?.trim()).toBe('0/0');
  });

  test('counter updates from local value state without parent bind:value', async () => {
    const { container } = render(Textarea, {
      props: { id: 'unbound', showCount: true, maxlength: 100, value: 'hi' },
    });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const countElement = container.querySelector('#unbound-count');
    expect(countElement?.textContent?.trim()).toBe('2/100');
    await fireEvent.input(textarea, { target: { value: 'hi there' } });
    expect(textarea.value).toBe('hi there');
    await waitFor(() => {
      expect(countElement?.textContent?.trim()).toBe('8/100');
    });
  });
});

describe('resolveMaximumLength', () => {
  test.each([
    ['zero number', 0, 0],
    ['string zero', '0', 0],
    ['numeric positive integer', 500, 500],
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
