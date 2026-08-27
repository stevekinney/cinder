# Design tokens

cinder ships its design tokens as plain CSS custom properties on `:root`. Every token has a `--cinder-*` prefix; that prefix is the public surface, and you can override any of them at `:root` (globally) or on any ancestor selector (scoped) to reskin the system. Internal-only custom properties use `--_cinder-*`; those are not part of the contract and may change without notice.

The token tables below are generated from the DTCG token corpus at [`src/tokens/`](../packages/components/src/tokens/) — everything between a `<!-- BEGIN GENERATED TOKEN TABLE -->` / `<!-- END GENERATED TOKEN TABLE -->` marker pair is rewritten by `bun run --filter=@lostgradient/cinder tokens:generate`; edit the corpus, not the tables. The rest of this file — this intro, the callouts, and the explanatory prose between sections — is hand-maintained. A drift test in [`tokens-doc-drift.test.ts`](../packages/components/src/styles/tokens-doc-drift.test.ts) keeps the generated tables in sync with the corpus, and `tokens:generate -- --check` fails if they have drifted; add a new token by adding it to the corpus and to the matching section in [`generate-artifacts.ts`](../packages/components/scripts/tokens/generate-artifacts.ts), or CI will fail.

All tokens are declared in [`tokens-base.css`](../packages/components/src/styles/tokens-base.css). The aggregator [`tokens.css`](../packages/components/src/styles/tokens.css) imports the base file and is the entry point components consume.

> [!NOTE]
> Color tokens use [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) keyed off `color-scheme`. The default `:root` sets `color-scheme: light dark`, which means the browser picks based on the user's OS preference. Force a whole-page scheme with `data-theme="light"` or `data-theme="dark"` on `:root`. For scoped theme islands, put `[data-theme='light']` or `[data-theme='dark']` on the subtree; cinder redeclares the core semantic surface, text, border, overlay, interaction, status, and control tokens there so components inherit concrete local values instead of requiring consumer token pinning.

## Spacing

Rem-based spacing scale. Use these for padding, gap, margin — anywhere you'd otherwise hardcode a pixel value.

<!-- BEGIN GENERATED TOKEN TABLE: spacing -->

| Token                | Default    | Description                                                     |
| -------------------- | ---------- | --------------------------------------------------------------- |
| `--cinder-space-0`   | `0`        | Zero spacing step, used to explicitly reset a spacing property. |
| `--cinder-space-0-5` | `0.125rem` | Spacing scale half-step between 0 and 1 (2px).                  |
| `--cinder-space-1`   | `0.25rem`  | Base spacing increment.                                         |
| `--cinder-space-1-5` | `0.375rem` | Spacing scale half-step between 1 and 2 (6px).                  |
| `--cinder-space-2`   | `0.5rem`   | Spacing scale step (8px).                                       |
| `--cinder-space-2-5` | `0.625rem` | Spacing scale half-step between 2 and 3 (10px).                 |
| `--cinder-space-3`   | `0.75rem`  | Spacing scale step (12px).                                      |
| `--cinder-space-3-5` | `0.875rem` | Spacing scale half-step between 3 and 4 (14px).                 |
| `--cinder-space-4`   | `1rem`     | Spacing scale step (16px).                                      |
| `--cinder-space-5`   | `1.25rem`  | Spacing scale step (20px).                                      |
| `--cinder-space-6`   | `1.5rem`   | Spacing scale step (24px).                                      |
| `--cinder-space-7`   | `1.75rem`  | Spacing scale step (28px).                                      |
| `--cinder-space-8`   | `2rem`     | Spacing scale step (32px).                                      |
| `--cinder-space-10`  | `2.5rem`   | Spacing scale step (40px).                                      |
| `--cinder-space-12`  | `3rem`     | Spacing scale step (48px).                                      |
| `--cinder-space-16`  | `4rem`     | Spacing scale step (64px).                                      |
| `--cinder-space-20`  | `5rem`     | Spacing scale step (80px).                                      |
| `--cinder-space-24`  | `6rem`     | Spacing scale step (96px).                                      |
| `--cinder-space-32`  | `8rem`     | Spacing scale step (128px).                                     |

<!-- END GENERATED TOKEN TABLE -->

## Radii and shadows

Corner radii and elevation shadows. `--cinder-radius-full` produces a pill or circle depending on the element's aspect ratio.

Shadow tokens wrap each color argument in `light-dark()` so dark mode paints a light-neutral elevation instead of invisible black-on-dark. The offsets, blur radii, and spread radii are identical across themes; `--cinder-shadow-sm` carries a second hairline layer for deeper, crisper elevation, and the alphas were raised — in both arms for `--cinder-shadow-sm` and in the dark arms only for `--cinder-shadow-md` and `--cinder-shadow-lg`. Only those alphas, the new `sm` layer, and the per-theme color values branch. Overlay surfaces that sit above already-elevated dark UI can use `--cinder-shadow-overlay`, which keeps a dark shadow in both themes to avoid a glow halo.

<!-- BEGIN GENERATED TOKEN TABLE: radii-and-shadows -->

| Token                     | Default                                                                                                                                              | Description                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-radius-sm`      | `0.375rem`                                                                                                                                           | Compact control corner radius (6px).                                                                                                                                                                                                                                                                                                                                    |
| `--cinder-radius-md`      | `0.5rem`                                                                                                                                             | Default control corner radius.                                                                                                                                                                                                                                                                                                                                          |
| `--cinder-radius-lg`      | `0.75rem`                                                                                                                                            | Surface-level corner radius for cards, dialogs, and other large panels (12px).                                                                                                                                                                                                                                                                                          |
| `--cinder-radius-full`    | `9999px`                                                                                                                                             | Fully rounded corner radius for pills and circular controls.                                                                                                                                                                                                                                                                                                            |
| `--cinder-shadow-sm`      | `0 1px 2px light-dark(oklch(0% 0 0 / 0.1), oklch(100% 0 0 / 0.09)), 0 1px 1px light-dark(oklch(0% 0 0 / 0.06), oklch(100% 0 0 / 0.05))`              | Hairline elevation for barely-raised surfaces. Gained a second hairline layer and higher alphas in this refinement pass (light 0.08 -> 0.1 plus a new 0.06 layer; dark 0.06 -> 0.09 plus a new 0.05 layer) for deeper, crisper elevation. Light and dark themes carry distinct explicit values (see the theme modifier documents) alongside this `light-dark()` recipe. |
| `--cinder-shadow-md`      | `0 4px 6px -1px light-dark(oklch(0% 0 0 / 0.12), oklch(100% 0 0 / 0.09)), 0 2px 4px -2px light-dark(oklch(0% 0 0 / 0.1), oklch(100% 0 0 / 0.06))`    | Mid elevation for raised surfaces such as popovers.                                                                                                                                                                                                                                                                                                                     |
| `--cinder-shadow-lg`      | `0 10px 15px -3px light-dark(oklch(0% 0 0 / 0.14), oklch(100% 0 0 / 0.11)), 0 4px 6px -4px light-dark(oklch(0% 0 0 / 0.12), oklch(100% 0 0 / 0.07))` | High elevation for dialogs and drawers.                                                                                                                                                                                                                                                                                                                                 |
| `--cinder-shadow-overlay` | `0 10px 15px -3px light-dark(oklch(0% 0 0 / 0.14), oklch(0% 0 0 / 0.45)), 0 4px 6px -4px light-dark(oklch(0% 0 0 / 0.12), oklch(0% 0 0 / 0.32))`     | Elevation for modal/drawer overlay panels. Dark mode uses a stronger black shadow rather than the light-neutral lift the other tiers use, since overlay panels sit above a dimmed backdrop rather than page content.                                                                                                                                                    |

<!-- END GENERATED TOKEN TABLE -->

## Control heights

Shared height tier for any interactive control that needs to align with its siblings in a toolbar, button group, or form row. Per-component height tokens (e.g. `--cinder-button-height-sm`) alias this family where their values match so the tiers stay in sync as the design system grows. Adoption is opt-in: existing call sites that pass `size="sm"` keep rendering at their pre-existing dimensions until they opt in via a `density` prop.

<!-- BEGIN GENERATED TOKEN TABLE: control-heights -->

| Token                        | Default   | Description                                                    |
| ---------------------------- | --------- | -------------------------------------------------------------- |
| `--cinder-control-height-xs` | `1.5rem`  | Extra-small control height (24px).                             |
| `--cinder-control-height-sm` | `2rem`    | Small control height; the toolbar default (32px).              |
| `--cinder-control-height-lg` | `2.75rem` | Large control height; clears the WCAG AAA touch target (44px). |

<!-- END GENERATED TOKEN TABLE -->

## Typography

Font stacks, type scale, line heights, letter spacing, and weights. The base font size is `0.875rem` (`--cinder-text-base`) — slightly smaller than the browser default, tuned for dense application UI.

<!-- BEGIN GENERATED TOKEN TABLE: typography -->

| Token                       | Default                                                                                          | Description                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-font-sans`        | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif` | Default UI font stack.                                                                                                                   |
| `--cinder-font-mono`        | `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`         | Monospace font stack for code surfaces.                                                                                                  |
| `--cinder-text-2xs`         | `0.6875rem`                                                                                      | Smallest font size (11px).                                                                                                               |
| `--cinder-text-xs`          | `0.75rem`                                                                                        | Extra-small font size (12px).                                                                                                            |
| `--cinder-text-sm`          | `0.8125rem`                                                                                      | Small font size (13px).                                                                                                                  |
| `--cinder-text-base`        | `0.875rem`                                                                                       | Base body font size (14px).                                                                                                              |
| `--cinder-text-md`          | `0.9375rem`                                                                                      | Medium font size; the button ladder step between base and lg (15px).                                                                     |
| `--cinder-text-lg`          | `1rem`                                                                                           | Large font size (16px).                                                                                                                  |
| `--cinder-text-xl`          | `1.125rem`                                                                                       | Extra-large font size (18px).                                                                                                            |
| `--cinder-text-2xl`         | `1.25rem`                                                                                        | 2xl font size (20px).                                                                                                                    |
| `--cinder-text-3xl`         | `1.5rem`                                                                                         | 3xl font size (24px).                                                                                                                    |
| `--cinder-text-4xl`         | `1.875rem`                                                                                       | 4xl font size (30px).                                                                                                                    |
| `--cinder-text-5xl`         | `2.25rem`                                                                                        | 5xl font size (36px).                                                                                                                    |
| `--cinder-leading-none`     | `1`                                                                                              | No extra line height.                                                                                                                    |
| `--cinder-leading-tight`    | `1.15`                                                                                           | Tight line height for headings.                                                                                                          |
| `--cinder-leading-snug`     | `1.3`                                                                                            | Snug line height.                                                                                                                        |
| `--cinder-leading-normal`   | `1.5`                                                                                            | Default body line height.                                                                                                                |
| `--cinder-leading-relaxed`  | `1.625`                                                                                          | Relaxed line height for long-form reading.                                                                                               |
| `--cinder-tracking-tight`   | `-0.01em`                                                                                        | Tight letter-spacing, -0.01em. Expressed as a unitless number with an em recipe because DTCG dimension units are limited to px and rem.  |
| `--cinder-tracking-normal`  | `0`                                                                                              | Default letter spacing (no adjustment).                                                                                                  |
| `--cinder-tracking-wide`    | `0.02em`                                                                                         | Wide letter-spacing, 0.02em. Expressed as a unitless number with an em recipe because DTCG dimension units are limited to px and rem.    |
| `--cinder-font-normal`      | `400`                                                                                            | Normal font weight.                                                                                                                      |
| `--cinder-font-medium`      | `500`                                                                                            | Medium font weight.                                                                                                                      |
| `--cinder-font-semibold`    | `600`                                                                                            | Semibold font weight.                                                                                                                    |
| `--cinder-font-bold`        | `700`                                                                                            | Bold font weight.                                                                                                                        |
| `--cinder-type-tab-size`    | `2`                                                                                              | Tab width for monospace/code surfaces (`variant="code"` on Input/Textarea, CodeBlock). Tab characters render as this many spaces' worth. |
| `--cinder-touch-target-min` | `44px`                                                                                           | Minimum touch target size.                                                                                                               |

<!-- END GENERATED TOKEN TABLE -->

`--cinder-touch-target-min` is the WCAG AAA touch-target floor. Interactive primitives use it as a minimum height or width.

### Label/value hierarchy

Compact metadata and status pairs use one shared hierarchy: the label is
`--cinder-text-base`, semibold, full-strength text with snug leading; its value
or attached annotation is `--cinder-text-sm`, normal weight, muted text with
normal leading. Cinder components consume the internal `cinder-_label-text` and
`cinder-_value-text` recipes so all four axes move together. Primary body
content is not an annotation: keep it at the normal body size and
`--cinder-text` rather than muting it.

Use `--cinder-text-muted` for readable secondary text that remains part of the
content hierarchy. Reserve `--cinder-text-subtle` for tertiary metadata and
low-emphasis chrome; never use it for primary content or the only visible
label of a control.

## Layout

<!-- BEGIN GENERATED TOKEN TABLE: layout -->

| Token                           | Default | Description                                                                                                                                                                |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-content-width`        | `72rem` | Maximum inline size for primary page content. Caps line length and keeps content readable on wide viewports. Used by page layout styles; consumers can override per scope. |
| `--cinder-content-width-prose`  | `65ch`  | Prose column width, 65ch — caps line length at a readable measure. Expressed as a unitless number with a ch recipe because DTCG dimension units are limited to px and rem. |
| `--cinder-content-width-narrow` | `40rem` | Tighter centered column width.                                                                                                                                             |
| `--cinder-content-width-wide`   | `90rem` | Roomier centered column width.                                                                                                                                             |

<!-- END GENERATED TOKEN TABLE -->

`--cinder-content-width` caps the inline size of primary page content. It is the default width for [`Container`](../packages/components/src/components/container/container.svelte); consumers can override it globally or per scope.

`--cinder-content-width-prose`, `--cinder-content-width-narrow`, and `--cinder-content-width-wide` form the named width scale selected by [`Container`](../packages/components/src/components/container/container.svelte)'s `maxWidth` prop; omitting `maxWidth` falls back to `--cinder-content-width`. The `maxWidth="full"` keyword removes the cap entirely (`max-inline-size: none`) and maps to no token.

## Motion

Durations and easing curves. `--cinder-duration-normal` is an alias for `--cinder-duration` — both resolve to the same value. Transition durations stay separate from repeating animation durations so components like `Spinner` and indeterminate `Progress` can move at readable, intentionally slower cadences without making hover and value transitions feel sluggish. The `prefers-reduced-motion: reduce` media query collapses both transition and repeating animation duration tokens to `0ms` automatically; you do not need to handle that case yourself.

<!-- BEGIN GENERATED TOKEN TABLE: motion -->

| Token                                          | Default                          | Description                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--cinder-duration-instant`                    | `0ms`                            | Instant (no) transition duration.                                                                                                                                                                                                                                                                                              |
| `--cinder-duration-fast`                       | `120ms`                          | Fast interaction duration before a reduced-motion modifier applies.                                                                                                                                                                                                                                                            |
| `--cinder-duration`                            | `200ms`                          | Base transition duration.                                                                                                                                                                                                                                                                                                      |
| `--cinder-duration-normal`                     | `var(--cinder-duration)`         | Alias of the base transition duration.                                                                                                                                                                                                                                                                                         |
| `--cinder-duration-moderate`                   | `280ms`                          | Moderate transition duration.                                                                                                                                                                                                                                                                                                  |
| `--cinder-duration-slow`                       | `400ms`                          | Slow transition duration.                                                                                                                                                                                                                                                                                                      |
| `--cinder-duration-spin`                       | `750ms`                          | Repeating spin animation duration.                                                                                                                                                                                                                                                                                             |
| `--cinder-duration-progress-bar-indeterminate` | `1.6s`                           | Repeating indeterminate progress-bar animation duration.                                                                                                                                                                                                                                                                       |
| `--cinder-duration-progress-ring-spin`         | `1.4s`                           | Repeating progress-ring spin animation duration.                                                                                                                                                                                                                                                                               |
| `--cinder-ease-standard`                       | `cubic-bezier(0.2, 0, 0, 1)`     | Standard easing curve.                                                                                                                                                                                                                                                                                                         |
| `--cinder-ease-decelerate`                     | `cubic-bezier(0, 0, 0, 1)`       | Decelerate-in easing curve.                                                                                                                                                                                                                                                                                                    |
| `--cinder-ease-accelerate`                     | `cubic-bezier(0.3, 0, 1, 1)`     | Accelerate-out easing curve.                                                                                                                                                                                                                                                                                                   |
| `--cinder-ease-spring`                         | `cubic-bezier(0.22, 1, 0.36, 1)` | A fast, settled ease-out with no overshoot. Previously cubic-bezier(0.34, 1.56, 0.64, 1) — a back-ease whose y1=1.56 overshot to 156% of travel, which on the sheet/drawer (100%-of-panel translate) flung the panel past the viewport edge before settling. This curve keeps the snappy decelerate-in feel with no overshoot. |
| `--cinder-ease-in-out`                         | `cubic-bezier(0.4, 0, 0.2, 1)`   | Ease-in-out curve.                                                                                                                                                                                                                                                                                                             |

<!-- END GENERATED TOKEN TABLE -->

## Surfaces

Background and surface tokens for the three core elevations — page background, default surface, and raised surface — plus an inset variant for sunken regions and `hover`/`pressed` derivatives that lift or darken via `color-mix`. The light and dark ramps intentionally leave enough lightness separation for panels and their children to communicate hierarchy without relying on decorative hairlines.

<!-- BEGIN GENERATED TOKEN TABLE: surfaces -->

| Token                              | Default                                                                                                                                                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-bg`                      | `light-dark(oklch(98.4% 0.003 255), oklch(15% 0.035 245))`                                                                                                          | Page canvas background, distinct from `surface.base` (a card body). Part of the light-mode-anchors-at-white ramp: inset 0.960 -> bg 0.984 -> surface 0.994 -> raised 1.000.                                                                                                                                                                                                                                                                                                     |
| `--cinder-surface`                 | `light-dark(oklch(99.4% 0.002 255), oklch(21% 0.04 245))`                                                                                                           | Default semantic surface. Theme modifiers provide its dark value.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `--cinder-surface-raised`          | `light-dark(oklch(100% 0 255), oklch(28% 0.045 245))`                                                                                                               | Elevated semantic surface. Theme modifiers provide its dark value.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `--cinder-surface-inset`           | `light-dark(oklch(96% 0.005 255), oklch(11% 0.03 245))`                                                                                                             | Sunken region inside a card body (code blocks, wells, recessed sub-regions).                                                                                                                                                                                                                                                                                                                                                                                                    |
| `--cinder-surface-hover`           | `light-dark( color-mix(in oklch, var(--cinder-surface), var(--cinder-accent) 6%), color-mix(in oklch, var(--cinder-surface), oklch(100% 0 0) 2.5%) )`               | Hover state of the default surface. Light mode washes toward the accent rather than darkening toward black: once the light ramp is anchored at white, its four resting tiers occupy only 0.040 lightness points, so a proportional lightness-only mix would be wider than the whole ramp it has to stay clear of. A light-mode hover that washes toward the brand accent separates by chroma and hue as well, staying legible at a lightness step small enough to fit the ramp. |
| `--cinder-surface-pressed`         | `light-dark( color-mix(in oklch, var(--cinder-surface), var(--cinder-accent) 12%), color-mix(in oklch, var(--cinder-surface), oklch(100% 0 0) 6%) )`                | Pressed state of the default surface. Same accent-wash rationale as `surface.hover`, at a stronger mix percentage.                                                                                                                                                                                                                                                                                                                                                              |
| `--cinder-surface-raised-hover`    | `light-dark( color-mix(in oklch, var(--cinder-surface-raised), var(--cinder-accent) 6%), color-mix(in oklch, var(--cinder-surface-raised), oklch(100% 0 0) 2.5%) )` | Hover state of the raised surface. Light mode washes toward the accent; dark mode mixes toward white.                                                                                                                                                                                                                                                                                                                                                                           |
| `--cinder-surface-raised-pressed`  | `light-dark( color-mix(in oklch, var(--cinder-surface-raised), var(--cinder-accent) 12%), color-mix(in oklch, var(--cinder-surface-raised), oklch(100% 0 0) 6%) )`  | Pressed state of the raised surface. Light mode washes toward the accent; dark mode mixes toward white.                                                                                                                                                                                                                                                                                                                                                                         |
| `--cinder-surface-upcoming-marker` | `light-dark(var(--cinder-surface-inset), var(--cinder-surface))`                                                                                                    | Upcoming step marker background. Keeps the inset treatment in light mode (surface-inset is visibly recessed vs surface), but lifts to surface in dark mode where surface-inset is nearly invisible against the dark stage.                                                                                                                                                                                                                                                      |
| `--cinder-surface-inverse`         | `light-dark(var(--cinder-text), var(--cinder-surface-raised))`                                                                                                      | Inverse surface, used by Tooltip to stay a dark overlay in both themes. Light arm mirrors the text/surface swap (dark bg, light fg); dark arm uses the elevated surface + near-white text so the tooltip reads as a dark elevated layer rather than inverting to light.                                                                                                                                                                                                         |
| `--cinder-text-inverse`            | `light-dark(var(--cinder-surface), var(--cinder-text))`                                                                                                             | Text color for use on `surface.inverse` (Tooltip).                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `--cinder-border-inverse`          | `light-dark(transparent, var(--cinder-border-strong))`                                                                                                              | Border for surfaces using `surface.inverse` (Tooltip). Transparent in light mode; adds a 1px delineation in dark mode only.                                                                                                                                                                                                                                                                                                                                                     |

<!-- END GENERATED TOKEN TABLE -->

`--cinder-surface-upcoming-marker` is the background for Steps component upcoming-state markers. In light mode it resolves to `--cinder-surface-inset` (visibly recessed); in dark mode it lifts to `--cinder-surface` so the marker is visible against the dark stage. `--cinder-surface-inverse`, `--cinder-text-inverse`, and `--cinder-border-inverse` form the dark-overlay triple used by Tooltip — both arms render a dark overlay with legible light text (no theme inversion occurs in dark mode).

Form controls sit on `--cinder-surface-raised` in both themes. `--cinder-surface` is a page or panel surface and must never be used as an input fill. Interior component dividers use `--cinder-border-muted`; reserve `--cinder-border` for the component's outer edge. Forced-colors styles may restore system-color hairlines where background separation is unavailable.

## Text colors

Foreground colors keyed to readability against the surface tokens. `--cinder-text-disabled` meets the relaxed contrast bar for disabled UI; the others meet WCAG AA against `--cinder-surface`.

<!-- BEGIN GENERATED TOKEN TABLE: text-colors -->

| Token                    | Default                                                  | Description                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-text`          | `light-dark(oklch(20% 0.018 245), oklch(92% 0.02 245))`  | Default body text color.                                                                                                                                                                                                                                                                                                     |
| `--cinder-text-muted`    | `light-dark(oklch(32% 0.014 245), oklch(82% 0.02 245))`  | Muted (secondary) text color.                                                                                                                                                                                                                                                                                                |
| `--cinder-text-subtle`   | `light-dark(oklch(42% 0.012 245), oklch(72% 0.02 245))`  | Subtle (tertiary) text color.                                                                                                                                                                                                                                                                                                |
| `--cinder-text-disabled` | `light-dark(oklch(52% 0.01 245), oklch(64% 0.02 245))`   | Disabled text color. Clears the 3:1 UI floor in both themes even though disabled controls are exempt from WCAG text contrast; a disabled control still has to be visible as a control.                                                                                                                                       |
| `--cinder-fill-disabled` | `light-dark(oklch(86% 0.006 255), oklch(30% 0.015 245))` | Neutral fill for disabled solid controls (disabled-checked checkbox/radio) so they stop misusing `text.disabled` (a text-lightness token) as an assertive fill. The glyph on top must use `text.disabled`, not `accent.contrast`: accent-contrast is dark ink in both arms and would be near-invisible on the dark-arm fill. |

<!-- END GENERATED TOKEN TABLE -->

## Borders

<!-- BEGIN GENERATED TOKEN TABLE: borders -->

| Token                                     | Default                                                       | Description                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-border`                         | `light-dark(oklch(63% 0.006 255), oklch(58% 0.05 245))`       | Functional control boundary that clears 3:1 against supported surfaces. It is the border of the secondary Button, whose fill is `surface.raised` (pure white), so it is the only thing making that control read as a control; must not be lightened past ~0.85. |
| `--cinder-border-faint`                   | `light-dark(oklch(92% 0.003 255), oklch(33% 0.03 245))`       | Decorative-only hairline. Never use as a control boundary: it is intentionally below the WCAG 1.4.11 3:1 non-text threshold.                                                                                                                                    |
| `--cinder-border-muted`                   | `light-dark(oklch(85% 0.004 255), oklch(38% 0.04 245))`       | Decorative divider that wants less weight than `border.control`. Clears a separate 1.4:1 floor against its backdrop.                                                                                                                                            |
| `--cinder-border-strong`                  | `light-dark(oklch(60% 0.008 255), oklch(66% 0.06 245))`       | Stronger control boundary. Clears WCAG 1.4.11's 3:1 floor against every supported surface, like `border.control`.                                                                                                                                               |
| `--cinder-toggle-track-off-resting`       | `light-dark(var(--cinder-border-muted), oklch(45% 0.02 245))` | Toggle track color in the off, resting state. Light arm preserves the `border.muted` look; dark arm raises lightness for >=3:1 shape contrast against the surface.                                                                                              |
| `--cinder-toggle-track-off-hover-resting` | `light-dark(var(--cinder-border), oklch(52% 0.02 245))`       | Toggle track color in the off state on hover. Steps up from `off-resting` to be distinguishable.                                                                                                                                                                |

<!-- END GENERATED TOKEN TABLE -->

`--cinder-toggle-track-off-resting` and `--cinder-toggle-track-off-hover-resting` are the default fill colors for an unchecked Toggle track. In light mode they alias the existing muted and default border tokens. In dark mode they lift to L≈0.45 (rest) and L≈0.52 (hover) so the track has ≥3:1 shape contrast against the dark surface. The `--cinder-toggle-track-off` consumer override hook still takes priority.

`--cinder-border-faint` is for decorative internal hairlines only. It is intentionally below the 3:1 non-text contrast floor and must not be used to define a control boundary.

## Opacity

<!-- BEGIN GENERATED TOKEN TABLE: opacity -->

| Token                       | Default | Description                    |
| --------------------------- | ------- | ------------------------------ |
| `--cinder-opacity-disabled` | `0.55`  | Opacity for disabled elements. |
| `--cinder-opacity-muted`    | `0.72`  | Opacity for muted elements.    |
| `--cinder-opacity-faint`    | `0.4`   | Opacity for faint elements.    |

<!-- END GENERATED TOKEN TABLE -->

## Accent

The brand color and its derivatives. `hover` and `active` are computed from `--cinder-accent` with `oklch(from ...)`, so overriding `--cinder-accent` re-derives both. `--cinder-accent-contrast` is the foreground color for text and icons placed on top of `--cinder-accent`.

<!-- BEGIN GENERATED TOKEN TABLE: accent -->

| Token                            | Default                                                    | Description                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-accent`                | `light-dark(oklch(50% 0.22 270), oklch(72% 0.14 270))`     | Brand accent fill color.                                                                                                                                                                                                                                                                          |
| `--cinder-accent-contrast`       | `light-dark(oklch(100% 0 0), oklch(15% 0.035 245))`        | Label color for solid accent fills. Light arm flips to white (the indigo fill is dark enough); dark arm keeps dark ink against the bright dark-mode fill.                                                                                                                                         |
| `--cinder-accent-text`           | `light-dark(oklch(45% 0.22 270), oklch(72% 0.14 270))`     | Accent used as text/icon on light surfaces. The light-mode fill accent (L=0.50) reads as a foreground at only ~4.7:1, just clearing AA, so this dedicated, slightly darker foreground token stays necessary for comfortable link/icon legibility. The dark arm matches the dark-mode accent fill. |
| `--cinder-accent-text-hover`     | `oklch(from var(--cinder-accent-text) calc(l - 0.08) c h)` | Hover step for text/icon links, derived as a darker step of `accent.text` (not the bright fill-derived `accent.hover`, which is lighter than the resting text color and drops below WCAG AA on near-white).                                                                                       |
| `--cinder-accent-hover`          | `oklch(from var(--cinder-accent) calc(l - 0.08) c h)`      | Hover step for solid accent fills, derived as a darker step of `accent` (l - 0.08, c and h held constant).                                                                                                                                                                                        |
| `--cinder-accent-active`         | `oklch(from var(--cinder-accent) calc(l - 0.15) c h)`      | Active/pressed step for solid accent fills, derived as a darker step of `accent` (l - 0.15, c and h held constant).                                                                                                                                                                               |
| `--cinder-accent-active-on-fill` | `oklch(from var(--cinder-accent) calc(l - 0.11) c h)`      | Pressed fill for solid accent surfaces that carry the `accent.contrast` label (primary Button, FloatingAction). Kept distinct from `accent.active` so label-bearing and non-label consumers can diverge if ever needed.                                                                           |

<!-- END GENERATED TOKEN TABLE -->

`--cinder-accent-text` is the brand color used _as_ text/icon on a light surface. `--cinder-accent` is a deep indigo fill (`oklch(50% 0.22 270)` in light mode) that carries the white `--cinder-accent-contrast` label at 6.45:1; its bright periwinkle dark-mode arm carries the dark-ink label at 7.77:1. Foreground usages (links, accent chip/badge labels, active tab labels, selected rows, toast actions, and the current-step marker) use the dedicated `--cinder-accent-text` token, which clears 4.5:1 on every light surface. `--cinder-accent-text-hover` darkens that foreground by 0.08 lightness (light arm ≈7.9:1 on white) so links get darker on hover; links must not use the fill-derived `--cinder-accent-hover`, which does not preserve the foreground contrast contract.

`--cinder-accent-active-on-fill` is the pressed fill for solid accent surfaces that carry `--cinder-accent-contrast` labels (primary `Button`, `FloatingAction`). It darkens the light indigo arm by 0.11 to `L=0.39`, increasing white-label contrast to 10.5:1, while retaining a separate token so label-bearing and non-label consumers can diverge when needed. Accent surfaces that do not bear an on-fill label keep using `--cinder-accent-active`.

## Semantic aliases

An intent layer over the raw scale. Rather than reaching for a numeric step like `--cinder-space-2-5`, components reference what the spacing or radius is _for_ — control padding, card padding, a stack gap — so the meaning of a value travels with it and a single retune of the alias re-derives every call site. Every name here maps to a raw spacing or radius token and exists as a `:root` variable in `tokens-base.css`.

<!-- BEGIN GENERATED TOKEN TABLE: semantic-aliases -->

| Token                     | Default                   | Description                          |
| ------------------------- | ------------------------- | ------------------------------------ |
| `--cinder-pad-control`    | `var(--cinder-space-2-5)` | Default control padding.             |
| `--cinder-pad-card`       | `var(--cinder-space-4)`   | Default card padding.                |
| `--cinder-gap-stack`      | `var(--cinder-space-3)`   | Default vertical stack gap.          |
| `--cinder-gap-inline`     | `var(--cinder-space-2)`   | Default inline gap.                  |
| `--cinder-radius-control` | `var(--cinder-radius-md)` | Default control corner radius alias. |
| `--cinder-radius-surface` | `var(--cinder-radius-lg)` | Default surface corner radius alias. |

<!-- END GENERATED TOKEN TABLE -->

## Status — solid

Single-value status tokens for solid fills like badges and dot indicators. For soft-tinted surfaces (Alert, Toast, Callout) use the semantic triples below instead.

<!-- BEGIN GENERATED TOKEN TABLE: status-solid -->

| Token                       | Default                                                 | Description                                                                                                                                            |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--cinder-info`             | `light-dark(oklch(50% 0.098 230), oklch(78% 0.13 230))` | Info status fill color.                                                                                                                                |
| `--cinder-success`          | `light-dark(oklch(50% 0.157 145), oklch(78% 0.14 145))` | Success status fill color.                                                                                                                             |
| `--cinder-warning`          | `light-dark(oklch(54% 0.113 75), oklch(82% 0.156 75))`  | Warning status fill color.                                                                                                                             |
| `--cinder-danger`           | `light-dark(oklch(50% 0.202 25), oklch(72% 0.172 25))`  | Danger status fill color.                                                                                                                              |
| `--cinder-danger-contrast`  | `light-dark(oklch(100% 0 0), oklch(12% 0.02 25))`       | Label color for solid danger fills. Dark-mode danger is ~72% lightness; pure white fails WCAG AA on it, so the dark arm uses a near-black ink instead. |
| `--cinder-danger-hover`     | `light-dark(oklch(42% 0.171 25), oklch(64% 0.172 25))`  | Hover step for solid danger fills, explicitly authored and fitted to the in-gamut chroma maximum at this lightness.                                    |
| `--cinder-danger-active`    | `light-dark(oklch(35% 0.142 25), oklch(60% 0.172 25))`  | Active/pressed step for solid danger fills, explicitly authored and fitted to the in-gamut chroma maximum at this lightness.                           |
| `--cinder-info-hover`       | `light-dark(oklch(42% 0.079 230), oklch(70% 0.13 230))` | Hover step for solid info fills.                                                                                                                       |
| `--cinder-info-active`      | `light-dark(oklch(35% 0.065 230), oklch(62% 0.12 230))` | Active/pressed step for solid info fills.                                                                                                              |
| `--cinder-success-hover`    | `light-dark(oklch(42% 0.12 145), oklch(70% 0.14 145))`  | Hover step for solid success fills.                                                                                                                    |
| `--cinder-success-active`   | `light-dark(oklch(35% 0.1 145), oklch(62% 0.14 145))`   | Active/pressed step for solid success fills.                                                                                                           |
| `--cinder-warning-hover`    | `light-dark(oklch(42% 0.08 75), oklch(74% 0.156 75))`   | Hover step for solid warning fills.                                                                                                                    |
| `--cinder-warning-active`   | `light-dark(oklch(38% 0.07 75), oklch(66% 0.13 75))`    | Active/pressed step for solid warning fills.                                                                                                           |
| `--cinder-success-contrast` | `light-dark(oklch(100% 0 0), oklch(15% 0.03 145))`      | Label color for solid success fills.                                                                                                                   |
| `--cinder-warning-contrast` | `light-dark(oklch(100% 0 0), oklch(20% 0.04 75))`       | Label color for solid warning fills.                                                                                                                   |
| `--cinder-info-contrast`    | `light-dark(oklch(100% 0 0), oklch(15% 0.03 230))`      | Label color for solid info fills.                                                                                                                      |

<!-- END GENERATED TOKEN TABLE -->

The `*-contrast` tokens are the foreground color for text and icons placed on a solid status fill (e.g. a pressed semantic chip). In light mode the accents are dark enough for white text; in dark mode they sit at high lightness, so a dark same-hue color wins. All clear WCAG AA (≥4.5:1) against their paired accent.

## Status — semantic triples

Foreground / background / border triples for soft tinted surfaces. Use these in Alert, Toast, Callout, and anywhere else you need a status surface with semantically-paired text and border.

<!-- BEGIN GENERATED TOKEN TABLE: status-semantic-triples -->

| Token                           | Default                                                                                                | Description                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-color-info-bg`        | `light-dark(oklch(94.5% 0.03 230), oklch(28% 0.057 230))`                                              | Soft info-tinted surface background.                                                                                                                    |
| `--cinder-color-info-fg`        | `light-dark(oklch(40% 0.079 230), oklch(88% 0.071 230))`                                               | Foreground color on the soft info surface.                                                                                                              |
| `--cinder-color-info-border`    | `light-dark(oklch(80% 0.05 230), oklch(45% 0.08 230))`                                                 | Border color on the soft info surface.                                                                                                                  |
| `--cinder-color-success-bg`     | `light-dark(oklch(94.5% 0.045 145), oklch(28% 0.07 145))`                                              | Soft success-tinted surface background.                                                                                                                 |
| `--cinder-color-success-fg`     | `light-dark(oklch(40% 0.127 145), oklch(88% 0.11 145))`                                                | Foreground color on the soft success surface.                                                                                                           |
| `--cinder-color-success-border` | `light-dark(oklch(80% 0.05 145), oklch(45% 0.09 145))`                                                 | Border color on the soft success surface.                                                                                                               |
| `--cinder-color-warning-bg`     | `light-dark(oklch(94.5% 0.042 75), oklch(28% 0.06 75))`                                                | Soft warning-tinted surface background.                                                                                                                 |
| `--cinder-color-warning-fg`     | `light-dark(oklch(40% 0.085 75), oklch(90% 0.08 75))`                                                  | Foreground color on the soft warning surface.                                                                                                           |
| `--cinder-color-warning-border` | `light-dark(oklch(80% 0.06 75), oklch(50% 0.1 75))`                                                    | Border color on the soft warning surface.                                                                                                               |
| `--cinder-color-danger-bg`      | `light-dark(oklch(94.5% 0.026 25), oklch(28% 0.09 25))`                                                | Soft danger-tinted surface background.                                                                                                                  |
| `--cinder-color-danger-fg`      | `light-dark(oklch(42% 0.16 25), oklch(90% 0.05 25))`                                                   | Foreground color on the soft danger surface.                                                                                                            |
| `--cinder-color-danger-border`  | `light-dark(oklch(80% 0.06 25), oklch(50% 0.11 25))`                                                   | Border color on the soft danger surface.                                                                                                                |
| `--cinder-color-neutral-bg`     | `light-dark(oklch(94.5% 0.004 255), oklch(28% 0.04 245))`                                              | Soft neutral-tinted surface background. Neutral retains the status-triple shape so components never need ad hoc surface mixing for the default variant. |
| `--cinder-color-neutral-fg`     | `var(--cinder-text)`                                                                                   | Foreground color on the soft neutral surface.                                                                                                           |
| `--cinder-color-neutral-border` | `var(--cinder-border)`                                                                                 | Border color on the soft neutral surface.                                                                                                               |
| `--cinder-color-accent-bg`      | `color-mix(in oklch, var(--cinder-accent), var(--cinder-surface) 88%)`                                 | Soft accent-tinted background, mixed 88% toward the current surface.                                                                                    |
| `--cinder-color-accent-fg`      | `var(--cinder-accent-text)`                                                                            | Foreground color on the soft accent surface.                                                                                                            |
| `--cinder-color-accent-border`  | `color-mix(in oklch, var(--cinder-accent), transparent 60%)`                                           | Soft accent-tinted border, the accent color mixed 60% toward transparent.                                                                               |
| `--cinder-color-info-muted`     | `oklch( from color-mix(in oklch, var(--cinder-info), var(--cinder-surface) 36%) l min(c, 0.05) h )`    | Info color moved toward the current surface. Derived in one polarity-aware recipe shared by all four status colors.                                     |
| `--cinder-color-info-subtle`    | `oklch( from color-mix(in oklch, var(--cinder-info), var(--cinder-text) 36%) l min(c, 0.05) h )`       | Info color moved toward the current text color. Derived in one polarity-aware recipe shared by all four status colors.                                  |
| `--cinder-color-success-muted`  | `oklch( from color-mix(in oklch, var(--cinder-success), var(--cinder-surface) 36%) l min(c, 0.05) h )` | Success color moved toward the current surface. Derived in one polarity-aware recipe shared by all four status colors.                                  |
| `--cinder-color-success-subtle` | `oklch( from color-mix(in oklch, var(--cinder-success), var(--cinder-text) 36%) l min(c, 0.05) h )`    | Success color moved toward the current text color. Derived in one polarity-aware recipe shared by all four status colors.                               |
| `--cinder-color-warning-muted`  | `oklch( from color-mix(in oklch, var(--cinder-warning), var(--cinder-surface) 36%) l min(c, 0.05) h )` | Warning color moved toward the current surface. Derived in one polarity-aware recipe shared by all four status colors.                                  |
| `--cinder-color-warning-subtle` | `oklch( from color-mix(in oklch, var(--cinder-warning), var(--cinder-text) 36%) l min(c, 0.05) h )`    | Warning color moved toward the current text color. Derived in one polarity-aware recipe shared by all four status colors.                               |
| `--cinder-color-danger-muted`   | `oklch( from color-mix(in oklch, var(--cinder-danger), var(--cinder-surface) 36%) l min(c, 0.05) h )`  | Danger color moved toward the current surface. Derived in one polarity-aware recipe shared by all four status colors.                                   |
| `--cinder-color-danger-subtle`  | `oklch( from color-mix(in oklch, var(--cinder-danger), var(--cinder-text) 36%) l min(c, 0.05) h )`     | Danger color moved toward the current text color. Derived in one polarity-aware recipe shared by all four status colors.                                |

<!-- END GENERATED TOKEN TABLE -->

## Transparency checkerboard

Shared checkerboard colors for color-domain components that need to show alpha over a structural pattern.

<!-- BEGIN GENERATED TOKEN TABLE: transparency-checkerboard -->

| Token                         | Default                                 | Description                                                                                                                                                                                                           |
| ----------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-color-checker-base` | `light-dark(#fff, oklch(28% 0.02 245))` | Transparency checkerboard base tile, shared by color-domain components. Light mode preserves the historical white/gray grid; dark mode keeps the pattern visible without flashing a white backing inside dark chrome. |
| `--cinder-color-checker-tile` | `light-dark(#ccc, oklch(38% 0.02 245))` | Transparency checkerboard alternate tile.                                                                                                                                                                             |

<!-- END GENERATED TOKEN TABLE -->

## Chart series

Categorical chart colors for LineChart, BarChart, AreaChart, and consumers that need to keep custom chart marks aligned with cinder's default series palette.

Each `--cinder-chart-series-*` is a theme-aware design token: it wraps independently selected per-theme OKLCH values in `light-dark()`. Light-mode marks are generally darker for pale surfaces, while dark-mode marks are lighter for dark surfaces; hue and chroma both vary as needed for contrast and separation. The index keeps its position in the series sequence while the palette remaps it for the active theme.

<!-- BEGIN GENERATED TOKEN TABLE: chart-series -->

| Token                     | Default                                                  | Description     |
| ------------------------- | -------------------------------------------------------- | --------------- |
| `--cinder-chart-series-1` | `light-dark(oklch(33% 0.121 8), oklch(58% 0.089 205))`   | Chart series 1. |
| `--cinder-chart-series-2` | `light-dark(oklch(36% 0.069 80), oklch(67% 0.275 330))`  | Chart series 2. |
| `--cinder-chart-series-3` | `light-dark(oklch(40% 0.082 160), oklch(69% 0.182 44))`  | Chart series 3. |
| `--cinder-chart-series-4` | `light-dark(oklch(45% 0.087 235), oklch(70% 0.144 160))` | Chart series 4. |
| `--cinder-chart-series-5` | `light-dark(oklch(53% 0.218 330), oklch(78% 0.12 8))`    | Chart series 5. |
| `--cinder-chart-series-6` | `light-dark(oklch(56% 0.148 44), oklch(81% 0.152 80))`   | Chart series 6. |
| `--cinder-chart-series-7` | `light-dark(oklch(59% 0.126 120), oklch(85% 0.078 235))` | Chart series 7. |
| `--cinder-chart-series-8` | `light-dark(oklch(63% 0.098 205), oklch(89% 0.19 120))`  | Chart series 8. |

<!-- END GENERATED TOKEN TABLE -->

## Focus ring

The ring tokens drive the focus-visible outline used across interactive primitives. See [`focus-ring-policy.md`](./focus-ring-policy.md) for when components are expected to render the ring vs. when they delegate to the user agent.

<!-- BEGIN GENERATED TOKEN TABLE: focus-ring -->

| Token                        | Default                                                                                                   | Description                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-ring-width`        | `2px`                                                                                                     | Focus ring stroke width. A floor, not a preference: WCAG 2.4.13 wants an indicator at least as large as a 2px-thick perimeter of the control.                                                                                                                                                                                               |
| `--cinder-ring-offset`       | `2px`                                                                                                     | Focus ring offset from the control edge.                                                                                                                                                                                                                                                                                                    |
| `--cinder-ring-offset-color` | `var(--cinder-surface-raised)`                                                                            | Focus ring offset band color. The ring is a two-stop box-shadow and box-shadow cannot paint a transparent gap, so the offset band has to be some real color. Pinned to `surface.raised` (the top of the ramp) so the band disappears into raised surfaces, where controls overwhelmingly live, and reads as a light halo on recessed tiers. |
| `--cinder-ring-color`        | `light-dark( oklch(from var(--cinder-accent) 0.55 0.16 h), oklch(from var(--cinder-accent) 0.7 0.14 h) )` | Focus ring color, relative to `accent` so a consumer override re-derives the ring hue. Light arm clamps L to 0.55 for 3.56:1 against the widened ramp's darkest surface; `h` tracks the accent hue.                                                                                                                                         |
| `--cinder-ring-on-accent`    | `light-dark(oklch(15% 0.035 245), oklch(100% 0 0))`                                                       | Ring color tuned for use on solid accent/fill surfaces (FloatingAction primary variant). Light arm is a near-black that contrasts both the accent fill and the page background; dark arm is a near-white that contrasts the bright dark-mode accent and the dark page background.                                                           |

<!-- END GENERATED TOKEN TABLE -->

`--cinder-ring-on-accent` is a high-contrast focus ring for solid accent-fill surfaces (e.g. the primary `FloatingAction`). It uses dark ink in light mode and white in dark mode, contrasting with both the accent fill and surrounding surface. Regular interactive elements on neutral surfaces use `--cinder-ring-color` instead.

## Z-index layers

Stacking order is fixed: tooltip < dropdown ≈ popover < backdrop < modal ≈ drawer < toast < focused affordance < drag preview. The standalone `Backdrop` scrim sits just below modal and drawer so it can dim popover-layer chrome while staying beneath dialog surfaces (Modal and Drawer are built on the native `<dialog>` element and render their own scrim via `::backdrop` rather than this layer). Toast sits above modal so confirmations and warnings still reach the user when a modal is open, while the active drag preview remains attached to the pointer above every surface. Override these only if you are integrating cinder into an app with its own established stacking contract.

The token table is the single source of truth. A `z-index` reference must use
`var(--cinder-z-*)` without an inline fallback; otherwise a partial stylesheet
can silently put two components that name the same layer at different heights.
Component-local stacking may use `auto`, `0`, or `1`. A higher local relationship needs
an adjacent `cinder-z-index-local:` reason so Stylelint can distinguish it from
a new global layer.

<!-- BEGIN GENERATED TOKEN TABLE: z-index-layers -->

| Token                           | Default | Description                                                                      |
| ------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `--cinder-z-tooltip`            | `1000`  | Tooltip layer.                                                                   |
| `--cinder-z-dropdown`           | `1100`  | Dropdown layer.                                                                  |
| `--cinder-z-popover`            | `1100`  | Popover layer.                                                                   |
| `--cinder-z-backdrop`           | `1150`  | Modal/drawer backdrop layer.                                                     |
| `--cinder-z-modal`              | `1200`  | Modal/drawer panel layer.                                                        |
| `--cinder-z-toast`              | `1300`  | Toast layer, above modal so confirmations reach users even when a modal is open. |
| `--cinder-z-focused-affordance` | `1350`  | Focused-affordance layer.                                                        |
| `--cinder-z-drag-preview`       | `1400`  | Drag-preview layer, the topmost tier.                                            |

<!-- END GENERATED TOKEN TABLE -->

## Overlay surfaces

Shared backdrop, blur, padding, and radius for Modal, Drawer, and Popover. Adjust these once and every overlay primitive picks up the change.

<!-- BEGIN GENERATED TOKEN TABLE: overlay-surfaces -->

| Token                       | Default                                                            | Description                   |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| `--cinder-overlay-backdrop` | `light-dark(oklch(20% 0.03 245 / 0.5), oklch(8% 0.02 245 / 0.65))` | Overlay backdrop scrim color. |
| `--cinder-overlay-blur`     | `4px`                                                              | Overlay backdrop blur radius. |
| `--cinder-overlay-padding`  | `var(--cinder-space-6)`                                            | Overlay panel padding.        |
| `--cinder-overlay-radius`   | `var(--cinder-radius-lg)`                                          | Overlay panel corner radius.  |

<!-- END GENERATED TOKEN TABLE -->

## Scrollbars

Themed native scrollbars for components that opt in via `scrollbar-width` and `::-webkit-scrollbar-*` (notably `ScrollArea`). The thumb alphas are tuned so resolved thumb-on-surface contrast clears WCAG 1.4.11 (3:1) over the common light- and dark-mode surface tokens.

<!-- BEGIN GENERATED TOKEN TABLE: scrollbars -->

| Token                            | Default                                                    | Description                  |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------- |
| `--cinder-scrollbar-size`        | `0.625rem`                                                 | Scrollbar thickness.         |
| `--cinder-scrollbar-track`       | `light-dark(oklch(0% 0 0 / 0.04), oklch(100% 0 0 / 0.04))` | Scrollbar track color.       |
| `--cinder-scrollbar-thumb`       | `light-dark(oklch(0% 0 0 / 0.45), oklch(100% 0 0 / 0.45))` | Scrollbar thumb color.       |
| `--cinder-scrollbar-thumb-hover` | `light-dark(oklch(0% 0 0 / 0.65), oklch(100% 0 0 / 0.65))` | Scrollbar thumb hover color. |

<!-- END GENERATED TOKEN TABLE -->

## Button

Component-specific tokens for [`Button`](../packages/components/src/components/button.svelte). The base trio (`bg`, `fg`, `border`) defines the secondary-variant defaults; size tokens scale padding, height, font, and radius across `xs`/`sm`/`md`/`lg`/`xl`. `md` is the AAA touch-target size (44px); `xs` and `sm` are intentionally below AAA — see [`button.a11y.md`](../packages/components/src/components/button.a11y.md) for the rationale.

### Base

<!-- BEGIN GENERATED TOKEN TABLE: button-base -->

| Token                    | Default                                                         | Description                             |
| ------------------------ | --------------------------------------------------------------- | --------------------------------------- |
| `--cinder-button-bg`     | `var(--cinder-surface-raised)`                                  | Secondary (default) button fill.        |
| `--cinder-button-fg`     | `var(--cinder-text)`                                            | Secondary (default) button label color. |
| `--cinder-button-border` | `light-dark(var(--cinder-border), var(--cinder-border-strong))` | Secondary (default) button border.      |
| `--cinder-button-radius` | `var(--cinder-radius-md)`                                       | Default button corner radius.           |

<!-- END GENERATED TOKEN TABLE -->

### Size: xs

<!-- BEGIN GENERATED TOKEN TABLE: button-size-xs -->

| Token                          | Default                           | Description                                                                |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------------------- |
| `--cinder-button-padding-x-xs` | `var(--cinder-space-1-5)`         | Extra-small button horizontal padding.                                     |
| `--cinder-button-padding-y-xs` | `var(--cinder-space-0-5)`         | Extra-small button vertical padding.                                       |
| `--cinder-button-height-xs`    | `var(--cinder-control-height-xs)` | Extra-small button height (24px), aliasing the shared control-height tier. |
| `--cinder-button-font-size-xs` | `var(--cinder-text-xs)`           | Extra-small button label font size.                                        |
| `--cinder-button-radius-xs`    | `var(--cinder-radius-sm)`         | Extra-small button corner radius.                                          |

<!-- END GENERATED TOKEN TABLE -->

### Size: sm

<!-- BEGIN GENERATED TOKEN TABLE: button-size-sm -->

| Token                          | Default                   | Description                      |
| ------------------------------ | ------------------------- | -------------------------------- |
| `--cinder-button-padding-x-sm` | `var(--cinder-space-2)`   | Small button horizontal padding. |
| `--cinder-button-padding-y-sm` | `var(--cinder-space-1)`   | Small button vertical padding.   |
| `--cinder-button-height-sm`    | `1.75rem`                 | Small button height (28px).      |
| `--cinder-button-font-size-sm` | `var(--cinder-text-sm)`   | Small button label font size.    |
| `--cinder-button-radius-sm`    | `var(--cinder-radius-sm)` | Small button corner radius.      |

<!-- END GENERATED TOKEN TABLE -->

### Size: md

<!-- BEGIN GENERATED TOKEN TABLE: button-size-md -->

| Token                          | Default                   | Description                       |
| ------------------------------ | ------------------------- | --------------------------------- |
| `--cinder-button-padding-x-md` | `var(--cinder-space-2-5)` | Medium button horizontal padding. |
| `--cinder-button-padding-y-md` | `var(--cinder-space-1-5)` | Medium button vertical padding.   |
| `--cinder-button-height-md`    | `2rem`                    | Medium button height (32px).      |
| `--cinder-button-font-size-md` | `var(--cinder-text-sm)`   | Medium button label font size.    |
| `--cinder-button-radius-md`    | `var(--cinder-radius-md)` | Medium button corner radius.      |

<!-- END GENERATED TOKEN TABLE -->

### Size: lg

<!-- BEGIN GENERATED TOKEN TABLE: button-size-lg -->

| Token                          | Default                   | Description                      |
| ------------------------------ | ------------------------- | -------------------------------- |
| `--cinder-button-padding-x-lg` | `var(--cinder-space-3)`   | Large button horizontal padding. |
| `--cinder-button-padding-y-lg` | `var(--cinder-space-2)`   | Large button vertical padding.   |
| `--cinder-button-height-lg`    | `2.25rem`                 | Large button height (36px).      |
| `--cinder-button-font-size-lg` | `var(--cinder-text-md)`   | Large button label font size.    |
| `--cinder-button-radius-lg`    | `var(--cinder-radius-md)` | Large button corner radius.      |

<!-- END GENERATED TOKEN TABLE -->

### Size: xl

<!-- BEGIN GENERATED TOKEN TABLE: button-size-xl -->

| Token                          | Default                   | Description                            |
| ------------------------------ | ------------------------- | -------------------------------------- |
| `--cinder-button-padding-x-xl` | `var(--cinder-space-3-5)` | Extra-large button horizontal padding. |
| `--cinder-button-padding-y-xl` | `var(--cinder-space-2-5)` | Extra-large button vertical padding.   |
| `--cinder-button-height-xl`    | `2.5rem`                  | Extra-large button height (40px).      |
| `--cinder-button-font-size-xl` | `var(--cinder-text-lg)`   | Extra-large button label font size.    |
| `--cinder-button-radius-xl`    | `var(--cinder-radius-md)` | Extra-large button corner radius.      |

<!-- END GENERATED TOKEN TABLE -->
