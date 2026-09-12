# Translucent border seams

CIN-245 made the three neutral structural border tiers — `--cinder-border-muted`,
`--cinder-border`, and `--cinder-border-strong` — alpha steps over one polarity-aware
ink instead of opaque per-arm colors. That change is invisible almost everywhere,
because an alpha border painted once over a surface is just a color. It becomes
visible in exactly one situation: when two of those borders land on the **same
pixel**. Two 48% inks stacked resolve to 73%, not 48%, and the seam reads darker
(or lighter, in dark mode) than every other edge in the component.

This audit names every place in the repository where that can happen, and says
for each whether the overlap was removed, does not actually exist, or is
intentional.

Two things are _not_ on this list, deliberately:

- **Adjacent borders.** Two elements sitting side by side, each with its own 1px
  edge, produce a 2px line — but each layer composites over its own backdrop, so
  neither is diluted by the other. That was already a 2px line before this change
  and it still is. Only genuine overlap stacks alpha.
- **`border-collapse: collapse`.** Collapsed borders resolve to one painted edge
  by definition, so there is nothing to stack. `Table` and `JsonSchemaEditor` are
  covered by this.

## Candidate seams, and what each turned out to be

The headline result: **nothing in the repository stacks translucent border ink.**
Every candidate below either draws one edge per seam or occludes the edge
underneath with an opaque fill. Each is recorded anyway, because "we looked and
it was fine" is only useful if the next person can see what was looked at.

### HoverCard arrow — occlusion, not composition

`hover-card.css` centers a rotated square **on** the panel edge, with borders on
its two outward-facing sides. Half the square sits inside the panel, directly over
the panel's own border — which looks like the textbook overlap case.

It is not, because the square carries `background: inherit`, which resolves to the
panel's opaque `--cinder-surface-raised`. The panel's border is _hidden_ under the
arrow, not composited with it, so the two inks never sum. That was already true
when both were opaque; making the border translucent does not change it.

**Not just reasoned — verified.** [CIN-606](https://linear.app/lost-gradient/issue/CIN-606)'s
premise named "HoverCard and Tooltip at minimum" as candidates for the same
bug as Popover's arrow; neither actually is. `background: inherit` forces
HoverCard's arrow to inherit the (non-inherited-by-default) `background`
shorthand from its ancestor, which resolves to the panel's opaque
`surface-raised` — confirmed by the same pixel probe that covers Popover
(`popover-arrow-surface-parity.playwright.ts`): its arrow reads an IDENTICAL
pixel across all three backdrop surfaces, proving the backdrop never reaches
it. (The sample point is the upper quarter of the arrow's bounding box, not
its center: the un-rotated square is deliberately centered ON the panel
edge, so the diamond's geometric center sits exactly on that edge too and
can read the panel's own fill underneath rather than the arrow's own paint
— a gap in the first draft of this probe, caught in review and confirmed
by forcing `background: transparent` on the arrow, which the corrected
sample point now fails against and the original center-point sample did
not.) Tooltip has no arrow construction at all — no `arrow` class, no
CSS-triangle rule anywhere in `tooltip.css`/`tooltip.svelte` — confirmed by
asserting `.cinder-tooltip__arrow` has zero matches while a real Tooltip is
open. Neither needed a change.

### Popover arrow — one layer of ink

`popover.css` builds its arrow with the CSS-triangle technique. **Before
[CIN-606](https://linear.app/lost-gradient/issue/CIN-606)**, that was an 8px
triangle in `var(--cinder-border)` with a 7px `--cinder-surface-raised`
triangle laid over it, leaving a ~1px rim — one visible layer, not two, so
there was no alpha stacking. But the rim and the panel border no longer
composited over the same thing, which was a real regression:
`background-clip` defaults to `border-box`, so the panel's own
`--cinder-surface-raised` paints _underneath_ its translucent border, while
the arrow's outer triangle was a zero-size box with borders and no
background of its own, painting straight onto whatever the popover floated
over. While both tokens were opaque the two edges rendered identically
regardless of backdrop; once `--cinder-border` became 48% alpha they diverged
whenever that backdrop was not `surface-raised`.

Measured with a probe carrying both (pre-fix) constructions over
`surface-inset`:

| arm   | panel border       | arrow rim (pre-fix) |
| ----- | ------------------ | ------------------- |
| light | `rgb(141,144,148)` | `rgb(133,137,143)`  |
| dark  | `rgb(95,124,152)`  | `rgb(85,104,127)`   |

The light arm's difference was slight; the dark arm's was visible, because the
dark surface ramp spans L 0.11–0.28 and the two edges were compositing over
opposite ends of it.

**Shipped fix.** The arrow now gets its own backdrop rather than the panel
changing how it paints. An element's own background/border always paints
before its own `::before`/`::after`, so the three layers are built in that
fixed order: the arrow's OWN border is now the opaque `surface-raised`
backdrop (previously the translucent rim color); a new `::before` repeats the
exact same triangle in the translucent `--cinder-border` ink, compositing
over that backdrop; the existing `::after` (the opaque 7px inner triangle) is
unchanged and still covers the middle, leaving only the outer ~2px rim
visible — now backed by `surface-raised` in every placement, matching the
panel edge on every backdrop instead of only on `surface-raised` itself. The
panel's own rendering is untouched.

The `::before` triangle's `left`/`top` offset needed a second correction,
also caught in review: the containing block for an absolutely positioned
pseudo-element of a zero-size (`width:0`/`height:0`) parent is a POINT at
that parent's _padding_ edge, not its border-box origin — and that point is
inset from the parent's own top-left corner by the parent's own border
widths (8px here). `left: 0`/`top: 0` therefore started the repeated
triangle 8px off from the outer triangle it's meant to sit on top of; each
placement now offsets by `-8px` on whichever axis that parent's own border
adds the inset, canceling it back to 0. Confirmed empirically with a
`border-bottom-color: red !important` override that mapped the pseudo-
element's true rendered position pixel-by-pixel against the outer triangle's
bounding box.

Asserted by a Playwright pixel probe
(`packages/testing/tests/popover-arrow-surface-parity.playwright.ts`) rather
than by eye: it floats a real Popover over `surface-inset`, `surface-canvas`,
and `surface` in both arms and reads the actual rendered pixels at the
panel's border and the two slanted edges of the arrow's rim (scanned as
separate left/right regions, not one — a single region spanning the whole
triangle is exactly as wide as a coincidentally-misplaced repeated triangle,
so it can still contain half the wrong-colored rim and pass; this was caught
by reverting only the offset fix above and watching the original whole-
region version pass anyway). The probe runs at `deviceScaleFactor: 2`: at
1x, the ~2-CSS-px rim never owns a whole device pixel, so every sampled
pixel is a partial-coverage blend of the rim color with whatever's behind it
and no absolute-color tolerance can admit that correct rendering without
also admitting the bug (confirmed by running the pre-2x version of this
probe against the genuine, unfixed `origin/main` construction, where it
passed). At 2x the rim has an interior at full strength, measured at an
exact 0-per-channel gap to the panel border on the corrected construction,
so the assertion combines a tight (5) absolute ceiling with a
backdrop-to-backdrop stability check. Proven against three separate,
individually-reverted defects: the `origin/main` construction above (a
correctly discriminating ~8–25-per-channel gap, matching the table),
the `::before` offset bug on its own (~90–98-per-channel gap), and the
HoverCard sample point (see above).

An earlier draft of this section claimed the rim "composites against the page
canvas the arrow floats over, the same way the panel's own border does". The
first half was right and the second was not, which is exactly what hid this.

### ButtonGroup — already solved, and better now

`button-group.css` zeroes **both** borders that meet at each junction and paints a
single `::before` seam in `var(--cinder-border)`. That was done to stop a bordered
variant doubling with the next item's edge, and it means the seam is a single
layer of ink sitting directly on the surface. No change needed.

### PermissionMatrix — single edge per seam

`border-collapse: separate` with `border-spacing: 0`, but cells carry only
`border-block-end` and `border-inline-end`, so interior seams get one border each.
The last row and column sit adjacent to the container's own `border`, which is a
pre-existing 2px edge, not a stack.

### The `:not(:first-child)` divider family — single edge per seam

`DescriptionList`, `SegmentedControl`, `SourceDiffViewer`, `StatisticGroup`,
`Footer`, `Toolbar`, `Feed`, `FeedBoundary`, `FeedEvent`, `RunStepTimeline`,
`Timeline`, and the shared `_row-item.css` all draw interior dividers as one edge
on one of the two adjacent elements (or as a pseudo-element rail). The
`interior-border-weight` stylelint rule is what keeps this the house idiom. None
of them stack.

## Border tokens used as fills

Most `background: var(--cinder-border*)` sites in the repository are 1px rules —
a divider drawn as a filled element rather than as a border. Alpha behaves
identically there, because the rule sits directly on one surface. The hairline
sites are `divider`, `steps` (connector), `timeline`, `run-step-timeline`,
`feed-boundary`, `feed-event` (connector line), `button-group` (the
`:not(:first-child)` seam), and the shared `_row-item` rule.

`statistic-group`'s `shared-borders` variant is a near-miss worth naming: it
paints `--cinder-border` across the whole root, but the children paint over it
with their own surface, so only the 1px grid gaps survive. The result is a
hairline; the declaration is not.

Three sites put a tier in an **inset `box-shadow`** on an edge that also carries
a tier border, which is the nearest thing in the repository to the double-border
problem: `kbd` (a `border.control` border on every edge plus a `border.muted`
inset line along the bottom) and `data-grid`'s pinned columns (a `border.muted`
`border-inline-end` plus a `border.control` pin shadow on that same edge).
`steps`' skipped marker uses an inset ring with no border under it.

They do not stack. An inset shadow is clipped to the padding box, so it lands on
the pixel _beside_ the border rather than on it. Measured rather than reasoned —
a probe carrying the Kbd recipe reads two distinct rows at the bottom edge:

```
y=18  rgb(210,211,213)   the inset border.muted line, 19% ink on surface-raised
y=19  rgb(141,144,148)   the border.control border, 48% ink
```

A stacked pair would have produced a single row at their combined weight. The
edge is 2px of two different weights, which is what it was before the tiers were
composed — both layers simply track the surface now.

Fourteen sites are a real area rather than a hairline. All fourteen now carry
their tier's alpha over whatever surface is behind them, and each of the three
times this list was wrong, it was wrong the same way — the sweep only found
sites shaped like the ones it had already found. Two of the fourteen are outside
`@lostgradient/cinder` (Chat's busy dot, the playground's stage dot), and two
never appear in a stylesheet at all: the Toggle track pair reaches the page as a
corpus alias, through the generated token stylesheet.

| site                             | tier                                                                                             | how it is painted                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggle` track (light arm)       | `border.muted`                                                                                   | the full track                                                                                                                                 |
| `toggle` track hover (light arm) | `border.control`                                                                                 | the full track                                                                                                                                 |
| `parameter-field` rail           | `border.control` (was `border.muted`, [CIN-603](https://linear.app/lost-gradient/issue/CIN-603)) | 3px wide, full body height                                                                                                                     |
| `mega-menu` indicator track      | `border.control` (was `border.muted`, [CIN-603](https://linear.app/lost-gradient/issue/CIN-603)) | 2px tall                                                                                                                                       |
| `media-controls` progress track  | `border.control`                                                                                 | 4px tall                                                                                                                                       |
| `drawer` drag-handle pill        | `border.control`                                                                                 | 40 × 4px                                                                                                                                       |
| `slider` tick                    | `border.control`                                                                                 | 2 × 8px, undiluted — the redundant `opacity: 0.6` was removed ([CIN-603](https://linear.app/lost-gradient/issue/CIN-603))                      |
| `color-field` empty hatch        | `border.control`                                                                                 | a 6px `linear-gradient` repeat across the swatch                                                                                               |
| `feed-event` dot                 | `border.strong`                                                                                  | 8 × 8px                                                                                                                                        |
| `status-dot` neutral indicator   | `border.strong`                                                                                  | `--cinder-status-dot-size`                                                                                                                     |
| `rating` empty star              | `border.strong`                                                                                  | a 1.5rem masked glyph                                                                                                                          |
| `resizable-panels` grip          | `border.strong`                                                                                  | `color:`, inherited by a child, undiluted — the child's `opacity: 0.5` was removed ([CIN-603](https://linear.app/lost-gradient/issue/CIN-603)) |
| `entry-frame` busy dot (Chat)    | `border.control`                                                                                 | 8 × 8px                                                                                                                                        |
| `dx-stage` dot (playground)      | `border.strong`                                                                                  | 7 × 7px                                                                                                                                        |

Four of those do not reach the tier through `background` at all, which is how two
earlier passes of this document missed them: `color-field` uses
`background-image`, `resizable-panels` uses `color`, and `rating` and
`status-dot` hop through a component token (`--_cinder-rating-empty`,
`--cinder-status-dot-color`). `status-dot` borrows a border tier because every
other status maps to a `*-solid` and neutral has none.

This list is no longer prose that has to be re-derived.
`src/styles/border-tier-non-border-uses.test.ts` enumerates every use of a
structural tier outside a `border`/`outline` declaration — in `.css` and in
`.svelte` `<style>` blocks, across `packages/components`, `packages/chat`,
`packages/editor`, and `packages/playground` — requires each to be classified as
a hairline, area, mix, occlusion, or alias, and requires every `area` to be named
in this document. An unclassified site fails the suite.

It scans the token corpus too, for the case no stylesheet sweep can reach: a
component-facing token whose `$value` or `cssRecipe` resolves to a tier, which
arrives through the generated `tokens-base.css` rather than through any file a
grep would find. That is how the Toggle hover track was missed here until the
guard went looking — `toggle.track.off-hover-resting` aliases `border.control`
in its light arm, exactly as the resting track aliases `border.muted`.

Against WCAG 1.4.11's 3:1 floor for meaningful non-text graphics, measured
across all four surface tokens in both arms:

- **`border.strong` sites clear it comfortably** — 4.268–4.444 light, 4.250–4.871 dark. The ResizablePanels grip was a former exception here, diluted by a child `opacity: 0.5` to ~1.9–2.1; [CIN-603](https://linear.app/lost-gradient/issue/CIN-603) removed that opacity, so it now clears the same undiluted range as every other `border.strong` site. See the compounded-sites section below for the before/after.
- **`border.control` sites clear it** — 3.129–3.206 light, 3.338–3.624 dark. The Slider tick was a former exception here, carrying `opacity: 0.6` in the same rule for an effective ~29% ink and ~1.9:1; [CIN-603](https://linear.app/lost-gradient/issue/CIN-603) removed that opacity as redundant, so it now clears the same undiluted range too. See the compounded-sites section below.
- **`border.muted` sites do not**, at 1.493–1.503 light and 1.445–1.580 dark, and
  in the dark arm this is a **regression** rather than a pre-existing shortfall
  carried forward. An earlier draft of this document compared only the light arm
  and concluded that composition "neither introduces nor worsens" the gap. That
  was wrong. Measured on both:

  | dark surface     | opaque `border.muted` | 19% ink | change |
  | ---------------- | --------------------- | ------- | ------ |
  | `surface-inset`  | 2.052                 | 1.456   | −29%   |
  | `surface-canvas` | 1.974                 | 1.511   | −23%   |
  | `surface`        | 1.814                 | 1.577   | −13%   |
  | `surface-raised` | 1.460                 | 1.613   | +10%   |

  The tier still clears its own 1.4:1 decorative floor on every surface (1.456 is
  the worst case), and its spread collapses from 28.9% to 9.7%, which is what the
  ticket asks for. But the two sites that use the muted tier as an **area fill**
  rather than a hairline — the ParameterField rail and the MegaMenu indicator
  track — were already below 1.4.11's 3:1 in the dark arm and were, at that
  point, further below it on the three recessed surfaces.

  **Resolved by [CIN-603](https://linear.app/lost-gradient/issue/CIN-603).** The
  muted tier's contract is a 1.4:1 decorative hairline; filling a persistent
  state indicator with it was a misuse that predated this work. Both sites
  moved onto `border.control` (3.129–3.206 light, 3.338–3.624 dark — the same
  range quoted for the tier throughout this document), which is exactly the fix
  this section originally deferred rather than a new decision.
  `toolbar-separator.svelte` reached the same conclusion independently, earlier:
  "the muted variant looked invisible in dark mode (~1.4:1 against
  surface-raised)", which is why it uses `border.control`.

### Toggle track, light arm — intentional, and steadier than before

`--cinder-toggle-track-off-resting` aliases `border.muted` in its light arm
(the dark arm is an independent literal and is untouched). It is the largest of
the eight area fills, and the only one whose before/after was measured surface
by surface, so it is worth showing in full.

The track now tracks the surface underneath it instead of being a fixed grey,
which is the same improvement the borders get:

| surface          | before                 | after                    | contrast (before → after) |
| ---------------- | ---------------------- | ------------------------ | ------------------------- |
| `surface-inset`  | `oklch(85% 0.004 255)` | `oklch(83.2% 0.007 255)` | 1.408 → 1.492             |
| `surface-canvas` | `oklch(85% 0.004 255)` | `oklch(85.2% 0.005 255)` | 1.510 → 1.498             |
| `surface`        | `oklch(85% 0.004 255)` | `oklch(86.1% 0.004 255)` | 1.554 → 1.500             |
| `surface-raised` | `oklch(85% 0.004 255)` | `oklch(86.6% 0.003 255)` | 1.581 → 1.502             |

The track reads at a near-identical weight on every surface now (1.49–1.50)
rather than drifting across a 12% range, and its floor goes up rather than down.
The dark arm's ≥3:1 shape-contrast requirement is unaffected — that arm is a
literal, not an alias.

## Tier borders under an element opacity

A tier used as a border is normally the intended case and needs no entry here.
The exception is an element that also carries a fractional `opacity`: that
multiplies the tier's own alpha rather than replacing an opaque value, so
composing the tier compounds with it.

**This section does not claim to enumerate every such site, and cannot.** Three
successive attempts to list them exhaustively were each incomplete, because the
tier and the opacity are related by the cascade rather than by proximity in the
source. Review of this PR alone turned up five distinct arrangements, none of
which a text scan can follow:

| arrangement              | example                                              |
| ------------------------ | ---------------------------------------------------- |
| same rule                | SortableList's drag placeholder                      |
| separate rule, same file | Select's empty state                                 |
| cross-file               | a disabled Button, via `foundation.css`              |
| parent to child          | the ResizablePanels grip                             |
| cross-component          | RunStepTimeline's rewound marker composing StatusDot |
| inside `@keyframes`      | StatusDot's connecting pulse                         |

The arithmetic, at least, is fully determined: effective ink is the tier's alpha
times the opacity, so any combination can be read off directly.

|                 | `muted` (19%) | `control` (48%) | `strong` (58%) |
| --------------- | ------------- | --------------- | -------------- |
| `opacity: 0.7`  | 13%           | 34%             | 41%            |
| `opacity: 0.6`  | 11%           | 29%             | 35%            |
| `opacity: 0.55` | 10%           | 26%             | 32%            |
| `opacity: 0.5`  | 10%           | 24%             | 29%            |
| `opacity: 0.4`  | 8%            | 19%             | 23%            |
| `opacity: 0.32` | 6%            | 15%             | 19%            |

What follows is therefore a record of the cases found, not a closed set. The
ones that **mattered for a decision** were the handful that are not disabled
states, since WCAG exempts disabled controls from the contrast floor outright:
the SortableList drop marker, the ResizablePanels grip, the chart legend
toggles, and Select's empty state. **[CIN-603](https://linear.app/lost-gradient/issue/CIN-603)
resolved all four** — each is marked below with its retuned, undiluted value.
The disabled states below are recorded for completeness and remain
unretuned by design; they are not defects.

Deriving the full inventory needs computed styles rather than source text, which
is [CIN-602](https://linear.app/lost-gradient/issue/CIN-602); every arrangement
in the table above collapses into one measurement there.

**SortableList's drag placeholder** — `outline: 2px dashed var(--cinder-border-muted)`
under `opacity: 0.4`, so 19% × 0.4 ≈ 7.6% effective ink against 40% before. Its
own comment notes the outline is what marks the current drop position.

| dark surface     | before (opaque) | CIN-245 (muted × 0.4) |
| ---------------- | --------------- | --------------------- |
| `surface-inset`  | 1.220           | 1.113                 |
| `surface-canvas` | 1.229           | 1.136                 |
| `surface`        | 1.223           | 1.168                 |
| `surface-raised` | 1.155           | 1.199                 |

**Resolved by CIN-603.** Neither value ever cleared the 3:1 functional floor
this drop indicator needs — nothing here was a regression CIN-245 caused, it
was ink loss on a value already below the floor. The fix moved the outline to
`border.control` and removed the element `opacity` entirely: this box has no
other visible content (children are `visibility: hidden`, background and
box-shadow are already suppressed), so the opacity was diluting nothing but
this outline, and dropping it puts the indicator at `border.control`'s full,
undiluted 3.129–3.206 light / 3.338–3.624 dark — the same range quoted for
the tier throughout this document.

**ResizablePanels' grip** — the tier and the opacity are on _different
elements_. `.cinder-resizable-panels__handle` sets `color: var(--cinder-border-strong)`;
its child `.cinder-resizable-panels__handle-line` paints `background: currentColor`
at `opacity: 0.5`. So 58% × 0.5 ≈ 29% effective ink, and the dark arm loses:

| surface          | light before (opaque) → CIN-245 (strong × 0.5) | dark before (opaque) → CIN-245 (strong × 0.5) |
| ---------------- | ---------------------------------------------- | --------------------------------------------- |
| `surface-inset`  | 1.314 → 1.891                                  | 2.369 → 1.974                                 |
| `surface-canvas` | 1.356 → 1.904                                  | 2.400 → 2.042                                 |
| `surface`        | 1.373 → 1.909                                  | 2.396 → 2.111                                 |
| `surface-raised` | 1.383 → 1.912                                  | 2.236 → 2.100                                 |

This is the grip's only visible affordance, which made it the second site after
the SortableList marker where the loss landed on something functional rather than
decorative. Neither cleared 3:1 before either.

**Resolved by CIN-603.** The child's `opacity: 0.5` was removed, leaving the
line at `border.strong`'s full, undiluted alpha — 4.268–4.444 light,
4.250–4.871 dark, the same range quoted for the tier throughout this
document. The hover-state opacity bump (`0.5` → `0.9`) that existed only to
partly undo this dilution on hover was removed along with it, since resting
is now already at full strength.

**Disabled states.** More of these exist than are listed here; the ones found so
far, with the arithmetic from the table above:

- `tree` expand/select buttons — `border.control` × 0.5 → 24%
- `invocation-rule-builder` icon buttons — `border.muted` × 0.4 → 8%
- `chat-history-trigger` — `border.control` × 0.7 → 34%
- `color-picker` preview, via a disabled ancestor — `border.control` × 0.6 → 29%

Three more are measured in full below (`rating`, `media-controls`,
`file-upload`), and three share `opacity: 0.6` from `foundation.css`'s shared disabled-visual
rule (`foundation.css:315-324`) on top of a `border.muted` tier, so ≈11.4%
effective ink against 60%:

- a **Button** — `border-color: var(--cinder-border-muted)` from `button.css`
- a **SegmentedControl**, attached or detached — `border: 1px solid var(--cinder-border-muted)`
- an off **Toggle** — its track resolves through `--cinder-toggle-track-off-resting`,
  which aliases `border.muted` in the light arm; the dark arm is an independent
  literal and is untouched, so only the light arm moves here

All three share the same arithmetic, so one table covers them:

| dark surface     | before | after |
| ---------------- | ------ | ----- |
| `surface-inset`  | 1.422  | 1.201 |
| `surface-canvas` | 1.418  | 1.236 |
| `surface`        | 1.384  | 1.282 |
| `surface-raised` | 1.247  | 1.321 |

**Slider's tick** — the one compounded site that was an area fill rather than a
border: `background: var(--cinder-border, currentColor)` with `opacity: 0.6` in
the same rule, so 48% × 0.6 ≈ 29% effective ink.

| surface          | light | dark (CIN-245, opacity still present) |
| ---------------- | ----- | ------------------------------------- |
| `surface-inset`  | 1.881 | 1.961                                 |
| `surface-canvas` | 1.894 | 2.029                                 |
| `surface`        | 1.900 | 2.099                                 |
| `surface-raised` | 1.903 | 2.089                                 |

That was the figure that mattered for the tick at the time, not the
3.129–3.206 / 3.338–3.624 the tier measures undiluted — an earlier draft of
the table above quoted the latter for it, which was wrong. Ticks are a
decorative scale marking rather than a control boundary, so 3:1 was never the
applicable floor here, but the number needed to be the real one.

**Retuned by CIN-603 anyway.** The `opacity: 0.6` was redundant rather than
load-bearing — nothing else in this rule depended on it — so it was removed
even though the tick was never required to clear 3:1. It now measures the
tier's full undiluted range, 3.129–3.206 light / 3.338–3.624 dark, which the
"`border.control` sites clear it" bullet above already covers.

Both light arms improve slightly; only the dark arm loses. Neither was near
1.4.11's 3:1 before — a 40%-opacity ghost and a disabled control are both
deliberately faint, and disabled controls are exempt from the contrast floor
outright — so this is the same shape as the muted area fills above: a
pre-existing sub-floor value that composition moves further down in one arm,
recorded rather than silently absorbed. The drop indicator is the one worth
revisiting on its own, since it marks a live, functional position.

`border-tier-non-border-uses.test.ts` catches the same-rule shape and claims no
more. **Chart legend toggles, series off** — the one separate-rule case that is _not_
a disabled state. AreaChart, BarChart and LineChart each give their legend
buttons `border: 1px solid var(--cinder-border)` and then `opacity: 0.55` under
`[aria-pressed='false']`, so a toggled-off series shows a 48% × 0.55 ≈ 26%
boundary:

| surface          | light before (opaque) → CIN-245 (control × 0.55) | dark before (opaque) → CIN-245 (control × 0.55) |
| ---------------- | ------------------------------------------------ | ----------------------------------------------- |
| `surface-inset`  | 1.200 → 1.774                                    | 2.152 → 1.818                                   |
| `surface-canvas` | 1.244 → 1.785                                    | 2.169 → 1.884                                   |
| `surface`        | 1.263 → 1.790                                    | 2.148 → 1.955                                   |
| `surface-raised` | 1.274 → 1.792                                    | 1.978 → 1.962                                   |

These are enabled, persistent controls a user presses to toggle a series back
on, so WCAG 1.4.11's 3:1 does apply to them — unlike the disabled states below,
which are exempt. They did not clear it before either (2.15:1 at best in dark),
so this was a pre-existing shortfall pushed further down rather than a floor
this change broke, but it belonged with the live affordances rather than with
the exempt states.

**Resolved by CIN-603.** A toggled-off series is still an enabled control, so
its boundary can't simply be dimmed along with everything else. The fix
decouples the dimming from the border: `[aria-pressed='false']` now sets
`color`, and the swatch dot gets its own scoped `opacity: 0.55`, leaving the
border at `border.control`'s full, undiluted alpha — 3.129–3.206 light,
3.338–3.624 dark. Applied identically across AreaChart, BarChart, and
LineChart, which share this rule shape.

The `color` source is `--_cinder-chart-muted` — the same chart-local custom
property every other "muted" element in these three files already reads
(the series description, axis labels, tick labels) — not the global
`--cinder-text-muted` token. An earlier draft of this fix used the global
token, which is a theme-consistency regression caught in review: a consumer
supplying their own `theme.muted` to color-customize a chart would have that
override silently ignored for the one label where a series is toggled off,
potentially illegible against a custom chart background the global token
was never chosen against. `--_cinder-chart-muted` defaults to `currentColor`
(`chart-model-utilities`'s `theme?.muted ?? 'currentColor'`) when no
consumer theme is supplied, so with no override the label now reads at
full, undimmed contrast — the swatch's own `opacity: 0.55` is what still
marks the series as toggled off in that default case.

**StatusDot's connecting pulse** — the opacity lives in a `@keyframes` body,
which is a fifth arrangement the scan cannot reach. With
`status="neutral" connectionState="connecting"` the indicator resolves to
`border.strong` and `cinder-status-dot-pulse` animates it to `opacity: 0.3` at
the midpoint, so 58% × 0.3 ≈ 17% ink there — dark `surface-inset` 1.534 → 1.393,
light 1.174 → 1.439.

This is a transient trough rather than a resting value: the animation spends
most of its cycle nearer `opacity: 1`, where the undiluted StatusDot row in the
area table applies. Recorded so that row is not read as covering every state of
the component.

**Chat's rollback preview** — the faintest of the compounded states, and an
ancestor/child pair in the Chat workspace rather than in `@lostgradient/cinder`.
When a rollback confirmation marks later messages as discarded,
`chat-message.svelte:501-504` puts `opacity: 0.32` (and `saturate(0.35)`) on the
wrapper, while the assistant bubble inside it draws `border: 1px solid
var(--cinder-border-muted)`. That is 19% × 0.32 ≈ 6% ink — dark `surface-inset`
1.158 → 1.085; the light arm improves slightly, 1.079 → 1.129.

Recorded rather than flagged. This state exists to show content that is about to
be thrown away: it is deliberately ghosted, desaturated, and `pointer-events:
none`, so it is neither an interactive control nor an indicator carrying
information the user must read. Its boundary was already ~1.16:1 at best before
composition. Of every state in this section it has the strongest claim to being
decorative by intent.

**RunStepTimeline's rewound marker** — a cross-_component_ case. A step with
`status: 'skipped'` maps through `statusDotStatus()` to the neutral StatusDot,
whose indicator is `border.strong`; when that step is also `rewound: true`, an
ancestor rule applies `opacity: 0.55` to the marker. So 58% × 0.55 ≈ 32% ink,
dark `surface-inset` 2.649 → 2.166 — the same arithmetic as the disabled Rating
below, reached through two components rather than one file.

The StatusDot row in the area table measures the tier undiluted, which is right
for every other status; this combination is the exception.

**Select's empty state** — the other separate-rule case that is not a disabled
control. With `options=[]`, `select.svelte` renders `data-cinder-empty="true"`
but leaves `disabled` bound to the field, so an empty-and-enabled Select keeps
`border: 1px solid var(--cinder-border)` and takes `opacity: 0.5` from the
`[data-cinder-empty='true']` rule — 48% × 0.5 ≈ 24% ink, the same arithmetic as
the MediaControls row below (dark `surface-inset` 1.963 → 1.688).

The state does signal unavailability by other means — `border-style: dashed` and
`cursor: not-allowed` — and a select with no options has nothing to choose. But
it is not `disabled`, so it cannot claim the exemption, and the dashed border is
the affordance carrying the "empty" meaning.

**Resolved by CIN-603.** The `[data-cinder-empty='true']` rule now sets
`color: var(--cinder-text-muted)` instead of `opacity`, keeping the dimmed
look on the text while leaving the dashed `border.control` boundary at its
full, undiluted alpha — 3.129–3.206 light, 3.338–3.624 dark.

These three are measured in full, as representative of the band — the tier comes
from the base rule and the opacity from a `:disabled` / `[aria-disabled]` /
`[data-disabled]` rule on the same element:

| state                          | tier × opacity         | effective | dark `surface-inset` before → after |
| ------------------------------ | ---------------------- | --------- | ----------------------------------- |
| Rating, disabled               | `border.strong` × 0.55 | 32%       | 2.649 → 2.166                       |
| MediaControls button, disabled | `border.control` × 0.5 | 24%       | 1.963 → 1.688                       |
| FileUpload dropzone, disabled  | `border.control` × 0.7 | 34%       | 2.841 → 2.288                       |

All three are disabled states, which WCAG exempts from the contrast floor
outright, so none is a compliance problem — but all three lose ink in the dark
arm and the numbers belong on the record with the rest.

The grip's two halves sit on a parent and its child; the Button, Toggle and SegmentedControl states are **cross-file**; and the three above are same-file but in separate rules. None of those is a textual relationship — the tier is declared
in a component stylesheet and the opacity in `foundation.css` — so no same-rule scan can see any of them, and
resolving that would mean matching selectors and following the cascade. This section is the record for those, and [CIN-602](https://linear.app/lost-gradient/issue/CIN-602)
covers deriving the whole audit from computed styles instead, which would find
them without a hand-maintained list.

### Computed audit

<!-- BEGIN GENERATED: border-tier-computed-audit -->
<!-- prettier-ignore-start -->
<!--
  Generated by packages/testing/tests/border-tier-computed-audit.playwright.ts.
  Do not hand-edit between these markers -- run
    CINDER_UPDATE_SEAM_AUDIT=1 bun run --filter=@cinder/testing test:playwright -- tests/border-tier-computed-audit.playwright.ts
  to regenerate it, and commit the result. Everything outside these markers is
  human-owned narrative and is never touched by that command.

  Each row is a real, rendered element read via CDP's
  CSS.getMatchedStylesForNode -- category and identity only, no contrast
  numbers (those still belong in the hand-authored measurements above and
  stay that way; this table exists to prove WHICH sites the mechanism finds,
  not to re-measure them). A later lane extends this by adding its own site
  to AUDITED_SITES in that file and re-running the command above.
-->

| site | property | tier reference | how it was found |
| --- | --- | --- | --- |
| disabled icon-only ghost Button (`/page/button`) | `border-color` | `var(--cinder-border-muted)` | opacity compound: a variant-specific rule in `button.css` pairs `border-color` and `opacity: 0.6` in the SAME rule (also caught by the source-text scan), while `foundation.css`'s shared disabled-visual rule redundantly contributes the identical opacity from a second file; matched via CDP |
| disabled secondary Button (`/page/button`) | `border-color` | `var(--cinder-border-muted)` | cross-file-only opacity compound: `button.css`'s base disabled rule sets `border-color: var(--cinder-border-muted)` alone (no same-rule `opacity`), and `opacity: 0.6` comes entirely from `foundation.css`'s shared disabled-visual rule -- the two declarations never appear together as literal text in any one file, matched on the same element via CDP |
| resting Toggle track (`/page/toggle`) | `background` | `--cinder-toggle-track-off-resting` → `var(--cinder-border-muted)` | one-hop alias: a non-border property's `var()` fallback names a custom property whose own declaration (inherited from the generated `:root` block) names the tier |

Coverage note: this table currently audits, across three sites, the two shapes
CIN-602 was scoped to prove (an opacity compound, and a corpus-alias area fill
invisible to static source text) -- one of the three (the icon-only Button) is
ALSO caught by the same-rule case in `border-tier-non-border-uses.test.ts`; the
plain (secondary) disabled Button is the one the text scan cannot see even in
principle. It is not yet a full replacement for the hand-maintained
tables elsewhere in this document -- extending `AUDITED_SITES` to the rest of the
sites listed by hand above (SortableList, ResizablePanels, SegmentedControl, the
disabled-state list, the fourteen-site area-fill table) has not been done.
<!-- prettier-ignore-end -->
<!-- END GENERATED: border-tier-computed-audit -->

## Border tokens used as an input to `color-mix()`

A translucent token mixed into another color behaves differently from an opaque
one: the result inherits a fraction of the transparency, and OKLCH mixing is
premultiplied, so both the alpha and the color shift.

### `chat-message.svelte:669` — intentional, re-tuned

```css
background: color-mix(in oklch, var(--cinder-surface), var(--cinder-border-muted) 10%);
```

The muted tier is now 19% alpha, so this resolves to a ~92%-opaque wash instead of
a fully opaque one, and the tint it contributes is proportionally weaker. The
declaration is a _subtle_ background tint by design and still reads as one; the
residual transparency lands on the same surface the mix is anchored to, so the
painted result is within a fraction of a percent of what it was. Left as authored.

### `chip.css:137` — intentional

```css
color-mix(in oklch, … var(--cinder-border) 65% …)
```

Chip's `brandColor` mix pulls `border.control` in at 65%. The tier is now 48%
alpha, so the mix contributes proportionally less ink and the result carries a
little residual transparency over whatever the chip sits on. It is a tint by
design and still reads as one. Left as authored.

### Playground placeholder hatching — intentional

Ten `packages/playground/src/examples/card/*.example.svelte` files and
`examples/aspect-ratio/embedded-media.example.svelte` build a diagonal
placeholder hatch out of `color-mix(in oklch, var(--cinder-border-muted),
transparent 70%)`. Double dilution makes the hatch fainter than before
(19% × 30% ≈ 6% alpha).

Left as authored. These are the grey "your content goes here" boxes inside
documentation examples — a fainter hatch is if anything a better placeholder,
they are not part of the shipped component surface, and re-tuning eleven example
files to chase an intentional dilution would be noise in a token PR. Flagged here
so the next person who looks at those examples knows the value moved and why.

## What is not derived from the ink

`--cinder-border-faint` stays opaque. CIN-245 enumerates exactly three structural
tiers, and faint answers to a different floor — it is deliberately below WCAG
1.4.11's 3:1 and gated at 1.1:1 — so folding it into the same ladder would mean
re-deciding that floor, which is not this ticket's call. It remains the one
neutral border tier that does not follow `--cinder-border-ink` when overridden.

The four **hued** status borders — `info`, `success`, `warning`, `danger` —
stay opaque too, and that is the ratified hybrid
model rather than an omission: a translucent status border would take its hue
from whatever surface it happened to sit on, which is the opposite of what a
status color is for. `check-token-contrast.test.ts` enforces it — those four are
read through the strict reader that throws on any alpha channel.

Two neutral borders wearing another name are deliberately **not** in that list.
`--cinder-status-neutral-border` is a straight alias of `--cinder-border` and
always has been, and `--cinder-border-inverse`'s dark arm is a straight alias of
`--cinder-border-strong` (its light arm is `transparent`, so only one arm is
affected). Both became translucent along with the tier they alias. That is correct: the neutral status tier is neutral
structure wearing a status name, not a hue that needs protecting. Its contrast
is measured composited over the soft neutral background in the same file.
