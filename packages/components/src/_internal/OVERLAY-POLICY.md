# Cinder Overlay Policy

This document defines the cross-cutting behavior every Cinder overlay component (Modal, Drawer, Alert Dialog, Popover, Tooltip, HoverCard, the Select and Combobox listboxes, Dropdown/Menu, Context Menu, Command Menu, Speed Dial, Toast) must follow. It exists so each component's own `.a11y.md` doesn't have to re-derive these answers, and so the policy stays consistent as new overlay components are added in later phases.

The runtime helpers backing this policy live in `src/_internal/overlay.ts` and
`src/_internal/anchored-overlay.svelte.ts`.

## Native-first positioning matrix

| Surface                                                   | Preferred primitive                                               | JavaScript fallback                                                 | Notes                                                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal blocking surfaces                                   | Native `<dialog>.showModal()`                                     | None for the modal contract                                         | Browser top-layer and native inert behavior are the baseline. Do not manually inert the whole app except for narrowly scoped transitional states. |
| Simple trigger-owned menus                                | Popover API plus CSS Anchor Positioning                           | Shared anchored overlay helper with Floating UI `strategy: "fixed"` | The native path must be guarded by both runtime `showPopover` detection and CSS `@supports` for anchor positioning.                               |
| Rich anchored panels, listboxes, and hover/focus previews | Shared anchored overlay helper                                    | Same helper                                                         | Popover, Combobox, Autocomplete, HoverCard, Tooltip, CommandMenu, MenuBar, and non-native Dropdown paths use one fixed-position lifecycle.        |
| Pointer, caret, and text-selection anchors                | Shared anchored overlay helper with a Floating UI virtual element | Same helper                                                         | CSS Anchor Positioning is intentionally not used for virtual anchors yet. ContextMenu and CommandMenu use virtual anchors.                        |

CSS Anchor Positioning remains a progressive enhancement. Do not require it for
correctness until the support policy changes.

## Portal root

- Default portal root: `document.body`.
- Components may accept a `portalTarget` prop to override (deferred until a real consumer needs it).
- All overlays render into the portal **after hydration**. SSR markup is empty.

Dialog-owned anchored surfaces use the open native `<dialog>` as their portal
boundary. The dialog must keep those surfaces paintable in the top layer; its
content panel remains the clipping boundary for ordinary modal content. This
preserves modal scrolling and rounded content clipping without allowing a
nested Popover, SpeedDial, or NavigationBar surface to be truncated.

## SSR rule (hard constraint)

Overlays render nothing on the server, regardless of their initial `open` state. The standard idiom in a [Svelte 5](https://svelte.dev/docs/svelte/overview) component:

```svelte
<script>
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });
</script>

{#if hydrated && open}
  <div class="cinder-popover">…</div>
{/if}
```

`$effect` only runs on the client, so `hydrated` stays `false` through SSR. The conditional block keeps the server output empty whether `open` is `true` or `false`. The trade-off is a one-frame render delay on the client when an overlay starts open; the gain is a single, predictable hydration model with no `open={true}` server/client mismatch.

A development-mode warning is logged if `open={true}` is detected during SSR (Phase 3 components). Production silently renders empty.

Consumers needing server-rendered overlay content for first paint must compose the content outside the overlay (e.g. render the panel inline with `display: none` toggled by a script). Cinder does not support that path in v1.

## Z-index layering

| Layer              | CSS variable                    | JS constant            | Numeric |
| ------------------ | ------------------------------- | ---------------------- | ------- |
| Tooltip            | `--cinder-z-tooltip`            | `Z_LAYERS.tooltip`     | 1000    |
| Dropdown           | `--cinder-z-dropdown`           | `Z_LAYERS.dropdown`    | 1100    |
| Popover            | `--cinder-z-popover`            | `Z_LAYERS.popover`     | 1100    |
| Modal              | `--cinder-z-modal`              | `Z_LAYERS.modal`       | 1200    |
| Drawer             | `--cinder-z-modal`              | `Z_LAYERS.modal`       | 1200    |
| Toast              | `--cinder-z-toast`              | `Z_LAYERS.toast`       | 1300    |
| Focused affordance | `--cinder-z-focused-affordance` | —                      | 1350    |
| Drag preview       | `--cinder-z-drag-preview`       | `Z_LAYERS.dragPreview` | 1400    |

Toast sits **above** Modal so confirmation and error toasts reach users even when a modal is open. An actively dragged preview is the top visual layer so it remains attached to the pointer across every surface. Stylesheets reference the CSS variables; tests use the JS constants.

## Focus

- **Capture** on open: record the previously-focused element via `captureFocus()` before moving focus into the overlay.
- **Restore** on close: focus returns to the captured element via `restoreFocusTo()`. Components must call this even when the close was triggered by ESC, outside-click, or a programmatic `open = false`.
- **Initial focus**: by default, focus moves to the first focusable element inside the overlay. Components may honor a `data-cinder-initial-focus` attribute on a child to override.
- **Trap**: full-viewport overlays (Modal, Drawer) trap focus within their content. Anchored overlays (Popover when modal, Dropdown menu) optionally trap; Tooltip never traps.

## Escape priority

- The top-most open overlay handles ESC; lower overlays ignore the event.
- Implemented via the module-level escape stack in `overlay.ts`. Each overlay calls `pushEscapeHandler()` on open and the returned `release()` on close.
- Native `<dialog>` ESC dispatches via `onCancel`/`onClose`, not via the JS stack — Modal handles its own ESC routing while still pushing/popping so non-dialog overlays above it don't accidentally swallow the keystroke.

## Outside-click

- Click outside the overlay's DOM tree (or on the backdrop, for full-viewport overlays) closes the overlay.
- `closeOnOutsideClick` prop (default `true`) lets consumers opt out where appropriate (e.g. a popover anchored to a button group where clicks elsewhere should not dismiss).
- **Use the shared `createClickOutside` attachment** (`src/utilities/attachments.ts`) rather than hand-rolling a `document` listener in a `$effect`. It is the single canonical light-dismiss mechanism: it owns the `document.addEventListener`/`removeEventListener` lifecycle, the inside-vs-outside containment check, the capture-phase default, and the trigger/anchor exclusion. Apply it to the overlay's panel element:

  ```svelte
  <script lang="ts">
    import { createClickOutside } from '../../utilities/attachments.ts';
    // $derived keeps the attachment stable — recreating it each render would re-bind the listener.
    const dismiss = $derived(
      createClickOutside({
        handler: () => (open = false),
        enabled: () => open,
        eventType: 'pointerdown', // or 'mousedown' to dismiss before a focus/selection change; default 'click'
        ignoreRefs: [() => triggerElement], // elements that count as "inside" beyond the panel
      }),
    );
  </script>

  <div {@attach dismiss}>…</div>
  ```

  - `eventType` (`'click' | 'pointerdown' | 'mousedown'`, default `'click'`): use `pointerdown`/`mousedown` when the overlay must dismiss before a fresh focus or text selection commits.
  - `capture` (default `true`): the document-level dismisser should see the event before inner `stopPropagation`.
  - `ignoreRefs`: getters so a trigger/anchor that mounts or swaps after the attachment is created resolves freshly on each event. Snapshot the anchor at open time (not the live reference) when a swapped trigger must not cause an unexpected close.

- **Not every `document` keydown is an outside-click.** A dismiss-on-`Escape` keydown handler (e.g. HoverCard's) is escape handling, not outside-click, and stays as its own listener / `pushEscapeHandler` — do not route it through `createClickOutside`.

## Scroll lock

- Only Modal and Drawer lock body scroll. Anchored overlays (Dropdown, Popover, Tooltip) and the Toast region do not.
- Implemented via the counted `lockBodyScroll()` helper. Nested full-viewport overlays each acquire and release; the lock is released only when the count reaches zero, so a Modal opened inside a Drawer doesn't restore scroll when either of them closes individually.

## Reduced motion

- All overlays must check `prefers-reduced-motion: reduce` and either:
  - Skip animations entirely (immediate fade or no transition), or
  - Use a clearly-reduced fallback (no looping animation, lower amplitude, etc.).
- Token-driven durations help: `--cinder-duration-*` tokens collapse to 0ms under reduced motion (see `tokens-base.css`).
- For client-side JS decisions (e.g. choosing `scrollTo` behavior, gating an animation `setTimeout`), use the `useReducedMotion()` hook. It exposes a reactive `.current` boolean; on the server it returns `false` because the user's preference is unavailable. Keep SSR-visible presentation in CSS media queries and duration tokens. New JS code must use this hook rather than reading `window.matchMedia` directly; existing inline checks should migrate opportunistically.
  - **External consumers**: `import { useReducedMotion } from '@lostgradient/cinder';`
  - **Inside `packages/components/src/...`**: import using the appropriate local relative path to `src/utilities/use-reduced-motion.svelte.ts` (the depth depends on the consuming file's location). This matches the package's existing internal-import convention — for example, components reference `./_internal/overlay.ts` or `../_internal/overlay.ts` rather than the package root — and avoids a barrel cycle through `src/index.ts`.

## Transition lifecycle

This section defines how an overlay _leaves_ the screen. The canonical implementation is `SlidingDialogState` (`src/components/_internal/create-sliding-dialog-state.svelte.ts`), shared today by Modal and Drawer (and by Alert Dialog through its composition of Modal). New overlays and migrations conform to this contract; CIN-376 extends it across the anchored-overlay family.

### The contract

- **The component owns triggering the close.** When close begins (the `open` prop flips false, ESC fires, the backdrop is clicked), the component enters a _closing_ state and renders `data-cinder-closing` on its animated element(s) for the full duration of the exit transition. In the canonical helper this is the `isClosing` flag; the component renders it as `data-cinder-closing={dialogState.isClosing ? '' : undefined}` and keys its exit styles off `[data-cinder-closing]` (see `modal.css` / `drawer.css`).
- **The shared helper owns detecting completion.** `waitForTransitionCompletion` (`src/_internal/transition-completion.ts`) watches the animated element for `transitionend`/`transitioncancel` on every tracked transition property, backed by a computed-duration fallback timer, and signals unmount-readiness via its `onComplete` callback. Only after that callback does the component drop the panel from the DOM (and, for native dialogs, call `dialog.close()`).
- **Reduced motion must not deadlock teardown.** When `prefers-reduced-motion: reduce` collapses durations to zero (the `--cinder-duration-*` tokens do this), `waitForTransitionCompletion` sees a total transition time of `0` and resolves immediately via `queueMicrotask` — the overlay still unmounts, it just does so without animating. Callers pass the current `useReducedMotion()` value so the helper never waits on a transition that will not fire.
- **Interrupted closes are generation-guarded.** A reopen during the exit transition must not let a stale completion callback unmount the freshly reopened overlay. Note that the function `waitForTransitionCompletion` returns is a _force-finish_, not a cancel — calling it invokes `onComplete` immediately. The caller therefore owns staleness protection: `SlidingDialogState` increments its close generation counter _before_ invoking the returned function, so the forced completion hits a stale generation and becomes a no-op. Conformers must replicate this guard (or an equivalent) — invoking the returned function without one runs the completion logic at the wrong moment.

### Awaiting completion vs. destroy-on-close

Every overlay that animates in must animate out symmetrically and await transition completion before unmount — the enter/exit asymmetry of a panel that fades in but snaps out reads as a bug. An overlay may destroy-on-close without an exit transition only when:

- it has no visible enter motion either (it never animates in), or
- its content is regenerated fresh on every open in a way that makes preserving exit state meaningless (e.g. a single-frame flash confirmation).

Overlays claiming this exception are listed here with a stated reason. Current exception list: _(empty — CIN-376's migration will surface any legitimate entries)_.

### Modal vs. non-modal guarantees

| Class     | Components                                                                                                  | Owes                                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal     | Modal, Drawer, Alert Dialog, Confirm Dialog, Command Palette                                                | Scroll lock (counted `lockBodyScroll`), focus trap, `aria-modal`, escape-stack registration                                                   |
| Non-modal | Popover, Tooltip, HoverCard, Combobox listbox, Dropdown/Menu, Context Menu, Command Menu, Speed Dial, Toast | Escape-stack registration only — no scroll lock, no focus trap, no `aria-modal`, since they don't block interaction with the rest of the page |

### Census

Every overlay-shaped component in the repo today, and where it stands against this contract:

| Component        | Class     | Exit-transition status                                                              |
| ---------------- | --------- | ----------------------------------------------------------------------------------- |
| Modal            | Modal     | Conforms — `SlidingDialogState`                                                     |
| Drawer           | Modal     | Conforms — `SlidingDialogState`                                                     |
| Alert Dialog     | Modal     | Conforms — composes Modal                                                           |
| Confirm Dialog   | Modal     | Conforms — composes Modal                                                           |
| Command Palette  | Modal     | Deviation — animates in, closes instantly (see below)                               |
| HoverCard        | Non-modal | Deviation — hand-rolled duplicate with a reopen defect (see below)                  |
| Toast            | Non-modal | Deviation — awaits completion but non-canonical attribute (see below)               |
| Speed Dial       | Non-modal | Deviation — bespoke exit-await mechanism (see below)                                |
| Popover          | Non-modal | No exit transition — migrates under CIN-376                                         |
| Tooltip          | Non-modal | No exit transition — migrates under CIN-376                                         |
| Combobox listbox | Non-modal | Composes Popover — inherits its exit lifecycle; migrates with Popover under CIN-376 |
| Dropdown/Menu    | Non-modal | No exit transition — migrates under CIN-376                                         |
| Context Menu     | Non-modal | No exit transition — migrates under CIN-376                                         |
| Command Menu     | Non-modal | No exit transition — migrates under CIN-376                                         |

Select is not in this census: `select.svelte` renders a native `<select>` element, so the browser owns its popup UI and there is no Cinder-owned listbox to apply this lifecycle to.

Components that do not exist in this repo yet (image-lightbox as a components-package component — its Modal migration is CIN-377 — and Sheet) are out of scope for this census. CIN-375's `InlineConfirm` is in-flow rather than overlaid and will conform to this section's reduced-motion and symmetry rules without the overlay guarantees.

### Known deviations

These existing overlays contradict the contract above and are listed here rather than silently diverging:

- **HoverCard** — renders `data-cinder-closing` and awaits `waitForTransitionCompletion`, but as a hand-rolled duplicate inside `hover-card.svelte` instead of through a shared helper, and without the generation guard: its reopen path sets `renderCard = true` and then invokes the helper's returned force-finish, whose completion callback immediately sets `renderCard = false` — a reopen during the exit transition can unmount the freshly reopened card. Migration to the shared anchored-overlay exit helper (which fixes the reopen defect) is inside CIN-376's scope.
- **Toast** — awaits `waitForTransitionCompletion` before unmounting a dismissed toast, but never renders `data-cinder-closing`; its exit styles key off the non-canonical `data-cinder-presence="exiting"` attribute instead. Migration follow-up: CIN-425.
- **Speed Dial** — awaits its actions' exit transitions through a bespoke `waitForSpeedDialExit` mechanism (`speed-dial-exit.ts`) rather than the canonical helper, and never renders `data-cinder-closing`. Migration to the shared anchored-overlay exit helper is inside CIN-376's scope.
- **Command Palette** — plays a visible enter animation but `closePalette()` calls `dialog.close()` immediately, with no exit lifecycle at all — the exact enter/exit asymmetry this section forbids. Migration follow-up: CIN-426.

## Hydration tests

Every overlay component must have hydration tests (using `src/test/hydrate.ts`) that assert:

1. SSR renders empty markup with `open={false}`.
2. SSR renders empty markup with `open={true}` (no warning in production, dev warning emitted).
3. Client hydration produces the correct overlay markup post-mount.
4. No console hydration warnings during the hydrate.

## Adding a new overlay

When introducing a new overlay component:

1. Add a Z-layer entry to `tokens-base.css` and `Z_LAYERS` in `overlay.ts` if the layer is novel.
2. Implement the `hydrated`-gated render pattern (see "SSR rule" above).
3. Wire `pushEscapeHandler` on open and call its release on close.
4. For light-dismiss (anchored overlays), use the shared `createClickOutside` attachment — see "Outside-click" above. Do not hand-roll a `document` listener.
5. If the overlay is full-viewport, wire `lockBodyScroll` on open and release on close.
6. On open, capture focus; on close, restore focus.
7. If the overlay animates in, implement the exit-transition lifecycle — render `data-cinder-closing` while closing and await `waitForTransitionCompletion` before unmount (see "Transition lifecycle" above).
8. Reference this document in the component's `.a11y.md`.
