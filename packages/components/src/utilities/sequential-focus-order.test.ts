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
  test('does not revisit positive tabindex targets after a default-tabindex reference', () => {
    const region = document.createElement('div');
    const reference = document.createElement('button');
    const positive = document.createElement('button');
    positive.tabIndex = 1;
    const following = document.createElement('button');
    region.append(reference, positive, following);
    document.body.append(region);

    expect(
      getSequentialFocusTargets(region, { relativeTo: reference, direction: 'after' }),
    ).toEqual([following]);
    region.remove();
  });

  test('skips a lower positive tabindex target after a higher positive reference', () => {
    // Native Tab order visits positive tabindex values ascending, so a
    // tabindex="1" target has already been visited by the time a
    // tabindex="2" reference has focus, regardless of where it sits in the
    // DOM relative to the reference.
    const region = document.createElement('div');
    const reference = document.createElement('button');
    reference.tabIndex = 2;
    const lower = document.createElement('button');
    lower.tabIndex = 1;
    const following = document.createElement('button');
    region.append(reference, lower, following);
    document.body.append(region);

    expect(
      getSequentialFocusTargets(region, { relativeTo: reference, direction: 'after' }),
    ).toEqual([following]);
    region.remove();
  });

  test('skips a higher positive tabindex target before a lower positive reference', () => {
    // The mirror of the case above: a tabindex="5" target has not been
    // visited yet when a tabindex="2" reference has focus, so it cannot be
    // "before" that reference in reverse Tab order even when it sits
    // earlier in the DOM.
    const region = document.createElement('div');
    const higher = document.createElement('button');
    higher.tabIndex = 5;
    const lower = document.createElement('button');
    lower.tabIndex = 1;
    const reference = document.createElement('button');
    reference.tabIndex = 2;
    region.append(higher, lower, reference);
    document.body.append(region);

    expect(
      getSequentialFocusTargets(region, { relativeTo: reference, direction: 'before' }),
    ).toEqual([lower]);
    region.remove();
  });

  test('reaches a higher positive tabindex target positioned before the reference', () => {
    // Native Tab order sorts positive-tabindex elements by tier first, so a
    // tabindex="3" target is "after" a tabindex="2" reference regardless of
    // which one sits earlier in the DOM. A composed-position filter that
    // requires the candidate to be DOM-later than the reference would wrong
    // this case: `higher` sits before `reference` here, but tier order
    // still owes it to forward Tab next.
    const region = document.createElement('div');
    const higher = document.createElement('button');
    higher.tabIndex = 3;
    const reference = document.createElement('button');
    reference.tabIndex = 2;
    const following = document.createElement('button');
    region.append(higher, reference, following);
    document.body.append(region);

    expect(
      getSequentialFocusTargets(region, { relativeTo: reference, direction: 'after' }),
    ).toEqual([higher, following]);
    region.remove();
  });

  test('reaches a lower positive tabindex target positioned after the reference', () => {
    // The mirror of the case above: a tabindex="1" target has already been
    // visited by the time a tabindex="2" reference has focus, so it is
    // "before" that reference in reverse Tab order even though it sits
    // later in the DOM.
    const region = document.createElement('div');
    const reference = document.createElement('button');
    reference.tabIndex = 2;
    const lower = document.createElement('button');
    lower.tabIndex = 1;
    region.append(reference, lower);
    document.body.append(region);

    expect(
      getSequentialFocusTargets(region, { relativeTo: reference, direction: 'before' }),
    ).toEqual([lower]);
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
});
