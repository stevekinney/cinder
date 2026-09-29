import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';
setupHappyDom();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: Button } = await import('./button.svelte');
afterEach(cleanup);

const leadingIconSnippet = createRawSnippet(() => ({
  render: () => '<svg data-testid="leading-icon" aria-hidden="true"></svg>',
}));

const trailingIconSnippet = createRawSnippet(() => ({
  render: () => '<svg data-testid="trailing-icon" aria-hidden="true"></svg>',
}));

describe('Button iconOnly', () => {
  test('iconOnly=true applies data-cinder-icon-only=""', () => {
    const { container } = render(Button, {
      props: {
        iconOnly: true,
        leadingIcon: leadingIconSnippet,
        'aria-label': 'Close',
        label: 'Close',
      },
    });
    expect(container.querySelector('button')?.getAttribute('data-cinder-icon-only')).toBe('');
  });

  test('iconOnly=false does not apply data-cinder-icon-only', () => {
    const { container } = render(Button, { props: { label: 'Save', iconOnly: false } });
    expect(container.querySelector('button')?.hasAttribute('data-cinder-icon-only')).toBe(false);
  });
});

describe('Button icon snippets', () => {
  test('leadingIcon and trailingIcon render in aria-hidden icon wrappers around label text', () => {
    const { container, getByText } = render(Button, {
      props: {
        label: 'Save',
        leadingIcon: leadingIconSnippet,
        trailingIcon: trailingIconSnippet,
      },
    });

    const wrappers = Array.from(container.querySelectorAll('.cinder-button__icon'));
    expect(wrappers).toHaveLength(2);
    expect(wrappers.every((wrapper) => wrapper.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(wrappers[0]?.querySelector('[data-testid="leading-icon"]')).not.toBeNull();
    expect(wrappers[1]?.querySelector('[data-testid="trailing-icon"]')).not.toBeNull();
    expect(getByText('Save')).not.toBeNull();
  });
});

describe('Button iconOnly sr-only label', () => {
  test('iconOnly=true with label renders label text in a sr-only span (no aria-label override)', () => {
    const { container, getByText } = render(Button, {
      props: { iconOnly: true, leadingIcon: leadingIconSnippet, label: 'Close' },
    });
    // Label text must be queryable — it's in a visually-hidden span.
    const labelNode = getByText('Close');
    expect(labelNode).not.toBeNull();
    expect(labelNode.className).toContain('cinder-sr-only');
    // The button should NOT have a synthesized aria-label attribute from label.
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBeNull();
  });

  test('iconOnly=true with aria-label does NOT render a sr-only span for label', () => {
    const { container } = render(Button, {
      props: {
        iconOnly: true,
        leadingIcon: leadingIconSnippet,
        'aria-label': 'Close dialog',
        label: 'Close',
      },
    });
    // When aria-label is set it is the accessible name; sr-only label span should not appear.
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Close dialog');
    // label text should NOT be rendered as sr-only span when aria-label supplies the name
    const srOnlySpan = container.querySelector('.cinder-sr-only');
    expect(srOnlySpan).toBeNull();
  });

  test('iconOnly=true with whitespace aria-label falls back to sr-only label', () => {
    const { container } = render(Button, {
      props: {
        iconOnly: true,
        leadingIcon: leadingIconSnippet,
        'aria-label': '   ',
        label: 'Close',
      },
    });

    const srOnlySpan = container.querySelector('.cinder-sr-only');
    expect(srOnlySpan).not.toBeNull();
    expect(srOnlySpan?.textContent).toBe('Close');
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBeNull();
  });

  test('iconOnly=true with whitespace aria-labelledby falls back to sr-only label', () => {
    const { container } = render(Button, {
      props: {
        iconOnly: true,
        leadingIcon: leadingIconSnippet,
        'aria-labelledby': '   ',
        label: 'Close',
      },
    });

    const srOnlySpan = container.querySelector('.cinder-sr-only');
    expect(srOnlySpan).not.toBeNull();
    expect(srOnlySpan?.textContent).toBe('Close');
    expect(container.querySelector('button')?.getAttribute('aria-labelledby')).toBeNull();
  });
});

describe('Button accessible name precedence', () => {
  test('aria-label takes precedence over label as the accessible name', () => {
    const { container } = render(Button, {
      props: { label: 'Close', 'aria-label': 'Close dialog' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Close dialog');
  });

  test('aria-labelledby is passed through to the element', () => {
    const { container } = render(Button, {
      props: { label: 'Close', 'aria-labelledby': 'dialog-title' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-labelledby')).toBe('dialog-title');
  });
});
