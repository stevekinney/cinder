const eventProperties = [
  'view',
  'key',
  'code',
  'location',
  'repeat',
  'isComposing',
  'button',
  'buttons',
  'movementX',
  'movementY',
  'which',
  'clientX',
  'clientY',
  'screenX',
  'screenY',
  'ctrlKey',
  'shiftKey',
  'altKey',
  'metaKey',
  'relatedTarget',
  'pointerId',
  'pointerType',
  'isPrimary',
  'detail',
  'data',
  'inputType',
  'dataTransfer',
  'pressure',
  'tiltX',
  'tiltY',
  'twist',
  'tangentialPressure',
  'width',
  'height',
] as const;
const writableEventProperties = ['movementX', 'movementY', 'which', 'width', 'height'] as const;

function createRedispatchEventInit(event: Event): EventInit & { [property: string]: unknown } {
  const eventInit: EventInit & { [property: string]: unknown } = {
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    composed: event.composed,
  };
  for (const property of eventProperties) {
    if (property in event) eventInit[property] = Reflect.get(event, property);
  }
  return eventInit;
}

function constructRedispatchEvent(event: Event, eventInit: EventInit): Event {
  try {
    return Reflect.construct(event.constructor, [event.type, eventInit]);
  } catch {
    return new Event(event.type, eventInit);
  }
}

function copyWritableEventProperties(source: Event, target: Event): void {
  for (const property of writableEventProperties) {
    if (!(property in source)) continue;
    const value = Reflect.get(source, property);
    if (Reflect.get(target, property) === value) continue;
    try {
      Object.defineProperty(target, property, { configurable: true, value });
    } catch {
      // Some native event implementations expose non-configurable accessors.
    }
  }
}

export function redispatchPortaledEvent(
  event: Event,
  sourceTarget: HTMLElement | null | undefined,
): boolean {
  if (!sourceTarget) return false;

  // Pointer and mouse events are distinct native families. Bridge each native
  // event once; dropping the browser's corresponding mousedown/mouseup would
  // break consumers that listen to only that family. Replay protection belongs
  // to the redispatched-event marker, not pointer/mouse pairing heuristics.

  const originalTarget = event.target;
  const originalComposedPath = event.composedPath();
  const eventInit = createRedispatchEventInit(event);
  const bridgedEvent = constructRedispatchEvent(event, eventInit);
  copyWritableEventProperties(event, bridgedEvent);
  redispatchedPortalEvents.add(bridgedEvent);
  Object.defineProperty(bridgedEvent, 'target', { configurable: true, value: originalTarget });
  // Dispatching at the authored root necessarily changes currentTarget and the
  // platform-computed path. Preserve the original portaled ancestry for delegated
  // consumers; isTrusted cannot be copied to a synthetic Event.
  const nativeComposedPath = bridgedEvent.composedPath.bind(bridgedEvent);
  let dispatchComplete = false;
  Object.defineProperty(bridgedEvent, 'composedPath', {
    configurable: true,
    value: () => {
      // During synthetic dispatch expose the authored-root path. Svelte's
      // delegated listener traverses composedPath(); exposing portaled
      // descendants here would replay their handlers. Restore the original
      // path after dispatch for consumer inspection.
      return dispatchComplete ? [...originalComposedPath] : nativeComposedPath();
    },
  });
  if (event.defaultPrevented) bridgedEvent.preventDefault();

  event.stopPropagation();
  const dispatched = sourceTarget.dispatchEvent(bridgedEvent);
  dispatchComplete = true;
  if (!dispatched) {
    event.preventDefault();
  }
  return true;
}

const redispatchedPortalEvents = new WeakSet<Event>();

/** Returns the host element of `element`'s enclosing shadow root, or `null` if it is not in one. */
export function getShadowHost(element: HTMLElement): HTMLElement | null {
  const root = element.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
}

/**
 * Like `Element.prototype.closest`, but continues the search from the
 * enclosing shadow host once `element`'s own tree is exhausted, so a
 * selector matching an ancestor *outside* an intervening shadow boundary
 * (e.g. `[hidden]`, `[inert]`, `aria-hidden="true"` set on a shadow host)
 * is still found. Plain `closest()` cannot see past a shadow root.
 */
export function closestAcrossShadow(element: HTMLElement, selector: string): HTMLElement | null {
  let current: HTMLElement | null = element;
  while (current) {
    const match = current.closest<HTMLElement>(selector);
    if (match) return match;
    current = getShadowHost(current);
  }
  return null;
}

export function isRedispatchedPortaledEvent(event: Event): boolean {
  return redispatchedPortalEvents.has(event);
}
