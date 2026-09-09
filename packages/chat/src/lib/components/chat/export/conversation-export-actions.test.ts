/**
 * Regression test for CIN-505: `ConversationExportActions`' polite copy-status
 * announcer must be visually hidden, not rendered as ordinary visible text.
 *
 * Same root cause as `tool-call-group.test.ts`: the announcer previously
 * carried the bare `sr-only` class, which has no CSS rule reaching this
 * component. The fix switches the class to `cinder-sr-only`, the design
 * system's utility, which every `@lostgradient/chat` consumer already
 * receives via the required `@lostgradient/cinder/styles` import (see
 * `packages/chat/README.md`).
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { injectStyles } from '../../../test/css.ts';
import { setupHappyDom } from '../../../test/happy-dom.ts';
import { createConversationHistory } from '../builders.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: ConversationExportActions } = await import('./conversation-export-actions.svelte');

const cinderSrOnlyCss = await Bun.file(
  new URL('../../../../../../components/src/styles/utilities.css', import.meta.url),
).text();

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('ConversationExportActions — copy announcer visibility (CIN-505)', () => {
  test('carries the cinder-sr-only class, not the undefined bare sr-only class', () => {
    const conversation = createConversationHistory({ id: 'export-visibility' });
    const { container } = render(ConversationExportActions, {
      props: { id: 'export-actions', conversation },
    });
    const announcer = container.querySelector('[aria-live="polite"]');
    expect(announcer).not.toBeNull();
    expect(announcer?.classList.contains('cinder-sr-only')).toBe(true);
    expect(announcer?.classList.contains('sr-only')).toBe(false);
  });

  test('is visually clipped to nothing once the real cinder-sr-only rule applies', () => {
    const removeStyles = injectStyles(cinderSrOnlyCss);
    try {
      const conversation = createConversationHistory({ id: 'export-visibility-computed' });
      const { container } = render(ConversationExportActions, {
        props: { id: 'export-actions-computed', conversation },
      });
      const announcer = container.querySelector('[aria-live="polite"]');
      expect(announcer).not.toBeNull();

      const computed = getComputedStyle(announcer as Element);
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
