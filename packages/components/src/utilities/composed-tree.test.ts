/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { getSequentialFocusTargets } = await import('./focus.ts');
const { composedContains, composedFocusScopes } = await import('./composed-tree.ts');

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
  test('traverses slotted controls in composed-tree order without duplicates', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot></slot>';
    const slotted = document.createElement('button');
    slotted.slot = '';
    host.append(slotted);
    document.body.append(host);

    const targets = getSequentialFocusTargets(shadow);
    expect(targets.filter((target) => target === slotted)).toHaveLength(1);
    expect(targets).toContain(slotted);
    host.remove();
  });

  test('excludes a slotted control hidden by an ancestor inside the shadow tree', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<div hidden><slot></slot></div>';
    const slotted = document.createElement('button');
    host.append(slotted);
    document.body.append(host);

    expect(getSequentialFocusTargets(shadow)).not.toContain(slotted);
    host.remove();
  });

  test('does not traverse slot fallback content when the host assigns only text nodes', () => {
    // A host that assigns only text (no elements) to a slot still means the
    // slot has assigned content: assignedElements() returns [] because a
    // text node isn't an Element, but assignedNodes() is non-empty and
    // native fallback content is not rendered in that case. Gating on
    // assignedElements alone would wrongly fall through to traversing the
    // slot's own fallback children as reachable focus targets.
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot><button id="fallback"></button></slot>';
    host.append(document.createTextNode('Just text'));
    document.body.append(host);

    const fallbackButton = shadow.querySelector('button');
    if (!fallbackButton) throw new Error('Expected the slot fallback button');
    expect(getSequentialFocusTargets(shadow)).not.toContain(fallbackButton);
    host.remove();
  });

  test('traverses slot fallback content when the host assigns nothing to the slot at all', () => {
    // The complement of the case above: with no host children at all,
    // `assignedNodes()` is empty (not merely empty of elements), so native
    // fallback content renders and the slot's own declared children become
    // reachable focus targets.
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot><button id="fallback"></button></slot>';
    document.body.append(host);

    const fallbackButton = shadow.querySelector('button');
    if (!fallbackButton) throw new Error('Expected the slot fallback button');
    expect(getSequentialFocusTargets(shadow)).toContain(fallbackButton);
    host.remove();
  });

  test('filters before and after a reference in flattened composed-tree order', () => {
    const region = document.createElement('div');
    const beforeHost = document.createElement('div');
    const before = document.createElement('button');
    beforeHost.attachShadow({ mode: 'open' }).append(before);
    const reference = document.createElement('span');
    const afterHost = document.createElement('div');
    const after = document.createElement('button');
    afterHost.attachShadow({ mode: 'open' }).append(after);
    region.append(beforeHost, reference, afterHost);
    document.body.append(region);

    expect(
      getSequentialFocusTargets(region, { relativeTo: reference, direction: 'before' }),
    ).toEqual([before]);
    expect(
      getSequentialFocusTargets(region, { relativeTo: reference, direction: 'after' }),
    ).toEqual([after]);
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
describe('composedContains', () => {
  test('does not mistake an unslotted light-DOM child for one assigned to its shadow host', () => {
    // The host's shadow root declares only a NAMED slot, and this child
    // carries no matching `slot` attribute, so the browser never assigns it
    // anywhere: `element.assignedSlot` is null and no slot's
    // `assignedElements()` includes it either. `composedParentElement` must
    // still fall through to the light-DOM `parentElement` in that case,
    // rather than getting stuck.
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const namedSlot = document.createElement('slot');
    namedSlot.setAttribute('name', 'known');
    shadowRoot.append(namedSlot);
    const orphan = document.createElement('button');
    host.append(orphan);
    document.body.append(host);

    expect(composedContains(document.body, orphan)).toBe(true);

    host.remove();
  });
});
describe('composedFocusScopes', () => {
  test('walks outward through every level of nested shadow trees to the document', () => {
    const outerHost = document.createElement('div');
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    const innerHost = document.createElement('div');
    outerShadow.append(innerHost);
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const anchor = document.createElement('button');
    innerShadow.append(anchor);
    document.body.append(outerHost);

    const scopes = [...composedFocusScopes(anchor)];

    expect(scopes).toEqual([
      { root: innerShadow, anchor },
      { root: outerShadow, anchor: innerHost },
      { root: document, anchor: outerHost },
    ]);

    outerHost.remove();
  });

  test('accepts a detached element as its own searchable focus scope', () => {
    const anchor = document.createElement('div');
    const scope = [...composedFocusScopes(anchor)];
    expect(scope).toHaveLength(1);
    expect(scope[0]?.root).toBe(anchor);
    expect(scope[0]?.anchor).toBe(anchor);
  });
});
