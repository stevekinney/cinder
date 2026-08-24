---
'@lostgradient/cinder': minor
---

Extend the shared exit-transition lifecycle (previously canonical only for `Modal`/`Drawer` via `SlidingDialogState`) across the anchored-overlay family through a new `AnchoredOverlayExitState` helper: `Popover`, `SelectionPopover`, `Tooltip`, `HoverCard`, and `NavigationBar`'s mobile panel now render `data-cinder-closing` and await their real exit transition before unmounting/hiding, instead of snapping away instantly.

Notably:

- `HoverCard` had a hand-rolled version of this pattern with a reopen defect — reopening while it was mid-close could unmount the freshly-reopened card. Migrating onto the shared helper (which generation-guards a reopen) fixes that defect.
- `NavigationBar`'s mobile panel previously hid its exit via an unconditional `visibility: hidden`, which made its exit transition invisible even though it animated in. It now fades/slides out symmetrically.
- `SpeedDial`'s bespoke `waitForSpeedDialExit` mechanism now delegates its per-action transition waits to the shared `waitForTransitionCompletion` primitive instead of duplicating that parsing logic, and its actions surface now renders `data-cinder-closing`.
- `waitForTransitionCompletion` (`_internal/transition-completion.ts`) now resolves immediately for an element whose `transition-property` resolves to `none` (previously it would wait out the leftover computed duration even though no property would ever transition).

`DropdownMenu`, `ContextMenu`, `CommandMenu`, and `MultiSelect` remain on the destroy-on-close exception list documented in `OVERLAY-POLICY.md` (no enter motion today, so an instant close stays symmetric) — this was evaluated and deliberately kept rather than given new motion as part of this change.
