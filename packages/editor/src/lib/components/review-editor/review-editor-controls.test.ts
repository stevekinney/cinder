/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: ReviewEditorControls } = await import('./review-editor-controls.svelte');

// ---------------------------------------------------------------------------
// Source-contract assertions — no DOM mounting required.
// ---------------------------------------------------------------------------

describe('ReviewEditorControls source contract', () => {
  test('source does not contain :global(.comments-toggle)', async () => {
    const source = await Bun.file(
      new URL('./review-editor-controls.svelte', import.meta.url),
    ).text();
    expect(source).not.toContain(':global(.comments-toggle)');
  });
});

// ---------------------------------------------------------------------------
// Component mount assertions via happy-dom + @testing-library/svelte.
// ---------------------------------------------------------------------------

const BASE_PROPS = {
  id: 'test-controls',
  activeView: 'editor',
} as const;

describe('ReviewEditorControls — comments toggle ARIA attributes', () => {
  test('toggle has aria-expanded reflecting sidebarOpen=false', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 3, sidebarOpen: false },
    });
    const button = container.querySelector('button[aria-controls="test-controls-sidebar"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  test('toggle has aria-expanded reflecting sidebarOpen=true', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 3, sidebarOpen: true },
    });
    const button = container.querySelector('button[aria-controls="test-controls-sidebar"]');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
  });

  test('toggle has aria-controls pointing to the sidebar id', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 5 },
    });
    const button = container.querySelector('button[aria-controls="test-controls-sidebar"]');
    expect(button).not.toBeNull();
  });

  test('toggle aria-label includes the comment count', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 7 },
    });
    const button = container.querySelector('button[aria-controls="test-controls-sidebar"]');
    const label = button?.getAttribute('aria-label') ?? '';
    expect(label).toContain('7');
  });

  test('toggle aria-label uses singular "comment" for count of 1', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 1 },
    });
    const button = container.querySelector('button[aria-controls="test-controls-sidebar"]');
    const label = button?.getAttribute('aria-label') ?? '';
    expect(label).toContain('1 comment');
    expect(label).not.toContain('1 comments');
  });

  test('toggle aria-label uses plural "comments" for count > 1', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 4 },
    });
    const button = container.querySelector('button[aria-controls="test-controls-sidebar"]');
    const label = button?.getAttribute('aria-label') ?? '';
    expect(label).toContain('4 comments');
  });
});

describe('ReviewEditorControls — visible count rendered by Badge', () => {
  test('count is rendered inside a .cinder-badge element', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 9 },
    });
    const badge = container.querySelector('.cinder-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe('9');
  });

  test('.cinder-badge is aria-hidden to avoid double-announcing the count', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 2 },
    });
    const badge = container.querySelector('.cinder-badge');
    expect(badge?.getAttribute('aria-hidden')).toBe('true');
  });

  test('badge count updates when commentCount prop changes', async () => {
    const { container, rerender } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 2 },
    });
    expect(container.querySelector('.cinder-badge')?.textContent?.trim()).toBe('2');
    await rerender({ ...BASE_PROPS, commentCount: 8 });
    expect(container.querySelector('.cinder-badge')?.textContent?.trim()).toBe('8');
  });
});

describe('ReviewEditorControls — live announcer', () => {
  test('live announcer is empty on initial render', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 3 },
    });
    const announcer = container.querySelector('[role="status"][aria-live="polite"]');
    expect(announcer).not.toBeNull();
    expect(announcer?.textContent?.trim()).toBe('');
  });

  test('live announcer has aria-atomic="true"', () => {
    const { container } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 3 },
    });
    const announcer = container.querySelector('[role="status"][aria-live="polite"]');
    expect(announcer?.getAttribute('aria-atomic')).toBe('true');
  });

  test('live announcer updates after commentCount changes', async () => {
    const { container, rerender } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 3 },
    });
    const announcer = container.querySelector('[role="status"][aria-live="polite"]');
    // Initially empty — no announcement on first render.
    expect(announcer?.textContent?.trim()).toBe('');

    await rerender({ ...BASE_PROPS, commentCount: 5 });

    // After a count change, the announcer should describe the new count.
    expect(announcer?.textContent?.trim()).toBe('5 comments');
  });

  test('live announcer uses singular "comment" when count changes to 1', async () => {
    const { container, rerender } = render(ReviewEditorControls, {
      props: { ...BASE_PROPS, commentCount: 3 },
    });
    await rerender({ ...BASE_PROPS, commentCount: 1 });
    const announcer = container.querySelector('[role="status"][aria-live="polite"]');
    expect(announcer?.textContent?.trim()).toBe('1 comment');
  });
});
