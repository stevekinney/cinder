/**
 * Ghost-text inline-completion state machine for CommandMenu.
 *
 * See `command-menu.a11y.md` for the recorded design/accessibility decisions
 * this implements. This module owns *whether to show ghost text and what it
 * says*; `command-menu.svelte` owns DOM wiring (live selection tracking,
 * overlay positioning, keydown interception, portaling).
 *
 * ## Keyboard / edge-case matrix
 *
 * | Input                                   | Effect on ghost text                                             |
 * | ---------------------------------------- | ------------------------------------------------------------------ |
 * | `onComplete` not passed                  | Feature entirely off — `remainder` is always `''`.                |
 * | Menu closed (`open` false)               | Hidden; latches reset so the next open starts clean.               |
 * | IME composing                            | Hidden while composing (checked live + defensively on keydown).    |
 * | Caret not at the end of the field value  | Hidden — an overlay can't render "inline" over trailing text.      |
 * | Field direction is `rtl`                 | Hidden — the caret-relative rightward overlay assumes LTR growth.  |
 * | No active item                           | Hidden (`activeValue` is `null`).                                  |
 * | Active item's value doesn't prefix-match | Hidden — this is also how a stale active item self-corrects when   |
 * | the query (case-insensitive)             | the registration set churns: it simply stops matching.             |
 * | Active item's value equals the query     | Hidden (empty remainder — nothing left to complete).                |
 * | Query shrank since the last keystroke    | Hidden for that keystroke only — standard "never re-complete on    |
 * | (backspace, or a net-shrinking paste)    | deletion" rule. Re-arms the instant the query grows again.         |
 * | Empty query                              | Shown (remainder is the active item's full value) — not a special  |
 * |                                           | case, just an empty prefix.                                        |
 * | ArrowUp / ArrowDown                      | Not handled here — the shared list moves `activeItemId`, which     |
 * |                                           | flows into `activeValue` and recomputes the remainder for free.    |
 * | ArrowRight at the field end, unmodified  | Accepts (see `acceptCompletion`) when a remainder is visible.       |
 * | Tab, unmodified                          | Accepts, same as ArrowRight. Shift+Tab is never intercepted.       |
 * | Escape                                   | First press hides the ghost (`dismissGhostText`) without closing   |
 * |                                           | the menu; only a second press (ghost already hidden) falls through |
 * |                                           | to the existing listbox Escape-dismiss latch.                      |
 * | Enter                                    | Untouched — always activates the listbox selection via the         |
 * |                                           | existing `onEnter` path, regardless of ghost-text state.            |
 * | Query / caretIndex / activeItemId change | Clears the accept/Escape dismissal latch — a new context gets a    |
 * | while open                               | fresh chance to show ghost text.                                    |
 *
 * `registrationsReady` (used to gate the empty-state message) is deliberately
 * **not** part of this gate: it flips false→true on every query change, which
 * would flicker the ghost text off and on for a frame each keystroke. The
 * prefix-match check above is already race-proof — a stale `activeValue` from
 * the previous registration set simply won't prefix-match the new query.
 *
 * Everything here is synchronous — there is no async work (no timers, no
 * network), so there's no "race between typing and filtering" in the sense
 * Autocomplete has to guard against with request versioning: each Svelte
 * reactive flush recomputes `remainder` exactly once from the current values
 * of `query`, `activeValue`, `composing`, etc., all read together.
 */

import type { CommandMenuCompletion } from './command-menu.types.ts';

export type InlineCompletionOptions = {
  /** The whole feature is opt-in: gate everything on `onComplete` being passed. */
  enabled: () => boolean;
  open: () => boolean;
  composing: () => boolean;
  /** True when the anchor's selection is collapsed at the end of its value. */
  caretAtFieldEnd: () => boolean;
  rightToLeft: () => boolean;
  query: () => string;
  /** Used only to detect "the trigger context changed" for the dismissal latch. */
  caretIndex: () => number;
  activeItemId: () => string | null;
  /** Raw `CommandItem.value` of the active item, or `null` when none is active. */
  activeValue: () => string | null;
};

/**
 * Case-insensitive prefix match: the remainder of `activeValue` after
 * `query`, preserving `activeValue`'s own casing. Returns `''` when there is
 * no active value, the value doesn't start with the query, or there is
 * nothing left to complete.
 */
export function computeGhostRemainder(query: string, activeValue: string | null): string {
  if (!activeValue) return '';
  if (!activeValue.toLowerCase().startsWith(query.toLowerCase())) return '';
  return activeValue.slice(query.length);
}

/**
 * Font metrics (not color) copied onto the ghost overlay so its text lines
 * up visually with the anchor field's own text, even though the overlay is
 * portaled outside the field (so it can't inherit these via normal CSS
 * cascade). Color is deliberately excluded — the ghost span's semi-transparent
 * appearance comes from the `--cinder-text-disabled` token in
 * `command-menu.css`, and an inline `color` declaration would win over that
 * cascade-layered rule, defeating the whole "reduced opacity" point.
 */
export function computeGhostOverlayFontStyle(element: Element): string {
  if (typeof getComputedStyle !== 'function') return '';
  const computed = getComputedStyle(element);
  return [
    `font-family: ${computed.fontFamily};`,
    `font-size: ${computed.fontSize};`,
    `font-weight: ${computed.fontWeight};`,
    `font-style: ${computed.fontStyle};`,
    `line-height: ${computed.lineHeight};`,
    `letter-spacing: ${computed.letterSpacing};`,
  ].join(' ');
}

export function createInlineCompletionState(options: InlineCompletionOptions) {
  let dismissed = $state(false);
  let queryShrank = $state(false);

  let previousQueryForShrink: string | undefined;

  $effect(() => {
    const currentQuery = options.query();
    if (!options.open()) {
      queryShrank = false;
      previousQueryForShrink = undefined;
      return;
    }
    queryShrank =
      previousQueryForShrink !== undefined && currentQuery.length < previousQueryForShrink.length;
    previousQueryForShrink = currentQuery;
  });

  let previousQueryForDismiss: string | undefined;
  let previousCaretIndexForDismiss: number | undefined;
  let previousActiveItemIdForDismiss: string | null | undefined;

  $effect(() => {
    if (!options.open()) {
      dismissed = false;
      previousQueryForDismiss = undefined;
      previousCaretIndexForDismiss = undefined;
      previousActiveItemIdForDismiss = undefined;
      return;
    }
    const currentQuery = options.query();
    const currentCaretIndex = options.caretIndex();
    const currentActiveItemId = options.activeItemId();
    if (
      currentQuery !== previousQueryForDismiss ||
      currentCaretIndex !== previousCaretIndexForDismiss ||
      currentActiveItemId !== previousActiveItemIdForDismiss
    ) {
      dismissed = false;
    }
    previousQueryForDismiss = currentQuery;
    previousCaretIndexForDismiss = currentCaretIndex;
    previousActiveItemIdForDismiss = currentActiveItemId;
  });

  const remainder = $derived.by(() => {
    if (!options.enabled()) return '';
    if (!options.open()) return '';
    if (options.composing()) return '';
    if (queryShrank) return '';
    if (dismissed) return '';
    if (!options.caretAtFieldEnd()) return '';
    if (options.rightToLeft()) return '';
    return computeGhostRemainder(options.query(), options.activeValue());
  });

  const visible = $derived(remainder.length > 0);

  /**
   * Accepts the current ghost text, returning the completion detail to fire
   * through `onComplete`, or `null` when there's nothing to accept. Always
   * latches `dismissed` on an actual accept — even if the host's
   * `onComplete` is a no-op, this guarantees the *next* ArrowRight/Tab press
   * is untouched (native caret move / focus change), so a non-participating
   * host can never turn Tab into a keyboard trap.
   */
  function acceptCompletion(): CommandMenuCompletion | null {
    if (!visible) return null;
    const value = options.activeValue();
    if (value === null) return null;
    // Snapshot before latching `dismissed`: `remainder` is derived *from*
    // `dismissed`, so writing it first and reading `remainder` after would
    // read the now-hidden ('') value instead of what was just accepted.
    const acceptedRemainder = remainder;
    const acceptedQuery = options.query();
    dismissed = true;
    return { value, query: acceptedQuery, remainder: acceptedRemainder };
  }

  /**
   * Escape's first stage: hide the ghost text without closing the menu.
   * Returns `false` (does nothing) when there's no ghost text showing, so
   * the caller falls through to the existing listbox Escape-dismiss latch.
   */
  function dismissGhostText(): boolean {
    if (!visible) return false;
    dismissed = true;
    return true;
  }

  return {
    get remainder() {
      return remainder;
    },
    get visible() {
      return visible;
    },
    acceptCompletion,
    dismissGhostText,
  };
}

export type InlineCompletionState = ReturnType<typeof createInlineCompletionState>;
