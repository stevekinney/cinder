/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import ReviewEditor from './review-editor.svelte';

setupHappyDom();

afterEach(() => {
  cleanup();
});

describe('ReviewEditor mounted inline controls', () => {
  test('mounts the original component and exposes its editor surface', async () => {
    const { container } = render(ReviewEditor, {
      props: {
        id: 'mounted-control',
        original: 'alpha beta',
        value: 'alpha beta',
        currentUserId: 'reviewer',
      },
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const surface = container.querySelector('.review-editor-main');
    expect(surface).not.toBeNull();
    expect(container.querySelector('[data-testid="review-editor"]')).not.toBeNull();
  });

  test('dispatches keyboard events through the current component container', async () => {
    const { container } = render(ReviewEditor, {
      props: {
        id: 'keyboard-control',
        original: 'alpha beta',
        value: 'alpha beta',
        currentUserId: 'reviewer',
      },
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const root = container.querySelector('[data-testid="review-editor"]');
    if (!(root instanceof HTMLElement)) throw new Error('ReviewEditor root missing');
    const event = new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true });
    root.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  test('selectionchange leaves the popover hidden for a collapsed selection', async () => {
    const { container } = render(ReviewEditor, {
      props: {
        id: 'selection-control',
        original: 'alpha beta',
        value: 'alpha beta',
        currentUserId: 'reviewer',
      },
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const root = container.querySelector('[data-testid="review-editor"]');
    if (!(root instanceof HTMLElement)) throw new Error('ReviewEditor root missing');
    const range = document.createRange();
    range.setStart(root, 0);
    range.collapse(true);
    const selection = window.getSelection();
    if (!selection) throw new Error('Browser selection unavailable');
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    expect(container.querySelector('[data-cinder-visible="true"]')).toBeNull();
  });

  test('announces malformed leading front matter through the existing polite live region', async () => {
    const malformed = '---\nowner: [\n---\n\n# Malformed\n';
    const { container } = render(ReviewEditor, {
      props: {
        id: 'malformed-front-matter',
        value: malformed,
        currentUserId: 'reviewer',
      },
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    const politeRegion = container.querySelector('[aria-live="polite"]');
    expect(politeRegion?.textContent).toContain(
      'Front matter could not be parsed; showing as plain text.',
    );

    const note = container.querySelector('[role="note"][aria-label="Front matter warning"]');
    expect(note?.textContent).toContain('Front matter could not be parsed; showing as plain text.');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[aria-live="assertive"]')).toBeNull();
  });

  test('does not render malformed recovery for unfenced documents', async () => {
    const { container } = render(ReviewEditor, {
      props: {
        id: 'unfenced-front-matter',
        value: '# Plain document\n\nNo leading fence.',
        currentUserId: 'reviewer',
      },
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(container.textContent).not.toContain(
      'Front matter could not be parsed; showing as plain text.',
    );
    expect(container.querySelector('[role="note"][aria-label="Front matter warning"]')).toBeNull();
  });

  test('dismisses malformed recovery without changing content or selection', async () => {
    const malformed = '---\nowner: [\n---\n\n# Malformed\n';
    const { component, container } = render(ReviewEditor, {
      props: {
        id: 'dismiss-front-matter',
        value: malformed,
        currentUserId: 'reviewer',
      },
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const textarea = container.querySelector('#dismiss-front-matter');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('Expected source textarea.');
    textarea.focus();
    textarea.setSelectionRange(4, 9);

    const dismiss = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Dismiss front matter warning',
    );
    if (!dismiss) throw new Error('Expected dismiss button.');

    await fireEvent.click(dismiss);

    expect(component.getMarkdown()).toBe(malformed);
    expect(textarea.selectionStart).toBe(4);
    expect(textarea.selectionEnd).toBe(9);
    expect(container.querySelector('[role="note"][aria-label="Front matter warning"]')).toBeNull();
  });

  test('dismisses malformed recovery only for the selected ReviewEditor instance', async () => {
    const malformed = '---\nowner: [\n---\n\n# Malformed\n';
    const first = render(ReviewEditor, {
      props: {
        id: 'dismiss-front-matter-first',
        value: malformed,
        currentUserId: 'reviewer',
      },
    });
    const second = render(ReviewEditor, {
      props: {
        id: 'dismiss-front-matter-second',
        value: malformed,
        currentUserId: 'reviewer',
      },
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const firstDismiss = Array.from(first.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Dismiss front matter warning',
    );
    if (!firstDismiss) throw new Error('Expected first dismiss button.');

    await fireEvent.click(firstDismiss);

    expect(
      first.container.querySelector('[role="note"][aria-label="Front matter warning"]'),
    ).toBeNull();
    expect(
      second.container.querySelector('[role="note"][aria-label="Front matter warning"]'),
    ).not.toBeNull();
  });

  test('does not announce a stale malformed warning after the value becomes valid before the tick', async () => {
    const malformed = '---\nowner: [\n---\n\n# Malformed\n';
    const valid = '---\nowner: platform\n---\n\n# Valid\n';
    const { container, rerender } = render(ReviewEditor, {
      props: {
        id: 'stale-front-matter',
        value: malformed,
        currentUserId: 'reviewer',
      },
    });

    await rerender({
      id: 'stale-front-matter',
      value: valid,
      currentUserId: 'reviewer',
    });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    const politeRegion = container.querySelector('[aria-live="polite"]');
    expect(politeRegion?.textContent).not.toContain(
      'Front matter could not be parsed; showing as plain text.',
    );
    expect(container.querySelector('[role="note"][aria-label="Front matter warning"]')).toBeNull();
  });

  test('focuses the source textarea at the opening fence from malformed recovery', async () => {
    const malformed = '---\nowner: [\n---\n\n# Malformed\n';
    const { component, container } = render(ReviewEditor, {
      props: {
        id: 'plain-text-front-matter',
        value: malformed,
        currentUserId: 'reviewer',
      },
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const edit = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Edit as plain text',
    );
    if (!edit) throw new Error('Expected edit-as-plain-text button.');

    await fireEvent.click(edit);

    const textarea = container.querySelector('#plain-text-front-matter');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('Expected source textarea.');
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(0);
    expect(component.getMarkdown()).toBe(malformed);
  });
});
