---
'@lostgradient/cinder': minor
'@lostgradient/chat': minor
---

Add scroll-driven edge fades and a horizontal-scroll shadow affordance, and fix a forced-colors defect in the existing overlay-body fade.

- New shared internal partial `_scroll-fade.css`: an opaque, scroll-position-aware edge fade driven by `animation-timeline: scroll()` where supported, falling back to the existing `data-cinder-overflows` attribute path everywhere else — no `CSS.supports()` branch, no hydration divergence. Never a `mask-image` (masking a container that paints its own background reveals whatever is behind it, which is why PR #972 removed masks from Modal/Drawer/Sheet in the first place).
- Modal, Drawer, and Sheet bodies now consume the shared recipe instead of three byte-identical copies, which also fixes a real bug: the previous hard-coded gradient had no `forced-colors` carve-out, so it painted a light-gray band across the bottom of every scrollable overlay in high-contrast mode. `--cinder-scroll-fade-size` (1.5rem) is now a themeable public token instead of being hard-coded three times.
- `overflowFade()` (`utilities/attachments.ts`) no longer registers a `ResizeObserver` on every descendant of a scroll container — only the container itself, with a `MutationObserver` triggering direct re-measurement on content changes. The previous approach was fine for a modal body but registered thousands of observers on a long scroll surface.
- New opt-in `scrollFadeVisible` prop on `ScrollArea`, `CodeBlock`, and Chat's message timeline — presentation-only, never the sole signal that content scrolls. `CodeBlock`'s fade is horizontal (inline) and intentionally translucent rather than fully opaque, so a partially covered glyph still reads as a glyph. Chat's timeline fades both the top and bottom edges and is only active in `surfaceMode="default"`.
- `Table`, `PermissionMatrix`, and `TransferList` scroll containers now show `DataGrid`'s existing inset-shadow horizontal(/vertical, for TransferList)-scroll affordance when their content actually overflows, via a new `overflowShadow()` attachment.
