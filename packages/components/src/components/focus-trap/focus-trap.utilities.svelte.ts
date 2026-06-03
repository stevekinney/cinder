import type { Attachment } from 'svelte/attachments';

import { restoreFocusTo } from '../../utilities/focus.ts';
import { readOption } from '../../utilities/read-option.ts';

export type FocusTargetInput =
  | HTMLElement
  | string
  | null
  | undefined
  | (() => HTMLElement | string | null | undefined);

export type FocusTrapOptions = {
  active?: boolean | (() => boolean);
  restoreFocus?: boolean;
  initialFocus?: FocusTargetInput;
  fallbackFocus?: FocusTargetInput;
};

type TrapInstance = {
  id: symbol;
  node: HTMLElement;
};

const trapStack: TrapInstance[] = [];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ');

function noop() {}

function isHiddenByTree(element: HTMLElement): boolean {
  if (element.hidden) return true;
  if (element.matches('[inert], [aria-hidden="true"]')) return true;
  const ancestor = element.closest<HTMLElement>('[hidden], [inert], [aria-hidden="true"]');
  return ancestor !== null && ancestor !== element;
}

/**
 * Whether an element is eligible to receive focus via Tab. Excludes `tabindex="-1"` because that
 * value opts an element out of sequential focus navigation — used for auto-discovery in
 * `getTabbableElements`.
 */
function isFocusableCandidate(element: HTMLElement): boolean {
  if (isHiddenByTree(element)) return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('tabindex') === '-1') return false;
  return true;
}

const NATIVELY_FOCUSABLE_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);

/**
 * Whether an element can be programmatically focused via `.focus()`. Unlike `isFocusableCandidate`,
 * this accepts `tabindex="-1"` — the standard pattern for making a non-interactive element
 * (a container, heading, etc.) a valid `initialFocus`/`fallbackFocus` target without inserting it
 * into the Tab order. Requires the element to actually be capable of accepting focus: a
 * `tabindex` attribute, a natively focusable tag, an anchor with `href`, or contenteditable.
 * Plain `<div>` / `<h2>` etc. without `tabindex` are rejected because `.focus()` is a no-op on
 * them in real browsers — accepting them would silently leave focus outside the trap.
 */
function isProgrammaticallyFocusable(element: HTMLElement): boolean {
  if (isHiddenByTree(element)) return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.hasAttribute('tabindex')) return true;
  if (NATIVELY_FOCUSABLE_TAGS.has(element.tagName)) return true;
  if (element.tagName === 'A' && element.hasAttribute('href')) return true;
  const contentEditable = element.getAttribute('contenteditable');
  if (contentEditable !== null && contentEditable !== 'false') return true;
  return false;
}

function getTabbableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => root.contains(element) && isFocusableCandidate(element),
  );
}

function resolveScopedTarget(root: HTMLElement, target: FocusTargetInput): HTMLElement | null {
  const resolved = readOption(target ?? null);
  if (!resolved) return null;
  if (typeof resolved === 'string') {
    let match: HTMLElement | null = null;
    try {
      match = root.querySelector<HTMLElement>(resolved);
    } catch {
      return null;
    }
    return match && root.contains(match) ? match : null;
  }
  return resolved instanceof HTMLElement && root.contains(resolved) ? resolved : null;
}

function getFallbackTarget(root: HTMLElement, fallbackFocus: FocusTargetInput): HTMLElement | null {
  const resolved = resolveScopedTarget(root, fallbackFocus);
  return resolved && isProgrammaticallyFocusable(resolved) ? resolved : null;
}

/**
 * Calls `.focus()` and returns whether the element actually became `document.activeElement`.
 * `isProgrammaticallyFocusable` cannot tell whether a plain `<div>` or `<h2>` (no `tabindex`,
 * no native focus behavior) will accept focus — `.focus()` is a no-op on those. Verifying the
 * landing lets callers fall through to the next strategy instead of silently leaving focus
 * outside the trap.
 */
function tryFocus(element: HTMLElement): boolean {
  element.focus();
  return document.activeElement === element;
}

function ensureRootFocusable(root: HTMLElement): () => void {
  if (root.hasAttribute('tabindex')) {
    return () => {};
  }
  root.setAttribute('tabindex', '-1');
  return () => {
    root.removeAttribute('tabindex');
  };
}

function pushTrap(instance: TrapInstance) {
  const existingIndex = trapStack.findIndex((entry) => entry.id === instance.id);
  if (existingIndex !== -1) {
    trapStack.splice(existingIndex, 1);
  }
  trapStack.push(instance);
}

function removeTrap(id: symbol) {
  const index = trapStack.findIndex((entry) => entry.id === id);
  if (index !== -1) {
    trapStack.splice(index, 1);
  }
}

function isTopTrap(id: symbol): boolean {
  return trapStack.at(-1)?.id === id;
}

export function createFocusTrap(options: FocusTrapOptions = {}): Attachment<HTMLElement> {
  const trapId = Symbol('focus-trap');

  return (node) => {
    const isActive = () => readOption(options.active ?? true);
    const restoreFocus = options.restoreFocus ?? true;
    const initialFocus = options.initialFocus ?? null;
    const fallbackFocus = options.fallbackFocus ?? null;

    let activated = false;
    // Bumped on every `activate()`. The deferred `focusTrapTarget` microtask snapshots this value
    // and bails if it no longer matches, so a deactivate (or deactivate→reactivate) that lands
    // before the microtask drains can't let a stale activation steal focus into the trap.
    let activationGeneration = 0;
    let capturedFocus: HTMLElement | null = null;
    let restoreRootFocusability = noop;

    function focusTrapTarget() {
      const preferred = resolveScopedTarget(node, initialFocus);
      if (preferred && isProgrammaticallyFocusable(preferred) && tryFocus(preferred)) {
        return;
      }

      const tabbable = getTabbableElements(node);
      if (tabbable.length > 0 && tabbable[0] && tryFocus(tabbable[0])) {
        return;
      }

      const fallbackTarget = getFallbackTarget(node, fallbackFocus);
      if (fallbackTarget && tryFocus(fallbackTarget)) {
        return;
      }

      restoreRootFocusability = ensureRootFocusable(node);
      node.focus();
    }

    function activate() {
      if (activated) return;
      activated = true;
      const generation = ++activationGeneration;
      capturedFocus =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : null;
      pushTrap({ id: trapId, node });
      // Defer focusing so the trap's content is in the DOM. Guard against the trap being
      // deactivated (or deactivated then reactivated) before this microtask drains — moving focus
      // into a no-longer-current activation would steal it back after `deactivate()` already
      // restored it to the previously-focused element.
      queueMicrotask(() => {
        if (!activated || generation !== activationGeneration) return;
        focusTrapTarget();
      });
    }

    function deactivate() {
      if (!activated) return;
      activated = false;
      restoreRootFocusability();
      restoreRootFocusability = noop;
      removeTrap(trapId);
      if (restoreFocus) {
        restoreFocusTo(capturedFocus);
      }
      capturedFocus = null;
    }

    function handleKeydown(event: KeyboardEvent) {
      // Use the live `isActive()` value so a trap deactivated reactively stops intercepting Tab
      // immediately, even if the cleanup branch below has not yet fired (which only runs on
      // unmount, not on prop changes).
      if (!isActive() || !isTopTrap(trapId) || event.key !== 'Tab') return;

      const tabbable = getTabbableElements(node);
      if (tabbable.length === 0) {
        const fallbackTarget = getFallbackTarget(node, fallbackFocus);
        event.preventDefault();
        if (!fallbackTarget || !tryFocus(fallbackTarget)) {
          restoreRootFocusability = ensureRootFocusable(node);
          node.focus();
        }
        return;
      }

      const first = tabbable[0];
      const last = tabbable[tabbable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    node.addEventListener('keydown', handleKeydown);

    // Reactive activation: a getter-form `active` flipping true→false (or vice versa) must call
    // `activate()` / `deactivate()` immediately, not only on unmount. Otherwise an inactive trap
    // lingers on `trapStack`, blocking lower traps' Tab handling via `isTopTrap`, and focus is
    // never restored to the previously-focused element on reactive deactivation.
    $effect(() => {
      if (!isActive()) return;
      activate();
      return () => {
        deactivate();
      };
    });

    return () => {
      node.removeEventListener('keydown', handleKeydown);
      // `$effect` cleanup above already ran `deactivate()` when active flipped false; this final
      // call is a defensive no-op in that case (guarded by the `activated` flag) and ensures
      // restoration when the trap is still active at unmount.
      deactivate();
    };
  };
}
