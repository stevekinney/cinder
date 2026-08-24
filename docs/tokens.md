# Design tokens

cinder ships its design tokens as plain CSS custom properties on `:root`. Every token has a `--cinder-*` prefix; that prefix is the public surface, and you can override any of them at `:root` (globally) or on any ancestor selector (scoped) to reskin the system. Internal-only custom properties use `--_cinder-*`; those are not part of the contract and may change without notice.

This file is hand-maintained. It is the source of truth for what cinder exposes; the CSS files in `packages/components/src/styles/` are the source of truth for the values. A drift test in [`tokens-doc-drift.test.ts`](../packages/components/src/styles/tokens-doc-drift.test.ts) keeps the two in sync — if you add, remove, or rename a token, update both this doc and the CSS, or CI will fail.

All tokens are declared in [`tokens-base.css`](../packages/components/src/styles/tokens-base.css). The aggregator [`tokens.css`](../packages/components/src/styles/tokens.css) imports the base file and is the entry point components consume.

> [!NOTE]
> Color tokens use [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) keyed off `color-scheme`. The default `:root` sets `color-scheme: light dark`, which means the browser picks based on the user's OS preference. Force a whole-page scheme with `data-theme="light"` or `data-theme="dark"` on `:root`. For scoped theme islands, put `[data-theme='light']` or `[data-theme='dark']` on the subtree; cinder redeclares the core semantic surface, text, border, overlay, interaction, status, and control tokens there so components inherit concrete local values instead of requiring consumer token pinning.

## Spacing

Rem-based spacing scale. Use these for padding, gap, margin — anywhere you'd otherwise hardcode a pixel value.

| Token                | Default    |
| -------------------- | ---------- |
| `--cinder-space-0`   | `0`        |
| `--cinder-space-0-5` | `0.125rem` |
| `--cinder-space-1`   | `0.25rem`  |
| `--cinder-space-1-5` | `0.375rem` |
| `--cinder-space-2`   | `0.5rem`   |
| `--cinder-space-2-5` | `0.625rem` |
| `--cinder-space-3`   | `0.75rem`  |
| `--cinder-space-3-5` | `0.875rem` |
| `--cinder-space-4`   | `1rem`     |
| `--cinder-space-5`   | `1.25rem`  |
| `--cinder-space-6`   | `1.5rem`   |
| `--cinder-space-7`   | `1.75rem`  |
| `--cinder-space-8`   | `2rem`     |
| `--cinder-space-10`  | `2.5rem`   |
| `--cinder-space-12`  | `3rem`     |
| `--cinder-space-16`  | `4rem`     |
| `--cinder-space-20`  | `5rem`     |
| `--cinder-space-24`  | `6rem`     |
| `--cinder-space-32`  | `8rem`     |

## Radii and shadows

Corner radii and elevation shadows. `--cinder-radius-full` produces a pill or circle depending on the element's aspect ratio.

Shadow tokens wrap each color argument in `light-dark()` so dark mode paints a light-neutral elevation instead of invisible black-on-dark. The offsets, blur radii, and spread radii are identical across themes; `--cinder-shadow-sm` carries a second hairline layer for deeper, crisper elevation, and the alphas were raised — in both arms for `--cinder-shadow-sm` and in the dark arms only for `--cinder-shadow-md` and `--cinder-shadow-lg`. Only those alphas, the new `sm` layer, and the per-theme color values branch. Overlay surfaces that sit above already-elevated dark UI can use `--cinder-shadow-overlay`, which keeps a dark shadow in both themes to avoid a glow halo.

| Token                     | Default                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-radius-sm`      | `0.375rem`                                                                                                                                           |
| `--cinder-radius-md`      | `0.5rem`                                                                                                                                             |
| `--cinder-radius-lg`      | `0.75rem`                                                                                                                                            |
| `--cinder-radius-full`    | `9999px`                                                                                                                                             |
| `--cinder-shadow-sm`      | `0 1px 2px light-dark(oklch(0% 0 0 / 0.1), oklch(100% 0 0 / 0.09)), 0 1px 1px light-dark(oklch(0% 0 0 / 0.06), oklch(100% 0 0 / 0.05))`              |
| `--cinder-shadow-md`      | `0 4px 6px -1px light-dark(oklch(0% 0 0 / 0.12), oklch(100% 0 0 / 0.09)), 0 2px 4px -2px light-dark(oklch(0% 0 0 / 0.1), oklch(100% 0 0 / 0.06))`    |
| `--cinder-shadow-lg`      | `0 10px 15px -3px light-dark(oklch(0% 0 0 / 0.14), oklch(100% 0 0 / 0.11)), 0 4px 6px -4px light-dark(oklch(0% 0 0 / 0.12), oklch(100% 0 0 / 0.07))` |
| `--cinder-shadow-overlay` | `0 10px 15px -3px light-dark(oklch(0% 0 0 / 0.14), oklch(0% 0 0 / 0.45)), 0 4px 6px -4px light-dark(oklch(0% 0 0 / 0.12), oklch(0% 0 0 / 0.32))`     |

## Control heights

Shared height tier for any interactive control that needs to align with its siblings in a toolbar, button group, or form row. Per-component height tokens (e.g. `--cinder-button-height-sm`) alias this family where their values match so the tiers stay in sync as the design system grows. Adoption is opt-in: existing call sites that pass `size="sm"` keep rendering at their pre-existing dimensions until they opt in via a `density` prop.

| Token                        | Default   |
| ---------------------------- | --------- |
| `--cinder-control-height-xs` | `1.5rem`  |
| `--cinder-control-height-sm` | `2rem`    |
| `--cinder-control-height-lg` | `2.75rem` |

## Typography

Font stacks, type scale, line heights, letter spacing, and weights. The base font size is `0.875rem` (`--cinder-text-base`) — slightly smaller than the browser default, tuned for dense application UI.

| Token                       | Default                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `--cinder-font-sans`        | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif` |
| `--cinder-font-mono`        | `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`         |
| `--cinder-text-2xs`         | `0.6875rem`                                                                                      |
| `--cinder-text-xs`          | `0.75rem`                                                                                        |
| `--cinder-text-sm`          | `0.8125rem`                                                                                      |
| `--cinder-text-base`        | `0.875rem`                                                                                       |
| `--cinder-text-md`          | `0.9375rem`                                                                                      |
| `--cinder-text-lg`          | `1rem`                                                                                           |
| `--cinder-text-xl`          | `1.125rem`                                                                                       |
| `--cinder-text-2xl`         | `1.25rem`                                                                                        |
| `--cinder-text-3xl`         | `1.5rem`                                                                                         |
| `--cinder-text-4xl`         | `1.875rem`                                                                                       |
| `--cinder-text-5xl`         | `2.25rem`                                                                                        |
| `--cinder-leading-none`     | `1`                                                                                              |
| `--cinder-leading-tight`    | `1.15`                                                                                           |
| `--cinder-leading-snug`     | `1.3`                                                                                            |
| `--cinder-leading-normal`   | `1.5`                                                                                            |
| `--cinder-leading-relaxed`  | `1.625`                                                                                          |
| `--cinder-tracking-tight`   | `-0.01em`                                                                                        |
| `--cinder-tracking-normal`  | `0`                                                                                              |
| `--cinder-tracking-wide`    | `0.02em`                                                                                         |
| `--cinder-font-normal`      | `400`                                                                                            |
| `--cinder-font-medium`      | `500`                                                                                            |
| `--cinder-font-semibold`    | `600`                                                                                            |
| `--cinder-font-bold`        | `700`                                                                                            |
| `--cinder-code-tab-size`    | `2`                                                                                              |
| `--cinder-touch-target-min` | `44px`                                                                                           |

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

| Token                           | Default |
| ------------------------------- | ------- |
| `--cinder-content-width`        | `72rem` |
| `--cinder-content-width-prose`  | `65ch`  |
| `--cinder-content-width-narrow` | `40rem` |
| `--cinder-content-width-wide`   | `90rem` |

`--cinder-content-width` caps the inline size of primary page content. It is the default width for [`Container`](../packages/components/src/components/container/container.svelte); consumers can override it globally or per scope.

`--cinder-content-width-prose`, `--cinder-content-width-narrow`, and `--cinder-content-width-wide` form the named width scale selected by [`Container`](../packages/components/src/components/container/container.svelte)'s `maxWidth` prop; omitting `maxWidth` falls back to `--cinder-content-width`. The `maxWidth="full"` keyword removes the cap entirely (`max-inline-size: none`) and maps to no token.

## Motion

Durations and easing curves. `--cinder-duration-normal` is an alias for `--cinder-duration` — both resolve to the same value. Transition durations stay separate from repeating animation durations so components like `Spinner` and indeterminate `Progress` can move at readable, intentionally slower cadences without making hover and value transitions feel sluggish. The `prefers-reduced-motion: reduce` media query collapses both transition and repeating animation duration tokens to `0ms` automatically; you do not need to handle that case yourself.

| Token                                          | Default                        |
| ---------------------------------------------- | ------------------------------ |
| `--cinder-duration-instant`                    | `0ms`                          |
| `--cinder-duration-fast`                       | `120ms`                        |
| `--cinder-duration`                            | `200ms`                        |
| `--cinder-duration-normal`                     | `var(--cinder-duration)`       |
| `--cinder-duration-moderate`                   | `280ms`                        |
| `--cinder-duration-slow`                       | `400ms`                        |
| `--cinder-duration-spin`                       | `750ms`                        |
| `--cinder-duration-progress-bar-indeterminate` | `1.6s`                         |
| `--cinder-duration-progress-ring-spin`         | `1.4s`                         |
| `--cinder-ease-standard`                       | `cubic-bezier(0.2, 0, 0, 1)`   |
| `--cinder-ease-decelerate`                     | `cubic-bezier(0, 0, 0, 1)`     |
| `--cinder-ease-accelerate`                     | `cubic-bezier(0.3, 0, 1, 1)`   |
| `--cinder-ease-spring`                         | `cubic-bezier(0.22,1,0.36,1)`  |
| `--cinder-ease-in-out`                         | `cubic-bezier(0.4, 0, 0.2, 1)` |

## Surfaces

Background and surface tokens for the three core elevations — page background, default surface, and raised surface — plus an inset variant for sunken regions and `hover`/`pressed` derivatives that lift or darken via `color-mix`. The light and dark ramps intentionally leave enough lightness separation for panels and their children to communicate hierarchy without relying on decorative hairlines.

| Token                              | Default                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cinder-bg`                      | `light-dark(oklch(98.4% 0.003 255),oklch(15% 0.035 245))`                                                                                                  |
| `--cinder-surface`                 | `light-dark(oklch(99.4% 0.002 255),oklch(21% 0.04 245))`                                                                                                   |
| `--cinder-surface-raised`          | `light-dark(oklch(100% 0 255),oklch(28% 0.045 245))`                                                                                                       |
| `--cinder-surface-inset`           | `light-dark(oklch(96% 0.005 255),oklch(11% 0.03 245))`                                                                                                     |
| `--cinder-surface-hover`           | `light-dark(color-mix(in oklch,var(--cinder-surface),var(--cinder-accent)6%),color-mix(in oklch,var(--cinder-surface),oklch(100% 0 0)2.5%))`               |
| `--cinder-surface-pressed`         | `light-dark(color-mix(in oklch,var(--cinder-surface),var(--cinder-accent)12%),color-mix(in oklch,var(--cinder-surface),oklch(100% 0 0)6%))`                |
| `--cinder-surface-raised-hover`    | `light-dark(color-mix(in oklch,var(--cinder-surface-raised),var(--cinder-accent)6%),color-mix(in oklch,var(--cinder-surface-raised),oklch(100% 0 0)2.5%))` |
| `--cinder-surface-raised-pressed`  | `light-dark(color-mix(in oklch,var(--cinder-surface-raised),var(--cinder-accent)12%),color-mix(in oklch,var(--cinder-surface-raised),oklch(100% 0 0)6%))`  |
| `--cinder-surface-upcoming-marker` | `light-dark(var(--cinder-surface-inset), var(--cinder-surface))`                                                                                           |
| `--cinder-surface-inverse`         | `light-dark(var(--cinder-text), var(--cinder-surface-raised))`                                                                                             |
| `--cinder-text-inverse`            | `light-dark(var(--cinder-surface), var(--cinder-text))`                                                                                                    |
| `--cinder-border-inverse`          | `light-dark(transparent, var(--cinder-border-strong))`                                                                                                     |

`--cinder-surface-upcoming-marker` is the background for Steps component upcoming-state markers. In light mode it resolves to `--cinder-surface-inset` (visibly recessed); in dark mode it lifts to `--cinder-surface` so the marker is visible against the dark stage. `--cinder-surface-inverse`, `--cinder-text-inverse`, and `--cinder-border-inverse` form the dark-overlay triple used by Tooltip — both arms render a dark overlay with legible light text (no theme inversion occurs in dark mode).

Form controls sit on `--cinder-surface-raised` in both themes. `--cinder-surface` is a page or panel surface and must never be used as an input fill. Interior component dividers use `--cinder-border-muted`; reserve `--cinder-border` for the component's outer edge. Forced-colors styles may restore system-color hairlines where background separation is unavailable.

## Text colors

Foreground colors keyed to readability against the surface tokens. `--cinder-text-disabled` meets the relaxed contrast bar for disabled UI; the others meet WCAG AA against `--cinder-surface`.

| Token                    | Default                                                 |
| ------------------------ | ------------------------------------------------------- |
| `--cinder-text`          | `light-dark(oklch(20% 0.018 245), oklch(92% 0.02 245))` |
| `--cinder-text-muted`    | `light-dark(oklch(32% 0.014 245), oklch(82% 0.02 245))` |
| `--cinder-text-subtle`   | `light-dark(oklch(42% 0.012 245), oklch(72% 0.02 245))` |
| `--cinder-text-disabled` | `light-dark(oklch(52% 0.01 245), oklch(64% 0.02 245))`  |
| `--cinder-fill-disabled` | `light-dark(oklch(86% 0.006 255),oklch(30% 0.015 245))` |

## Borders

| Token                                     | Default                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| `--cinder-border`                         | `light-dark(oklch(63% 0.006 255),oklch(58% 0.05 245))`        |
| `--cinder-border-faint`                   | `light-dark(oklch(92% 0.003 255),oklch(33% 0.03 245))`        |
| `--cinder-border-muted`                   | `light-dark(oklch(85% 0.004 255),oklch(38% 0.04 245))`        |
| `--cinder-border-strong`                  | `light-dark(oklch(60% 0.008 255),oklch(66% 0.06 245))`        |
| `--cinder-toggle-track-off-resting`       | `light-dark(var(--cinder-border-muted), oklch(45% 0.02 245))` |
| `--cinder-toggle-track-off-hover-resting` | `light-dark(var(--cinder-border), oklch(52% 0.02 245))`       |

`--cinder-toggle-track-off-resting` and `--cinder-toggle-track-off-hover-resting` are the default fill colors for an unchecked Toggle track. In light mode they alias the existing muted and default border tokens. In dark mode they lift to L≈0.45 (rest) and L≈0.52 (hover) so the track has ≥3:1 shape contrast against the dark surface. The `--cinder-toggle-track-off` consumer override hook still takes priority.

`--cinder-border-faint` is for decorative internal hairlines only. It is intentionally below the 3:1 non-text contrast floor and must not be used to define a control boundary.

## Opacity

| Token                       | Default |
| --------------------------- | ------- |
| `--cinder-opacity-disabled` | `0.55`  |
| `--cinder-opacity-muted`    | `0.72`  |
| `--cinder-opacity-faint`    | `0.4`   |

## Accent

The brand color and its derivatives. `hover` and `active` are computed from `--cinder-accent` with `oklch(from ...)`, so overriding `--cinder-accent` re-derives both. `--cinder-accent-contrast` is the foreground color for text and icons placed on top of `--cinder-accent`.

| Token                            | Default                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `--cinder-accent`                | `light-dark(oklch(50% 0.22 270),oklch(72% 0.14 270))`      |
| `--cinder-accent-contrast`       | `light-dark(oklch(100% 0 0),oklch(15% 0.035 245))`         |
| `--cinder-accent-text`           | `light-dark(oklch(45% 0.22 270),oklch(72% 0.14 270))`      |
| `--cinder-accent-text-hover`     | `oklch(from var(--cinder-accent-text) calc(l - 0.08) c h)` |
| `--cinder-accent-hover`          | `oklch(from var(--cinder-accent) calc(l - 0.08) c h)`      |
| `--cinder-accent-active`         | `oklch(from var(--cinder-accent) calc(l - 0.15) c h)`      |
| `--cinder-accent-active-on-fill` | `oklch(from var(--cinder-accent) calc(l - 0.11) c h)`      |

`--cinder-accent-text` is the brand color used _as_ text/icon on a light surface. `--cinder-accent` is a deep indigo fill (`oklch(50% 0.22 270)` in light mode) that carries the white `--cinder-accent-contrast` label at 6.45:1; its bright periwinkle dark-mode arm carries the dark-ink label at 7.77:1. Foreground usages (links, accent chip/badge labels, active tab labels, selected rows, toast actions, and the current-step marker) use the dedicated `--cinder-accent-text` token, which clears 4.5:1 on every light surface. `--cinder-accent-text-hover` darkens that foreground by 0.08 lightness (light arm ≈7.9:1 on white) so links get darker on hover; links must not use the fill-derived `--cinder-accent-hover`, which does not preserve the foreground contrast contract.

`--cinder-accent-active-on-fill` is the pressed fill for solid accent surfaces that carry `--cinder-accent-contrast` labels (primary `Button`, `FloatingAction`). It darkens the light indigo arm by 0.11 to `L=0.39`, increasing white-label contrast to 10.5:1, while retaining a separate token so label-bearing and non-label consumers can diverge when needed. Accent surfaces that do not bear an on-fill label keep using `--cinder-accent-active`.

## Semantic aliases

An intent layer over the raw scale. Rather than reaching for a numeric step like `--cinder-space-2-5`, components reference what the spacing or radius is _for_ — control padding, card padding, a stack gap — so the meaning of a value travels with it and a single retune of the alias re-derives every call site. Every name here maps to a raw spacing or radius token and exists as a `:root` variable in `tokens-base.css`.

| Token                     | Default                   |
| ------------------------- | ------------------------- |
| `--cinder-pad-control`    | `var(--cinder-space-2-5)` |
| `--cinder-pad-card`       | `var(--cinder-space-4)`   |
| `--cinder-gap-stack`      | `var(--cinder-space-3)`   |
| `--cinder-gap-inline`     | `var(--cinder-space-2)`   |
| `--cinder-radius-control` | `var(--cinder-radius-md)` |
| `--cinder-radius-surface` | `var(--cinder-radius-lg)` |

## Status — solid

Single-value status tokens for solid fills like badges and dot indicators. For soft-tinted surfaces (Alert, Toast, Callout) use the semantic triples below instead.

| Token                       | Default                                                |
| --------------------------- | ------------------------------------------------------ |
| `--cinder-info`             | `light-dark(oklch(50% 0.098 230),oklch(78% 0.13 230))` |
| `--cinder-success`          | `light-dark(oklch(50% 0.157 145),oklch(78% 0.14 145))` |
| `--cinder-warning`          | `light-dark(oklch(54% 0.113 75),oklch(82% 0.156 75))`  |
| `--cinder-danger`           | `light-dark(oklch(50% 0.202 25),oklch(72% 0.172 25))`  |
| `--cinder-danger-contrast`  | `light-dark(oklch(100% 0 0), oklch(12% 0.02 25))`      |
| `--cinder-danger-hover`     | `light-dark(oklch(42% 0.171 25),oklch(64% 0.172 25))`  |
| `--cinder-danger-active`    | `light-dark(oklch(35% 0.142 25),oklch(60% 0.172 25))`  |
| `--cinder-info-hover`       | `light-dark(oklch(42% 0.079 230),oklch(70% 0.13 230))` |
| `--cinder-info-active`      | `light-dark(oklch(35% 0.065 230),oklch(62% 0.12 230))` |
| `--cinder-success-hover`    | `light-dark(oklch(42% 0.12 145),oklch(70% 0.14 145))`  |
| `--cinder-success-active`   | `light-dark(oklch(35% 0.1 145),oklch(62% 0.14 145))`   |
| `--cinder-warning-hover`    | `light-dark(oklch(42% 0.08 75),oklch(74% 0.156 75))`   |
| `--cinder-warning-active`   | `light-dark(oklch(38% 0.07 75),oklch(66% 0.13 75))`    |
| `--cinder-success-contrast` | `light-dark(oklch(100% 0 0), oklch(15% 0.03 145))`     |
| `--cinder-warning-contrast` | `light-dark(oklch(100% 0 0), oklch(20% 0.04 75))`      |
| `--cinder-info-contrast`    | `light-dark(oklch(100% 0 0),oklch(15% 0.03 230))`      |

The `*-contrast` tokens are the foreground color for text and icons placed on a solid status fill (e.g. a pressed semantic chip). In light mode the accents are dark enough for white text; in dark mode they sit at high lightness, so a dark same-hue color wins. All clear WCAG AA (≥4.5:1) against their paired accent.

## Status — semantic triples

Foreground / background / border triples for soft tinted surfaces. Use these in Alert, Toast, Callout, and anywhere else you need a status surface with semantically-paired text and border.

| Token                           | Default                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `--cinder-color-info-bg`        | `light-dark(oklch(94.5% 0.03 230),oklch(28% 0.057 230))`                                             |
| `--cinder-color-info-fg`        | `light-dark(oklch(40% 0.079 230),oklch(88% 0.071 230))`                                              |
| `--cinder-color-info-border`    | `light-dark(oklch(80% 0.05 230),oklch(45% 0.08 230))`                                                |
| `--cinder-color-success-bg`     | `light-dark(oklch(94.5% 0.045 145),oklch(28% 0.07 145))`                                             |
| `--cinder-color-success-fg`     | `light-dark(oklch(40% 0.127 145), oklch(88% 0.11 145))`                                              |
| `--cinder-color-success-border` | `light-dark(oklch(80% 0.05 145), oklch(45% 0.09 145))`                                               |
| `--cinder-color-warning-bg`     | `light-dark(oklch(94.5% 0.042 75),oklch(28% 0.06 75))`                                               |
| `--cinder-color-warning-fg`     | `light-dark(oklch(40% 0.085 75), oklch(90% 0.08 75))`                                                |
| `--cinder-color-warning-border` | `light-dark(oklch(80% 0.06 75), oklch(50% 0.1 75))`                                                  |
| `--cinder-color-danger-bg`      | `light-dark(oklch(94.5% 0.026 25),oklch(28% 0.09 25))`                                               |
| `--cinder-color-danger-fg`      | `light-dark(oklch(42% 0.16 25), oklch(90% 0.05 25))`                                                 |
| `--cinder-color-danger-border`  | `light-dark(oklch(80% 0.06 25), oklch(50% 0.11 25))`                                                 |
| `--cinder-color-neutral-bg`     | `light-dark(oklch(94.5% 0.004 255),oklch(28% 0.04 245))`                                             |
| `--cinder-color-neutral-fg`     | `var(--cinder-text)`                                                                                 |
| `--cinder-color-neutral-border` | `var(--cinder-border)`                                                                               |
| `--cinder-color-accent-bg`      | `color-mix(in oklch, var(--cinder-accent), var(--cinder-surface) 88%)`                               |
| `--cinder-color-accent-fg`      | `var(--cinder-accent-text)`                                                                          |
| `--cinder-color-accent-border`  | `color-mix(in oklch, var(--cinder-accent), transparent 60%)`                                         |
| `--cinder-color-info-muted`     | `oklch(from color-mix(in oklch, var(--cinder-info), var(--cinder-surface) 36%) l min(c, 0.05) h)`    |
| `--cinder-color-info-subtle`    | `oklch(from color-mix(in oklch, var(--cinder-info), var(--cinder-text) 36%) l min(c, 0.05) h)`       |
| `--cinder-color-success-muted`  | `oklch(from color-mix(in oklch, var(--cinder-success), var(--cinder-surface) 36%) l min(c, 0.05) h)` |
| `--cinder-color-success-subtle` | `oklch(from color-mix(in oklch, var(--cinder-success), var(--cinder-text) 36%) l min(c, 0.05) h)`    |
| `--cinder-color-warning-muted`  | `oklch(from color-mix(in oklch, var(--cinder-warning), var(--cinder-surface) 36%) l min(c, 0.05) h)` |
| `--cinder-color-warning-subtle` | `oklch(from color-mix(in oklch, var(--cinder-warning), var(--cinder-text) 36%) l min(c, 0.05) h)`    |
| `--cinder-color-danger-muted`   | `oklch(from color-mix(in oklch, var(--cinder-danger), var(--cinder-surface) 36%) l min(c, 0.05) h)`  |
| `--cinder-color-danger-subtle`  | `oklch(from color-mix(in oklch, var(--cinder-danger), var(--cinder-text) 36%) l min(c, 0.05) h)`     |

## Transparency checkerboard

Shared checkerboard colors for color-domain components that need to show alpha over a structural pattern.

| Token                         | Default                                 |
| ----------------------------- | --------------------------------------- |
| `--cinder-color-checker-base` | `light-dark(#fff, oklch(28% 0.02 245))` |
| `--cinder-color-checker-tile` | `light-dark(#ccc, oklch(38% 0.02 245))` |

## Chart series

Categorical chart colors for LineChart, BarChart, AreaChart, and consumers that need to keep custom chart marks aligned with cinder's default series palette.

Each `--cinder-chart-series-*` is a theme-aware design token: it wraps independently selected per-theme OKLCH values in `light-dark()`. Light-mode marks are generally darker for pale surfaces, while dark-mode marks are lighter for dark surfaces; hue and chroma both vary as needed for contrast and separation. The index keeps its position in the series sequence while the palette remaps it for the active theme.

| Token                     | Default                                                 |
| ------------------------- | ------------------------------------------------------- |
| `--cinder-chart-series-1` | `light-dark(oklch(33% 0.121 8),oklch(58% 0.089 205))`   |
| `--cinder-chart-series-2` | `light-dark(oklch(36% 0.069 80),oklch(67% 0.275 330))`  |
| `--cinder-chart-series-3` | `light-dark(oklch(40% 0.082 160),oklch(69% 0.182 44))`  |
| `--cinder-chart-series-4` | `light-dark(oklch(45% 0.087 235),oklch(70% 0.144 160))` |
| `--cinder-chart-series-5` | `light-dark(oklch(53% 0.218 330),oklch(78% 0.12 8))`    |
| `--cinder-chart-series-6` | `light-dark(oklch(56% 0.148 44),oklch(81% 0.152 80))`   |
| `--cinder-chart-series-7` | `light-dark(oklch(59% 0.126 120),oklch(85% 0.078 235))` |
| `--cinder-chart-series-8` | `light-dark(oklch(63% 0.098 205),oklch(89% 0.19 120))`  |

## Focus ring

The ring tokens drive the focus-visible outline used across interactive primitives. See [`focus-ring-policy.md`](./focus-ring-policy.md) for when components are expected to render the ring vs. when they delegate to the user agent.

| Token                        | Default                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `--cinder-ring-width`        | `2px`                                                                                                |
| `--cinder-ring-offset`       | `2px`                                                                                                |
| `--cinder-ring-offset-color` | `var(--cinder-surface-raised)`                                                                       |
| `--cinder-ring-color`        | `light-dark(oklch(from var(--cinder-accent)0.55 0.16 h),oklch(from var(--cinder-accent)0.7 0.14 h))` |
| `--cinder-ring-on-accent`    | `light-dark(oklch(15% 0.035 245), oklch(100% 0 0))`                                                  |

`--cinder-ring-on-accent` is a high-contrast focus ring for solid accent-fill surfaces (e.g. the primary `FloatingAction`). It uses dark ink in light mode and white in dark mode, contrasting with both the accent fill and surrounding surface. Regular interactive elements on neutral surfaces use `--cinder-ring-color` instead.

## Z-index layers

Stacking order is fixed: tooltip < dropdown ≈ popover < backdrop < modal ≈ drawer < toast < focused affordance < drag preview. The standalone `Backdrop` scrim sits just below modal and drawer so it can dim popover-layer chrome while staying beneath dialog surfaces (Modal and Drawer are built on the native `<dialog>` element and render their own scrim via `::backdrop` rather than this layer). Toast sits above modal so confirmations and warnings still reach the user when a modal is open, while the active drag preview remains attached to the pointer above every surface. Override these only if you are integrating cinder into an app with its own established stacking contract.

The token table is the single source of truth. A `z-index` reference must use
`var(--cinder-z-*)` without an inline fallback; otherwise a partial stylesheet
can silently put two components that name the same layer at different heights.
Component-local stacking may use `auto`, `0`, or `1`. A higher local relationship needs
an adjacent `cinder-z-index-local:` reason so Stylelint can distinguish it from
a new global layer.

| Token                           | Default |
| ------------------------------- | ------- |
| `--cinder-z-tooltip`            | `1000`  |
| `--cinder-z-dropdown`           | `1100`  |
| `--cinder-z-popover`            | `1100`  |
| `--cinder-z-backdrop`           | `1150`  |
| `--cinder-z-modal`              | `1200`  |
| `--cinder-z-toast`              | `1300`  |
| `--cinder-z-focused-affordance` | `1350`  |
| `--cinder-z-drag-preview`       | `1400`  |

## Overlay surfaces

Shared backdrop, blur, padding, and radius for Modal, Drawer, and Popover. Adjust these once and every overlay primitive picks up the change.

| Token                       | Default                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `--cinder-overlay-backdrop` | `light-dark(oklch(20% 0.03 245 / 0.5), oklch(8% 0.02 245 / 0.65))` |
| `--cinder-overlay-blur`     | `4px`                                                              |
| `--cinder-overlay-padding`  | `var(--cinder-space-6)`                                            |
| `--cinder-overlay-radius`   | `var(--cinder-radius-lg)`                                          |

## Scrollbars

Themed native scrollbars for components that opt in via `scrollbar-width` and `::-webkit-scrollbar-*` (notably `ScrollArea`). The thumb alphas are tuned so resolved thumb-on-surface contrast clears WCAG 1.4.11 (3:1) over the common light- and dark-mode surface tokens.

| Token                            | Default                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `--cinder-scrollbar-size`        | `0.625rem`                                                 |
| `--cinder-scrollbar-track`       | `light-dark(oklch(0% 0 0 / 0.04), oklch(100% 0 0 / 0.04))` |
| `--cinder-scrollbar-thumb`       | `light-dark(oklch(0% 0 0 / 0.45), oklch(100% 0 0 / 0.45))` |
| `--cinder-scrollbar-thumb-hover` | `light-dark(oklch(0% 0 0 / 0.65), oklch(100% 0 0 / 0.65))` |

## Button

Component-specific tokens for [`Button`](../packages/components/src/components/button.svelte). The base trio (`bg`, `fg`, `border`) defines the secondary-variant defaults; size tokens scale padding, height, font, and radius across `xs`/`sm`/`md`/`lg`/`xl`. `md` is the AAA touch-target size (44px); `xs` and `sm` are intentionally below AAA — see [`button.a11y.md`](../packages/components/src/components/button.a11y.md) for the rationale.

### Base

| Token                    | Default                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `--cinder-button-bg`     | `var(--cinder-surface-raised)`                                  |
| `--cinder-button-fg`     | `var(--cinder-text)`                                            |
| `--cinder-button-border` | `light-dark(var(--cinder-border), var(--cinder-border-strong))` |
| `--cinder-button-radius` | `var(--cinder-radius-md)`                                       |

### Size: xs

| Token                          | Default                           |
| ------------------------------ | --------------------------------- |
| `--cinder-button-padding-x-xs` | `var(--cinder-space-1-5)`         |
| `--cinder-button-padding-y-xs` | `var(--cinder-space-0-5)`         |
| `--cinder-button-height-xs`    | `var(--cinder-control-height-xs)` |
| `--cinder-button-font-size-xs` | `var(--cinder-text-xs)`           |
| `--cinder-button-radius-xs`    | `var(--cinder-radius-sm)`         |

### Size: sm

| Token                          | Default                   |
| ------------------------------ | ------------------------- |
| `--cinder-button-padding-x-sm` | `var(--cinder-space-2)`   |
| `--cinder-button-padding-y-sm` | `var(--cinder-space-1)`   |
| `--cinder-button-height-sm`    | `1.75rem`                 |
| `--cinder-button-font-size-sm` | `var(--cinder-text-sm)`   |
| `--cinder-button-radius-sm`    | `var(--cinder-radius-sm)` |

### Size: md

| Token                          | Default                   |
| ------------------------------ | ------------------------- |
| `--cinder-button-padding-x-md` | `var(--cinder-space-2-5)` |
| `--cinder-button-padding-y-md` | `var(--cinder-space-1-5)` |
| `--cinder-button-height-md`    | `2rem`                    |
| `--cinder-button-font-size-md` | `var(--cinder-text-sm)`   |
| `--cinder-button-radius-md`    | `var(--cinder-radius-md)` |

### Size: lg

| Token                          | Default                   |
| ------------------------------ | ------------------------- |
| `--cinder-button-padding-x-lg` | `var(--cinder-space-3)`   |
| `--cinder-button-padding-y-lg` | `var(--cinder-space-2)`   |
| `--cinder-button-height-lg`    | `2.25rem`                 |
| `--cinder-button-font-size-lg` | `var(--cinder-text-md)`   |
| `--cinder-button-radius-lg`    | `var(--cinder-radius-md)` |

### Size: xl

| Token                          | Default                   |
| ------------------------------ | ------------------------- |
| `--cinder-button-padding-x-xl` | `var(--cinder-space-3-5)` |
| `--cinder-button-padding-y-xl` | `var(--cinder-space-2-5)` |
| `--cinder-button-height-xl`    | `2.5rem`                  |
| `--cinder-button-font-size-xl` | `var(--cinder-text-lg)`   |
| `--cinder-button-radius-xl`    | `var(--cinder-radius-md)` |
