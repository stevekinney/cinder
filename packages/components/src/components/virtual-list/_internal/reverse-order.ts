/**
 * Pure ordering/anchoring math for `reverse` virtual-list mode (chat
 * transcripts). See CIN-194 for the decided semantics.
 *
 * `reverse` renders items in ordinary chronological order — oldest at index
 * 0, newest at the last index — and is bottom-anchored: the newest item sits
 * at the bottom of the viewport, and the list starts scrolled to the bottom.
 * The name describes the anchoring, not the item order; nothing here
 * reverses an array.
 *
 * `reverse` is deliberately distinct from `stickToBottom`. `stickToBottom`
 * only pins on append when the reader is already at the bottom.  `reverse`
 * always pins on append, because a chat transcript's whole point is that new
 * messages are the thing you came to see — the reader scrolling up to reread
 * older history should not be interpreted as "let new messages pile up
 * unseen," the way it would be in a general-purpose bottom-sticking list.
 *
 * Everything here is dependency-free arithmetic: no DOM, no runes, no
 * globals. Held to the same 100%-lines/100%-functions coverage floor as
 * `measurement-window.ts` (see `coverage-ratchet.json`).
 */

import type { VirtualListKey } from '../../../utilities/fixed-virtual-window.ts';

/**
 * How the item-key sequence changed between two renders of a `reverse` list.
 * Anchoring decisions are keyed off this, not off item count alone, because
 * a same-length reorder and a same-length no-op both need to be told apart
 * from a genuine boundary change.
 */
export type ItemGrowth =
  | { readonly kind: 'appended'; readonly appendedCount: number }
  | { readonly kind: 'prepended'; readonly prependedCount: number }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'replaced' };

function keysAreEqual(
  firstKeys: readonly VirtualListKey[],
  secondKeys: readonly VirtualListKey[],
): boolean {
  if (firstKeys.length !== secondKeys.length) return false;
  for (let index = 0; index < firstKeys.length; index += 1) {
    if (firstKeys[index] !== secondKeys[index]) return false;
  }
  return true;
}

/**
 * Classifies how `nextKeys` relates to `previousKeys` for anchoring
 * purposes.
 *
 * A real append leaves the FIRST key untouched and adds new keys at the END
 * — so it is detected by `previousKeys` being a PREFIX of `nextKeys`. A
 * prepend (loading older history above the top) leaves the LAST key
 * untouched and adds new keys at the START — detected by `previousKeys`
 * being a SUFFIX of `nextKeys`. Getting the prefix/suffix pairing backwards
 * here would silently swap "new message arrived" for "older history
 * loaded," which is exactly the kind of bug this module exists to prevent,
 * so the two checks are kept explicit rather than merged into one
 * direction-agnostic helper.
 *
 * `previousKeys` (length 0) is trivially both a prefix and a suffix of any
 * `nextKeys`, so an empty-to-non-empty transition satisfies both checks —
 * see the tie-break note below.
 */
export function classifyItemGrowth(
  previousKeys: readonly VirtualListKey[],
  nextKeys: readonly VirtualListKey[],
): ItemGrowth {
  if (keysAreEqual(previousKeys, nextKeys)) {
    return { kind: 'unchanged' };
  }

  // Only a strictly longer nextKeys can be an append or a prepend — a
  // same-length or shorter change is a reorder, a removal, or some other
  // rewrite the caller must re-render for, so it falls through to 'replaced'.
  if (nextKeys.length > previousKeys.length) {
    const isPrefixExtension = keysAreEqual(nextKeys.slice(0, previousKeys.length), previousKeys);
    // Prefix wins when nextKeys satisfies BOTH checks (e.g. previousKeys
    // ['a'], nextKeys ['a', 'a']). A chat transcript grows almost entirely by
    // new messages arriving, so an ambiguous single-item growth should
    // resolve to the far more common 'appended' case rather than
    // 'prepended', which callers treat as a history page that must NOT
    // disturb the reader's scroll position.
    if (isPrefixExtension) {
      return { kind: 'appended', appendedCount: nextKeys.length - previousKeys.length };
    }

    const isSuffixExtension = keysAreEqual(
      nextKeys.slice(nextKeys.length - previousKeys.length),
      previousKeys,
    );
    if (isSuffixExtension) {
      return { kind: 'prepended', prependedCount: nextKeys.length - previousKeys.length };
    }
  }

  return { kind: 'replaced' };
}

/**
 * The scroll offset that puts the end of the content flush with the
 * viewport's bottom edge — the resting position `reverse` mode starts at and
 * snaps back to on every pinned append. Clamped to never go negative: when
 * the content is shorter than the viewport, the only valid resting position
 * is the top (offset 0), not a negative offset that would leave blank space
 * above the content.
 */
export function resolveReversePinTarget(options: {
  totalSize: number;
  viewportSize: number;
}): number {
  return Math.max(0, options.totalSize - options.viewportSize);
}

/** Anchoring strategy a virtual list can run under. */
export type ReversePinMode = 'reverse' | 'stick-to-bottom' | 'none';

/**
 * Decides whether a render should snap the scroll offset back to
 * `resolveReversePinTarget`.
 *
 * Pinning only ever happens on `'appended'` growth. A `'prepended'` change
 * (older history loaded above the top) must never pin to the end — doing so
 * would yank a reader who just asked to see older messages straight back
 * down to the newest one. `'unchanged'` and `'replaced'` never pin either:
 * there is no new content at the end to reveal.
 */
export function shouldPinToEnd(options: {
  mode: ReversePinMode;
  growth: ItemGrowth;
  isAtEnd: boolean;
}): boolean {
  if (options.growth.kind !== 'appended') return false;

  switch (options.mode) {
    case 'reverse':
      // Always pins, regardless of where the reader is scrolled — this is
      // the entire behavioral difference from 'stick-to-bottom'.
      return true;
    case 'stick-to-bottom':
      return options.isAtEnd;
    case 'none':
      return false;
  }
}
