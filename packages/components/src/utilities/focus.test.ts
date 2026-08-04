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
    summary.setAttribute('tabindex', '0');
    details.append(summary);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('tabindex', '0');
    const audio = document.createElement('audio');
    audio.setAttribute('controls', '');
    const video = document.createElement('video');
    video.setAttribute('controls', '');
    video.setAttribute('tabindex', '0');
    const embed = document.createElement('embed');
    embed.setAttribute('src', 'test.swf');
    embed.setAttribute('tabindex', '0');
    const object = document.createElement('object');
    object.setAttribute('tabindex', '0');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.setAttribute('tabindex', '0');
    const notEditable = document.createElement('div');
    notEditable.setAttribute('contenteditable', 'FALSE');
    region.append(details, iframe, audio, video, embed, object, editable, notEditable);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(summary);
    expect(targets).toContain(iframe);
    expect(targets).toContain(video);
    expect(targets).toContain(embed);
    expect(targets).toContain(object);
    expect(targets).toContain(editable);
    expect(targets).not.toContain(notEditable);
    region.remove();
  });

  test('excludes an embed without a source when its native tabIndex is negative', () => {
    const region = document.createElement('div');
    const embed = document.createElement('embed');
    region.append(embed);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).not.toContain(embed);
    region.remove();
  });

  test('orders positive tabindex values before default controls', () => {
    const region = document.createElement('div');
    const defaultButton = document.createElement('button');
    defaultButton.setAttribute('tabindex', '0');
    const positiveTwo = document.createElement('button');
    positiveTwo.setAttribute('tabindex', '2');
    const positiveOne = document.createElement('button');
    positiveOne.setAttribute('tabindex', '1');
    region.append(defaultButton, positiveTwo, positiveOne);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(
      targets.map((target) =>
        target === positiveOne ? 'one' : target === positiveTwo ? 'two' : 'default',
      ),
    ).toEqual(['one', 'two', 'default']);
    region.remove();
  });

  test('treats an invalid tabindex as omitted and parses a leading integer', () => {
    const region = document.createElement('div');
    const nativeInvalid = document.createElement('button');
    nativeInvalid.setAttribute('tabindex', 'bogus');
    const genericInvalid = document.createElement('div');
    genericInvalid.setAttribute('tabindex', 'bogus');
    const leadingInteger = document.createElement('div');
    leadingInteger.setAttribute('tabindex', '3x');
    region.append(nativeInvalid, genericInvalid, leadingInteger);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets[0]).toBe(leadingInteger);
    expect(targets).toContain(nativeInvalid);
    expect(targets).not.toContain(genericInvalid);
    region.remove();
  });

  test('includes only the first summary in a details element', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const first = document.createElement('summary');
    first.setAttribute('tabindex', '0');
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

  test('includes a standalone summary when an explicit tabindex opts it in', () => {
    const region = document.createElement('div');
    const summary = document.createElement('summary');
    summary.tabIndex = 0;
    region.append(summary);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(summary);
    region.remove();
  });

  test('includes only editing hosts unless a nested editable is explicitly opted in', () => {
    const region = document.createElement('div');
    const editingHost = document.createElement('div');
    editingHost.setAttribute('contenteditable', 'true');
    const nestedEditable = document.createElement('div');
    nestedEditable.setAttribute('contenteditable', 'true');
    const optedInNestedEditable = document.createElement('div');
    optedInNestedEditable.setAttribute('contenteditable', 'true');
    optedInNestedEditable.tabIndex = 0;
    const optedInNonEditable = document.createElement('div');
    optedInNonEditable.setAttribute('contenteditable', 'false');
    optedInNonEditable.tabIndex = 0;
    editingHost.append(nestedEditable, optedInNestedEditable, optedInNonEditable);
    region.append(editingHost);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(editingHost);
    expect(targets).not.toContain(nestedEditable);
    expect(targets).toContain(optedInNestedEditable);
    expect(targets).toContain(optedInNonEditable);
    region.remove();
  });

  test('skips controls inside closed details but includes them when open', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.setAttribute('tabindex', '0');
    const button = document.createElement('button');
    button.setAttribute('tabindex', '0');
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
    outerSummary.setAttribute('tabindex', '0');
    const inner = document.createElement('details');
    const innerSummary = document.createElement('summary');
    innerSummary.setAttribute('tabindex', '0');
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
    first.setAttribute('tabindex', '0');
    const checked = document.createElement('input');
    checked.type = 'radio';
    checked.name = 'choice';
    checked.checked = true;
    checked.setAttribute('tabindex', '0');
    const other = document.createElement('input');
    other.type = 'radio';
    other.name = 'other';
    other.setAttribute('tabindex', '0');
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
    first.setAttribute('tabindex', '0');
    const second = document.createElement('input');
    second.type = 'radio';
    second.setAttribute('tabindex', '0');
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
      '<input type="radio" name="foreign" tabindex="0">',
      'text/html',
    );
    const foreignRadio = foreignDocument.querySelector('input') as HTMLElement;
    expect(getSequentialFocusTargets(foreignDocument)).toContain(foreignRadio);
  });

  test('excludes hidden, collapsed, inert, disabled, and negative-tabindex candidates', () => {
    const region = document.createElement('div');
    const visible = document.createElement('button');
    visible.setAttribute('tabindex', '0');
    const hidden = document.createElement('button');
    hidden.hidden = true;
    const collapsed = document.createElement('button');
    collapsed.style.visibility = 'collapse';
    const inert = document.createElement('button');
    inert.setAttribute('inert', '');
    const disabled = document.createElement('button');
    disabled.disabled = true;
    const negative = document.createElement('button');
    negative.setAttribute('tabindex', '-1');
    region.append(visible, hidden, collapsed, inert, disabled, negative);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(visible);
    expect(targets).not.toContain(hidden);
    expect(targets).not.toContain(collapsed);
    expect(targets).not.toContain(inert);
    expect(targets).not.toContain(disabled);
    expect(targets).not.toContain(negative);
    region.remove();
  });

  test('excludes hidden inputs even when an explicit tabindex is supplied', () => {
    const region = document.createElement('div');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.tabIndex = 0;
    region.append(hiddenInput);

    expect(getSequentialFocusTargets(region)).not.toContain(hiddenInput);
  });

  test('keeps focusable aria-hidden elements in the native sequential order', () => {
    const region = document.createElement('div');
    const hiddenFromAccessibilityTree = document.createElement('button');
    hiddenFromAccessibilityTree.type = 'button';
    hiddenFromAccessibilityTree.setAttribute('aria-hidden', 'true');
    region.append(hiddenFromAccessibilityTree);

    expect(getSequentialFocusTargets(region)).toContain(hiddenFromAccessibilityTree);
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
