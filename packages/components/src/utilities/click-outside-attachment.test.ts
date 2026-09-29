/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { setupAttachmentTests } from './attachments-test-support.ts';
import { createClickOutside } from './attachments.ts';
setupHappyDom();
setupAttachmentTests();

/**
 * Dispatch a bubbling, cancelable event of `type` from `target`. Use a concrete UI event
 * where possible so happy-dom routes it through the full capture→bubble tree to the
 * document-level capture listener the attachment registers.
 */
function fire(type: string, target: EventTarget): void {
  const init = { bubbles: true, cancelable: true };
  const event =
    type === 'pointerdown'
      ? new (globalThis.PointerEvent ?? Event)(type, init)
      : type === 'touchstart'
        ? new (globalThis.TouchEvent ?? Event)(type, init)
        : new (globalThis.MouseEvent ?? Event)(type, init);
  target.dispatchEvent(event);
}

describe('createClickOutside', () => {
  let node: HTMLElement;
  let cleanup: (() => void) | void;

  beforeEach(() => {
    node = document.createElement('div');
    document.body.append(node);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    node.remove();
  });

  /** Invoke the attachment factory and capture its teardown. */
  function attach(options: Parameters<typeof createClickOutside>[0]): void {
    cleanup = createClickOutside(options)(node);
  }

  test('calls the handler on an outside click but not an inside click', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1) });

    const inner = document.createElement('button');
    node.append(inner);
    fire('click', inner);
    expect(calls).toBe(0);

    const outside = document.createElement('button');
    document.body.append(outside);
    fire('click', outside);
    expect(calls).toBe(1);
    outside.remove();
  });

  test('respects a reactive `enabled` getter', () => {
    let calls = 0;
    let on = false;
    attach({ handler: () => (calls += 1), enabled: () => on });

    const outside = document.createElement('button');
    document.body.append(outside);

    fire('click', outside);
    expect(calls).toBe(0); // disabled

    on = true;
    fire('click', outside);
    expect(calls).toBe(1); // enabled
    outside.remove();
  });

  test('eventType: "pointerdown" listens for pointerdown, not click', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'pointerdown' });

    const outside = document.createElement('button');
    document.body.append(outside);

    // A click must NOT trigger a pointerdown-configured listener.
    fire('click', outside);
    expect(calls).toBe(0);

    fire('pointerdown', outside);
    expect(calls).toBe(1);
    outside.remove();
  });

  test('eventType: "mousedown" listens for mousedown', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'mousedown' });

    const outside = document.createElement('button');
    document.body.append(outside);

    fire('click', outside);
    expect(calls).toBe(0);

    fire('mousedown', outside);
    expect(calls).toBe(1);
    outside.remove();
  });

  test('eventType: "touchstart" listens for touchstart', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'touchstart' });

    const outside = document.createElement('button');
    document.body.append(outside);

    fire('click', outside);
    expect(calls).toBe(0);

    fire('touchstart', outside);
    expect(calls).toBe(1);
    outside.remove();
  });

  test('eventType: "touchstart" ignores non-cancelable touches', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'touchstart' });

    const outside = document.createElement('button');
    document.body.append(outside);
    const event = new (globalThis.TouchEvent ?? Event)('touchstart', {
      bubbles: true,
      cancelable: false,
    });
    outside.dispatchEvent(event);

    expect(calls).toBe(0);
    outside.remove();
  });

  test('treats composedPath entries contained by the node as inside', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1), eventType: 'pointerdown' });

    const inside = document.createElement('button');
    node.append(inside);
    const outside = document.createElement('button');
    document.body.append(outside);
    const event = new (globalThis.PointerEvent ?? Event)('pointerdown', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', { value: outside });
    Object.defineProperty(event, 'composedPath', { value: () => [inside, node, document.body] });

    document.dispatchEvent(event);

    expect(calls).toBe(0);
    outside.remove();
  });

  test('ignoreRefs: a target inside an ignored ref does not trigger the handler', () => {
    let calls = 0;
    const trigger = document.createElement('button');
    document.body.append(trigger);
    attach({ handler: () => (calls += 1), ignoreRefs: [() => trigger] });

    // Clicking the trigger (outside `node` but in an ignored ref) must NOT close.
    fire('click', trigger);
    expect(calls).toBe(0);

    // A genuinely-outside click still triggers.
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    fire('click', elsewhere);
    expect(calls).toBe(1);

    trigger.remove();
    elsewhere.remove();
  });

  test('ignoreRefs resolves the ref freshly on each event (late-mounted trigger)', () => {
    let calls = 0;
    let trigger: HTMLElement | null = null;
    attach({ handler: () => (calls += 1), ignoreRefs: [() => trigger] });

    // Ref is null at attach time; mount the trigger afterward.
    trigger = document.createElement('button');
    document.body.append(trigger);

    fire('click', trigger);
    expect(calls).toBe(0); // resolved freshly -> recognized as inside

    trigger.remove();
  });

  test('removes its document listener on teardown', () => {
    let calls = 0;
    attach({ handler: () => (calls += 1) });

    const outside = document.createElement('button');
    document.body.append(outside);
    fire('click', outside);
    expect(calls).toBe(1);

    cleanup?.();
    cleanup = undefined;
    fire('click', outside);
    expect(calls).toBe(1); // no further calls after teardown
    outside.remove();
  });

  test('capture: false — bubble-phase listener is correctly removed on teardown', () => {
    // When capture:false, removeEventListener must be called with the same phase flag.
    // A regression that hard-codes `true` in removeEventListener would silently fail to
    // deregister the listener. This test verifies teardown symmetry for capture:false.
    let calls = 0;
    attach({ handler: () => (calls += 1), capture: false });

    const outside = document.createElement('button');
    document.body.append(outside);
    fire('click', outside);
    expect(calls).toBe(1);

    cleanup?.();
    cleanup = undefined;
    fire('click', outside);
    expect(calls).toBe(1); // listener removed — no further calls
    outside.remove();
  });

  test('non-Node target (null) is treated as outside and triggers the handler', () => {
    // Defensive branch: event.target can be null on synthetic events or in certain
    // shadow-DOM scenarios. A null target must NOT prevent the handler from firing.
    let calls = 0;
    attach({ handler: () => (calls += 1) });

    // Override `target` with null via Object.defineProperty; `value: null` is
    // simpler and clearer than a getter and avoids the unused-variable pattern.
    const nullTargetEvent = Object.defineProperty(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
      'target',
      { value: null, configurable: true },
    );
    document.dispatchEvent(nullTargetEvent);
    expect(calls).toBe(1); // null target => treated as outside => handler fires
  });
});
