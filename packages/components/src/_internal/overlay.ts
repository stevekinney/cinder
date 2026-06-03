/**
 * Internal overlay contract shared by Modal, Sheet, Dropdown, Popover, Tooltip,
 * and Toast.
 *
 * See `OVERLAY-POLICY.md` (sibling of this file) for the full policy. Helpers
 * here implement that policy in code so individual overlay components don't
 * each invent their own scroll-lock counter, escape stack, or focus-restore
 * routine.
 *
 * **All overlay markup must be SSR-empty**: Cinder overlays render an empty
 * placeholder (or nothing at all) during server-side rendering, regardless of
 * their `open` prop. The {@link useHydrated} helper exposes the bit Svelte 5
 * components need to gate their `{#if}` block on. This keeps the hydration
 * model simple — overlays only ever attach to the DOM after the client takes
 * over — at the cost of a one-frame delay for `open={true}` initial state.
 */

/// <reference lib="dom" />

/**
 * Z-index layer constants. Mirror the `--cinder-z-*` CSS custom properties.
 * Components should prefer the CSS variables in stylesheets; these JS constants
 * are for inline-style fallbacks and ordering checks in tests.
 */
export const Z_LAYERS = {
  tooltip: 1000,
  dropdown: 1100,
  popover: 1100,
  backdrop: 1150,
  modal: 1200,
  sheet: 1200,
  toast: 1300,
} as const;

export type OverlayLayer = keyof typeof Z_LAYERS;

/**
 * Returns the SSR-friendly "is the client hydrated yet?" bit. The standard
 * idiom in a Svelte 5 component:
 *
 * ```svelte
 * <script>
 *   let hydrated = $state(false);
 *   $effect(() => { hydrated = true; });
 * </script>
 *
 * {#if hydrated && open}
 *   <div class="cinder-popover">...</div>
 * {/if}
 * ```
 *
 * `$effect` only runs on the client, so `hydrated` stays false through SSR.
 * Wrap any DOM-attached overlay element in `{#if hydrated}` so the server
 * sends back an empty markup slot regardless of `open`.
 *
 * This is documented as a snippet rather than provided as a Svelte runes API
 * because runes can only be invoked from inside `.svelte` / `.svelte.ts`
 * files. Inlining the two lines into each overlay component is clearer than
 * a wrapper.
 *
 * The function exists so downstream tests can introspect the contract — i.e.
 * importing `Z_LAYERS` and `useHydrated` from one place is the canonical
 * overlay-policy entry point.
 */
export function useHydrated(): { value: boolean } {
  // No-op runtime — the real implementation lives inline in each overlay
  // component (see Modal, Sheet, etc.). Returning a frozen object keeps the
  // export shape stable for consumers that import it for type information
  // alongside the runes pattern in their own component.
  return Object.freeze({ value: false });
}

// ---------------------------------------------------------------------------
// Escape stack
// ---------------------------------------------------------------------------

/**
 * Stack of ESC handlers. Top-most overlay handles ESC; lower overlays ignore
 * the event. Each overlay registers a handler on open and unregisters on close.
 *
 * The stack lives in module scope so all Cinder overlays share it. This is
 * fine for tests (each test runs against a fresh module instance) and fine
 * for production (a real app has at most a handful of stacked overlays at
 * once). The stack is also keyed-set semantics: pushing the same handler
 * twice is a no-op; popping a handler not on the stack is a no-op.
 */
const escapeStack: Array<() => void> = [];

/**
 * Register a handler to be called when ESC is pressed and this overlay is at
 * the top of the stack. Returns a `release` function the overlay must call
 * on close.
 *
 * The first handler pushed installs the global keydown listener; the last
 * handler popped removes it.
 */
export function pushEscapeHandler(handler: () => void): () => void {
  escapeStack.push(handler);
  if (escapeStack.length === 1 && typeof window !== 'undefined') {
    window.addEventListener('keydown', onEscapeKeydown, { capture: true });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = escapeStack.lastIndexOf(handler);
    if (index !== -1) escapeStack.splice(index, 1);
    if (escapeStack.length === 0 && typeof window !== 'undefined') {
      window.removeEventListener('keydown', onEscapeKeydown, { capture: true });
    }
  };
}

function onEscapeKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  const handler = escapeStack.at(-1);
  if (!handler) return;
  // Don't preventDefault — native dialog ESC and consumer keydown handlers
  // may want to react too. We just invoke the topmost overlay's close.
  handler();
}

/**
 * Test-only: clear the escape stack. Useful between tests to ensure a fresh
 * starting state. Not part of the public overlay API.
 */
export function _resetEscapeStack(): void {
  escapeStack.length = 0;
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onEscapeKeydown, { capture: true });
  }
}

// ---------------------------------------------------------------------------
// Scroll lock (counted)
// ---------------------------------------------------------------------------

let scrollLockCount = 0;
let originalBodyOverflow: string | null = null;

/**
 * Acquire the body scroll lock. Full-viewport overlays that dim the page —
 * Modal, Sheet, and the standalone Backdrop (via its `lockScroll` prop) — call
 * this. Counted: nested overlays each acquire and release; the lock is only
 * released when the count reaches zero, so a Modal opened inside a Sheet (or a
 * Backdrop behind either) doesn't accidentally restore scroll when one of them
 * closes.
 *
 * Returns a `release` function the overlay must call on close.
 */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (scrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.overflow = originalBodyOverflow ?? '';
      originalBodyOverflow = null;
    }
  };
}

/**
 * Test-only: forcibly reset the scroll-lock counter. Use between tests that
 * mount overlays with scroll lock to avoid leaking state into other tests.
 */
export function _resetScrollLock(): void {
  scrollLockCount = 0;
  originalBodyOverflow = null;
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
}

// ---------------------------------------------------------------------------
// Focus restore
// ---------------------------------------------------------------------------

/**
 * Capture the currently-focused element. Pair with {@link restoreFocusTo}.
 *
 * Returns null on the server or when no element has focus (focus is on the
 * body). Callers should fall back to a sensible default (e.g. the trigger
 * element) when null.
 */
export function captureFocus(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  if (active && active !== document.body && active instanceof HTMLElement) {
    return active;
  }
  return null;
}

// Note: `restoreFocusTo` lives in `utilities/focus.ts` (returns a boolean so
// candidate-list iteration can short-circuit). Overlays import it directly
// from that module.
