import type { Attachment } from 'svelte/attachments';

import { restoreFocusTo } from '../../utilities/focus.ts';

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

function readOption<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

function isHiddenByTree(element: HTMLElement): boolean {
  if (element.hidden) return true;
  if (element.matches('[inert], [aria-hidden="true"]')) return true;
  const ancestor = element.closest<HTMLElement>('[hidden], [inert], [aria-hidden="true"]');
  return ancestor !== null && ancestor !== element;
}

function isFocusableCandidate(element: HTMLElement): boolean {
  if (isHiddenByTree(element)) return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('tabindex') === '-1') return false;
  return true;
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
    const match = root.querySelector<HTMLElement>(resolved);
    return match && root.contains(match) ? match : null;
  }
  return resolved instanceof HTMLElement && root.contains(resolved) ? resolved : null;
}

function getFallbackTarget(root: HTMLElement, fallbackFocus: FocusTargetInput): HTMLElement | null {
  const resolved = resolveScopedTarget(root, fallbackFocus);
  return resolved && isFocusableCandidate(resolved) ? resolved : null;
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
    let capturedFocus: HTMLElement | null = null;
    let restoreRootFocusability = () => {};

    function focusTrapTarget() {
      const preferred = resolveScopedTarget(node, initialFocus);
      if (preferred && isFocusableCandidate(preferred)) {
        preferred.focus();
        return;
      }

      const tabbable = getTabbableElements(node);
      if (tabbable.length > 0) {
        tabbable[0]?.focus();
        return;
      }

      const fallbackTarget = getFallbackTarget(node, fallbackFocus);
      if (fallbackTarget) {
        fallbackTarget.focus();
        return;
      }

      restoreRootFocusability = ensureRootFocusable(node);
      node.focus();
    }

    function activate() {
      if (activated) return;
      activated = true;
      capturedFocus =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : null;
      pushTrap({ id: trapId, node });
      queueMicrotask(focusTrapTarget);
    }

    function deactivate() {
      if (!activated) return;
      activated = false;
      restoreRootFocusability();
      restoreRootFocusability = () => {};
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
        if (fallbackTarget) {
          fallbackTarget.focus();
        } else {
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

    if (isActive()) {
      activate();
    }

    return () => {
      node.removeEventListener('keydown', handleKeydown);
      deactivate();
    };
  };
}
