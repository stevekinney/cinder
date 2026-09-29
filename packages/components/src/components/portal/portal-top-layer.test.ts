import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  findNearestOpenTopLayer,
  observePortalSourceAvailability,
  redispatchPortaledEvent,
  restorePortalGlobalState,
  waitFor,
} from './portal-test-helpers.ts';

beforeEach(() => document.body.replaceChildren());
afterEach(restorePortalGlobalState);

describe('Portal', () => {
  test('finds the innermost open dialog as the top-layer portal target', () => {
    const outerDialog = document.createElement('dialog');
    outerDialog.setAttribute('open', '');
    const innerDialog = document.createElement('dialog');
    innerDialog.setAttribute('open', '');
    const source = document.createElement('button');
    outerDialog.append(innerDialog);
    innerDialog.append(source);
    document.body.append(outerDialog);
    expect(findNearestOpenTopLayer(source, (element) => element === innerDialog)).toBe(innerDialog);
  });

  test('does not treat a non-modal open dialog as a top-layer owner', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    const source = document.createElement('button');
    dialog.append(source);
    document.body.append(dialog);
    expect(findNearestOpenTopLayer(source)).toBeNull();
  });

  test('does not resolve a trigger wrapper marker to itself (self-owned scope)', () => {
    // Regression test: `.cinder-popover__trigger` wrappers tag themselves with
    // `data-cinder-portal-owner` while open so nested content can find an enclosing owner.
    // Resolving that marker back to the trigger's own source produces a self-referential
    // target that later throws `appendChild` on itself — this must fall through to null.
    const trigger = document.createElement('div');
    trigger.className = 'cinder-popover__trigger';
    trigger.setAttribute('data-cinder-portal-owner', 'own-panel-scope');
    const source = document.createElement('button');
    trigger.append(source);
    document.body.append(trigger);

    expect(findNearestOpenTopLayer(source)).toBeNull();
  });

  test('finds an enclosing owner marker beyond the source’s own trigger wrapper', () => {
    // A popover nested inside another popover's trigger content should resolve the OUTER
    // trigger's marker as its owner, not its own (inner) trigger's self-reference.
    const outerTrigger = document.createElement('div');
    outerTrigger.className = 'cinder-popover__trigger';
    outerTrigger.setAttribute('data-cinder-portal-owner', 'outer-scope');
    const outerScope = document.createElement('div');
    outerScope.id = 'outer-scope';
    document.body.append(outerScope);

    const innerTrigger = document.createElement('div');
    innerTrigger.className = 'cinder-popover__trigger';
    innerTrigger.setAttribute('data-cinder-portal-owner', 'inner-scope');
    const source = document.createElement('button');
    innerTrigger.append(source);
    outerTrigger.append(innerTrigger);
    document.body.append(outerTrigger);

    expect(findNearestOpenTopLayer(source)).toBe(outerScope);
  });

  test('crosses an open shadow host while finding a top-layer owner', () => {
    const dialog = document.createElement('dialog');
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const source = document.createElement('button');
    shadow.append(source);
    dialog.append(host);
    document.body.append(dialog);
    expect(findNearestOpenTopLayer(source, (element) => element === dialog)).toBe(dialog);
  });

  test('resolves a portal owner marker and owner inside the same shadow root', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const owner = document.createElement('div');
    owner.id = 'shadow-owner';
    const marker = document.createElement('div');
    marker.setAttribute('data-cinder-portal-owner', owner.id);
    const source = document.createElement('button');
    marker.append(source);
    shadow.append(owner, marker);
    document.body.append(host);

    expect(findNearestOpenTopLayer(source)).toBe(owner);
  });

  test('falls back to the document owner when a shadow-root owner is absent', () => {
    const documentOwner = document.createElement('div');
    documentOwner.id = 'document-owner';
    document.body.append(documentOwner);
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const marker = document.createElement('div');
    marker.setAttribute('data-cinder-portal-owner', documentOwner.id);
    const source = document.createElement('button');
    marker.append(source);
    shadow.append(marker);
    document.body.append(host);

    expect(findNearestOpenTopLayer(source)).toBe(documentOwner);

    marker.setAttribute('data-cinder-portal-owner', 'missing-owner');
    expect(findNearestOpenTopLayer(source)).toBeNull();
  });

  test('finds an enclosing owner marker across nested shadow hosts', () => {
    const owner = document.createElement('div');
    owner.id = 'outer-shadow-owner';
    const outerHost = document.createElement('div');
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    const outerMarker = document.createElement('div');
    outerMarker.setAttribute('data-cinder-portal-owner', owner.id);
    const innerHost = document.createElement('div');
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const source = document.createElement('button');
    innerShadow.append(source);
    outerMarker.append(innerHost);
    outerShadow.append(owner, outerMarker);
    document.body.append(outerHost);

    expect(findNearestOpenTopLayer(source)).toBe(owner);
  });

  test('skips a self-owned trigger marker across shadow boundaries', () => {
    const trigger = document.createElement('div');
    trigger.id = 'shadow-self-owner';
    trigger.className = 'cinder-popover__trigger';
    trigger.setAttribute('data-cinder-portal-owner', trigger.id);
    const outerHost = document.createElement('div');
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    const innerHost = document.createElement('div');
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const source = document.createElement('button');
    innerShadow.append(source);
    outerShadow.append(innerHost);
    trigger.append(outerHost);
    document.body.append(trigger);

    expect(findNearestOpenTopLayer(source)).toBeNull();
  });

  test('prefers a nearer native modal over an outer portal owner marker', () => {
    const outer = document.createElement('div');
    const owner = document.createElement('div');
    owner.id = 'outer-owner';
    outer.setAttribute('data-cinder-portal-owner', owner.id);
    const dialog = document.createElement('dialog');
    const source = document.createElement('button');
    dialog.append(source);
    outer.append(dialog, owner);
    document.body.append(outer);

    expect(findNearestOpenTopLayer(source, (element) => element === dialog)).toBe(dialog);
  });

  test('observePortalSourceAvailability crosses a shadow host for hidden/inert/aria-hidden', async () => {
    // `closest('[hidden], [inert], [aria-hidden="true"]')` cannot see past a
    // shadow boundary. The computed-style walk this helper also runs does
    // cross shadow hosts, but none of these three attributes affect
    // display/visibility on their own, so the source must still be reported
    // unavailable when its enclosing shadow HOST carries one of them.
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const source = document.createElement('button');
    shadow.append(source);
    document.body.append(host);

    const states: boolean[] = [];
    const stop = observePortalSourceAvailability(source, (unavailable) => {
      states.push(unavailable);
    });
    expect(states.at(-1)).toBe(false);

    host.setAttribute('inert', '');
    await waitFor(() => expect(states.at(-1)).toBe(true));

    host.removeAttribute('inert');
    await waitFor(() => expect(states.at(-1)).toBe(false));

    host.setAttribute('aria-hidden', 'true');
    await waitFor(() => expect(states.at(-1)).toBe(true));

    stop();
  });

  test('preserves event propagation flags when redispatching', () => {
    const source = document.createElement('div');
    const target = document.createElement('button');
    source.append(target);
    document.body.append(source);
    let received: Event | undefined;
    source.addEventListener('input', (event) => {
      received = event;
    });
    const original = new Event('input', { bubbles: false, cancelable: false, composed: true });
    Object.defineProperty(original, 'target', { configurable: true, value: target });
    redispatchPortaledEvent(original, source);
    expect(received?.bubbles).toBe(false);
    expect(received?.cancelable).toBe(false);
    expect(received?.composed).toBe(true);
  });
});
