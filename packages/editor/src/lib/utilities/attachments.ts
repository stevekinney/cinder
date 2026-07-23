import type { Attachment } from 'svelte/attachments';

/** Pointer/click/touch events the outside-dismiss listener can key off. */
export type ClickOutsideEventType = 'click' | 'pointerdown' | 'mousedown' | 'touchstart';

export type ClickOutsideOptions = {
  /** Callback when an outside interaction occurs */
  handler: () => void;
  /** Whether the attachment is enabled — accepts a getter to stay reactive (default: true) */
  enabled?: boolean | (() => boolean);
  /**
   * Which document event triggers the outside check (default: `'click'`). Overlays that must
   * dismiss before a focus/selection change commits use `'pointerdown'` (or `'mousedown'`),
   * which fire ahead of `'click'`.
   */
  eventType?: ClickOutsideEventType;
  /**
   * Whether to listen in the capture phase (default: `true`). Capture sees the event before
   * inner stopPropagation can swallow it — the right default for a document-level dismisser.
   */
  capture?: boolean;
  /**
   * Additional elements that count as "inside" — a target within any of these (or the attach
   * node) does NOT trigger the handler. Each entry is a getter so a trigger/anchor that mounts
   * or swaps after the attachment is created still resolves freshly on each event. Returning
   * `null` skips that ref.
   */
  ignoreRefs?: Array<() => Element | null>;
};

function isInsideEventPath(event: Event, element: Element): boolean {
  const path = event.composedPath();
  return path.some((entry) => entry instanceof Node && element.contains(entry));
}

/**
 * Creates an outside-interaction attachment that calls a handler when a `click`, `pointerdown`,
 * `mousedown`, or `touchstart` lands outside the attached element (and outside any `ignoreRefs`).
 * This is the single canonical mechanism for overlay light-dismiss — dropdowns, menus, popovers —
 * so each overlay does not hand-roll its own `document` listener and inside/trigger exclusion
 * (see `OVERLAY-POLICY.md` § Outside-click).
 *
 * @example
 * ```svelte
 * <div {@attach createClickOutside({ handler: () => isOpen = false, enabled: () => isOpen })}>
 *   Dropdown content
 * </div>
 * ```
 *
 * @example With a separate trigger that must not count as outside, dismissing on pointerdown:
 * ```svelte
 * <div {@attach createClickOutside({
 *   handler: close,
 *   enabled: () => open,
 *   eventType: 'pointerdown',
 *   ignoreRefs: [() => triggerElement],
 * })}>...</div>
 * ```
 */
export function createClickOutside(options: ClickOutsideOptions): Attachment<HTMLElement> {
  const { handler, enabled = true, eventType = 'click', capture = true, ignoreRefs } = options;

  return (node: HTMLElement) => {
    function handleEvent(event: MouseEvent | PointerEvent | TouchEvent) {
      const isEnabled = typeof enabled === 'function' ? enabled() : enabled;
      if (!isEnabled) return;
      if (event.type === 'touchstart' && !event.cancelable) return;
      const target = event.target;
      // A non-Node (or null) target is treated as outside the node.
      if (!(target instanceof Node)) {
        handler();
        return;
      }
      if (isInsideEventPath(event, node)) return;
      if (ignoreRefs) {
        for (const ref of ignoreRefs) {
          const element = ref();
          if (element && isInsideEventPath(event, element)) return;
        }
      }
      handler();
    }

    document.addEventListener(eventType, handleEvent, capture);

    return () => {
      document.removeEventListener(eventType, handleEvent, capture);
    };
  };
}
