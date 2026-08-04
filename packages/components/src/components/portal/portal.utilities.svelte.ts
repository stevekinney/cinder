import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

import { devWarn } from '../../utilities/dev-warn.ts';

import { readOption } from '../../utilities/read-option.ts';
import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';

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
   * When true (default), inherit `dir`, `lang`, `data-theme`, and `data-cinder-theme` from the nearest
   * matching ancestor of `source` while mounted. Explicit attributes on the portal wrapper win over
   * inherited values.
   */
  inheritAttributes?: boolean | (() => boolean);
  /**
   * Current public attributes supplied by the Portal component. The attachment uses these to
   * distinguish explicit attributes from equal inherited values after the wrapper has moved.
   */
  explicitAttributes?:
    | {
        dir?: string | null | undefined;
        lang?: string | null | undefined;
        dataTheme?: string | null | undefined;
        theme?: string | null | undefined;
      }
    | (() => {
        dir?: string | null | undefined;
        lang?: string | null | undefined;
        dataTheme?: string | null | undefined;
        theme?: string | null | undefined;
      });
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

export function findNearestOpenPopover(source: HTMLElement): HTMLElement | null {
  let candidate = source.closest<HTMLElement>('[popover]');
  while (candidate) {
    try {
      if (candidate.matches(':popover-open')) return candidate;
    } catch {
      // Unsupported pseudo-classes are treated as closed.
    }
    candidate = candidate.parentElement?.closest<HTMLElement>('[popover]') ?? null;
  }
  return null;
}

export function findNearestOpenTopLayer(
  source: HTMLElement,
  isModalDialog: (element: HTMLElement) => boolean = (element) => element.matches(':modal'),
): HTMLElement | null {
  // Skip the nearest `.cinder-popover__trigger` itself: that marker is always the source's own
  // (not-yet-existing) scope, not a genuinely enclosing owner. Continuing the search from its
  // parent finds the next marker up the tree, which — by construction — belongs to a different,
  // truly enclosing popover/top-layer instance (see the nested-popover-in-trigger follow-up).
  const ownerLookupSource = source.closest('.cinder-popover__trigger')?.parentElement ?? source;
  const ownerId = ownerLookupSource.closest<HTMLElement>('[data-cinder-portal-owner]')?.dataset[
    'cinderPortalOwner'
  ];
  if (ownerId) {
    const owner = document.getElementById(ownerId);
    if (owner instanceof HTMLElement) return owner;
  }
  let candidate: HTMLElement | null = source;
  while (candidate) {
    try {
      if (
        (candidate.matches('dialog') && isModalDialog(candidate)) ||
        (candidate.matches('[popover]') && candidate.matches(':popover-open'))
      )
        return candidate;
    } catch {
      // Unsupported pseudo-classes are treated as closed.
    }
    const rootNode = candidate.getRootNode();
    const shadowHost: Element | null = rootNode instanceof ShadowRoot ? rootNode.host : null;
    candidate = candidate.parentElement ?? (shadowHost instanceof HTMLElement ? shadowHost : null);
  }
  return null;
}

export function getInheritedPortalStyle(source: HTMLElement | null | undefined): string {
  if (!source || typeof window === 'undefined') return '';

  const computed = getComputedStyle(source);
  const hasDirectTypography =
    source.tagName === 'NAV' ||
    (source.parentElement === null &&
      ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'].some(
        (property) => source.style.getPropertyValue(property) !== '',
      ));
  const typographySource = hasDirectTypography ? source : (source.parentElement ?? source);
  const typography = getComputedStyle(typographySource);
  const inherited = document.createElement('div').style;
  const customPropertyNames = new Set<string>();
  let customPropertySource: HTMLElement | null = source;
  while (customPropertySource) {
    for (const property of Array.from(customPropertySource.style)) {
      if (property.startsWith('--cinder-')) customPropertyNames.add(property);
    }
    customPropertySource =
      customPropertySource.parentElement ?? getShadowHost(customPropertySource);
  }
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (property.startsWith('--cinder-')) customPropertyNames.add(property);
  }
  for (const property of customPropertyNames) {
    const value = computed.getPropertyValue(property);
    if (value) inherited.setProperty(property, value);
  }

  const colorScheme = computed.colorScheme || source.style.colorScheme;
  if (colorScheme) {
    inherited.setProperty('color-scheme', colorScheme);
  }
  if (!source.hasAttribute('dir') && computed.direction) {
    inherited.setProperty('direction', computed.direction);
  }
  for (const property of [
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
  ]) {
    const value = typography.getPropertyValue(property);
    if (value) inherited.setProperty(property, value);
  }
  for (const property of Array.from(source.style)) {
    if (!property.startsWith('--cinder-')) continue;
    const rawValue = source.style.getPropertyValue(property);
    if (!rawValue.includes('var(')) inherited.setProperty(property, rawValue);
  }
  if (source.style.colorScheme) inherited.setProperty('color-scheme', source.style.colorScheme);

  return inherited.cssText;
}

export function createInheritedPortalStyle(
  source: () => HTMLElement | null | undefined,
  active: () => boolean,
): { readonly style: string } {
  let style = $state('');
  const reducedMotion = useReducedMotion();

  $effect(() => {
    void reducedMotion.current;
    if (!active()) {
      style = '';
      return;
    }
    const inheritanceSource = source();
    const syncStyle = () => {
      style = getInheritedPortalStyle(inheritanceSource);
    };
    syncStyle();
    const stopObserving = observeInheritedPortalAttributes(inheritanceSource, true, syncStyle);
    if (typeof window === 'undefined') return stopObserving ?? undefined;
    const mediaQueries = [
      '(prefers-color-scheme: dark)',
      '(prefers-contrast: more)',
      '(forced-colors: active)',
    ].map((query) => window.matchMedia(query));
    const onMediaChange = () => syncStyle();
    for (const mediaQuery of mediaQueries) mediaQuery.addEventListener('change', onMediaChange);
    window.addEventListener('resize', onMediaChange);
    return () => {
      stopObserving?.();
      for (const mediaQuery of mediaQueries)
        mediaQuery.removeEventListener('change', onMediaChange);
      window.removeEventListener('resize', onMediaChange);
    };
  });

  return {
    get style() {
      return style;
    },
  };
}

export function copyInheritedPortalAttributes(
  element: HTMLElement,
  source: HTMLElement | null | undefined,
  inheritAttributes: boolean,
  fallbackAttributes: {
    dir: string | null;
    lang?: string | null;
    dataTheme: string | null;
    theme: string | null;
    preserveDirection?: boolean;
    preserveLanguage?: boolean;
    preserveDataTheme?: boolean;
    preserveTheme?: boolean;
  } = {
    dir: element.getAttribute('dir'),
    lang: element.getAttribute('lang'),
    dataTheme: element.getAttribute('data-theme'),
    theme: element.getAttribute('data-cinder-theme'),
  },
) {
  const inheritedDirectionAttribute = 'data-cinder-portal-inherited-direction';
  const preservesExplicitDirection =
    fallbackAttributes.preserveDirection || element.dataset['cinderExplicitDirection'] === 'true';
  let inheritedDir: string | null | undefined = null;
  let generatedDirectionFallback: string | null = null;
  if (inheritAttributes && source && !preservesExplicitDirection) {
    let computedDirection: string | null = null;
    let hasReadComputedDirection = false;
    const readComputedDirection = () => {
      if (!hasReadComputedDirection) {
        computedDirection =
          typeof getComputedStyle === 'function' ? getComputedStyle(source).direction : null;
        hasReadComputedDirection = true;
      }
      return computedDirection;
    };
    let directionSource: HTMLElement | null = source;
    let crossedGeneratedDirectionBoundary = false;
    while (directionSource) {
      const matchingDirection = closestAcrossShadow(directionSource, '[dir]');
      if (!matchingDirection) {
        directionSource = getShadowHost(directionSource);
        continue;
      }
      if (!matchingDirection.hasAttribute(inheritedDirectionAttribute)) {
        const explicitDirection = matchingDirection.getAttribute('dir');
        const normalizedExplicitDirection = explicitDirection?.toLowerCase();
        if (crossedGeneratedDirectionBoundary) {
          if (normalizedExplicitDirection === 'auto') inheritedDir = 'auto';
          break;
        }
        const documentComputedDirection =
          matchingDirection === document.documentElement && normalizedExplicitDirection !== 'auto'
            ? readComputedDirection()
            : null;
        inheritedDir =
          normalizedExplicitDirection === 'auto'
            ? normalizedExplicitDirection
            : documentComputedDirection || explicitDirection;
        break;
      }
      const generatedDirection = matchingDirection.getAttribute('dir');
      generatedDirectionFallback ??= generatedDirection;
      crossedGeneratedDirectionBoundary = true;
      directionSource = matchingDirection.parentElement ?? getShadowHost(matchingDirection);
    }
    if (inheritedDir === null) {
      inheritedDir = readComputedDirection() || generatedDirectionFallback;
    }
  }
  const nextDir = inheritedDir ?? fallbackAttributes.dir;
  if (nextDir) {
    element.setAttribute('dir', nextDir);
    if (!preservesExplicitDirection && inheritedDir !== null) {
      element.setAttribute(inheritedDirectionAttribute, 'true');
    } else {
      element.removeAttribute(inheritedDirectionAttribute);
    }
  } else {
    element.removeAttribute('dir');
    element.removeAttribute(inheritedDirectionAttribute);
  }

  const preservesExplicitLanguage =
    fallbackAttributes.preserveLanguage ?? fallbackAttributes.lang !== null;
  const inheritedLanguage =
    inheritAttributes && source && !preservesExplicitLanguage
      ? closestAcrossShadow(source, '[lang]')?.getAttribute('lang')
      : null;
  const nextLanguage = inheritedLanguage ?? fallbackAttributes.lang;
  if (nextLanguage !== null && nextLanguage !== undefined) {
    element.setAttribute('lang', nextLanguage);
  } else {
    element.removeAttribute('lang');
  }

  const preservesExplicitDataTheme = fallbackAttributes.preserveDataTheme === true;
  const inheritedDataTheme =
    inheritAttributes &&
    source &&
    !preservesExplicitDataTheme &&
    fallbackAttributes.dataTheme === null
      ? closestAcrossShadow(source, '[data-theme]')?.getAttribute('data-theme')
      : null;
  const nextDataTheme = inheritedDataTheme ?? fallbackAttributes.dataTheme;
  if (nextDataTheme) {
    element.setAttribute('data-theme', nextDataTheme);
  } else {
    element.removeAttribute('data-theme');
  }

  const preservesExplicitTheme = fallbackAttributes.preserveTheme === true;
  const inheritedTheme =
    inheritAttributes && source && !preservesExplicitTheme && fallbackAttributes.theme === null
      ? closestAcrossShadow(source, '[data-cinder-theme]')?.getAttribute('data-cinder-theme')
      : null;
  const nextTheme = inheritedTheme ?? fallbackAttributes.theme;
  if (nextTheme) {
    element.setAttribute('data-cinder-theme', nextTheme);
  } else {
    element.removeAttribute('data-cinder-theme');
  }

  return {
    dir: inheritedDir ?? null,
    lang: inheritedLanguage ?? null,
    dataTheme: inheritedDataTheme ?? null,
    theme: inheritedTheme ?? null,
  };
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
  const eventInit: EventInit & { [property: string]: unknown } = {
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    composed: event.composed,
  };
  for (const property of [
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
  ]) {
    if (property in event) eventInit[property] = Reflect.get(event, property);
  }
  let bridgedEvent: Event;
  try {
    bridgedEvent = Reflect.construct(event.constructor, [event.type, eventInit]);
  } catch {
    bridgedEvent = new Event(event.type, eventInit);
  }
  for (const property of ['movementX', 'movementY', 'which', 'width', 'height']) {
    if (!(property in event)) continue;
    const value = Reflect.get(event, property);
    if (Reflect.get(bridgedEvent, property) === value) continue;
    try {
      Object.defineProperty(bridgedEvent, property, { configurable: true, value });
    } catch {
      // Some native event implementations expose non-configurable accessors.
    }
  }
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

function isEffectivelyDisabled(source: HTMLElement): boolean {
  if (source.matches(':disabled')) return true;

  const disabledFieldset = source.closest<HTMLFieldSetElement>('fieldset[disabled]');
  if (!disabledFieldset) return false;
  const firstLegend = disabledFieldset.querySelector(':scope > legend');
  return !firstLegend?.contains(source);
}

function isEffectivelyUnavailable(source: HTMLElement): boolean {
  if (isEffectivelyDisabled(source)) return true;
  // Plain `closest()` cannot see past a shadow boundary, so a source whose
  // enclosing shadow HOST gains `[hidden]`/`[inert]`/`aria-hidden="true"`
  // would otherwise still report itself as available: the computed-style
  // walk below crosses shadow hosts, but none of these three attributes
  // change `display`/`visibility` on their own, so this check needs the
  // same cross-shadow reach.
  if (closestAcrossShadow(source, '[hidden], [inert], [aria-hidden="true"]')) return true;
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return false;
  let ancestor: HTMLElement | null = source;
  while (ancestor) {
    const computed = getComputedStyle(ancestor);
    if (computed.display === 'none' || computed.visibility === 'hidden') return true;
    ancestor = ancestor.parentElement ?? getShadowHost(ancestor);
  }
  return false;
}

export function observePortalSourceAvailability(
  source: HTMLElement | null | undefined,
  onChange: (unavailable: boolean) => void,
): () => void {
  if (!source) return () => {};

  const syncAvailability = () => {
    onChange(isEffectivelyUnavailable(source));
  };
  if (typeof MutationObserver === 'undefined') {
    syncAvailability();
    return () => {};
  }

  const observer = new MutationObserver(syncAvailability);
  let ancestor: HTMLElement | null = source;
  while (ancestor) {
    observer.observe(ancestor, {
      attributes: true,
      attributeFilter: ['hidden', 'inert', 'aria-hidden', 'disabled', 'class', 'style'],
    });
    ancestor = ancestor.parentElement ?? getShadowHost(ancestor);
  }
  syncAvailability();

  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncAvailability);
  resizeObserver?.observe(source);

  return () => {
    observer.disconnect();
    resizeObserver?.disconnect();
  };
}

function observeInheritedPortalAttributes(
  source: HTMLElement | null | undefined,
  inheritAttributes: boolean,
  syncAttributes: () => void,
): (() => void) | null {
  if (!inheritAttributes || !source) return null;

  const observer =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          syncAttributes();
        });
  const observedElements: HTMLElement[] = [];

  function observe(elementToObserve: HTMLElement | null | undefined) {
    if (!observer || !elementToObserve || observedElements.includes(elementToObserve)) return;
    observedElements.push(elementToObserve);
    observer.observe(elementToObserve, {
      attributes: true,
      attributeFilter: ['class', 'style', 'dir', 'lang', 'data-theme', 'data-cinder-theme'],
    });
  }

  function rebindObservedElements() {
    const nextElements: HTMLElement[] = [];
    let ancestor: HTMLElement | null = source ?? null;
    while (ancestor) {
      nextElements.push(ancestor);
      ancestor = ancestor.parentElement ?? getShadowHost(ancestor);
    }
    if (!nextElements.includes(document.documentElement)) {
      nextElements.push(document.documentElement);
    }
    if (
      observedElements.length === nextElements.length &&
      observedElements.every((element, index) => element === nextElements[index])
    ) {
      return;
    }
    observer?.disconnect();
    observedElements.length = 0;
    for (const element of nextElements) observe(element);
  }
  rebindObservedElements();

  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncAttributes);
  resizeObserver?.observe(source);
  const stopObservingComputedDirection = observeComputedDirection(
    source,
    syncAttributes,
    rebindObservedElements,
  );

  return () => {
    observer?.disconnect();
    resizeObserver?.disconnect();
    stopObservingComputedDirection();
  };
}

type ComputedDirectionObservation = {
  source: HTMLElement;
  direction: string;
  sync: () => void;
  rebindInheritedAttributes: () => void;
  roots: ShadowRoot[];
  resizeObserver: ResizeObserver | null;
  resizeObservedElements: HTMLElement[];
};

const computedDirectionObservations = new Set<ComputedDirectionObservation>();
const observedMediaQueries = new Map<string, MediaQueryList>();
const directionInvalidationRoots = new Map<
  ShadowRoot,
  { observer: MutationObserver | null; count: number }
>();
const directionInvalidationEvents = [
  'focusin',
  'focusout',
  'pointerover',
  'pointerout',
  'input',
  'change',
  'toggle',
  'pointerdown',
  'pointerup',
  'pointercancel',
  'keydown',
  'keyup',
] as const;
let directionInvalidationObserver: MutationObserver | null = null;
let directionInvalidationFrame: number | null = null;
let directionInvalidationDocument: Document | null = null;
let directionInvalidationStarted = false;

function invalidateComputedDirections() {
  if (directionInvalidationFrame !== null || typeof window === 'undefined') return;
  if (typeof window.requestAnimationFrame !== 'function') {
    syncComputedDirections();
    return;
  }
  directionInvalidationFrame = window.requestAnimationFrame(() => {
    directionInvalidationFrame = null;
    syncComputedDirections();
  });
}

/**
 * Notify mounted portals after a CSSOM edit that emits no DOM mutation, including `insertRule`,
 * `replace`, `replaceSync`, or assigning `adoptedStyleSheets` on a document or shadow root.
 */
export function invalidatePortalDirection() {
  if (computedDirectionObservations.size === 0) return;
  refreshMediaQueryObservers();
  invalidateComputedDirections();
}

function syncComputedDirections() {
  const topologyChanges = new Set<ComputedDirectionObservation>();
  for (const current of computedDirectionObservations) {
    if (!rebindComputedDirectionObservation(current)) continue;
    topologyChanges.add(current);
    current.rebindInheritedAttributes();
  }
  if (topologyChanges.size > 0) refreshMediaQueryObservers();
  if (typeof getComputedStyle !== 'function') return;
  for (const current of computedDirectionObservations) {
    const direction = getComputedStyle(current.source).direction;
    if (direction === current.direction && !topologyChanges.has(current)) continue;
    current.direction = direction;
    current.sync();
  }
}

function collectMediaQueries(rules: CSSRuleList | Iterable<CSSRule>, queries: Set<string>) {
  for (const rule of Array.from(rules)) {
    const conditionText = Reflect.get(rule, 'conditionText');
    const media = Reflect.get(rule, 'media');
    if (typeof conditionText === 'string' && media && typeof media === 'object') {
      queries.add(conditionText);
    }
    const mediaText = media && Reflect.get(media, 'mediaText');
    if (typeof mediaText === 'string' && mediaText) queries.add(mediaText);
    const importedStylesheet = Reflect.get(rule, 'styleSheet');
    if (importedStylesheet) {
      try {
        const importedMedia = Reflect.get(importedStylesheet, 'media');
        const importedMediaText = importedMedia && Reflect.get(importedMedia, 'mediaText');
        if (typeof importedMediaText === 'string' && importedMediaText)
          queries.add(importedMediaText);
        const importedRules = Reflect.get(importedStylesheet, 'cssRules');
        if (isCssRuleCollection(importedRules)) collectMediaQueries(importedRules, queries);
      } catch {
        // Cross-origin imported stylesheets are not script-readable.
      }
    }
    const nestedRules = Reflect.get(rule, 'cssRules');
    if (isCssRuleCollection(nestedRules)) {
      try {
        collectMediaQueries(nestedRules, queries);
      } catch {
        // Cross-origin stylesheets and inaccessible CSS rule lists are ignored.
      }
    }
  }
}

function addMediaQueryListener(mediaQuery: MediaQueryList) {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', invalidateComputedDirections);
  } else {
    mediaQuery.addListener?.(invalidateComputedDirections);
  }
}

function removeMediaQueryListener(mediaQuery: MediaQueryList) {
  if (typeof mediaQuery.removeEventListener === 'function') {
    mediaQuery.removeEventListener('change', invalidateComputedDirections);
  } else {
    mediaQuery.removeListener?.(invalidateComputedDirections);
  }
}

function isCssRuleCollection(value: unknown): value is CSSRuleList | Iterable<CSSRule> {
  if (typeof CSSRuleList !== 'undefined' && value instanceof CSSRuleList) return true;
  return typeof value === 'object' && value !== null && Symbol.iterator in value;
}

function refreshMediaQueryObservers() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const queries = new Set<string>();
  const roots = new Set<Document | ShadowRoot>([document]);
  for (const current of computedDirectionObservations) {
    const root = current.source.getRootNode();
    if (root instanceof ShadowRoot) roots.add(root);
    for (const observedRoot of current.roots) roots.add(observedRoot);
  }
  for (const root of roots) {
    const stylesheets = [
      ...Array.from(root.styleSheets ?? []),
      ...Array.from(root.adoptedStyleSheets ?? []),
    ];
    for (const stylesheet of stylesheets) {
      try {
        const mediaText = stylesheet.media?.mediaText;
        if (mediaText) queries.add(mediaText);
        collectMediaQueries(stylesheet.cssRules, queries);
      } catch {
        // Cross-origin stylesheets are not script-readable.
      }
    }
  }
  for (const [query, mediaQuery] of observedMediaQueries) {
    if (queries.has(query)) continue;
    removeMediaQueryListener(mediaQuery);
    observedMediaQueries.delete(query);
  }
  for (const query of queries) {
    if (observedMediaQueries.has(query)) continue;
    const mediaQuery = window.matchMedia(query);
    addMediaQueryListener(mediaQuery);
    observedMediaQueries.set(query, mediaQuery);
  }
}

function startDirectionInvalidationObservers() {
  if (directionInvalidationStarted || typeof document === 'undefined') return;
  directionInvalidationStarted = true;
  directionInvalidationDocument = document;
  directionInvalidationObserver =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((mutations) => {
          if (mutations.some(isStylesheetMutation)) {
            refreshMediaQueryObservers();
          }
          invalidateComputedDirections();
        });
  directionInvalidationObserver?.observe(document.documentElement, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  document.addEventListener('load', handleStylesheetLoad, true);
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', invalidateComputedDirections);
    window.addEventListener('orientationchange', invalidateComputedDirections);
    window.addEventListener('hashchange', invalidateComputedDirections);
    for (const event of directionInvalidationEvents) {
      document.addEventListener(event, invalidateComputedDirections, true);
    }
  }
  refreshMediaQueryObservers();
}

function isStylesheetMutation(mutation: MutationRecord): boolean {
  if (mutation.type === 'attributes') {
    return (
      (mutation.target instanceof HTMLStyleElement || isStylesheetLink(mutation.target)) &&
      (mutation.attributeName === 'media' || mutation.attributeName === 'disabled')
    );
  }
  if (mutation.type === 'characterData') {
    return mutation.target.parentElement instanceof HTMLStyleElement;
  }
  if (mutation.type !== 'childList') return false;
  if (mutation.target instanceof HTMLStyleElement) return true;
  return [...mutation.addedNodes, ...mutation.removedNodes].some(containsStylesheetNode);
}

function containsStylesheetNode(node: Node): boolean {
  if (node instanceof HTMLStyleElement || isStylesheetLink(node)) return true;
  if (!(node instanceof Element || node instanceof DocumentFragment)) return false;
  return (
    node.querySelector('style') !== null ||
    [...node.querySelectorAll('link')].some(isStylesheetLink)
  );
}

function isStylesheetLink(node: Node): node is HTMLLinkElement {
  return (
    node instanceof HTMLLinkElement &&
    node.rel.split(/\s+/).some((relationship) => relationship.toLowerCase() === 'stylesheet')
  );
}

function observeDirectionShadowRoots(source: HTMLElement) {
  const roots: ShadowRoot[] = [];
  let current: HTMLElement | null = source;
  while (current) {
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      roots.push(root);
      const existing = directionInvalidationRoots.get(root);
      if (existing) existing.count += 1;
      else {
        const observer =
          typeof MutationObserver === 'undefined'
            ? null
            : new MutationObserver((mutations) => {
                if (mutations.some(isStylesheetMutation)) refreshMediaQueryObservers();
                invalidateComputedDirections();
              });
        observer?.observe(root, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true,
        });
        root.addEventListener('load', handleStylesheetLoad, true);
        for (const event of directionInvalidationEvents) {
          root.addEventListener(event, invalidateComputedDirections, true);
        }
        directionInvalidationRoots.set(root, { observer, count: 1 });
      }
    }
    current = getShadowHost(current);
  }
  return roots;
}

function releaseDirectionShadowRoot(root: ShadowRoot) {
  const existing = directionInvalidationRoots.get(root);
  if (!existing) return;
  existing.count -= 1;
  if (existing.count > 0) return;
  existing.observer?.disconnect();
  root.removeEventListener('load', handleStylesheetLoad, true);
  for (const event of directionInvalidationEvents) {
    root.removeEventListener(event, invalidateComputedDirections, true);
  }
  directionInvalidationRoots.delete(root);
}

function stopDirectionInvalidationObservers() {
  if (computedDirectionObservations.size > 0) return;
  directionInvalidationStarted = false;
  directionInvalidationObserver?.disconnect();
  directionInvalidationObserver = null;
  directionInvalidationDocument?.removeEventListener('load', handleStylesheetLoad, true);
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', invalidateComputedDirections);
    window.removeEventListener('orientationchange', invalidateComputedDirections);
    window.removeEventListener('hashchange', invalidateComputedDirections);
  }
  for (const event of directionInvalidationEvents) {
    directionInvalidationDocument?.removeEventListener(event, invalidateComputedDirections, true);
  }
  for (const mediaQuery of observedMediaQueries.values()) {
    removeMediaQueryListener(mediaQuery);
  }
  observedMediaQueries.clear();
  for (const [root, { observer }] of directionInvalidationRoots) {
    observer?.disconnect();
    root.removeEventListener('load', handleStylesheetLoad, true);
    for (const event of directionInvalidationEvents) {
      root.removeEventListener(event, invalidateComputedDirections, true);
    }
  }
  directionInvalidationRoots.clear();
  if (directionInvalidationFrame !== null) {
    if (typeof window !== 'undefined') window.cancelAnimationFrame(directionInvalidationFrame);
    directionInvalidationFrame = null;
  }
  directionInvalidationDocument = null;
}

function handleStylesheetLoad(event: Event) {
  const target = event.target;
  if (target instanceof HTMLStyleElement || (target instanceof Node && isStylesheetLink(target))) {
    refreshMediaQueryObservers();
    invalidateComputedDirections();
  }
}

function observeComputedDirection(
  source: HTMLElement,
  sync: () => void,
  rebindInheritedAttributes: () => void,
): () => void {
  if (
    typeof getComputedStyle !== 'function' ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return () => {};
  }
  const observation: ComputedDirectionObservation = {
    source,
    direction: getComputedStyle(source).direction,
    sync,
    rebindInheritedAttributes,
    roots: [],
    resizeObserver: null,
    resizeObservedElements: [],
  };
  computedDirectionObservations.add(observation);
  startDirectionInvalidationObservers();
  observation.roots = observeDirectionShadowRoots(source);
  refreshMediaQueryObservers();
  rebindResizeObservation(observation, collectResizeObservedElements(source));

  return () => {
    computedDirectionObservations.delete(observation);
    observation.resizeObserver?.disconnect();
    for (const root of observation.roots) releaseDirectionShadowRoot(root);
    if (computedDirectionObservations.size === 0) {
      stopDirectionInvalidationObservers();
    } else {
      refreshMediaQueryObservers();
    }
  };
}

function collectDirectionShadowRoots(source: HTMLElement): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  let current: HTMLElement | null = source;
  while (current) {
    const root = current.getRootNode();
    if (root instanceof ShadowRoot && !roots.includes(root)) roots.push(root);
    current = getShadowHost(current);
  }
  return roots;
}

function collectResizeObservedElements(source: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];
  let current: HTMLElement | null = source;
  while (current) {
    elements.push(current);
    current = current.parentElement ?? getShadowHost(current);
  }
  return elements;
}

function rebindResizeObservation(
  observation: ComputedDirectionObservation,
  nextElements: HTMLElement[],
): boolean {
  if (
    observation.resizeObservedElements.length === nextElements.length &&
    observation.resizeObservedElements.every((element, index) => element === nextElements[index])
  )
    return false;
  observation.resizeObserver?.disconnect();
  observation.resizeObserver = null;
  observation.resizeObservedElements = nextElements;
  if (typeof ResizeObserver === 'undefined') return true;
  const resizeObserver = new ResizeObserver(invalidateComputedDirections);
  for (const element of nextElements) resizeObserver.observe(element);
  observation.resizeObserver = resizeObserver;
  return true;
}

function rebindComputedDirectionObservation(observation: ComputedDirectionObservation): boolean {
  const nextRoots = collectDirectionShadowRoots(observation.source);
  const rootsChanged =
    nextRoots.length !== observation.roots.length ||
    nextRoots.some((root, index) => root !== observation.roots[index]);
  if (rootsChanged) {
    for (const root of observation.roots) releaseDirectionShadowRoot(root);
    observation.roots = observeDirectionShadowRoots(observation.source);
  }
  const resizeChanged = rebindResizeObservation(
    observation,
    collectResizeObservedElements(observation.source),
  );
  return rootsChanged || resizeChanged;
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
      dir: element.getAttribute('dir'),
      lang: element.getAttribute('lang'),
      dataTheme: element.getAttribute('data-theme'),
      theme: element.getAttribute('data-cinder-theme'),
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
        dir:
          explicitDirection !== undefined
            ? explicitDirection
            : direction !== managedAttributes.dir
              ? direction
              : preserveInitialDirection
                ? initialAttributes.dir
                : null,
        preserveDirection:
          explicitDirection !== undefined ||
          (preserveInitialDirection && initialAttributes.dir !== null),
        lang:
          explicitLanguage !== undefined
            ? explicitLanguage
            : language !== managedAttributes.lang
              ? language
              : null,
        preserveLanguage: explicitLanguage !== undefined,
        dataTheme:
          explicitDataTheme !== undefined
            ? explicitDataTheme
            : dataTheme !== managedAttributes.dataTheme
              ? dataTheme
              : null,
        preserveDataTheme: explicitDataTheme !== undefined,
        theme:
          explicitTheme !== undefined
            ? explicitTheme
            : theme !== managedAttributes.theme
              ? theme
              : null,
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

    let activeAttributeSource: HTMLElement | null = null;
    let activeInheritAttributes = false;

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
      let stopObservingInheritedAttributes: (() => void) | null = null;
      const disabled = readOption(options.disabled ?? false);
      const inheritAttributes = readOption(options.inheritAttributes ?? true);
      const targetValue = readOption(options.target ?? null);
      const attributeSource = readOption(options.source ?? initialParent) ?? initialParent;
      const rawResolved = disabled ? null : resolvePortalTarget(targetValue);
      // A resolved target that is the wrapper itself (or nests inside it) is never valid — most
      // often this means an ownership lookup (e.g. findNearestOpenTopLayer) fed its own scope
      // element back as the target. Treat it the same as "unresolved" rather than attempting the
      // append, which would throw (a node cannot become its own child).
      const resolved =
        rawResolved?.kind === 'resolved' &&
        (rawResolved.target === element || element.contains(rawResolved.target))
          ? ({ kind: 'unresolved', key: 'own-wrapper' } as const)
          : rawResolved;

      if (!disabled && resolved?.kind === 'resolved') {
        activeAttributeSource = attributeSource;
        activeInheritAttributes = inheritAttributes;
        untrack(() => syncInheritedAttributes(attributeSource, inheritAttributes));
        stopObservingInheritedAttributes = observeInheritedPortalAttributes(
          attributeSource,
          inheritAttributes,
          () => syncInheritedAttributes(attributeSource, inheritAttributes),
        );
        if (element.parentElement !== resolved.target) {
          resolved.target.appendChild(element);
        }
        lastWarnedUnresolvedKey = null;
      } else if (!disabled && resolved?.kind === 'unresolved') {
        // Target unresolved: keep the wrapper inline at the anchor so children remain rendered
        // (with a dev warning) instead of vanishing from the DOM entirely.
        restoreInline();
        activeAttributeSource = null;
        activeInheritAttributes = false;
        untrack(() => syncInheritedAttributes(null, false));
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
        activeAttributeSource = null;
        activeInheritAttributes = false;
        untrack(() => syncInheritedAttributes(null, false));
        lastWarnedUnresolvedKey = null;
      }

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
