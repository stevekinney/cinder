# CommandMenu Accessibility

`CommandMenu` renders only the floating listbox. The host keeps ownership of the
textarea or input and must wire the field ARIA from `onStateChange`.

For a textarea host, keep the native textbox role and apply:

- `aria-controls={listboxId}` while open
- `aria-activedescendant={activeItemId}` when an option is active
- `aria-autocomplete="list"` — or `"both"` when the host also passes
  `onComplete` to enable inline ghost-text completion (see below)

Do not add `aria-expanded` to a native textarea; axe flags it as unsupported for
that role. For a single-line text input, the host may additionally use
`role="combobox"` and `aria-expanded={open}`.
Selection belongs to `CommandMenu.onSelect`; do not put replacement logic on
`CommandItem.onSelect` inside `CommandMenu`.

## Empty state

When no items match, the `empty` snippet renders in a `role="status"` element
that is a sibling of the `<ul role="listbox">`, not a child of it — `listbox`
only permits `option`/`group` descendants, so the message can't live inside
the list without breaking that contract. Instead, the listbox gets
`aria-describedby` pointing at the empty-state element, so a screen reader
user who lands on the (otherwise childless) listbox still hears why it's
empty. The listbox also keeps a 1px `min-block-size` while empty so it never
collapses to a zero-size box.

## Inline ghost-text completion (#970)

Ghost text is opt-in: it does nothing unless the host passes `onComplete`.
The four contract questions the issue gated on, decided below, are
implemented by `command-menu-inline-completion.svelte.ts` (the
show/what-it-says state machine) and `command-menu.svelte` (DOM wiring —
live caret tracking, overlay positioning, keydown interception, portaling).

### (a) Rendering surface: `aria-hidden` overlay, not contenteditable

An `aria-hidden` `<span>`, portaled to `document.body` and positioned via the
same mirrored-`<div>` text measurement `caret-rect.svelte.ts` already uses to
place the listbox (`getCaretRect`, called with `anchor.value.length` instead
of the trigger's caret index). This has direct in-repo precedent in this
exact component — no new positioning technique — and keeps `anchor` a plain
`<input>`/`<textarea>`, which a contenteditable surface would give up
(native form participation, IME, spellcheck, existing host event wiring).

The overlay's own position is a synchronous `$derived` (one `getCaretRect`
call), not a second `createAnchoredOverlay`/floating-ui instance: floating-ui's
`flip` middleware would, at the right viewport edge, flip `right-start` to
`left-start` and render the ghost text on top of what the user already
typed — worse than the alternative of doing nothing. `flip`/`shift` also
imply async positioning (`computePosition` is a promise), which would lag
the ghost by a frame on every keystroke. The tradeoff: without an
autoUpdate loop, the overlay only repositions on an explicit nudge, so the
anchor's own `scroll` event and the window's `scroll`/`resize` events are
listened for directly (alongside the existing selection-tracking listeners)
to bump a `selectionGeneration` counter the position `$derived` depends on.
This does not cover every conceivable ancestor scroll container repositioning
the field without firing a window-level scroll event (a `capture: true`
window listener catches ancestor scrolls that reach `window`, not scrolls
consumed entirely by an intermediate `overflow: auto` container) — a known,
accepted gap, not a silent one.

### (b) Acceptance keys and Enter precedence

- **ArrowRight**, unmodified, when the caret is at the field end and ghost
  text is visible: accepts.
- **Tab**, unmodified: accepts and keeps focus on the anchor
  (`event.preventDefault()` on accept is what keeps focus — Tab's default
  action, moving focus, is what "keeps focus" means to prevent). Shift+Tab
  is never intercepted.
- **Enter always activates the listbox selection** (`onSelect`), regardless
  of ghost-text visibility. It never accepts ghost text. This was explicit
  in the issue ("listbox Enter wins") and matches the existing shared
  `CommandListState.handleKeydown`, which already claims unmodified Enter
  unconditionally.
- **End does _not_ accept**, contradicting the issue's own suggestion.
  In-repo precedent wins: `CommandListState.handleKeydown` already claims
  unmodified `End` to move the active item to the last enabled option (see
  `command-menu.test.ts:214,324`, pre-existing and unrelated to this work).
  A conditional override ("End accepts when ghost is visible, otherwise
  jumps to last") would silently steal "jump to last option" for the
  entire time a host has ghost text enabled — worse than just not
  overloading the key. `Home` is symmetric (jumps to first) and was never a
  candidate acceptance key.
- Accepting fires `onComplete({ value, query, remainder })`, not `onSelect`.
  Accepting completes the _typed text_ (like shell tab-completion); it does
  not select/commit the command. `remainder` is `value.slice(query.length)`,
  already cased to match `value` — hosts should append `remainder` at the
  caret, not replace the whole token with `value`. Replacing with `value`
  would silently normalize the user's typed casing (typing `AL` against an
  `alpha` item would become `alpha`, not `ALpha`), contradicting what the
  ghost span visually promised.
- Accepting always latches the dismissal state (see `dismissGhostText`'s
  sibling `acceptCompletion`), even when `onComplete` is a no-op — so the
  very next ArrowRight/Tab press is guaranteed untouched (native caret
  move / native focus change). A host that ignores `onComplete` can never
  turn Tab into a keyboard trap.

### (c) Announcements

The ghost span is `aria-hidden="true"` — it is never announced as
user-entered content. Real state continues to flow through
`aria-activedescendant` (already required, per the field-ARIA guidance
above) and the existing listbox semantics; nothing new is added there.
`aria-autocomplete` on the host field should be `"both"` when `onComplete`
is passed (list suggestions _and_ inline text completion), versus `"list"`
when it isn't — this is the standard ARIA `aria-autocomplete` vocabulary,
not a Cinder-specific addition. The playground example
(`slash-in-textarea.example.svelte`) demonstrates this.

### (d) Full keyboard matrix

| Key                                                  | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ArrowUp` / `ArrowDown`                              | Moves the active item (pre-existing). Ghost text updates to the new active item's remainder for free — it's a derived read of `activeItemId`, not separately wired.                                                                                                                                                                                                                                                                                                                       |
| `Home`                                               | Pre-existing, now documented: jumps the active item to the first enabled option. Not caret movement — the shared list already claims this key. Unaffected by ghost text.                                                                                                                                                                                                                                                                                                                  |
| `End`                                                | Pre-existing, now documented: jumps the active item to the last enabled option. Does **not** accept ghost text — see (b).                                                                                                                                                                                                                                                                                                                                                                 |
| `ArrowRight`, unmodified, at field end               | Accepts ghost text when visible (see (b)). Otherwise native caret move (no-op, since caret is already at the end).                                                                                                                                                                                                                                                                                                                                                                        |
| `ArrowRight`, caret mid-value                        | Native caret move. Ghost text is never visible here (gated on caret-at-field-end), so nothing is intercepted.                                                                                                                                                                                                                                                                                                                                                                             |
| `Tab`, unmodified                                    | Accepts ghost text when visible (see (b)). Otherwise untouched — native focus traversal.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Shift+Tab`                                          | Never intercepted, ghost visible or not.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Enter`                                              | Always activates the listbox selection (pre-existing). Never accepts ghost text.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Escape`, ghost visible                              | First stage: dismisses the ghost text only. Menu stays open. Does not touch the existing Escape-dismiss latch.                                                                                                                                                                                                                                                                                                                                                                            |
| `Escape`, ghost already hidden                       | Falls through to the existing listbox Escape-dismiss latch (menu closes, trigger context latched dismissed).                                                                                                                                                                                                                                                                                                                                                                              |
| Wrap-around                                          | Pre-existing `ArrowUp`/`ArrowDown` wrap (first↔last) is unchanged; ghost text just follows the wrapped active item.                                                                                                                                                                                                                                                                                                                                                                       |
| Empty filtered results                               | No active item ⇒ `activeValue` is `null` ⇒ ghost text hidden. Same "hidden, not a special case" path as any other no-active-item state.                                                                                                                                                                                                                                                                                                                                                   |
| IME composition                                      | Ghost text hidden while composing (checked live via `compositionstart`/`compositionend`, and defensively again via `event.isComposing`/`keyCode === 229` at accept/dismiss time — mirrors the guard `CommandListState.handleKeydown` already uses).                                                                                                                                                                                                                                       |
| RTL field direction                                  | Ghost text hidden (`isRightToLeftElement(anchor)`) — the caret-relative rightward overlay assumes LTR growth. Fails toward "no ghost text," not toward a misleading or mirrored render.                                                                                                                                                                                                                                                                                                   |
| Caret not at the field's end                         | Ghost text hidden. An overlay glued to `anchor.value.length` cannot render "inline" ahead of trailing text the user hasn't reached yet. This also means **ghost text never appears for a trigger mid-paragraph** in a multi-line textarea (e.g. `/command` typed earlier in a longer note, caret later moved elsewhere) — an accepted scope limitation of choosing an overlay surface over contenteditable, not a bug.                                                                    |
| Backspace / any net-shrinking edit (typed or pasted) | Ghost text suppressed for that one keystroke only ("never re-complete on deletion"). Re-arms the instant the query grows again. Detected generically via query-length comparison, not a `Backspace`-key check, so a paste that shrinks the query is covered too.                                                                                                                                                                                                                          |
| Paste that grows the query                           | Treated like typing — shown when the (possibly multi-character) new query still prefix-matches the active item.                                                                                                                                                                                                                                                                                                                                                                           |
| Query / caretIndex / active item changes while open  | Clears the accept/Escape-dismissal latch, so a new context gets a fresh chance to show ghost text. One consequence worth naming: pressing `ArrowDown` immediately after an Escape-dismissal re-arms ghost text right away (the active item changed), even though the user just dismissed it. Accepted — the alternative (a dismissal that survives navigating to a _different_ item) would leave ghost text permanently off for the rest of the session after one Escape, which is worse. |

### `caretIndex`: optional-with-derivation

`caretIndex` is now optional. Ghost text's own caret-position need
(`caretAtFieldEnd`) reads `anchor.selectionStart`/`selectionEnd` directly off
the live element — it never reads the `caretIndex` prop at all. That's the
evidence this settles: a caret-position-consuming feature _can_ derive it
from the anchor, so the prop no longer needs to be mandatory. When omitted,
`caretIndex` derives from `anchor.selectionEnd`, live-tracked the same way
`caretAtFieldEnd` is. Consumers that already track trigger-relative caret
state (via `detectTrigger`, as both playground examples do) can keep passing
it explicitly with zero behavior change — the derivation only activates when
the prop is `undefined`. This is additive, not a breaking change: every
existing caller passes `caretIndex` explicitly today.

This resolves the prop's required-ness for CommandMenu specifically. It does
not itself close out the broader `caretIndex` naming question `#922` raised
(whether `caretIndex` is the right name at all) — that remains open if
anyone wants to pursue it, but is a separate, larger conversation than what
ghost text needed to settle.
