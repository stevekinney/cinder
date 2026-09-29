/**
 * `bun test` preload (plan §11.2, T0.1). Registers happy-dom DOM globals and
 * the Svelte 5 compile plugin BEFORE any test file's imports resolve, then a
 * single global `afterEach(cleanup)` for `@testing-library/svelte`.
 *
 * Ported from `cinder/components/cinder/scripts/preload.ts` +
 * `src/test/happy-dom.ts` + `src/test/register-global-cleanup.ts` — the
 * proven working incantation for Bun + happy-dom + Svelte 5 component
 * tests, copied rather than re-derived. See the inline comments below for
 * why each piece exists; they carry over unchanged from that source.
 *
 * One divergence from that source worth knowing about: this Bun version's
 * `bun:test` runner ships its own native `document`/DOM globals ahead of
 * this preload running, so `document` already exists before `setupHappyDom`
 * below runs (its "skip if already present" copy loop leaves Bun's native
 * `document` in place rather than layering happy-dom's). That's fine for
 * `@testing-library/svelte`'s `render`/`fireEvent`/`cleanup`, but
 * `@testing-library/dom`'s `screen` singleton decides ONCE, at its own
 * module-evaluation time, whether a global `document.body` is ready — under
 * this runner that can land before Bun's native `document.body` is
 * populated, permanently baking in a throwing stub. See the comment in
 * `tests/component-harness.test.ts` for the workaround (prefer `render()`'s
 * own bound query methods over `screen`).
 */
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { plugin } from 'bun';
import { afterEach, expect } from 'bun:test';
import { Window } from 'happy-dom';

import { sveltePlugin } from '@lostgradient/testing';

declare module 'bun:test' {
  interface Matchers<T = unknown> extends TestingLibraryMatchers<
    ReturnType<typeof expect.stringContaining>,
    T
  > {}
}

// Register the same matchers that the declaration above exposes to TypeScript.
expect.extend(jestDomMatchers);

type Global = typeof globalThis & Record<string, unknown>;

let happyDomInstalled = false;

/**
 * happy-dom does not implement the Web Animations API. Svelte 5's JS-driven
 * transitions (`slide`, `fade`, `fly`, …) call `Element.prototype.animate`
 * to coordinate enter/exit; without a stub, mounting any component that
 * uses `transition:fn` throws `element.animate is not a function`. This
 * stub settles on the next microtask — duration/easing are irrelevant in a
 * non-painting DOM. Module-scoped (not nested inside `stubWebAnimationsApi`)
 * since it captures nothing from an enclosing call.
 */
function stubbedAnimate(): unknown {
  let settled = false;
  const animation: Record<string, unknown> = {
    currentTime: 0,
    playState: 'finished',
    effect: null,
    onfinish: null,
    cancel() {
      settled = true;
    },
    finish() {
      fire();
    },
  };
  function fire(): void {
    if (settled) return;
    settled = true;
    const handler = animation['onfinish'];
    if (typeof handler === 'function') {
      handler.call(animation);
    }
  }
  queueMicrotask(fire);
  return animation;
}

function stubWebAnimationsApi(happyWindow: Window): void {
  const elementCtor = Reflect.get(happyWindow, 'Element');
  if (typeof elementCtor !== 'function') return;
  const proto = Reflect.get(elementCtor, 'prototype');
  if (typeof proto !== 'object' || proto === null) return;
  if (typeof Reflect.get(proto, 'animate') === 'function') return;

  Reflect.set(proto, 'animate', stubbedAnimate);
}

function setupHappyDom(): void {
  if (happyDomInstalled) return;
  const happyWindow = new Window();
  const target = globalThis as Global;

  for (const key of Object.getOwnPropertyNames(happyWindow)) {
    if (key in target) continue;
    const descriptor = Object.getOwnPropertyDescriptor(happyWindow, key);
    if (!descriptor) continue;
    Object.defineProperty(target, key, descriptor);
  }
  Object.defineProperty(target, 'window', { value: happyWindow, configurable: true });

  stubWebAnimationsApi(happyWindow);

  happyDomInstalled = true;
}

// Install DOM globals BEFORE any test file's static imports resolve — some
// dependencies read `document` at module-init under the `browser` export
// condition, and pre-installing happy-dom here lets every test file use a
// static `import { render } from '@testing-library/svelte'` instead of a
// top-level `await import(...)` (Bun's test runner can deadlock when many
// files race to dynamically import the same module at module-init).
setupHappyDom();

await plugin(sveltePlugin());

let cleanupRegistered = false;

async function registerGlobalCleanup(): Promise<void> {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const { cleanup } = await import('@testing-library/svelte');
  afterEach(cleanup);
}

await registerGlobalCleanup();
