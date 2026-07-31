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
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    details.append(summary);
    const iframe = document.createElement('iframe');
    const audio = document.createElement('audio');
    audio.setAttribute('controls', '');
    const video = document.createElement('video');
    video.setAttribute('controls', '');
    const embed = document.createElement('embed');
    const object = document.createElement('object');
    region.append(details, iframe, audio, video, embed, object);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(summary);
    expect(targets).toContain(iframe);
    expect(targets).toContain(video);
    expect(targets).toContain(embed);
    expect(targets).toContain(object);
    region.remove();
  });

  test('orders positive tabindex values before default controls and rejects invalid tabindex', () => {
    const region = document.createElement('div');
    const defaultButton = document.createElement('button');
    const positiveTwo = document.createElement('button');
    positiveTwo.setAttribute('tabindex', '2');
    const positiveOne = document.createElement('button');
    positiveOne.setAttribute('tabindex', '1');
    const invalid = document.createElement('button');
    invalid.setAttribute('tabindex', 'bogus');
    region.append(defaultButton, positiveTwo, positiveOne, invalid);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(
      targets.map((target) =>
        target === positiveOne ? 'one' : target === positiveTwo ? 'two' : 'default',
      ),
    ).toEqual(['one', 'two', 'default']);
    region.remove();
  });

  test('includes only the first summary in a details element', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const first = document.createElement('summary');
    const second = document.createElement('summary');
    const standalone = document.createElement('summary');
    details.append(first, second);
    region.append(details, standalone);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(first);
    expect(getSequentialFocusTargets(region)).not.toContain(second);
    expect(getSequentialFocusTargets(region)).not.toContain(standalone);
    region.remove();
  });

  test('skips controls inside closed details but includes them when open', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const button = document.createElement('button');
    details.append(summary, button);
    region.append(details);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(summary);
    expect(getSequentialFocusTargets(region)).not.toContain(button);
    details.open = true;
    expect(getSequentialFocusTargets(region)).toContain(button);
    region.remove();
  });

  test('skips nested controls when an outer details element is closed', () => {
    const region = document.createElement('div');
    const outer = document.createElement('details');
    const outerSummary = document.createElement('summary');
    const inner = document.createElement('details');
    const innerSummary = document.createElement('summary');
    const button = document.createElement('button');
    inner.append(innerSummary, button);
    outer.append(outerSummary, inner);
    region.append(outer);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(outerSummary);
    expect(getSequentialFocusTargets(region)).not.toContain(innerSummary);
    expect(getSequentialFocusTargets(region)).not.toContain(button);
    region.remove();
  });

  test('exposes one radio per same-name group, preferring checked or first eligible', () => {
    const region = document.createElement('div');
    const first = document.createElement('input');
    first.type = 'radio';
    first.name = 'choice';
    const checked = document.createElement('input');
    checked.type = 'radio';
    checked.name = 'choice';
    checked.checked = true;
    const other = document.createElement('input');
    other.type = 'radio';
    other.name = 'other';
    region.append(first, checked, other);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).not.toContain(first);
    expect(targets).toContain(checked);
    expect(targets).toContain(other);
    region.remove();
  });

  test('keeps unnamed radios as independent tab stops', () => {
    const region = document.createElement('div');
    const first = document.createElement('input');
    first.type = 'radio';
    const second = document.createElement('input');
    second.type = 'radio';
    region.append(first, second);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(first);
    expect(targets).toContain(second);
    region.remove();
  });

  test('keeps a tabindex div with a disabled attribute in the sequential order', () => {
    const region = document.createElement('div');
    const candidate = document.createElement('div');
    candidate.setAttribute('tabindex', '0');
    candidate.setAttribute('disabled', '');
    region.append(candidate);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(candidate);
    region.remove();
  });

  test('recognizes a radio from a foreign document without instanceof checks', () => {
    const foreignDocument = new DOMParser().parseFromString(
      '<input type="radio" name="foreign">',
      'text/html',
    );
    const foreignRadio = foreignDocument.querySelector('input') as HTMLElement;
    expect(getSequentialFocusTargets(foreignDocument)).toContain(foreignRadio);
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
