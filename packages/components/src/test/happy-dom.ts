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
let errorFilterInstalled = false;

/**
 * happy-dom occasionally throws `Failed to execute 'removeChild' on 'Node':
 * The node to be removed is not a child of this node.` while Svelte's
 * flushSync tears down effects after a fixture unmount. The throw bubbles
 * through a Promise inside flushSync and surfaces as an unhandled rejection
 * (or uncaught exception) before Bun's test runner can attribute it to a
 * specific test. The error is a known happy-dom + Svelte unmount race, not a
 * production-relevant bug — filter it from the unhandled channels so the
 * suite reports the real test outcome.
 */
function isHappyDomDetachedChildError(reason: unknown): boolean {
  const message =
    reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
  return (
    message.includes("Failed to execute 'removeChild' on 'Node'") ||
    message.includes('not a child of this node')
  );
}

function installUnhandledErrorFilter(): void {
  if (errorFilterInstalled) return;
  errorFilterInstalled = true;
  process.on('unhandledRejection', (reason) => {
    if (isHappyDomDetachedChildError(reason)) return;
    throw reason;
  });
  process.on('uncaughtException', (error) => {
    if (isHappyDomDetachedChildError(error)) return;
    throw error;
  });
}

export function setupHappyDom(): void {
  installUnhandledErrorFilter();
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

  patchRemoveChildToToleratePriorDetach(happyWindow);

  installed = true;
}

/**
 * happy-dom's `removeChild` throws when the node is already detached from the
 * parent. Svelte's flushSync hits this race during unmount when a fixture
 * removes a wrapper before Testing Library's cleanup unmounts the Svelte tree
 * inside it — the throw escapes through a Promise executor and surfaces as an
 * "unhandled error between tests" in Bun's runner. Make `removeChild` a no-op
 * when the child has already been removed; that's also the spec-compliant
 * behaviour for `ChildNode.remove()` which Svelte ultimately calls.
 */
type NodeRemoveChild = (this: Node, node: Node) => Node;

function patchRemoveChildToToleratePriorDetach(happyWindow: Window): void {
  const nodeCtor = (happyWindow as unknown as { Node?: { prototype: Record<string, unknown> } })
    .Node;
  if (!nodeCtor) return;
  const proto = nodeCtor.prototype;
  const original = proto['removeChild'];
  if (typeof original !== 'function') return;
  const originalFn = original as NodeRemoveChild;
  proto['removeChild'] = function patchedRemoveChild(this: Node, node: Node): Node {
    try {
      return originalFn.call(this, node);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not a child of this node')) {
        return node;
      }
      throw error;
    }
  };
}
