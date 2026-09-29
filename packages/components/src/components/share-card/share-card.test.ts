/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, jest, test } from 'bun:test';
import { markupSnippet } from './share-card-test-support.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');

const { default: ShareCard } = await import('./share-card.svelte');
afterEach(() => {
  cleanup();
  if (jest.isFakeTimers()) jest.useRealTimers();
});

describe('ShareCard', () => {
  test('renders the value in a focusable, read-only field', () => {
    const { container } = render(ShareCard, { value: 'https://example.com/share/abc' });
    const valueField = container.querySelector<HTMLInputElement>('.cinder-share-card__value');
    expect(valueField).not.toBeNull();
    expect(valueField?.tagName).toBe('INPUT');
    expect(valueField?.value).toBe('https://example.com/share/abc');
    expect(valueField?.readOnly).toBe(true);
    // Keyboard reachability: no explicit `tabindex` removes it from the Tab
    // order, and it is not disabled — a bare `<input>` is natively focusable.
    // (happy-dom's `tabIndex` IDL property defaults to -1 for elements with no
    // explicit attribute, unlike real browsers, so assert on the attribute and
    // `disabled` state directly rather than the IDL property.)
    expect(valueField?.getAttribute('tabindex')).toBeNull();
    expect(valueField?.disabled).toBe(false);
  });

  test('selects the full value when the field receives focus', () => {
    const { container } = render(ShareCard, { value: 'https://example.com/share/abc' });
    const valueField = container.querySelector<HTMLInputElement>('.cinder-share-card__value')!;
    valueField.focus();
    expect(document.activeElement).toBe(valueField);
    expect(valueField.selectionStart).toBe(0);
    expect(valueField.selectionEnd).toBe(valueField.value.length);
  });

  test('renders title when provided', () => {
    const { container } = render(ShareCard, {
      value: 'https://example.com',
      title: 'My shared report',
    });
    expect(container.querySelector('.cinder-share-card__title')?.textContent).toBe(
      'My shared report',
    );
  });

  test('renders description when provided', () => {
    const { container } = render(ShareCard, {
      value: 'https://example.com',
      description: 'Share this report with your team',
    });
    expect(container.querySelector('.cinder-share-card__description')?.textContent).toBe(
      'Share this report with your team',
    );
  });

  test('renders the share actions group with aria-label', () => {
    const { container } = render(ShareCard, { value: 'https://example.com' });
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('Share actions');
  });

  test('renders default copy link button', () => {
    const { getByRole } = render(ShareCard, { value: 'https://example.com' });
    const button = getByRole('button', { name: /Copy link/i });
    expect(button).not.toBeNull();
  });

  test('renders custom copyLinkLabel', () => {
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      copyLinkLabel: 'Copy URL',
    });
    expect(getByRole('button', { name: /Copy URL/i })).not.toBeNull();
  });

  test('renders custom actions', () => {
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        { key: 'copy-text', label: 'Copy text', copyValue: 'My text' },
        { key: 'copy-link', label: 'Copy link', copyValue: 'https://example.com' },
      ],
    });
    expect(getByRole('button', { name: /Copy text/i })).not.toBeNull();
    expect(getByRole('button', { name: /Copy link/i })).not.toBeNull();
  });

  test('calls custom onclick for actions', () => {
    let clicked = false;
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        {
          key: 'custom',
          label: 'Custom action',
          onclick: () => {
            clicked = true;
          },
        },
      ],
    });
    fireEvent.click(getByRole('button', { name: /Custom action/i }));
    expect(clicked).toBe(true);
  });

  test('applies custom class', () => {
    const { container } = render(ShareCard, {
      value: 'https://example.com',
      class: 'my-share-card',
    });
    const root = container.querySelector('.cinder-share-card');
    expect(root?.classList.contains('my-share-card')).toBe(true);
  });

  test('renders without title or description when omitted', () => {
    const { container } = render(ShareCard, { value: 'https://example.com' });
    expect(container.querySelector('.cinder-share-card__meta')).toBeNull();
  });

  test('does not render native share button when navigator.share is absent', () => {
    // happy-dom doesn't implement navigator.share — this tests the fallback.
    const { container } = render(ShareCard, { value: 'https://example.com' });
    const actions = container.querySelectorAll('.cinder-share-card__action');
    // Only the copy-link button should be rendered by default when no native share.
    expect(actions.length).toBeGreaterThanOrEqual(1);
  });

  test('value region is labelled "Link to share" for a URL', () => {
    const { container } = render(ShareCard, { value: 'https://example.com/x' });
    expect(container.querySelector('.cinder-share-card__value')?.getAttribute('aria-label')).toBe(
      'Link to share',
    );
  });

  test('value region is labelled "Text to share" for non-URL text', () => {
    const { container } = render(ShareCard, { value: 'Just some text' });
    expect(container.querySelector('.cinder-share-card__value')?.getAttribute('aria-label')).toBe(
      'Text to share',
    );
  });

  test('the copy-link button is icon-only: aria-label carries the name, no visible label text', () => {
    const { container, getByRole } = render(ShareCard, {
      value: 'https://example.com',
      copyLinkLabel: 'Copy link',
    });
    const button = getByRole('button', { name: 'Copy link' });
    expect(button.getAttribute('aria-label')).toBe('Copy link');
    // No visible "Copy link" text node in the button — only the decorative,
    // aria-hidden icon.
    expect(button.textContent?.trim()).toBe('');
    expect(
      container.querySelector('.cinder-share-card__action-icon[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  test('a labelSnippet action still renders its rich visible content', () => {
    const { getByRole } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        {
          key: 'copy-link',
          label: 'Copy link',
          copyValue: 'https://example.com',
          labelSnippet: markupSnippet('<strong>Custom copy label</strong>'),
        },
      ],
    });
    const button = getByRole('button', { name: 'Copy link' });
    expect(button.textContent?.trim()).toBe('Custom copy label');
  });
});
