/**
 * Regression test for CIN-505: `ToolCallGroup`'s polite live-region status
 * announcer must be visually hidden, not rendered as ordinary visible text.
 *
 * The announcer previously carried the bare `sr-only` class, which has no CSS
 * rule reaching this component (the only matching selector,
 * `.cinder-chat-conversation-list .sr-only`, is scoped to an unrelated
 * component). It rendered as plain visible text — confirmed in a real browser
 * as a stray "remember_note: Action required" line stacked above the intended
 * tool-status chip. The fix switches the class to `cinder-sr-only`, the
 * design system's utility, which every `@lostgradient/chat` consumer already
 * receives via the required `@lostgradient/cinder/styles` import (see
 * `packages/chat/README.md`).
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { injectStyles } from '../../../test/css.ts';
import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: ToolCallGroup } = await import('./tool-call-group.svelte');

const cinderSrOnlyCss = await Bun.file(
  new URL('../../../../../../components/src/styles/utilities.css', import.meta.url),
).text();

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('ToolCallGroup — status announcer visibility (CIN-505)', () => {
  test('carries the cinder-sr-only class, not the undefined bare sr-only class', () => {
    const { container } = render(ToolCallGroup, {
      props: { pair: { call: { id: 'note-1', name: 'remember_note', arguments: {} } } },
    });
    const announcer = container.querySelector('[aria-live="polite"]');
    expect(announcer).not.toBeNull();
    expect(announcer?.classList.contains('cinder-sr-only')).toBe(true);
    expect(announcer?.classList.contains('sr-only')).toBe(false);
  });

  test('is visually clipped to nothing once the real cinder-sr-only rule applies', () => {
    const removeStyles = injectStyles(cinderSrOnlyCss);
    try {
      const { container } = render(ToolCallGroup, {
        props: {
          pair: { call: { id: 'note-2', name: 'remember_note', arguments: {} } },
        },
      });
      const announcer = container.querySelector('[aria-live="polite"]');
      expect(announcer).not.toBeNull();
      expect(announcer?.textContent).toContain('remember_note');

      const computed = getComputedStyle(announcer as Element);
      // Still in the accessibility tree (not display:none / visibility:hidden),
      // but clipped to a 1px box and out of flow, exactly like `.cinder-sr-only`.
      expect(computed.display).not.toBe('none');
      expect(computed.visibility).not.toBe('hidden');
      expect(computed.position).toBe('absolute');
      expect(computed.width).toBe('1px');
      expect(computed.height).toBe('1px');
      expect(computed.overflow).toBe('hidden');
      expect(computed.clip).toBe('rect(0, 0, 0, 0)');
      expect(computed.whiteSpace).toBe('nowrap');
    } finally {
      removeStyles();
    }
  });
});
