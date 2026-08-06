---
'@lostgradient/cinder': patch
---

Gate Tooltip's portal on visibility, so a hidden tooltip leaves nothing in `document.body`.

The portal attachment had no `disabled` option, and the panel is not inside a conditional block, so every Tooltip portaled its `[role="tooltip"]` node on mount and left it there for the component's whole lifetime — one detached node per instance, including during SSR. That contradicts `OVERLAY-POLICY.md` ("All overlays render into the portal after hydration. SSR markup is empty."), and every sibling overlay already gates: Popover and HoverCard through `{#if mounted && open && anchorElement}`, Portal / SpeedDial / NavigationBar / DropdownMenu through an explicit `disabled` getter.

Uses `disabled` rather than wrapping the node in `{#if visible}`: the disabled path calls `restoreInline()`, which returns the panel to its original position inside the wrapper instead of unmounting it, so the `aria-describedby` target keeps resolving while the tooltip is hidden. Conditional rendering would break that association.

Gated on `visible` rather than `isTooltipExposed`, because the latter also requires `positionReady` and position is computed against the portaled node — gating on it would deadlock a tooltip that can never be positioned because it was never portaled.
