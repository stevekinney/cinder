# Cinder Overlay Policy

This document defines the cross-cutting behavior every Cinder overlay component (Modal, Sheet, Dropdown, Popover, Tooltip, Toast) must follow. It exists so each component's own `.a11y.md` doesn't have to re-derive these answers, and so the policy stays consistent as new overlay components are added in later phases.

The runtime helpers backing this policy live in `src/_internal/overlay.ts`.

## Portal root

- Default portal root: `document.body`.
- Components may accept a `portalTarget` prop to override (deferred until a real consumer needs it).
- All overlays render into the portal **after hydration**. SSR markup is empty.

## SSR rule (hard constraint)

Overlays render nothing on the server, regardless of their initial `open` state. The standard idiom in a Svelte 5 component:

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

| Layer    | CSS variable          | JS constant         | Numeric |
| -------- | --------------------- | ------------------- | ------- |
| Tooltip  | `--cinder-z-tooltip`  | `Z_LAYERS.tooltip`  | 1000    |
| Dropdown | `--cinder-z-dropdown` | `Z_LAYERS.dropdown` | 1100    |
| Popover  | `--cinder-z-popover`  | `Z_LAYERS.popover`  | 1100    |
| Modal    | `--cinder-z-modal`    | `Z_LAYERS.modal`    | 1200    |
| Sheet    | `--cinder-z-sheet`    | `Z_LAYERS.sheet`    | 1200    |
| Toast    | `--cinder-z-toast`    | `Z_LAYERS.toast`    | 1300    |

Toast sits **above** Modal so confirmation and error toasts reach users even when a modal is open. Stylesheets reference the CSS variables; tests use the JS constants.

## Focus

- **Capture** on open: record the previously-focused element via `captureFocus()` before moving focus into the overlay.
- **Restore** on close: focus returns to the captured element via `restoreFocusTo()`. Components must call this even when the close was triggered by ESC, outside-click, or a programmatic `open = false`.
- **Initial focus**: by default, focus moves to the first focusable element inside the overlay. Components may honor a `data-cinder-initial-focus` attribute on a child to override.
- **Trap**: full-viewport overlays (Modal, Sheet) trap focus within their content. Anchored overlays (Popover when modal, Dropdown menu) optionally trap; Tooltip never traps.

## Escape priority

- The top-most open overlay handles ESC; lower overlays ignore the event.
- Implemented via the module-level escape stack in `overlay.ts`. Each overlay calls `pushEscapeHandler()` on open and the returned `release()` on close.
- Native `<dialog>` ESC dispatches via `oncancel`/`onclose`, not via the JS stack — Modal handles its own ESC routing while still pushing/popping so non-dialog overlays above it don't accidentally swallow the keystroke.

## Outside-click

- Click outside the overlay's DOM tree (or on the backdrop, for full-viewport overlays) closes the overlay.
- `closeOnOutsideClick` prop (default `true`) lets consumers opt out where appropriate (e.g. a popover anchored to a button group where clicks elsewhere should not dismiss).

## Scroll lock

- Only Modal and Sheet lock body scroll. Anchored overlays (Dropdown, Popover, Tooltip) and the Toast region do not.
- Implemented via the counted `lockBodyScroll()` helper. Nested full-viewport overlays each acquire and release; the lock is released only when the count reaches zero, so a Modal opened inside a Sheet doesn't restore scroll when either of them closes individually.

## Reduced motion

- All overlays must check `prefers-reduced-motion: reduce` and either:
  - Skip animations entirely (immediate fade or no transition), or
  - Use a clearly-reduced fallback (no looping animation, lower amplitude, etc.).
- Token-driven durations help: `--cinder-duration-*` tokens collapse to 0ms under reduced motion (see `tokens-base.css`).

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
4. If the overlay is full-viewport, wire `lockBodyScroll` on open and release on close.
5. On open, capture focus; on close, restore focus.
6. Reference this document in the component's `.a11y.md`.
