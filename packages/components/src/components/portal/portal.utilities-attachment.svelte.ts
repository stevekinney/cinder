import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

import { devWarn } from '../../utilities/dev-warn.ts';
import { readOption } from '../../utilities/read-option.ts';
import type { PortalAttachmentOptions } from './portal-attachment-types.ts';
import {
  copyInheritedPortalAttributes,
  resolvePortalTarget,
} from './portal.utilities-inheritance.svelte.ts';
import { observeInheritedPortalAttributes } from './portal.utilities-inherited-observers.svelte.ts';

function resolveManagedAttribute(
  explicit: string | null | undefined,
  current: string | null,
  managed: string | null,
  initial: string | null,
  preserveInitial: boolean,
): string | null | undefined {
  if (explicit !== undefined) return explicit;
  if (current !== managed) return current;
  return preserveInitial ? initial : null;
}

export function createPortalAttachment(
  options: PortalAttachmentOptions = {},
): Attachment<HTMLElement> {
  let lastWarnedUnresolvedKey: string | null = null;
  return (element) => {
    // Capture the *original* parentElement once, before any mounting moves the wrapper. After
    // `appendChild`, `element.parentElement` becomes the portal target — which would defeat the
    // "inherit dir/lang/data-theme/data-cinder-theme from the trigger subtree" contract.
    const initialParent = element.parentElement;
    const initialAttributes = {
      dir: element.getAttribute('dir') ?? null,
      lang: element.getAttribute('lang') ?? null,
      dataTheme: element.getAttribute('data-theme') ?? null,
      theme: element.getAttribute('data-cinder-theme') ?? null,
    };
    const preserveInitialDirection = options.explicitAttributes === undefined;
    const managedAttributes = {
      dir: null as string | null,
      lang: null as string | null,
      dataTheme: null as string | null,
      theme: null as string | null,
    };

    function currentFallbackAttributes() {
      const explicitAttributes = readOption(options.explicitAttributes ?? {});
      const explicitDirection = explicitAttributes.dir;
      const explicitLanguage = explicitAttributes.lang;
      const explicitDataTheme = explicitAttributes.dataTheme;
      const explicitTheme = explicitAttributes.theme;
      const direction = element.getAttribute('dir');
      const language = element.getAttribute('lang');
      const dataTheme = element.getAttribute('data-theme');
      const theme = element.getAttribute('data-cinder-theme');

      return {
        dir: resolveManagedAttribute(
          explicitDirection,
          direction,
          managedAttributes.dir,
          initialAttributes.dir,
          preserveInitialDirection,
        ),
        preserveDirection:
          explicitDirection !== undefined ||
          (preserveInitialDirection && initialAttributes.dir !== null),
        lang: resolveManagedAttribute(
          explicitLanguage,
          language,
          managedAttributes.lang,
          null,
          false,
        ),
        preserveLanguage: explicitLanguage !== undefined,
        dataTheme: resolveManagedAttribute(
          explicitDataTheme,
          dataTheme,
          managedAttributes.dataTheme,
          null,
          false,
        ),
        preserveDataTheme: explicitDataTheme !== undefined,
        theme: resolveManagedAttribute(explicitTheme, theme, managedAttributes.theme, null, false),
        preserveTheme: explicitTheme !== undefined,
      };
    }

    function syncInheritedAttributes(
      source: HTMLElement | null | undefined,
      inheritAttributes: boolean,
    ) {
      const nextManagedAttributes = copyInheritedPortalAttributes(
        element,
        source,
        inheritAttributes,
        currentFallbackAttributes(),
      );
      managedAttributes.dir = nextManagedAttributes.dir;
      managedAttributes.lang = nextManagedAttributes.lang;
      managedAttributes.dataTheme = nextManagedAttributes.dataTheme;
      managedAttributes.theme = nextManagedAttributes.theme;
    }

    // Drop a placeholder comment at the wrapper's original location. When `disabled` flips true or
    // the target can no longer be resolved, the wrapper is reinserted at this anchor so children
    // stay rendered in the original document position. Without this, `$effect` cleanup detaches
    // the wrapper and nothing reattaches it — content silently disappears.
    const anchor =
      typeof document !== 'undefined' ? document.createComment('@lostgradient/cinder') : null;
    if (anchor && initialParent && element.parentNode === initialParent) {
      initialParent.insertBefore(anchor, element);
    }

    function restoreInline() {
      if (!anchor || !anchor.parentNode) return;
      if (element.parentNode === anchor.parentNode && element.previousSibling === anchor) return;
      anchor.parentNode.insertBefore(element, anchor.nextSibling);
    }

    let activeAttributeSource: HTMLElement | null = null;
    let activeInheritAttributes = false;
    let stopObservingInheritedAttributes: (() => void) | null = null;

    function clearActivePortal() {
      restoreInline();
      activeAttributeSource = null;
      activeInheritAttributes = false;
      untrack(() => syncInheritedAttributes(null, false));
    }

    function mountResolved(target: HTMLElement, source: HTMLElement | null, inherit: boolean) {
      activeAttributeSource = source;
      activeInheritAttributes = inherit;
      untrack(() => syncInheritedAttributes(source, inherit));
      stopObservingInheritedAttributes = observeInheritedPortalAttributes(source, inherit, () =>
        syncInheritedAttributes(source, inherit),
      );
      if (element.parentElement !== target) target.appendChild(element);
      lastWarnedUnresolvedKey = null;
    }

    function handleUnresolved(key: string) {
      clearActivePortal();
      if (lastWarnedUnresolvedKey === key) return;
      devWarn(`[cinder/portal] could not resolve portal target ${JSON.stringify(key)}.`);
      lastWarnedUnresolvedKey = key;
    }

    function resolveAttachmentTarget(
      target: ReturnType<typeof resolvePortalTarget>,
    ): ReturnType<typeof resolvePortalTarget> {
      if (target?.kind !== 'resolved') return target;
      return target.target === element || element.contains(target.target)
        ? { kind: 'unresolved', key: 'own-wrapper' }
        : target;
    }

    function applyAttachmentState(
      disabled: boolean,
      resolved: ReturnType<typeof resolvePortalTarget>,
      attributeSource: HTMLElement | null,
      inheritAttributes: boolean,
    ): void {
      if (disabled) {
        clearActivePortal();
        lastWarnedUnresolvedKey = null;
      } else if (resolved?.kind === 'resolved') {
        mountResolved(resolved.target, attributeSource, inheritAttributes);
      } else if (resolved?.kind === 'unresolved') {
        handleUnresolved(resolved.key);
      }
    }

    // Attribute props can update without changing where the portal is mounted. Keep those updates
    // in a child effect so changing language or theme never runs the mount effect's teardown and
    // detaches focused content.
    $effect(() => {
      readOption(options.explicitAttributes ?? {});
      untrack(() => syncInheritedAttributes(activeAttributeSource, activeInheritAttributes));
    });

    // Nest the reads inside `$effect` so getter-based options are tracked reactively. Each rerun
    // detaches the previous mount before re-resolving — this guards against the wrapper being
    // stranded in the old target when `target` changes or `disabled` flips true.
    $effect(() => {
      const disabled = readOption(options.disabled ?? false);
      const inheritAttributes = readOption(options.inheritAttributes ?? true);
      const targetValue = readOption(options.target ?? null);
      const attributeSource = readOption(options.source ?? initialParent) ?? initialParent;
      const rawResolved = disabled ? null : resolvePortalTarget(targetValue);
      // A resolved target that is the wrapper itself (or nests inside it) is never valid — most
      // often this means an ownership lookup (e.g. findNearestOpenTopLayer) fed its own scope
      // element back as the target. Treat it the same as "unresolved" rather than attempting the
      // append, which would throw (a node cannot become its own child).
      const resolved = resolveAttachmentTarget(rawResolved);
      applyAttachmentState(disabled, resolved, attributeSource, inheritAttributes);

      return () => {
        stopObservingInheritedAttributes?.();
        // The next effect run moves the existing wrapper directly between its old and new
        // locations. Removing it here would blur focused descendants even when the resolved target
        // did not change.
      };
    });

    return () => {
      // The wrapper may have been moved out of Svelte's original render tree. Remove it from
      // whichever target currently owns it so unmounting a portaled surface cannot leak it into
      // the next render or test.
      element.remove();
      // Final cleanup: also remove the anchor so we don't leave orphan comment nodes behind.
      if (anchor && anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    };
  };
}
