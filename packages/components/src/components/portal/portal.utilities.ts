import type { Attachment } from 'svelte/attachments';

import { DEV } from 'esm-env';

export type PortalTargetInput = HTMLElement | string | null | undefined;

export type PortalAttachmentOptions = {
  target?: PortalTargetInput | (() => PortalTargetInput);
  disabled?: boolean | (() => boolean);
  inheritAttributes?: boolean | (() => boolean);
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
    const disabled = readOption(options.disabled ?? false);
    const inheritAttributes = readOption(options.inheritAttributes ?? true);
    const targetValue = readOption(options.target ?? null);
    const attributeSource = readOption(options.source ?? element.parentElement);
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
      if (element.isConnected) {
        element.remove();
      }
    };
  };
}
