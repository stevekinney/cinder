/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { getSequentialFocusTargets, restoreFocusTo } = await import('./focus.ts');

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

  test('returns false when focus throws', () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus = () => {
      throw new Error('cannot focus');
    };

    expect(restoreFocusTo(button)).toBe(false);
  });
});

describe('getSequentialFocusTargets', () => {
  test('includes native sequential controls omitted by the old selector', () => {
    const region = document.createElement('div');
    const summary = document.createElement('summary');
    const iframe = document.createElement('iframe');
    const audio = document.createElement('audio');
    audio.setAttribute('controls', '');
    const video = document.createElement('video');
    video.setAttribute('controls', '');
    const embed = document.createElement('embed');
    const object = document.createElement('object');
    region.append(summary, iframe, audio, video, embed, object);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(summary);
    expect(targets).toContain(iframe);
    expect(targets).toContain(video);
    expect(targets).toContain(embed);
    expect(targets).toContain(object);
    region.remove();
  });

  test('excludes hidden, inert, disabled, and negative-tabindex candidates', () => {
    const region = document.createElement('div');
    const visible = document.createElement('button');
    const hidden = document.createElement('button');
    hidden.hidden = true;
    const inert = document.createElement('button');
    inert.setAttribute('inert', '');
    const disabled = document.createElement('button');
    disabled.disabled = true;
    const negative = document.createElement('button');
    negative.setAttribute('tabindex', '-1');
    region.append(visible, hidden, inert, disabled, negative);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(visible);
    expect(targets).not.toContain(hidden);
    expect(targets).not.toContain(inert);
    expect(targets).not.toContain(disabled);
    expect(targets).not.toContain(negative);
    region.remove();
  });

  test('crosses a shadow host when checking hidden and rendered state', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const iframe = document.createElement('iframe');
    shadow.append(iframe);
    host.hidden = true;
    document.body.append(host);

    expect(getSequentialFocusTargets(shadow)).toEqual([]);
    host.remove();
  });
});
