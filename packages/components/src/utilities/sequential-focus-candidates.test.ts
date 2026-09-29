/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { getSequentialFocusTargets } = await import('./focus.ts');

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

describe('getSequentialFocusTargets', () => {
  test('includes text, checkbox, and radio inputs while excluding hidden and disabled inputs', () => {
    const region = document.createElement('div');
    const text = document.createElement('input');
    text.type = 'text';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'choice';
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    const disabled = document.createElement('input');
    disabled.type = 'checkbox';
    disabled.disabled = true;
    region.append(text, checkbox, radio, hidden, disabled);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(text);
    expect(targets).toContain(checkbox);
    expect(targets).toContain(radio);
    expect(targets).not.toContain(hidden);
    expect(targets).not.toContain(disabled);
    region.remove();
  });

  test('includes SVG elements with an explicit tabindex', () => {
    const region = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('tabindex', '0');
    region.append(svg);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toEqual([svg]);
    region.remove();
  });

  test('includes native sequential controls omitted by the old selector', () => {
    const region = document.createElement('div');
    const input = document.createElement('input');
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
    region.append(input, details, iframe, audio, video, embed, object, editable, notEditable);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(input);
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

  test('matches native object tab order only when data is nonempty', () => {
    const region = document.createElement('div');
    const missing = document.createElement('object');
    const empty = document.createElement('object');
    empty.setAttribute('data', '   ');
    const nonempty = document.createElement('object');
    nonempty.setAttribute('data', 'movie.swf');
    region.append(missing, empty, nonempty);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).not.toContain(missing);
    expect(targets).not.toContain(empty);
    expect(targets).toContain(nonempty);
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

  test('picks the in-range member as the fallback when an unchecked group straddles the range boundary', () => {
    // The group's own root (the document) is scanned for members, so a
    // group with one radio before `relativeTo` and one after must restrict
    // its fallback candidates to the in-range side — picking the
    // out-of-range member would drop the in-range radio from the result
    // entirely (it belongs to a group whose chosen representative isn't
    // itself a candidate).
    const region = document.createElement('div');
    const before = document.createElement('input');
    before.type = 'radio';
    before.name = 'straddle';
    before.id = 'radio-before';
    before.setAttribute('tabindex', '0');
    const reference = document.createElement('span');
    const after = document.createElement('input');
    after.type = 'radio';
    after.name = 'straddle';
    after.id = 'radio-after';
    after.setAttribute('tabindex', '0');
    region.append(before, reference, after);
    document.body.append(region);

    const result = getSequentialFocusTargets(region, {
      relativeTo: reference,
      direction: 'after',
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(after);
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
});
