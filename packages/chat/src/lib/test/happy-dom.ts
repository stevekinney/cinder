/**
 * Register a happy-dom Window on Node's globalThis so `@testing-library/svelte` — which
 * expects `document`, `window`, and the usual DOM globals — can mount components in Bun's
 * test runner. Bun doesn't ship a DOM, and happy-dom doesn't include a Bun-native global
 * registrator, so we wire it up by hand.
 *
 * Called from test files via top-level `setupHappyDom()` before dynamic-importing
 * `@testing-library/svelte`. The dynamic import is important: testing-library reads
 * `globalThis.document` during module init, so it must load AFTER happy-dom is installed.
 */
import { Window } from 'happy-dom';

type Global = typeof globalThis & Record<string, unknown>;

let installed = false;

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

/**
 * Stub Animation returned by the `Element.prototype.animate` shim below. Settles
 * on the next microtask so that Svelte's transition lifecycle — which assigns
 * `onfinish` synchronously after calling `animate()` — completes once.
 *
 * It honors `cancel()`: a cancelled animation never fires `onfinish`. This
 * matters because Svelte cancels the in-flight animation when a transition is
 * interrupted (a rapid open→close→open). A stub that fired `onfinish`
 * regardless would let a stale, cancelled transition resolve after it was torn
 * down — masking real interruption bugs and producing cross-suite flakiness.
 *
 * `playState` is reported as `'finished'`, which is correct for the CSS-driven
 * transitions (`slide`, `fade`) this stub supports: Svelte reads keyframes from
 * the `css` hook and never enters its `tick`-based `loop()`, so it never reads
 * `playState` for those. Do NOT rely on this stub to test `tick`-based
 * transitions — Svelte's loop guard (`playState !== 'running'`) would exit on
 * the first frame and the tick callback would never run.
 */
function stubbedAnimate(): unknown {
  let settled = false;
  const animation: Record<string, unknown> = {
    currentTime: 0,
    playState: 'finished',
    effect: null,
    onfinish: null,
    cancel() {
      // A cancelled animation never fires onfinish.
      settled = true;
    },
    finish() {
      // Spec: finish() settles synchronously and fires onfinish. Run it once.
      fire();
    },
  };
  // Fire onfinish at most once, and never after cancel()/finish() already settled.
  function fire(): void {
    if (settled) return;
    settled = true;
    const handler = animation['onfinish'];
    if (typeof handler === 'function') {
      (handler as () => void).call(animation);
    }
  }
  queueMicrotask(fire);
  return animation;
}

/**
 * happy-dom does not implement the Web Animations API (`Element.prototype.animate`),
 * which Svelte 5's JS-driven transition functions (`slide`, `fade`, `fly`, …) call to
 * coordinate enter/exit. Without it, mounting any component that uses `transition:fn`
 * throws `element.animate is not a function`. Install a minimal stub that settles
 * immediately — duration/easing are irrelevant in a non-painting DOM; assertions care
 * about presence/absence after the transition resolves, not animation frames.
 */
function stubWebAnimationsApi(happyWindow: Window): void {
  const elementCtor = Reflect.get(happyWindow, 'Element') as unknown;
  if (typeof elementCtor !== 'function') return;
  const proto = Reflect.get(elementCtor, 'prototype') as Record<string, unknown> | undefined;
  if (!proto || typeof proto['animate'] === 'function') return;

  proto['animate'] = stubbedAnimate;
}

export function setupHappyDom(): void {
  if (installed) return;
  const happyWindow = new Window();
  const target = globalThis as Global;

  // Copy each own property defined on the happy-dom Window (DOM globals: document, Node,
  // Element, MouseEvent, etc.) onto Node's globalThis. Skip properties that already exist on
  // globalThis (e.g., `fetch`, `URL`) so we don't clobber Bun's own implementations.
  for (const key of Object.getOwnPropertyNames(happyWindow)) {
    if (key in target) continue;
    const descriptor = Object.getOwnPropertyDescriptor(happyWindow, key);
    if (!descriptor) continue;
    Object.defineProperty(target, key, descriptor);
  }
  // happy-dom's Window isn't structurally assignable to the DOM's `Window & typeof globalThis`
  // (happy-dom implements a subset). For test-globals purposes the subset is sufficient.
  // Using defineProperty sidesteps the lib.dom.d.ts `window` type on globalThis.
  Object.defineProperty(target, 'window', { value: happyWindow, configurable: true });

  alignElementRemoveWithChildNodeSpec(happyWindow);
  stubWebAnimationsApi(happyWindow);

  installed = true;
}
