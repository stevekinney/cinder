/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Label } = await import('./label.svelte');
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Label rendering', () => {
  test('renders a <label> with for attribute matching the for prop', () => {
    const { container } = render(Label, {
      for: 'username',
      children: textSnippet('Username'),
    });
    const label = container.querySelector('label');
    expect(label).not.toBeNull();
    expect(label?.getAttribute('for')).toBe('username');
    expect(label?.textContent?.trim()).toContain('Username');
  });

  test('applies cinder-label class', () => {
    const { container } = render(Label, {
      for: 'a',
      children: textSnippet('Hi'),
    });
    expect(container.querySelector('.cinder-label')).not.toBeNull();
  });

  test('class prop merges with cinder-label', () => {
    const { container } = render(Label, {
      for: 'a',
      class: 'extra',
      children: textSnippet('Hi'),
    });
    const label = container.querySelector('label');
    expect(label?.classList.contains('cinder-label')).toBe(true);
    expect(label?.classList.contains('extra')).toBe(true);
  });

  test('required prop renders a decorative asterisk', () => {
    const { container } = render(Label, {
      for: 'a',
      required: true,
      children: textSnippet('Email'),
    });
    const star = container.querySelector('.cinder-label__required');
    expect(star).not.toBeNull();
    expect(star?.getAttribute('aria-hidden')).toBe('true');
  });

  test('required false omits the asterisk', () => {
    const { container } = render(Label, {
      for: 'a',
      children: textSnippet('Email'),
    });
    expect(container.querySelector('.cinder-label__required')).toBeNull();
  });

  test('disabled prop sets data-disabled on the label', () => {
    const { container } = render(Label, {
      for: 'a',
      disabled: true,
      children: textSnippet('Locked'),
    });
    expect(container.querySelector('label')?.hasAttribute('data-disabled')).toBe(true);
  });

  test('rest props (e.g. data-testid) are spread onto the label element', () => {
    const { container } = render(Label, {
      for: 'a',
      'data-testid': 'my-label',
      children: textSnippet('Hi'),
    });
    expect(container.querySelector('[data-testid="my-label"]')).not.toBeNull();
  });
});
