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

Eight sites are a real area rather than a hairline. All eight now carry their
tier's alpha over whatever surface is behind them.

| site                            | tier                     | size                       |
| ------------------------------- | ------------------------ | -------------------------- |
| `toggle` track (light arm)      | `border.muted`           | the full track             |
| `parameter-field` rail          | `--cinder-border-muted`  | 3px wide, full body height |
| `mega-menu` indicator track     | `--cinder-border-muted`  | 2px tall                   |
| `media-controls` progress track | `--cinder-border`        | 4px tall                   |
| `drawer` drag-handle pill       | `--cinder-border`        | 40 × 4px                   |
| `slider` tick                   | `--cinder-border`        | 2 × 8px                    |
| `feed-event` dot                | `--cinder-border-strong` | 8 × 8px                    |
| `status-dot` neutral indicator  | `--cinder-border-strong` | `--cinder-status-dot-size` |

`status-dot` reaches the tier through `--cinder-status-dot-color`; every other
status maps to a `*-solid` token, and neutral borrows the border tier because
there is no neutral solid.

Against WCAG 1.4.11's 3:1 floor for meaningful non-text graphics, measured
across all four surface tokens in both arms:

- **`border.strong` sites clear it comfortably** — 4.268–4.444 light, 4.250–4.871 dark.
- **`border.control` sites clear it** — 3.129–3.206 light, 3.338–3.624 dark.
- **`border.muted` sites do not**, at 1.493–1.503 light and 1.445–1.580 dark. That
  is unchanged in kind: the muted tier sat below 3:1 before this work too (the
  light arm measured 1.408–1.581 opaque, against 1.492–1.502 now), so the two
  sites that use it as an area fill — the ParameterField rail and the MegaMenu
  indicator track — carry a pre-existing shortfall that composition neither
  introduces nor worsens. It is out of scope for CIN-245, which enumerates the
  three structural tiers rather than re-deciding what each is licensed for, but
  it is real and should be picked up separately.

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
