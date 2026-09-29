/// <reference lib="dom" />
import { Window } from 'happy-dom';

// Preserve Bun's fetch, timers, and process APIs; DOM objects must share the
// document's realm so dispatched events pass the DOM implementation's checks.
const CINDER_ANIMATE_STUB = Symbol.for('corvidae.test.stubbedAnimate');
const HAPPY_DOM_REALM_GLOBALS = new Set([
  'AbortController',
  'AbortSignal',
  'Blob',
  'CloseEvent',
  'Comment',
  'CompositionEvent',
  'CustomEvent',
  'Document',
  'DocumentFragment',
  'DOMException',
  'DOMParser',
  'DragEvent',
  'Element',
  'ErrorEvent',
  'Event',
  'EventTarget',
  'File',
  'FileList',
  'FileReader',
  'FocusEvent',
  'FormData',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'InputEvent',
  'KeyboardEvent',
  'MessageEvent',
  'MouseEvent',
  'MutationObserver',
  'Node',
  'PointerEvent',
  'ProgressEvent',
  'Range',
  'ResizeObserver',
  'SVGElement',
  'Selection',
  'SubmitEvent',
  'Text',
  'TouchEvent',
  'UIEvent',
  'URL',
  'WheelEvent',
  'Window',
  'XMLDocument',
  'XMLHttpRequest',
  'XMLSerializer',
  'addEventListener',
  'dispatchEvent',
  'getComputedStyle',
  'removeEventListener',
]);

let installed = false;

function stubbedAnimate(this: Element): unknown {
  let settled = false;
  const animation: Record<string | symbol, unknown> = {
    [CINDER_ANIMATE_STUB]: true,
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
      Reflect.apply(handler, animation, []);
    }
  }
  queueMicrotask(fire);
  return animation;
}

/**
 * Normalize happy-dom's Web Animations API for component tests. Svelte transitions
 * are driven by `Element.prototype.animate`; browser `Animation.cancel()` rejects
 * the animation's `finished` promise with `AbortError`, which is correct browser
 * behavior but noisy in this non-painting DOM when Svelte aborts an in-flight
 * transition during test cleanup. Use Cinder's deterministic test stub even when
 * happy-dom ships a partial native implementation so transition cancellation
 * remains synchronous, idempotent, and owned by the test environment.
 */
function stubWebAnimationsApi(happyWindow: Window): void {
  const elementCtor: unknown = Reflect.get(happyWindow, 'Element');
  if (typeof elementCtor !== 'function') return;
  const proto: unknown = Reflect.get(elementCtor, 'prototype');
  if ((typeof proto !== 'object' && typeof proto !== 'function') || proto === null) return;

  const currentAnimate: unknown = Reflect.get(proto, 'animate');
  if (
    typeof currentAnimate === 'function' &&
    Reflect.get(currentAnimate, CINDER_ANIMATE_STUB) === true
  ) {
    return;
  }

  Object.defineProperty(stubbedAnimate, CINDER_ANIMATE_STUB, {
    value: true,
    configurable: true,
  });
  Reflect.set(proto, 'animate', stubbedAnimate);
}

export function setupHappyDom(): void {
  if (installed) return;
  // Use a document origin so relative resources have valid browser URLs.
  // about:blank makes Happy DOM synchronously emit errors for every /image path.
  const happyWindow = new Window({ url: 'https://corvidae.test/' });
  const document = happyWindow.document;
  document.insertBefore(
    document.implementation.createDocumentType('html', '', ''),
    document.documentElement,
  );
  // Happy DOM does not implement compatMode. This fixture starts in standards
  // mode; libraries such as KaTeX require the corresponding browser contract.
  Object.defineProperty(document, 'compatMode', { value: 'CSS1Compat' });
  const target = globalThis;

  // Copy each own property defined on the happy-dom Window onto Node's globalThis. DOM realm
  // constructors are copied even when Bun already defines them; otherwise an Event created by
  // Bun fails happy-dom's `instanceof Event` check when dispatched to a happy-dom target.
  for (const key of Object.getOwnPropertyNames(happyWindow)) {
    if (key in target && !HAPPY_DOM_REALM_GLOBALS.has(key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(happyWindow, key);
    if (!descriptor) continue;
    Object.defineProperty(target, key, descriptor);
  }
  // happy-dom's Window isn't structurally assignable to the DOM's `Window & typeof globalThis`
  // (happy-dom implements a subset). For test-globals purposes the subset is sufficient.
  // Using defineProperty sidesteps the lib.dom.d.ts `window` type on globalThis.
  Object.defineProperty(target, 'window', { value: happyWindow, configurable: true });

  stubWebAnimationsApi(happyWindow);

  installed = true;
}
