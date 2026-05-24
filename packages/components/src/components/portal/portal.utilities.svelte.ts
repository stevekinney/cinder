import type { Attachment } from 'svelte/attachments';

import { DEV } from 'esm-env';

export type PortalTargetInput = HTMLElement | string | null | undefined;

export type PortalAttachmentOptions = {
  /**
   * Destination the portaled element is appended to. Can be a static value or a getter for reactive
   * retargeting. Omitting it resolves to `document.body`. A string is resolved through
   * `document.querySelector`; an unresolved or invalid selector emits a dev-only warning and skips
   * mount.
   */
  target?: PortalTargetInput | (() => PortalTargetInput);
  /**
   * When true, the attachment is a no-op (the wrapper stays inline in the source tree). Accepts a
   * getter for reactive opt-out.
   */
  disabled?: boolean | (() => boolean);
  /**
   * When true (default), copy `dir` and `data-cinder-theme` from the nearest ancestor of `source`
   * before moving the wrapper. Accepts a getter.
   */
  inheritAttributes?: boolean | (() => boolean);
  /**
   * Ancestor used as the lookup root for inherited attributes. Defaults to the wrapper's
   * `parentElement` at attach time — but once portaled the wrapper's parent is the target, so any
   * caller that needs the *original* ancestor chain after the move (Popover, etc.) must pass an
   * explicit `source` (typically the trigger element).
   */
  source?: HTMLElement | null | undefined | (() => HTMLElement | null | undefined);
};

type ResolvedPortalTarget =
  | { kind: 'resolved'; target: HTMLElement }
  | { kind: 'unresolved'; key: string };

function readOption<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

export function resolvePortalTarget(target: PortalTargetInput): ResolvedPortalTarget | null {
  if (typeof document === 'undefined') return null;

  if (target == null) {
    return { kind: 'resolved', target: document.body };
  }

  if (target instanceof HTMLElement) {
    return { kind: 'resolved', target };
  }

  try {
    const resolved = document.querySelector(target);
    return resolved instanceof HTMLElement
      ? { kind: 'resolved', target: resolved }
      : { kind: 'unresolved', key: target };
  } catch {
    return { kind: 'unresolved', key: target };
  }
}

export function copyInheritedPortalAttributes(
  element: HTMLElement,
  source: HTMLElement | null | undefined,
  inheritAttributes: boolean,
) {
  if (!inheritAttributes || !source) return;

  const inheritedDir = source.closest<HTMLElement>('[dir]')?.getAttribute('dir');
  if (inheritedDir) {
    element.setAttribute('dir', inheritedDir);
  }

  const inheritedTheme = source
    .closest<HTMLElement>('[data-cinder-theme]')
    ?.getAttribute('data-cinder-theme');
  if (inheritedTheme) {
    element.setAttribute('data-cinder-theme', inheritedTheme);
  }
}

export function createPortalAttachment(
  options: PortalAttachmentOptions = {},
): Attachment<HTMLElement> {
  let lastWarnedUnresolvedKey: string | null = null;

  return (element) => {
    // Capture the *original* parentElement once, before any mounting moves the wrapper.
    // After `appendChild`, `element.parentElement` becomes the portal target — which would defeat
    // the "inherit dir/data-cinder-theme from the trigger subtree" contract.
    const initialParent = element.parentElement;

    // Nest the reads inside `$effect` so getter-based options are tracked reactively. Each rerun
    // detaches the previous mount before re-resolving — this guards against the wrapper being
    // stranded in the old target when `target` changes or `disabled` flips true.
    $effect(() => {
      const disabled = readOption(options.disabled ?? false);
      const inheritAttributes = readOption(options.inheritAttributes ?? true);
      const targetValue = readOption(options.target ?? null);
      const attributeSource = readOption(options.source ?? initialParent);
      const resolved = disabled ? null : resolvePortalTarget(targetValue);

      if (!disabled && resolved?.kind === 'resolved') {
        copyInheritedPortalAttributes(element, attributeSource, inheritAttributes);
        resolved.target.appendChild(element);
        lastWarnedUnresolvedKey = null;
      } else if (!disabled && resolved?.kind === 'unresolved' && DEV) {
        if (lastWarnedUnresolvedKey !== resolved.key) {
          console.warn(
            `[cinder/portal] could not resolve portal target ${JSON.stringify(resolved.key)}.`,
          );
          lastWarnedUnresolvedKey = resolved.key;
        }
      } else if (disabled) {
        lastWarnedUnresolvedKey = null;
      }

      return () => {
        // Idempotent: only remove if still connected somewhere. Tolerates external removal of the
        // wrapper between mount and cleanup.
        if (element.isConnected) {
          element.remove();
        }
      };
    });
  };
}
