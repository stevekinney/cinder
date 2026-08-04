/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';

setupHappyDom();
const nativeGetComputedStyle = globalThis.getComputedStyle;

const { render, cleanup, waitFor } = await import('@testing-library/svelte');
const { default: Portal } = await import('./portal.svelte');
const { default: PortalAttachmentTest } = await import('./_portal-attachment-test-harness.svelte');
const {
  copyInheritedPortalAttributes,
  findNearestOpenTopLayer,
  getInheritedPortalStyle,
  invalidatePortalDirection,
  observePortalSourceAvailability,
  redispatchPortaledEvent,
} = await import('./portal.utilities.svelte.ts');

const childSnippet = createRawSnippet(() => ({
  render: () => '<button data-testid="portal-child">Portaled child</button>',
}));

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  // Unmount rendered components (runs Svelte teardown) before clearing the DOM —
  // replaceChildren() alone removes nodes but leaks component effects/subscriptions.
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-cinder-theme');
  document.documentElement.removeAttribute('dir');
  Object.defineProperty(globalThis, 'getComputedStyle', {
    configurable: true,
    value: nativeGetComputedStyle,
  });
  document.head.replaceChildren();
  document.body.replaceChildren();
});

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

  test('preserves mouse and input details when redispatching', () => {
    const source = document.createElement('div');
    let receivedClick: MouseEvent | undefined;
    let receivedInput: { data: string | null; inputType: string } | undefined;
    source.addEventListener('click', (event) => {
      receivedClick = event as MouseEvent;
    });
    source.addEventListener('input', (event) => {
      if (event instanceof InputEvent) {
        receivedInput = { data: event.data, inputType: event.inputType };
      }
    });

    redispatchPortaledEvent(new MouseEvent('click', { bubbles: true, detail: 2 }), source);
    redispatchPortaledEvent(
      new InputEvent('input', { bubbles: true, data: 'x', inputType: 'insertText' }),
      source,
    );

    expect(receivedClick?.detail).toBe(2);
    expect(receivedInput?.data).toBe('x');
    expect(receivedInput?.inputType).toBe('insertText');
  });

  test('preserves the exact original portaled composed path after dispatch', async () => {
    const authoredRoot = document.createElement('div');
    const portaledContainer = document.createElement('div');
    const control = document.createElement('button');
    portaledContainer.append(control);
    document.body.append(authoredRoot, portaledContainer);

    let originalPath: EventTarget[] = [];
    let bridgedEvent: Event | undefined;
    authoredRoot.addEventListener('mousedown', (event) => {
      bridgedEvent = event;
      expect(event.composedPath()[0]).toBe(authoredRoot);
    });

    control.addEventListener('mousedown', (event) => {
      originalPath = event.composedPath() as EventTarget[];
      redispatchPortaledEvent(event, authoredRoot);
    });
    control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
    await tick();

    expect(Array.from(bridgedEvent?.composedPath() ?? [])).toEqual(originalPath);
    expect(originalPath[0]).toBe(control);
    expect(originalPath).toContain(portaledContainer);
    expect(originalPath).not.toContain(authoredRoot);
  });

  test('bridges pointer and mouse families with native-parity delivery', () => {
    const authoredRoot = document.createElement('div');
    const control = document.createElement('button');
    document.body.append(authoredRoot, control);
    const received: string[] = [];
    authoredRoot.addEventListener('pointerdown', () => received.push('pointerdown'));
    authoredRoot.addEventListener('mousedown', () => received.push('mousedown'));
    const pointer = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(pointer, 'target', { configurable: true, value: control });
    const mouse = new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 20 });
    Object.defineProperty(mouse, 'target', { configurable: true, value: control });
    redispatchPortaledEvent(pointer, authoredRoot);
    redispatchPortaledEvent(mouse, authoredRoot);

    expect(received).toEqual(['pointerdown', 'mousedown']);
  });

  test('bridges an independent synthetic mouse event after a pointer event', () => {
    const authoredRoot = document.createElement('div');
    const control = document.createElement('button');
    document.body.append(authoredRoot, control);
    let received = 0;
    authoredRoot.addEventListener('mousedown', () => {
      received += 1;
    });
    const pointer = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(pointer, 'target', { configurable: true, value: control });
    const mouse = new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 20 });
    Object.defineProperty(mouse, 'target', { configurable: true, value: control });
    redispatchPortaledEvent(pointer, authoredRoot);
    redispatchPortaledEvent(mouse, authoredRoot);

    expect(received).toBe(1);
  });

  test('deduplicates browser mouse follow-ups for one mouse pointer action', () => {
    const authoredRoot = document.createElement('div');
    const control = document.createElement('button');
    document.body.append(authoredRoot, control);
    const received: string[] = [];
    authoredRoot.addEventListener('pointerdown', () => received.push('pointerdown'));
    authoredRoot.addEventListener('mousedown', () => received.push('mousedown'));
    authoredRoot.addEventListener('pointerup', () => received.push('pointerup'));
    authoredRoot.addEventListener('mouseup', () => received.push('mouseup'));

    const pointerEvent = (type: string) =>
      new (globalThis.PointerEvent ?? Event)(type, {
        bubbles: true,
        composed: true,
        pointerType: 'mouse',
        button: 0,
        clientX: 24,
        clientY: 36,
      });
    const pointerdown = pointerEvent('pointerdown');
    Object.defineProperty(pointerdown, 'target', { configurable: true, value: control });
    const mousedown = new MouseEvent('mousedown', {
      bubbles: true,
      composed: true,
      button: 0,
      clientX: 24,
      clientY: 36,
    });
    Object.defineProperty(mousedown, 'target', { configurable: true, value: control });
    const pointerup = pointerEvent('pointerup');
    Object.defineProperty(pointerup, 'target', { configurable: true, value: control });
    const mouseup = new MouseEvent('mouseup', {
      bubbles: true,
      composed: true,
      button: 0,
      clientX: 24,
      clientY: 36,
    });
    Object.defineProperty(mouseup, 'target', { configurable: true, value: control });

    redispatchPortaledEvent(pointerdown, authoredRoot);
    redispatchPortaledEvent(mousedown, authoredRoot);
    redispatchPortaledEvent(pointerup, authoredRoot);
    redispatchPortaledEvent(mouseup, authoredRoot);

    expect(received).toEqual(['pointerdown', 'pointerup']);
  });

  test('preserves pointer and mouse event class details when constructible', () => {
    const authoredRoot = document.createElement('div');
    const control = document.createElement('button');
    document.body.append(authoredRoot, control);
    let receivedMouse: MouseEvent | undefined;
    let receivedPointer: Event | undefined;
    authoredRoot.addEventListener('mousedown', (event) => (receivedMouse = event));
    authoredRoot.addEventListener('pointerdown', (event) => (receivedPointer = event));

    const mouse = new MouseEvent('mousedown', {
      bubbles: true,
      clientX: 10,
      clientY: 20,
      button: 1,
    });
    Object.defineProperty(mouse, 'movementX', { configurable: true, value: 3 });
    Object.defineProperty(mouse, 'movementY', { configurable: true, value: -2 });
    Object.defineProperty(mouse, 'which', { configurable: true, value: 2 });
    Object.defineProperty(mouse, 'target', { configurable: true, value: control });
    redispatchPortaledEvent(mouse, authoredRoot);

    const PointerConstructor = globalThis.PointerEvent;
    if (PointerConstructor) {
      const pointer = new PointerConstructor('pointerdown', {
        bubbles: true,
        pointerType: 'mouse',
        width: 8,
        height: 9,
      });
      Object.defineProperty(pointer, 'target', { configurable: true, value: control });
      redispatchPortaledEvent(pointer, authoredRoot);
    }

    expect(receivedMouse).toBeInstanceOf(MouseEvent);
    expect(receivedMouse?.movementX).toBe(3);
    expect(receivedMouse?.movementY).toBe(-2);
    expect(receivedMouse?.which).toBe(2);
    if (PointerConstructor) {
      expect(receivedPointer).toBeInstanceOf(PointerConstructor);
      expect((receivedPointer as PointerEvent).width).toBe(8);
      expect((receivedPointer as PointerEvent).height).toBe(9);
    }
  });

  test('propagates cancellation from the authored root back to the portaled event', () => {
    const authoredRoot = document.createElement('div');
    const control = document.createElement('button');
    document.body.append(authoredRoot, control);
    authoredRoot.addEventListener('mouseup', (event) => event.preventDefault());

    const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
    Object.defineProperty(mouseup, 'target', { configurable: true, value: control });
    redispatchPortaledEvent(mouseup, authoredRoot);

    expect(mouseup.defaultPrevented).toBe(true);
  });

  test('serializes scoped Cinder tokens and color scheme for a portaled surface', () => {
    const source = document.createElement('div');
    source.style.setProperty('--cinder-surface', 'hotpink');
    source.style.colorScheme = 'dark';
    document.body.append(source);

    const inheritedStyle = getInheritedPortalStyle(source);

    expect(inheritedStyle).toContain('--cinder-surface: hotpink');
    expect(inheritedStyle).toContain('color-scheme: dark');
  });

  test('takes typography from the source parent context', () => {
    const parent = document.createElement('div');
    parent.style.fontWeight = '400';
    const source = document.createElement('button');
    source.style.fontWeight = '700';
    parent.append(source);
    document.body.append(parent);
    expect(getInheritedPortalStyle(source)).toContain('font-weight: 400');
  });

  test('serializes an explicit normal color scheme for a portaled surface', () => {
    const source = document.createElement('div');
    source.style.colorScheme = 'normal';
    document.body.append(source);

    expect(getInheritedPortalStyle(source)).toContain('color-scheme: normal');
  });

  test('keeps computed values for Cinder aliases with non-Cinder dependencies', () => {
    const source = document.createElement('div');
    source.style.setProperty('--brand-surface', 'red');
    source.style.setProperty('--cinder-surface', 'var(--brand-surface)');
    document.body.append(source);

    expect(getInheritedPortalStyle(source)).toContain('--cinder-surface: red');
    expect(getInheritedPortalStyle(source)).not.toContain('var(--brand-surface)');
  });

  test('preserves an explicit language on direct attachment copies', () => {
    const source = document.createElement('div');
    source.lang = 'en';
    const element = document.createElement('div');
    element.lang = 'fr';
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);
    expect(element.lang).toBe('fr');
  });

  test('inherits computed direction when no explicit dir ancestor exists', () => {
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('inherits computed direction from a CSS class', () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = '.portal-rtl { direction: rtl; }';
    document.head.append(stylesheet);
    const source = document.createElement('div');
    source.className = 'portal-rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);
    stylesheet.remove();

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('prefers computed direction over the document default', () => {
    document.documentElement.setAttribute('dir', 'ltr');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('preserves automatic direction from the document root', () => {
    document.documentElement.setAttribute('dir', 'auto');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('auto');
  });

  test('preserves case-insensitive automatic direction from the document root', () => {
    document.documentElement.setAttribute('dir', 'AUTO');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    document.body.append(source, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('auto');
  });

  test('inherits an explicit direction across a shadow host', () => {
    const host = document.createElement('div');
    host.setAttribute('dir', 'AUTO');
    const shadow = host.attachShadow({ mode: 'open' });
    const generatedWrapper = document.createElement('div');
    generatedWrapper.setAttribute('dir', 'ltr');
    generatedWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    const element = document.createElement('div');
    generatedWrapper.append(source);
    shadow.append(generatedWrapper);
    document.body.append(host, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('auto');
  });

  test('does not let a generated outer portal direction mask inner computed direction', () => {
    document.documentElement.setAttribute('dir', 'ltr');
    const outerWrapper = document.createElement('div');
    outerWrapper.setAttribute('dir', 'ltr');
    outerWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    outerWrapper.append(source, element);
    document.body.append(outerWrapper);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('stops generated direction lookup at a shadow-root portal boundary', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const destination = document.createElement('div');
    destination.setAttribute('dir', 'ltr');
    const generatedWrapper = document.createElement('div');
    generatedWrapper.setAttribute('dir', 'ltr');
    generatedWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const element = document.createElement('div');
    generatedWrapper.append(source);
    destination.append(generatedWrapper);
    shadow.append(destination);
    document.body.append(host, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('inherits a generated outer portal direction without computed-style support', () => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: undefined,
    });
    const outerWrapper = document.createElement('div');
    outerWrapper.setAttribute('dir', 'rtl');
    outerWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    const element = document.createElement('div');
    outerWrapper.append(source, element);
    document.body.append(outerWrapper);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('falls back to a generated shadow-root direction without computed-style support', () => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: undefined,
    });
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const destination = document.createElement('div');
    destination.setAttribute('dir', 'ltr');
    const generatedWrapper = document.createElement('div');
    generatedWrapper.setAttribute('dir', 'rtl');
    generatedWrapper.setAttribute('data-cinder-portal-inherited-direction', 'true');
    const source = document.createElement('div');
    const element = document.createElement('div');
    generatedWrapper.append(source);
    destination.append(generatedWrapper);
    shadow.append(destination);
    document.body.append(host, element);

    copyInheritedPortalAttributes(element, source, true);

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('preserves an initial direction on a direct portal attachment', async () => {
    const source = document.createElement('div');
    source.style.direction = 'ltr';
    const target = document.createElement('div');
    document.body.append(source, target);

    render(PortalAttachmentTest, {
      props: { source, target, initialDirection: 'rtl' },
    });
    await tick();

    expect(
      target.querySelector('[data-testid="direct-portal-attachment"]')?.getAttribute('dir'),
    ).toBe('rtl');
  });

  test('inherits direction when a direct portal attachment has no initial direction', async () => {
    const source = document.createElement('div');
    source.setAttribute('dir', 'ltr');
    const target = document.createElement('div');
    document.body.append(source, target);

    render(PortalAttachmentTest, { props: { source, target } });
    await tick();

    expect(
      target.querySelector('[data-testid="direct-portal-attachment"]')?.getAttribute('dir'),
    ).toBe('ltr');
  });

  test('updates inherited computed direction when the source style changes', async () => {
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    source.style.direction = 'ltr';
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('ltr'));

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('updates inherited computed direction after a sibling selector changes', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    const sibling = document.createElement('div');
    document.body.append(sibling, source);

    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          Object.defineProperty(computed, 'direction', {
            configurable: true,
            value: sibling.classList.contains('portal-rtl') ? 'rtl' : 'ltr',
          });
        }
        return computed;
      },
    });
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    sibling.classList.add('portal-rtl');
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: nativeGetComputedStyle,
    });
  });

  test('updates computed direction after a CSSOM invalidation hook', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    let direction: 'ltr' | 'rtl' = 'ltr';
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          Object.defineProperty(computed, 'direction', { configurable: true, value: direction });
        }
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    direction = 'rtl';
    invalidatePortalDirection();
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
  });

  test('does not register media listeners without mounted portals', () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    let matchMediaCalls = 0;
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-color-scheme: dark)' }, cssRules: [] }],
    });
    window.matchMedia = ((query: string) => {
      matchMediaCalls += 1;
      return { media: query } as MediaQueryList;
    }) as typeof window.matchMedia;

    invalidatePortalDirection();

    expect(matchMediaCalls).toBe(0);
    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) {
      Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    } else {
      Reflect.deleteProperty(document, 'styleSheets');
    }
  });

  test('registers stylesheet-level media conditions for invalidation', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-color-scheme: dark)' }, cssRules: [] }],
    });
    const originalMatchMedia = window.matchMedia;
    let observedQuery = '';
    window.matchMedia = ((query: string) => {
      observedQuery = query;
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;
    const mountPoint = document.createElement('div');
    document.body.append(mountPoint);

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    expect(observedQuery).toBe('(prefers-color-scheme: dark)');
    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) {
      Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    } else {
      Reflect.deleteProperty(document, 'styleSheets');
    }
  });

  test('refreshes media listeners when a later portal registers a shadow root', async () => {
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    const removedQueries: string[] = [];
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => removedQueries.push(query),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;

    const firstMountPoint = document.createElement('div');
    document.body.append(firstMountPoint);
    render(Portal, { target: firstMountPoint, props: { children: childSnippet } });
    await tick();

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    Object.defineProperty(shadow, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-color-scheme: dark)' }, cssRules: [] }],
    });
    const secondMountPoint = document.createElement('div');
    shadow.append(secondMountPoint);
    document.body.append(host);

    const secondView = render(Portal, {
      target: secondMountPoint,
      props: { children: childSnippet },
    });
    await tick();

    expect(observedQueries).toContain('(prefers-color-scheme: dark)');
    secondView.unmount();
    expect(removedQueries).toContain('(prefers-color-scheme: dark)');
    window.matchMedia = originalMatchMedia;
  });

  test('registers media conditions from every enclosing shadow root', async () => {
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;

    const outerHost = document.createElement('div');
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    Object.defineProperty(outerShadow, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-contrast: more)' }, cssRules: [] }],
    });
    const innerHost = document.createElement('div');
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    innerShadow.append(mountPoint);
    outerShadow.append(innerHost);
    document.body.append(outerHost);

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    expect(observedQueries).toContain('(prefers-contrast: more)');
    window.matchMedia = originalMatchMedia;
  });

  test('registers enclosing shadow-root media without MutationObserver support', async () => {
    const originalMutationObserver = globalThis.MutationObserver;
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: undefined,
    });
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;

    const outerHost = document.createElement('div');
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    Object.defineProperty(outerShadow, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-contrast: more)' }, cssRules: [] }],
    });
    const innerHost = document.createElement('div');
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    innerShadow.append(mountPoint);
    outerShadow.append(innerHost);
    document.body.append(outerHost);

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    expect(observedQueries).toContain('(prefers-contrast: more)');
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: originalMutationObserver,
    });
    window.matchMedia = originalMatchMedia;
  });

  test('refreshes media listeners when the CSSOM invalidation hook changes rules', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(min-width: 1px)' }, cssRules: [] }],
    });
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;
    const mountPoint = document.createElement('div');
    document.body.append(mountPoint);
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(max-width: 1px)' }, cssRules: [] }],
    });
    invalidatePortalDirection();
    expect(observedQueries).toContain('(max-width: 1px)');

    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    else Reflect.deleteProperty(document, 'styleSheets');
  });

  test('refreshes adopted stylesheet media through the CSSOM invalidation hook', async () => {
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.append(mountPoint);
    document.body.append(host);
    Object.defineProperty(shadow, 'adoptedStyleSheets', {
      configurable: true,
      value: [],
    });
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    Object.defineProperty(shadow, 'adoptedStyleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-contrast: more)' }, cssRules: [] }],
    });
    invalidatePortalDirection();

    expect(observedQueries).toContain('(prefers-contrast: more)');
    window.matchMedia = originalMatchMedia;
  });

  test('refreshes direction and media inventory when live style text changes', async () => {
    const style = document.createElement('style');
    style.textContent = '.direction { direction: ltr; }';
    document.head.append(style);
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          Object.defineProperty(computed, 'direction', {
            configurable: true,
            value: style.textContent?.includes('rtl') ? 'rtl' : 'ltr',
          });
        }
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    style.firstChild!.textContent =
      '@media (prefers-contrast: more) { .direction { direction: rtl; } }';
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
    expect(observedQueries).toContain('(prefers-contrast: more)');
    window.matchMedia = originalMatchMedia;
  });

  test('refreshes media inventory for stylesheets nested in inserted subtrees', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    const removedQueries: string[] = [];
    const stylesheetContainer = document.createElement('div');
    stylesheetContainer.append(document.createElement('style'));
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      get: () =>
        stylesheetContainer.isConnected
          ? [{ media: { mediaText: '(prefers-reduced-transparency: reduce)' }, cssRules: [] }]
          : [],
    });
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => removedQueries.push(query),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;
    const mountPoint = document.createElement('div');
    document.body.append(mountPoint);
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    document.body.append(stylesheetContainer);
    await waitFor(() =>
      expect(observedQueries).toContain('(prefers-reduced-transparency: reduce)'),
    );
    stylesheetContainer.remove();
    await waitFor(() => expect(removedQueries).toContain('(prefers-reduced-transparency: reduce)'));

    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    else Reflect.deleteProperty(document, 'styleSheets');
  });

  test('does not refresh media inventory for non-stylesheet links', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    const removedQueries: string[] = [];
    let exposeMediaQuery = true;
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      get: () =>
        exposeMediaQuery
          ? [{ media: { mediaText: '(prefers-reduced-transparency: reduce)' }, cssRules: [] }]
          : [],
    });
    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => removedQueries.push(query),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList) as typeof window.matchMedia;
    const mountPoint = document.createElement('div');
    document.body.append(mountPoint);
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    exposeMediaQuery = false;
    const iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    document.head.append(iconLink);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(removedQueries).not.toContain('(prefers-reduced-transparency: reduce)');
    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    else Reflect.deleteProperty(document, 'styleSheets');
  });

  test('refreshes media inventory after a shadow-root stylesheet loads', async () => {
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const stylesheetLink = document.createElement('link');
    stylesheetLink.rel = 'stylesheet';
    const loadListener: { current: EventListener | null } = { current: null };
    const nativeAddEventListener = shadow.addEventListener.bind(shadow);
    shadow.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'load' && typeof listener === 'function') loadListener.current = listener;
      nativeAddEventListener(type, listener, options);
    }) as typeof shadow.addEventListener;
    const mountPoint = document.createElement('div');
    shadow.append(stylesheetLink, mountPoint);
    document.body.append(host);
    let loaded = false;
    Object.defineProperty(shadow, 'styleSheets', {
      configurable: true,
      get: () =>
        loaded ? [{ media: { mediaText: '(prefers-contrast: more)' }, cssRules: [] }] : [],
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    expect(observedQueries).not.toContain('(prefers-contrast: more)');

    loaded = true;
    expect(loadListener.current).not.toBeNull();
    loadListener.current?.call(shadow, { target: stylesheetLink } as unknown as Event);
    await waitFor(() => expect(observedQueries).toContain('(prefers-contrast: more)'));
    window.matchMedia = originalMatchMedia;
  });

  test('invalidates direction on pointer transitions', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    let direction: 'ltr' | 'rtl' = 'ltr';
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint)
          Object.defineProperty(computed, 'direction', { configurable: true, value: direction });
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    direction = 'rtl';
    document.dispatchEvent(new Event('pointerdown'));
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));

    direction = 'ltr';
    document.dispatchEvent(new Event('pointerup'));
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('ltr'));
  });

  test('invalidates direction when the fragment target changes', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    let direction: 'ltr' | 'rtl' = 'ltr';
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint)
          Object.defineProperty(computed, 'direction', { configurable: true, value: direction });
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    direction = 'rtl';
    window.dispatchEvent(new Event('hashchange'));
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
  });

  test('invalidates and releases shadow-root state event listeners', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.append(mountPoint);
    document.body.append(host);
    const toggleListener: { current: EventListener | null } = { current: null };
    let removedToggleListeners = 0;
    const nativeAddEventListener = shadow.addEventListener.bind(shadow);
    const nativeRemoveEventListener = shadow.removeEventListener.bind(shadow);
    shadow.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'toggle' && typeof listener === 'function') toggleListener.current = listener;
      nativeAddEventListener(type, listener, options);
    }) as typeof shadow.addEventListener;
    shadow.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      if (type === 'toggle' && listener === toggleListener.current) removedToggleListeners += 1;
      nativeRemoveEventListener(type, listener, options);
    }) as typeof shadow.removeEventListener;
    let direction: 'ltr' | 'rtl' = 'ltr';
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          Object.defineProperty(computed, 'direction', { configurable: true, value: direction });
        }
        return computed;
      },
    });

    const view = render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');
    expect(toggleListener.current).not.toBeNull();

    direction = 'rtl';
    toggleListener.current?.call(shadow, { target: mountPoint } as unknown as Event);
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
    view.unmount();
    expect(removedToggleListeners).toBe(1);
  });

  test('rebinds shadow-root and ancestor observers when the source moves', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(min-width: 1px)' }, cssRules: [] }],
    });
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    Object.defineProperty(shadow, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(max-width: 1px)' }, cssRules: [] }],
    });
    window.matchMedia = ((query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    }) as typeof window.matchMedia;
    const oldAncestor = document.createElement('div');
    oldAncestor.setAttribute('dir', 'ltr');
    oldAncestor.setAttribute('lang', 'en');
    oldAncestor.setAttribute('data-theme', 'old-theme');
    host.setAttribute('dir', 'auto');
    host.setAttribute('lang', 'ar');
    host.setAttribute('data-theme', 'new-theme');
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    oldAncestor.append(source);
    document.body.append(oldAncestor, host);
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint)
          Object.defineProperty(computed, 'direction', {
            configurable: true,
            value: 'ltr',
          });
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');
    expect(wrapper?.getAttribute('lang')).toBe('en');
    expect(wrapper?.getAttribute('data-theme')).toBe('old-theme');

    shadow.append(source);
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('auto'));
    expect(wrapper?.getAttribute('lang')).toBe('ar');
    expect(wrapper?.getAttribute('data-theme')).toBe('new-theme');
    expect(observedQueries).toContain('(max-width: 1px)');

    host.setAttribute('lang', 'he');
    host.setAttribute('data-theme', 'updated-theme');
    host.setAttribute('data-cinder-theme', 'contrast');
    await waitFor(() => expect(wrapper?.getAttribute('lang')).toBe('he'));
    expect(wrapper?.getAttribute('data-theme')).toBe('updated-theme');
    expect(wrapper?.getAttribute('data-cinder-theme')).toBe('contrast');

    oldAncestor.setAttribute('lang', 'stale');
    oldAncestor.setAttribute('data-theme', 'stale-theme');
    await tick();
    expect(wrapper?.getAttribute('lang')).toBe('he');
    expect(wrapper?.getAttribute('data-theme')).toBe('updated-theme');

    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    else Reflect.deleteProperty(document, 'styleSheets');
  });

  test('observes direction invalidations inside a shadow root', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    const sibling = document.createElement('div');
    source.append(mountPoint);
    shadow.append(sibling, source);
    document.body.append(host);
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          Object.defineProperty(computed, 'direction', {
            configurable: true,
            value: sibling.classList.contains('portal-rtl') ? 'rtl' : 'ltr',
          });
        }
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    sibling.classList.add('portal-rtl');
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
  });

  test('invalidates direction for arbitrary selector attributes', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    let direction: 'ltr' | 'rtl' = 'ltr';
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          Object.defineProperty(computed, 'direction', { configurable: true, value: direction });
        }
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    direction = 'rtl';
    source.setAttribute('data-locale', 'ar');
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
  });

  test('mounts without computed-style observation when getComputedStyle is unavailable', async () => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: undefined,
    });

    render(Portal, { props: { children: childSnippet } });
    await tick();

    expect(document.body.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('moves children into a custom target', async () => {
    const host = document.createElement('div');
    host.id = 'portal-host';
    document.body.appendChild(host);

    const view = render(Portal, {
      props: {
        target: '#portal-host',
        children: childSnippet,
      },
    });

    await tick();

    expect(host.querySelector('[data-testid="portal-child"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="portal-child"]')).toBeNull();

    view.unmount();
    expect(host.querySelector('[data-testid="portal-child"]')).toBeNull();
  });

  test('renders inline when disabled', async () => {
    const { container } = render(Portal, {
      props: {
        disabled: true,
        class: 'portal-inline',
        children: childSnippet,
      },
    });

    await tick();

    expect(container.querySelector('.portal-inline [data-testid="portal-child"]')).not.toBeNull();
  });

  test('preserves explicit portal attributes when no inherited source attribute exists', async () => {
    render(Portal, {
      props: {
        dir: 'rtl',
        'data-theme': 'dark',
        'data-cinder-theme': 'high-contrast',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector(
      '[dir="rtl"][data-theme="dark"][data-cinder-theme="high-contrast"]',
    );
    expect(wrapper?.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('preserves explicit portal theme attributes over inherited root themes', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-cinder-theme', 'light');

    render(Portal, {
      props: {
        'data-theme': 'dark',
        'data-cinder-theme': 'contrast',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');
    expect(wrapper?.getAttribute('data-cinder-theme')).toBe('contrast');
  });

  test('keeps updated explicit portal theme attributes during inherited sync', async () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const { rerender } = render(Portal, {
      props: {
        'data-theme': 'dark',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    await rerender({
      'data-theme': 'light',
      children: childSnippet,
    });
    await tick();
    document.documentElement.setAttribute('data-theme', 'dark');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('light');
  });

  test('allows clearing explicit portal theme attributes during inherited sync', async () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const { rerender } = render(Portal, {
      props: {
        'data-theme': 'dark',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    await rerender({
      'data-theme': undefined,
      children: childSnippet,
    });
    await tick();
    expect(wrapper?.getAttribute('data-theme')).toBe('light');

    document.documentElement.setAttribute('data-theme', 'contrast');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('contrast');
  });

  test('allows explicit null to clear portal theme attributes during inherited sync', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-cinder-theme', 'high-contrast');

    const { rerender } = render(Portal, {
      props: {
        'data-theme': 'dark',
        'data-cinder-theme': 'dark',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');
    expect(wrapper?.getAttribute('data-cinder-theme')).toBe('dark');

    await rerender({
      'data-theme': null,
      'data-cinder-theme': null,
      children: childSnippet,
    });
    await tick();

    expect(wrapper?.hasAttribute('data-theme')).toBe(false);
    expect(wrapper?.hasAttribute('data-cinder-theme')).toBe(false);

    document.documentElement.setAttribute('data-theme', 'contrast');
    document.documentElement.setAttribute('data-cinder-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.hasAttribute('data-theme')).toBe(false);
    expect(wrapper?.hasAttribute('data-cinder-theme')).toBe(false);
  });

  test('preserves same-value explicit portal theme attributes during inherited sync', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    const { rerender } = render(Portal, {
      props: {
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    await rerender({
      'data-theme': 'dark',
      children: childSnippet,
    });
    await tick();
    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('dark');
  });

  test('omits portal children from SSR when disabled is false', async () => {
    const sourcePath = new URL('./portal.svelte', import.meta.url).pathname;
    const result = await renderThenHydrate(Portal, sourcePath, {
      children: childSnippet,
      disabled: false,
    });

    try {
      expect(result.ssrHtml).not.toContain('Portaled child');
    } finally {
      result.cleanup();
    }
  });

  test('retargets when the target prop changes after mount', async () => {
    const hostA = document.createElement('div');
    hostA.id = 'portal-host-a';
    const hostB = document.createElement('div');
    hostB.id = 'portal-host-b';
    document.body.append(hostA, hostB);

    const { rerender } = render(Portal, {
      props: { target: '#portal-host-a', children: childSnippet },
    });

    await tick();
    expect(hostA.querySelector('[data-testid="portal-child"]')).not.toBeNull();

    await rerender({ target: '#portal-host-b', children: childSnippet });
    await tick();

    expect(hostA.querySelector('[data-testid="portal-child"]')).toBeNull();
    expect(hostB.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('renders inline when the target selector is unresolved after hydration', async () => {
    const { container } = render(Portal, {
      props: {
        target: '#missing-portal-host',
        children: childSnippet,
      },
    });

    await tick();

    expect(container.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('clears inherited attributes back to explicit initial values', () => {
    const element = document.createElement('div');
    element.setAttribute('dir', 'ltr');

    const themedSource = document.createElement('section');
    themedSource.setAttribute('dir', 'rtl');
    themedSource.setAttribute('data-theme', 'dark');
    themedSource.setAttribute('data-cinder-theme', 'dark');
    const child = document.createElement('span');
    themedSource.appendChild(child);

    copyInheritedPortalAttributes(element, child, true, {
      dir: 'ltr',
      dataTheme: null,
      theme: null,
    });

    expect(element.getAttribute('dir')).toBe('rtl');
    expect(element.getAttribute('data-theme')).toBe('dark');
    expect(element.getAttribute('data-cinder-theme')).toBe('dark');

    copyInheritedPortalAttributes(element, null, true, {
      dir: 'ltr',
      dataTheme: null,
      theme: null,
    });

    expect(element.getAttribute('dir')).toBe('ltr');
    expect(element.hasAttribute('data-theme')).toBe(false);
    expect(element.hasAttribute('data-cinder-theme')).toBe(false);
  });

  test('keeps inherited portal theme attributes synchronized while mounted', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('dir', 'ltr');

    render(Portal, {
      props: {
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('light');
  });

  test('updates inherited portal direction when the source stops providing an explicit dir', async () => {
    document.documentElement.removeAttribute('dir');

    const scopedAncestor = document.createElement('section');
    scopedAncestor.setAttribute('dir', 'rtl');
    const mountPoint = document.createElement('div');
    scopedAncestor.appendChild(mountPoint);
    document.body.appendChild(scopedAncestor);

    const { container } = render(Portal, {
      target: mountPoint,
      props: {
        children: childSnippet,
      },
    });
    scopedAncestor.appendChild(container);

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    scopedAncestor.removeAttribute('dir');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('preserves an explicitly empty inherited language', () => {
    const scopedAncestor = document.createElement('section');
    scopedAncestor.setAttribute('lang', '');
    const source = document.createElement('span');
    scopedAncestor.appendChild(source);
    const element = document.createElement('div');

    copyInheritedPortalAttributes(element, source, true, {
      dir: null,
      lang: null,
      dataTheme: null,
      theme: null,
    });

    expect(element.hasAttribute('lang')).toBe(true);
    expect(element.getAttribute('lang')).toBe('');
  });

  test('updates explicit language without remounting focused content', async () => {
    const view = render(Portal, {
      props: {
        lang: 'en',
        children: childSnippet,
      },
    });
    await tick();
    const button = document.body.querySelector<HTMLButtonElement>('[data-testid="portal-child"]')!;
    const wrapper = button.parentElement;
    button.focus();

    await view.rerender({
      lang: 'fr',
      children: childSnippet,
    });
    await tick();

    expect(button.parentElement?.getAttribute('lang')).toBe('fr');
    expect(button.parentElement).toBe(wrapper);
    expect(document.activeElement).toBe(button);
  });

  test('follows scoped theme additions on source ancestors while mounted', async () => {
    const scopedAncestor = document.createElement('section');
    const mountPoint = document.createElement('div');
    scopedAncestor.appendChild(mountPoint);
    document.body.appendChild(scopedAncestor);

    const { container } = render(Portal, {
      target: mountPoint,
      props: {
        children: childSnippet,
      },
    });
    scopedAncestor.appendChild(container);

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.hasAttribute('data-theme')).toBe(false);

    scopedAncestor.setAttribute('data-theme', 'dark');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('dark');
  });

  test('follows inherited attributes across a shadow host while mounted', async () => {
    const host = document.createElement('section');
    host.setAttribute('data-theme', 'dark');
    const shadow = host.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.body.appendChild(host);

    render(Portal, {
      target: mountPoint,
      props: {
        children: childSnippet,
      },
    });
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    host.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('light');
  });

  test('preserves a protected computed direction over inherited auto direction', () => {
    const element = document.createElement('div');
    element.setAttribute('dir', 'rtl');
    element.dataset['cinderExplicitDirection'] = 'true';

    const autoDirectionSource = document.createElement('section');
    autoDirectionSource.setAttribute('dir', 'auto');
    const child = document.createElement('span');
    autoDirectionSource.appendChild(child);

    copyInheritedPortalAttributes(element, child, true, {
      dir: 'rtl',
      dataTheme: null,
      theme: null,
    });

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('detaches from the target and reappears inline when disabled flips false to true', async () => {
    // Regression for Codex round 2 finding: previously the $effect cleanup detached the wrapper
    // when `disabled` flipped true but nothing reattached it inline, so the child silently vanished
    // from the entire DOM. The placeholder comment anchor now reinserts the wrapper inline.
    const host = document.createElement('div');
    host.id = 'portal-host';
    document.body.appendChild(host);

    const { container, rerender } = render(Portal, {
      props: { target: '#portal-host', disabled: false, children: childSnippet },
    });

    await tick();
    expect(host.querySelector('[data-testid="portal-child"]')).not.toBeNull();

    await rerender({ target: '#portal-host', disabled: true, children: childSnippet });
    await tick();

    // After disabling: gone from the previous target, present back in the original render container.
    expect(host.querySelector('[data-testid="portal-child"]')).toBeNull();
    expect(container.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('restores current explicit direction when a portal is disabled inline', async () => {
    const host = document.createElement('div');
    host.id = 'portal-host';
    document.body.appendChild(host);

    const { container, rerender } = render(Portal, {
      props: { target: '#portal-host', dir: 'rtl', disabled: false, children: childSnippet },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    await rerender({ target: '#portal-host', dir: 'ltr', disabled: true, children: childSnippet });
    await tick();

    expect(container.querySelector('[data-testid="portal-child"]')?.parentElement).toBe(wrapper);
    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('resumes inherited direction when an explicit portal direction is removed', async () => {
    const view = render(Portal, {
      props: { dir: 'ltr', children: childSnippet },
    });
    view.container.style.direction = 'rtl';
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await view.rerender({ dir: undefined, children: childSnippet });
    await tick();

    expect(wrapper?.getAttribute('dir')).toBe('rtl');
  });

  test('allows explicit null to clear portal direction during inherited sync', async () => {
    document.documentElement.setAttribute('dir', 'rtl');

    const { rerender } = render(Portal, {
      props: { dir: 'ltr', children: childSnippet },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await rerender({ dir: null, children: childSnippet });
    await tick();

    expect(wrapper?.hasAttribute('dir')).toBe(false);

    document.documentElement.setAttribute('dir', 'auto');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.hasAttribute('dir')).toBe(false);
  });

  test('clears a removed explicit direction instead of restoring the mount value', async () => {
    const { rerender } = render(Portal, {
      props: { dir: 'rtl', children: childSnippet },
    });

    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    await rerender({ dir: undefined, children: childSnippet });
    await tick();

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('falls back to an authored source direction after removing an explicit direction', async () => {
    const source = document.createElement('section');
    source.setAttribute('dir', 'rtl');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);

    const { container, rerender } = render(Portal, {
      target: mountPoint,
      props: { dir: 'ltr', children: childSnippet },
    });
    source.append(container);
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await rerender({ dir: undefined, children: childSnippet });
    await tick();

    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    source.setAttribute('dir', 'ltr');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('falls back to a computed source direction after removing an explicit direction', async () => {
    const source = document.createElement('section');
    source.style.direction = 'rtl';
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);

    const { container, rerender } = render(Portal, {
      target: mountPoint,
      props: { dir: 'ltr', children: childSnippet },
    });
    source.append(container);
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await rerender({ dir: undefined, children: childSnippet });
    await tick();

    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    source.style.direction = 'ltr';
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('reapplies a different explicit direction after removing one', async () => {
    const { rerender } = render(Portal, {
      props: { dir: 'auto', children: childSnippet },
    });

    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;

    await rerender({ dir: undefined, children: childSnippet });
    await tick();
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await rerender({ dir: 'rtl', children: childSnippet });
    await tick();
    expect(wrapper?.getAttribute('dir')).toBe('rtl');
  });

  test('restores initial attributes when a themed portal is disabled inline', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    const { container, rerender } = render(Portal, {
      props: { disabled: false, children: childSnippet },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    document.documentElement.removeAttribute('data-theme');
    await rerender({ disabled: true, children: childSnippet });
    await tick();

    expect(container.querySelector('[data-testid="portal-child"]')?.parentElement).toBe(wrapper);
    expect(wrapper?.hasAttribute('data-theme')).toBe(false);
  });
});
