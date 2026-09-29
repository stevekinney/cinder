import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  getInheritedPortalStyle,
  redispatchPortaledEvent,
  restorePortalGlobalState,
} from './portal-test-helpers.ts';

beforeEach(() => document.body.replaceChildren());
afterEach(restorePortalGlobalState);

function createMousePointerEvent(type: string): Event {
  return new (globalThis.PointerEvent ?? Event)(type, {
    bubbles: true,
    composed: true,
    pointerType: 'mouse',
    button: 0,
    clientX: 24,
    clientY: 36,
  });
}

describe('Portal', () => {
  test('preserves mouse and input details when redispatching', () => {
    const source = document.createElement('div');
    let receivedClick: MouseEvent | undefined;
    let receivedInput: { data: string | null; inputType: string } | undefined;
    source.addEventListener('click', (event) => {
      receivedClick = event;
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
      originalPath = event.composedPath();
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

  test('preserves browser mouse follow-ups for one mouse pointer action', () => {
    const authoredRoot = document.createElement('div');
    const control = document.createElement('button');
    document.body.append(authoredRoot, control);
    const received: string[] = [];
    authoredRoot.addEventListener('pointerdown', () => received.push('pointerdown'));
    authoredRoot.addEventListener('mousedown', () => received.push('mousedown'));
    authoredRoot.addEventListener('pointerup', () => received.push('pointerup'));
    authoredRoot.addEventListener('mouseup', () => received.push('mouseup'));

    const pointerdown = createMousePointerEvent('pointerdown');
    Object.defineProperty(pointerdown, 'target', { configurable: true, value: control });
    const mousedown = new MouseEvent('mousedown', {
      bubbles: true,
      composed: true,
      button: 0,
      clientX: 24,
      clientY: 36,
    });
    Object.defineProperty(mousedown, 'target', { configurable: true, value: control });
    const pointerup = createMousePointerEvent('pointerup');
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

    expect(received).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup']);
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
      if (receivedPointer instanceof PointerConstructor) {
        expect(receivedPointer.width).toBe(8);
        expect(receivedPointer.height).toBe(9);
      }
    }
  });

  test('preserves the original UIEvent view when redispatching', () => {
    const authoredRoot = document.createElement('div');
    const control = document.createElement('button');
    document.body.append(authoredRoot, control);
    let receivedMouse: MouseEvent | undefined;
    authoredRoot.addEventListener('mousedown', (event) => (receivedMouse = event));

    const mouse = new MouseEvent('mousedown', {
      bubbles: true,
      view: window,
    });
    Object.defineProperty(mouse, 'target', { configurable: true, value: control });
    redispatchPortaledEvent(mouse, authoredRoot);

    expect(receivedMouse?.view).toBe(window);
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
});
