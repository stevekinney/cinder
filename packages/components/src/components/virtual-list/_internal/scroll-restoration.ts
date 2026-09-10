/**
 * Pure scroll-position persistence for the virtual list's `scrollRestoration`
 * option.
 *
 * Dependency-free: no DOM, no `sessionStorage` global. The virtual list
 * mounts during server rendering, where `sessionStorage` does not exist, so
 * every function here takes its storage as an explicit
 * `ScrollRestorationStorage` parameter instead of reaching for the global
 * directly. `virtual-list.svelte` is responsible for passing the real
 * `sessionStorage` (or nothing, when `scrollRestoration` is off or the
 * component is server-rendering) at the call site.
 */

/**
 * The minimal structural shape this module needs from a storage object.
 * `sessionStorage` satisfies it, and so does an in-memory fake in tests —
 * this module never names `Storage` or the global directly, so it stays
 * importable anywhere, DOM or no DOM.
 */
export type ScrollRestorationStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** A saved scroll position: where the viewport was, and which row led it. */
export type ScrollRestorationPosition = {
  readonly scrollOffset: number;
  readonly startIndex: number;
  /**
   * How far into the anchor row the reader had scrolled.
   *
   * Optional because entries written before this field existed must still load —
   * `sessionStorage` survives deploys, and a missing remainder simply means the row's
   * start edge, which is what the previous version restored anyway.
   */
  readonly offsetWithinRow?: number;
};

const SCROLL_RESTORATION_KEY_PREFIX = 'cinder:virtual-list:';

/**
 * Namespaces a consumer-provided id into a storage key, so one list's saved
 * position can't collide with an unrelated `sessionStorage` entry sharing
 * the same page.
 *
 * Returns `null` for an empty or whitespace-only id rather than falling
 * back to the bare prefix — silently writing to a shared prefix key would
 * make every un-id'd list on the page overwrite one another's saved
 * position.
 */
export function resolveScrollRestorationKey(id: string): string | null {
  return id.trim().length === 0 ? null : `${SCROLL_RESTORATION_KEY_PREFIX}${id}`;
}

/** Serializes a scroll position for storage. */
/**
 * A saved `startIndex` must be a whole number: it is used to index `items` and is
 * handed to `scrollToIndex`. A fractional value read back from storage — which is
 * shared, user-writable, and survives deploys — would resolve to no row at all.
 */
function isValidScrollRestorationIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function serializeScrollPosition(position: ScrollRestorationPosition): string {
  return JSON.stringify(position);
}

type UnknownScrollRestorationPosition = {
  offsetWithinRow?: unknown;
  scrollOffset?: unknown;
  startIndex?: unknown;
};

function isValidScrollRestorationField(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Parses a previously-serialized scroll position. MUST be total: it never
 * throws, and it never returns anything but a well-formed position or
 * `null`.
 *
 * `sessionStorage` is shared with the rest of the page, user-writable via
 * devtools, and outlives deploys where this shape may have changed
 * underneath it. Every read is therefore untrusted input: malformed JSON, a
 * JSON value that isn't an object, a missing or non-numeric field, and a
 * non-finite or negative number are all treated as "nothing saved" rather
 * than propagated as an error.
 */
export function deserializeScrollPosition(raw: string | null): ScrollRestorationPosition | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // `Array.isArray` is deliberately not checked here: a JSON array destructures
  // to `undefined` for both named fields below just as any other non-matching
  // object would, so the field validation already rejects it — a redundant
  // isArray branch would be dead weight no test could distinguish.
  if (typeof parsed !== 'object' || parsed === null) return null;

  const candidate = parsed as UnknownScrollRestorationPosition;
  const { scrollOffset, startIndex } = candidate;
  if (!isValidScrollRestorationField(scrollOffset) || !isValidScrollRestorationIndex(startIndex)) {
    return null;
  }

  // Absent or malformed, the remainder is simply zero: the row's start edge, which
  // is exactly what an entry from before this field existed meant.
  const { offsetWithinRow } = candidate;
  return {
    scrollOffset,
    startIndex,
    offsetWithinRow: isValidScrollRestorationField(offsetWithinRow) ? offsetWithinRow : 0,
  };
}

/**
 * Saves a scroll position under the consumer's id.
 *
 * A no-op when `storage` is undefined (server rendering, or a consumer who
 * left `scrollRestoration` off) or when the id resolves to no usable key.
 * Swallows a throwing `setItem`: Safari private browsing, and any browser at
 * its storage quota, throw `QuotaExceededError` on write, and a component
 * must not break navigation because it couldn't remember where the list was
 * scrolled to.
 */
export function saveScrollPosition(
  storage: ScrollRestorationStorage | undefined,
  id: string,
  position: ScrollRestorationPosition,
): void {
  if (storage === undefined) return;
  const key = resolveScrollRestorationKey(id);
  if (key === null) return;

  try {
    storage.setItem(key, serializeScrollPosition(position));
  } catch {
    // Quota exceeded, or storage otherwise unwritable — losing a scroll
    // offset is not worth breaking navigation over.
  }
}

/**
 * Loads a previously-saved scroll position for the consumer's id.
 *
 * A no-op returning `null` when `storage` is undefined or the id resolves
 * to no usable key. Swallows a throwing `getItem`: some privacy modes throw
 * on access itself, not only on write.
 */
export function loadScrollPosition(
  storage: ScrollRestorationStorage | undefined,
  id: string,
): ScrollRestorationPosition | null {
  if (storage === undefined) return null;
  const key = resolveScrollRestorationKey(id);
  if (key === null) return null;

  try {
    return deserializeScrollPosition(storage.getItem(key));
  } catch {
    return null;
  }
}

/**
 * Clears a previously-saved scroll position for the consumer's id.
 *
 * Same guards as `saveScrollPosition`/`loadScrollPosition`: a no-op when
 * `storage` is undefined or the id resolves to no usable key, and swallows
 * a throwing `removeItem`.
 */
export function clearScrollPosition(
  storage: ScrollRestorationStorage | undefined,
  id: string,
): void {
  if (storage === undefined) return;
  const key = resolveScrollRestorationKey(id);
  if (key === null) return;

  try {
    storage.removeItem(key);
  } catch {
    // Storage inaccessible — nothing to clean up if we can't reach it.
  }
}
