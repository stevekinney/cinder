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

### Popover arrow — one layer of ink

`popover.css` builds its arrow with the CSS-triangle technique: an 8px triangle in
`var(--cinder-border)` with a 7px `--cinder-surface-raised` triangle laid over it,
leaving a ~1px rim. The rim is one layer, not two — the opaque inner triangle
covers everything else. It composites against the page canvas the arrow floats
over, the same way the panel's own border does.

Captured at 4× in both arms during this audit: the rim and the panel border read
as one continuous outline of even weight, with no denser pixel at the junction.

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

| site                             | tier             | how it is painted                                            |
| -------------------------------- | ---------------- | ------------------------------------------------------------ |
| `toggle` track (light arm)       | `border.muted`   | the full track                                               |
| `toggle` track hover (light arm) | `border.control` | the full track                                               |
| `parameter-field` rail           | `border.muted`   | 3px wide, full body height                                   |
| `mega-menu` indicator track      | `border.muted`   | 2px tall                                                     |
| `media-controls` progress track  | `border.control` | 4px tall                                                     |
| `drawer` drag-handle pill        | `border.control` | 40 × 4px                                                     |
| `slider` tick                    | `border.control` | 2 × 8px, under `opacity: 0.6` — see below                    |
| `color-field` empty hatch        | `border.control` | a 6px `linear-gradient` repeat across the swatch             |
| `feed-event` dot                 | `border.strong`  | 8 × 8px                                                      |
| `status-dot` neutral indicator   | `border.strong`  | `--cinder-status-dot-size`                                   |
| `rating` empty star              | `border.strong`  | a 1.5rem masked glyph                                        |
| `resizable-panels` grip          | `border.strong`  | `color:`, inherited by a child at `opacity: 0.5` — see below |
| `entry-frame` busy dot (Chat)    | `border.control` | 8 × 8px                                                      |
| `dx-stage` dot (playground)      | `border.strong`  | 7 × 7px                                                      |

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

- **`border.strong` sites clear it comfortably** — 4.268–4.444 light, 4.250–4.871 dark, with one exception: the ResizablePanels grip is diluted by a child `opacity: 0.5` and measures ~1.9–2.1. Recorded with the other compounded sites below.
- **`border.control` sites clear it** — 3.129–3.206 light, 3.338–3.624 dark, with one exception: the Slider tick carries `opacity: 0.6` in the same rule, so its effective ink is 48% × 0.6 ≈ 29% and it measures ~1.9. Recorded with the other compounded sites below.
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
  track — were already below 1.4.11's 3:1 in the dark arm and are now further
  below it on the three recessed surfaces.

  Not fixed here, and flagged rather than absorbed. The muted tier's contract is
  a 1.4:1 decorative hairline; filling a state indicator with it is a misuse that
  predates this work, and the fix is to move those two sites onto `border.control`
  (3.338–3.624 dark) or a purpose-built token — a visual change to two components
  that CIN-245 does not scope and that deserves its own decision.
  `toolbar-separator.svelte` reached the same conclusion independently: "the
  muted variant looked invisible in dark mode (~1.4:1 against surface-raised)",
  which is why it uses `border.control`.

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
composing the tier compounds with it. Two sites do this, and both lose ink in
the dark arm.

**SortableList's drag placeholder** — `outline: 2px dashed var(--cinder-border-muted)`
under `opacity: 0.4`, so 19% × 0.4 ≈ 7.6% effective ink against 40% before. Its
own comment notes the outline is what marks the current drop position.

| dark surface     | before | after |
| ---------------- | ------ | ----- |
| `surface-inset`  | 1.220  | 1.113 |
| `surface-canvas` | 1.229  | 1.136 |
| `surface`        | 1.223  | 1.168 |
| `surface-raised` | 1.155  | 1.199 |

**ResizablePanels' grip** — the tier and the opacity are on _different
elements_. `.cinder-resizable-panels__handle` sets `color: var(--cinder-border-strong)`;
its child `.cinder-resizable-panels__handle-line` paints `background: currentColor`
at `opacity: 0.5`. So 58% × 0.5 ≈ 29% effective ink, and the dark arm loses:

| surface          | light before → after | dark before → after |
| ---------------- | -------------------- | ------------------- |
| `surface-inset`  | 1.314 → 1.891        | 2.369 → 1.974       |
| `surface-canvas` | 1.356 → 1.904        | 2.400 → 2.042       |
| `surface`        | 1.373 → 1.909        | 2.396 → 2.111       |
| `surface-raised` | 1.383 → 1.912        | 2.236 → 2.100       |

This is the grip's only visible affordance, which makes it the second site after
the SortableList marker where the loss lands on something functional rather than
decorative. Neither cleared 3:1 before either.

**Three disabled states**, all taking `opacity: 0.6` from `foundation.css`'s
shared disabled-visual rule (`foundation.css:315-324`) on top of a `border.muted`
tier, so ≈11.4% effective ink against 60%:

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

**Slider's tick** — the one compounded site that is an area fill rather than a
border: `background: var(--cinder-border, currentColor)` with `opacity: 0.6` in
the same rule, so 48% × 0.6 ≈ 29% effective ink.

| surface          | light | dark  |
| ---------------- | ----- | ----- |
| `surface-inset`  | 1.881 | 1.961 |
| `surface-canvas` | 1.894 | 2.029 |
| `surface`        | 1.900 | 2.099 |
| `surface-raised` | 1.903 | 2.089 |

That is the figure that matters for the tick, not the 3.129–3.206 / 3.338–3.624
the tier measures undiluted — an earlier draft of the table above quoted the
latter for it, which was wrong. Ticks are a decorative scale marking rather than
a control boundary, so 3:1 is not the applicable floor, but the number should be
the real one.

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

| surface          | light before → after | dark before → after |
| ---------------- | -------------------- | ------------------- |
| `surface-inset`  | 1.200 → 1.774        | 2.152 → 1.818       |
| `surface-canvas` | 1.244 → 1.785        | 2.169 → 1.884       |
| `surface`        | 1.263 → 1.790        | 2.148 → 1.955       |
| `surface-raised` | 1.274 → 1.792        | 1.978 → 1.962       |

These are enabled, persistent controls a user presses to toggle a series back
on, so WCAG 1.4.11's 3:1 does apply to them — unlike the disabled states below,
which are exempt. They did not clear it before either (2.15:1 at best in dark),
so this is a pre-existing shortfall pushed further down rather than a floor this
change breaks, but it belongs with the live affordances rather than with the
exempt states.

Three more disabled states dilute a tier from a **separate rule in the same
file**, which the same-rule scan also cannot see — the tier comes from the base
rule and the opacity from a `:disabled` / `[aria-disabled]` / `[data-disabled]`
rule on the same element:

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
