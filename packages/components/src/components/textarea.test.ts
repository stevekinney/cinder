/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Textarea } = await import('./textarea.svelte');

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
