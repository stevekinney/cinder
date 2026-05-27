/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { restoreFocusTo } = await import('./focus.ts');

afterEach(() => {
  // Blur any lingering focus so each test starts clean.
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  // Drop any test-added buttons.
  for (const button of document.body.querySelectorAll('button')) {
    button.remove();
  }
});

describe('restoreFocusTo', () => {
  test('focuses a connected element and returns true', () => {
    const a = document.createElement('button');
    const b = document.createElement('button');
    document.body.append(a, b);
    b.focus();
    expect(document.activeElement).toBe(b);

    const moved = restoreFocusTo(a);
    expect(moved).toBe(true);
    expect(document.activeElement).toBe(a);
  });

  test('no-ops and returns false for a disconnected element', () => {
    const detached = document.createElement('button');
    expect(detached.isConnected).toBe(false);

    const moved = restoreFocusTo(detached);
    expect(moved).toBe(false);
  });

  test('returns false for null target', () => {
    expect(restoreFocusTo(null)).toBe(false);
  });

  test('returns false when ownerDocument differs from document', () => {
    // Create an element in a different document context (e.g., parsed from
    // a DOMParser instance) so its ownerDocument is not the active document.
    const otherDocument = new DOMParser().parseFromString('<button id="x">x</button>', 'text/html');
    const stranger = otherDocument.getElementById('x') as HTMLButtonElement;
    // Adopt it into the live document body so isConnected becomes true,
    // but keep ownerDocument pointing at the parsed document. Note: in
    // happy-dom appendChild auto-adopts the node, changing ownerDocument.
    // For this test we just confirm that an element whose ownerDocument is
    // a *parsed* document is rejected when never adopted into the live one.
    expect(stranger.ownerDocument).toBe(otherDocument);
    expect(restoreFocusTo(stranger)).toBe(false);
  });
});
