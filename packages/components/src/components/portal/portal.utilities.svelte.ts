import type { Attachment } from 'svelte/attachments';

import { devWarn } from '../../utilities/dev-warn.ts';

import { readOption } from '../../utilities/read-option.ts';

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
   * When true (default), copy `dir`, `data-theme`, and `data-cinder-theme` from the nearest
   * ancestor of `source` before moving the wrapper. Accepts a getter.
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
  fallbackAttributes: { dir: string | null; dataTheme: string | null; theme: string | null } = {
    dir: element.getAttribute('dir'),
    dataTheme: element.getAttribute('data-theme'),
    theme: element.getAttribute('data-cinder-theme'),
  },
) {
  const preservesExplicitDirection = element.dataset['cinderExplicitDirection'] === 'true';
  const inheritedDir =
    inheritAttributes && source && !preservesExplicitDirection
      ? source.closest<HTMLElement>('[dir]')?.getAttribute('dir')
      : null;
  const nextDir = inheritedDir ?? fallbackAttributes.dir;
  if (nextDir) {
    element.setAttribute('dir', nextDir);
  } else {
    element.removeAttribute('dir');
  }

  const inheritedDataTheme =
    inheritAttributes && source
      ? source.closest<HTMLElement>('[data-theme]')?.getAttribute('data-theme')
      : null;
  const nextDataTheme = inheritedDataTheme ?? fallbackAttributes.dataTheme;
  if (nextDataTheme) {
    element.setAttribute('data-theme', nextDataTheme);
  } else {
    element.removeAttribute('data-theme');
  }

  const inheritedTheme =
    inheritAttributes && source
      ? source.closest<HTMLElement>('[data-cinder-theme]')?.getAttribute('data-cinder-theme')
      : null;
  const nextTheme = inheritedTheme ?? fallbackAttributes.theme;
  if (nextTheme) {
    element.setAttribute('data-cinder-theme', nextTheme);
  } else {
    element.removeAttribute('data-cinder-theme');
  }
}

export function createPortalAttachment(
  options: PortalAttachmentOptions = {},
): Attachment<HTMLElement> {
  let lastWarnedUnresolvedKey: string | null = null;

  return (element) => {
    // Capture the *original* parentElement once, before any mounting moves the wrapper. After
    // `appendChild`, `element.parentElement` becomes the portal target — which would defeat the
    // "inherit dir/data-theme/data-cinder-theme from the trigger subtree" contract.
    const initialParent = element.parentElement;
    const initialAttributes = {
      dir: element.getAttribute('dir'),
      dataTheme: element.getAttribute('data-theme'),
      theme: element.getAttribute('data-cinder-theme'),
    };

    // Drop a placeholder comment at the wrapper's original location. When `disabled` flips true or
    // the target can no longer be resolved, the wrapper is reinserted at this anchor so children
    // stay rendered in the original document position. Without this, `$effect` cleanup detaches
    // the wrapper and nothing reattaches it — content silently disappears.
    const anchor =
      typeof document !== 'undefined'
        ? document.createComment('@lostgradient/cinder/portal')
        : null;
    if (anchor && initialParent && element.parentNode === initialParent) {
      initialParent.insertBefore(anchor, element);
    }

    function restoreInline() {
      if (!anchor || !anchor.parentNode) return;
      if (element.parentNode === anchor.parentNode && element.previousSibling === anchor) return;
      anchor.parentNode.insertBefore(element, anchor.nextSibling);
    }

    // Nest the reads inside `$effect` so getter-based options are tracked reactively. Each rerun
    // detaches the previous mount before re-resolving — this guards against the wrapper being
    // stranded in the old target when `target` changes or `disabled` flips true.
    $effect(() => {
      const disabled = readOption(options.disabled ?? false);
      const inheritAttributes = readOption(options.inheritAttributes ?? true);
      const targetValue = readOption(options.target ?? null);
      const attributeSource = readOption(options.source ?? initialParent) ?? initialParent;
      const resolved = disabled ? null : resolvePortalTarget(targetValue);

      if (!disabled && resolved?.kind === 'resolved') {
        copyInheritedPortalAttributes(
          element,
          attributeSource,
          inheritAttributes,
          initialAttributes,
        );
        resolved.target.appendChild(element);
        lastWarnedUnresolvedKey = null;
      } else if (!disabled && resolved?.kind === 'unresolved') {
        // Target unresolved: keep the wrapper inline at the anchor so children remain rendered
        // (with a dev warning) instead of vanishing from the DOM entirely.
        restoreInline();
        if (lastWarnedUnresolvedKey !== resolved.key) {
          devWarn(
            `[cinder/portal] could not resolve portal target ${JSON.stringify(resolved.key)}.`,
          );
          lastWarnedUnresolvedKey = resolved.key;
        }
      } else if (disabled) {
        // Disabled path: wrapper must stay in (or return to) its original position, not be left
        // detached. The Portal component's template still renders children in this mode.
        restoreInline();
        lastWarnedUnresolvedKey = null;
      }

      return () => {
        // Idempotent: only remove if still connected somewhere. Tolerates external removal of the
        // wrapper between mount and cleanup. The anchor stays put so the next re-run can reinsert.
        if (element.isConnected) {
          element.remove();
        }
      };
    });

    return () => {
      // Final cleanup: also remove the anchor so we don't leave orphan comment nodes behind.
      if (anchor && anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    };
  };
}
