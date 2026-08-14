import { Window } from 'happy-dom';

type Global = typeof globalThis & Record<string, unknown>;

let installed = false;

/*
 * Mirrors `packages/components/src/test/happy-dom.ts`. Duplicated rather than
 * imported because a test helper reaching across package boundaries is exactly
 * what `check:consumer-boundaries` exists to prevent; if a third package needs
 * it, extract it to `@lostgradient/testing` rather than adding a second copy.
 *
 * Ported here because the editor package hit the same divergence the moment a
 * test unmounted a rendered component: 0 tests failed and the run still failed,
 * because the throw escapes as an "unhandled error between tests" that Bun
 * counts separately from assertions. Easy to miss if you read only the
 * pass/fail lines.
 */
/**
 * Align happy-dom's `Element.prototype.remove()` with the DOM spec, which
 * makes `ChildNode.remove()` a no-op when the node has already been removed
 * from its parent. happy-dom currently routes the call through
 * `parentNode.removeChild(this)` using a stale `parentNode` pointer, which
 * throws when the parent's child-array no longer contains the node — Svelte
 * 5's `flushSync` effect-teardown trips this during fixture unmount and the
 * throw escapes through a Promise executor, surfacing as an "unhandled
 * error between tests" in Bun. The patch ONLY narrows the spec divergence
 * for `Element.prototype.remove`; it does NOT touch the explicit
 * `Node.prototype.removeChild` API, so misuse of that API still throws.
 *
 * Reference: WHATWG DOM § ChildNode.remove() — "remove this from its parent
 * (if any)".
 */
function alignElementRemoveWithChildNodeSpec(happyWindow: Window): void {
  const elementCtor = Reflect.get(happyWindow, 'Element') as unknown;
  if (typeof elementCtor !== 'function') return;
  const proto = Reflect.get(elementCtor, 'prototype') as Record<string, unknown> | undefined;
  if (!proto) return;
  const original = proto['remove'];
  if (typeof original !== 'function') return;
  type ElementRemove = (this: Element) => void;
  const originalFn = original as ElementRemove;
  proto['remove'] = function patchedRemove(this: Element): void {
    const parent = this.parentNode;
    if (parent === null) return;
    // Spec: "remove this from its parent (if any)". If the parent has
    // already forgotten this node, treat the call as a no-op rather than
    // throwing — that's the spec-aligned outcome for `ChildNode.remove()`.
    if (typeof parent.contains === 'function' && !parent.contains(this)) {
      return;
    }
    try {
      originalFn.call(this);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not a child of this node')) {
        // happy-dom bug: removeChild fails even when the element is in
        // parent.childNodes and parent.contains(this) is true. This happens
        // when a sibling insertion (e.g. anchor.before(newNode)) corrupts the
        // internal parent-child tracking, causing removeChild to lose the
        // reference even though childNodes still lists it.
        //
        // Workaround: move the element into a detached DocumentFragment, which
        // goes through appendChild's code path rather than removeChild's broken
        // one, effectively detaching it from the live DOM without needing
        // removeChild to succeed.
        try {
          document.createDocumentFragment().appendChild(this);
        } catch {
          // If appendChild also fails (unlikely), there is nothing more to do.
          // The element may remain in the DOM; this is a pre-existing happy-dom
          // limitation.
        }
        return;
      }
      throw error;
    }
  };
}

export function setupHappyDom(): void {
  if (installed) return;

  const happyWindow = new Window();
  alignElementRemoveWithChildNodeSpec(happyWindow);
  const target = globalThis as Global;

  for (const key of Object.getOwnPropertyNames(happyWindow)) {
    if (key in target) continue;

    const descriptor = Object.getOwnPropertyDescriptor(happyWindow, key);
    if (!descriptor) continue;

    Object.defineProperty(target, key, descriptor);
  }

  Object.defineProperty(target, 'window', { value: happyWindow, configurable: true });
  installed = true;
}

setupHappyDom();
