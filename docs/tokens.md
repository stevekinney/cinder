# Design tokens

cinder ships its design tokens as plain CSS custom properties on `:root`. Every token has a `--cinder-*` prefix; that prefix is the public surface, and you can override any of them at `:root` (globally) or on any ancestor selector (scoped) to reskin the system. Internal-only custom properties use `--_cinder-*`; those are not part of the contract and may change without notice.

This file is hand-maintained. It is the source of truth for what cinder exposes; the CSS files in `packages/components/src/styles/` are the source of truth for the values. A drift test in [`tokens-doc-drift.test.ts`](../packages/components/src/styles/tokens-doc-drift.test.ts) keeps the two in sync — if you add, remove, or rename a token, update both this doc and the CSS, or CI will fail.

All tokens are declared in [`tokens-base.css`](../packages/components/src/styles/tokens-base.css). The aggregator [`tokens.css`](../packages/components/src/styles/tokens.css) imports the base file and is the entry point components consume.

> [!NOTE]
> Color tokens use [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) keyed off `color-scheme`. The default `:root` sets `color-scheme: light dark`, which means the browser picks based on the user's OS preference. Force a scheme by setting `color-scheme: light` or `color-scheme: dark` on `:root` (or any ancestor) — or use the shorthand `[data-theme='light']` / `[data-theme='dark']` selectors cinder already wires up.

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

| Token                  | Default                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `--cinder-radius-sm`   | `0.375rem`                                                                   |
| `--cinder-radius-md`   | `0.5rem`                                                                     |
| `--cinder-radius-lg`   | `0.75rem`                                                                    |
| `--cinder-radius-full` | `9999px`                                                                     |
| `--cinder-shadow-sm`   | `0 1px 2px oklch(0% 0 0 / 0.08)`                                             |
| `--cinder-shadow-md`   | `0 4px 6px -1px oklch(0% 0 0 / 0.12), 0 2px 4px -2px oklch(0% 0 0 / 0.1)`    |
| `--cinder-shadow-lg`   | `0 10px 15px -3px oklch(0% 0 0 / 0.14), 0 4px 6px -4px oklch(0% 0 0 / 0.12)` |

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
| `--cinder-touch-target-min` | `44px`                                                                                           |

`--cinder-touch-target-min` is the WCAG AAA touch-target floor. Interactive primitives use it as a minimum height or width.

## Layout

| Token                    | Default |
| ------------------------ | ------- |
| `--cinder-content-width` | `72rem` |

`--cinder-content-width` caps the inline size of primary page content. Used by [`PageLayout`](../packages/components/src/components/page-layout.svelte); consumers can override per scope.

## Motion

Durations and easing curves. `--cinder-duration-normal` is an alias for `--cinder-duration` — both resolve to the same value. The `prefers-reduced-motion: reduce` media query collapses all durations to `0ms` automatically; you do not need to handle that case yourself.

| Token                        | Default                        |
| ---------------------------- | ------------------------------ |
| `--cinder-duration-instant`  | `0ms`                          |
| `--cinder-duration-fast`     | `120ms`                        |
| `--cinder-duration`          | `200ms`                        |
| `--cinder-duration-normal`   | `var(--cinder-duration)`       |
| `--cinder-duration-moderate` | `280ms`                        |
| `--cinder-duration-slow`     | `400ms`                        |
| `--cinder-ease-standard`     | `cubic-bezier(0.2, 0, 0, 1)`   |
| `--cinder-ease-decelerate`   | `cubic-bezier(0, 0, 0, 1)`     |
| `--cinder-ease-accelerate`   | `cubic-bezier(0.3, 0, 1, 1)`   |
| `--cinder-ease-in-out`       | `cubic-bezier(0.4, 0, 0.2, 1)` |

## Surfaces

Background and surface tokens for the three core elevations — page background, default surface, and raised surface — plus an inset variant for sunken regions and `hover`/`pressed` derivatives that lift or darken via `color-mix`.

| Token                      | Default                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `--cinder-bg`              | `light-dark(oklch(96.5% 0.012 245), oklch(15% 0.035 245))`                                   |
| `--cinder-surface`         | `light-dark(oklch(98.5% 0.008 245), oklch(20% 0.04 245))`                                    |
| `--cinder-surface-raised`  | `light-dark(oklch(100% 0.004 245), oklch(24% 0.045 245))`                                    |
| `--cinder-surface-inset`   | `light-dark(oklch(94% 0.018 245), oklch(12% 0.03 245))`                                      |
| `--cinder-surface-hover`   | `color-mix(in oklch, var(--cinder-surface), light-dark(oklch(0% 0 0), oklch(100% 0 0)) 8%)`  |
| `--cinder-surface-pressed` | `color-mix(in oklch, var(--cinder-surface), light-dark(oklch(0% 0 0), oklch(100% 0 0)) 12%)` |

## Text colors

Foreground colors keyed to readability against the surface tokens. `--cinder-text-disabled` meets the relaxed contrast bar for disabled UI; the others meet WCAG AA against `--cinder-surface`.

| Token                    | Default                                                 |
| ------------------------ | ------------------------------------------------------- |
| `--cinder-text`          | `light-dark(oklch(20% 0.03 245), oklch(92% 0.02 245))`  |
| `--cinder-text-muted`    | `light-dark(oklch(32% 0.02 245), oklch(82% 0.02 245))`  |
| `--cinder-text-subtle`   | `light-dark(oklch(42% 0.02 245), oklch(72% 0.02 245))`  |
| `--cinder-text-disabled` | `light-dark(oklch(52% 0.015 245), oklch(62% 0.02 245))` |

## Borders

| Token                    | Default                                                 |
| ------------------------ | ------------------------------------------------------- |
| `--cinder-border`        | `light-dark(oklch(86% 0.025 245), oklch(35% 0.05 245))` |
| `--cinder-border-muted`  | `light-dark(oklch(90% 0.018 245), oklch(30% 0.04 245))` |
| `--cinder-border-strong` | `light-dark(oklch(75% 0.035 245), oklch(45% 0.06 245))` |

## Accent

The brand color and its derivatives. `hover` and `active` are computed from `--cinder-accent` with `oklch(from ...)`, so overriding `--cinder-accent` re-derives both. `--cinder-accent-contrast` is the foreground color for text and icons placed on top of `--cinder-accent`.

| Token                      | Default                                                |
| -------------------------- | ------------------------------------------------------ |
| `--cinder-accent`          | `light-dark(oklch(45% 0.14 195), oklch(78% 0.15 195))` |
| `--cinder-accent-contrast` | `light-dark(oklch(100% 0 0), oklch(15% 0.035 245))`    |
| `--cinder-accent-hover`    | `oklch(from var(--cinder-accent) calc(l - 0.08) c h)`  |
| `--cinder-accent-active`   | `oklch(from var(--cinder-accent) calc(l - 0.15) c h)`  |

## Status — solid

Single-value status tokens for solid fills like badges and dot indicators. For soft-tinted surfaces (Alert, Toast, Callout) use the semantic triples below instead.

| Token                      | Default                                                |
| -------------------------- | ------------------------------------------------------ |
| `--cinder-info`            | `light-dark(oklch(45% 0.14 245), oklch(78% 0.13 245))` |
| `--cinder-success`         | `light-dark(oklch(42% 0.16 145), oklch(78% 0.14 145))` |
| `--cinder-warning`         | `light-dark(oklch(48% 0.18 75), oklch(82% 0.16 75))`   |
| `--cinder-danger`          | `light-dark(oklch(45% 0.22 25), oklch(72% 0.18 25))`   |
| `--cinder-danger-contrast` | `light-dark(oklch(100% 0 0), oklch(12% 0.02 25))`      |
| `--cinder-danger-hover`    | `oklch(from var(--cinder-danger) calc(l - 0.08) c h)`  |
| `--cinder-danger-active`   | `oklch(from var(--cinder-danger) calc(l - 0.15) c h)`  |

`--cinder-danger-contrast` exists because dark-mode `--cinder-danger` sits around 72% lightness and pure white fails WCAG AA against it.

## Status — semantic triples

Foreground / background / border triples for soft tinted surfaces. Use these in Alert, Toast, Callout, and anywhere else you need a status surface with semantically-paired text and border.

| Token                           | Default                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `--cinder-color-info-bg`        | `light-dark(oklch(96% 0.025 245), oklch(28% 0.06 245))` |
| `--cinder-color-info-fg`        | `light-dark(oklch(28% 0.12 245), oklch(88% 0.1 245))`   |
| `--cinder-color-info-border`    | `light-dark(oklch(82% 0.06 245), oklch(45% 0.08 245))`  |
| `--cinder-color-success-bg`     | `light-dark(oklch(96% 0.04 145), oklch(28% 0.07 145))`  |
| `--cinder-color-success-fg`     | `light-dark(oklch(28% 0.13 145), oklch(88% 0.11 145))`  |
| `--cinder-color-success-border` | `light-dark(oklch(80% 0.08 145), oklch(45% 0.09 145))`  |
| `--cinder-color-warning-bg`     | `light-dark(oklch(96% 0.04 75), oklch(28% 0.08 75))`    |
| `--cinder-color-warning-fg`     | `light-dark(oklch(32% 0.14 75), oklch(90% 0.12 75))`    |
| `--cinder-color-warning-border` | `light-dark(oklch(82% 0.1 75), oklch(50% 0.1 75))`      |
| `--cinder-color-danger-bg`      | `light-dark(oklch(96% 0.04 25), oklch(28% 0.09 25))`    |
| `--cinder-color-danger-fg`      | `light-dark(oklch(32% 0.16 25), oklch(90% 0.12 25))`    |
| `--cinder-color-danger-border`  | `light-dark(oklch(82% 0.1 25), oklch(50% 0.11 25))`     |

## Scrollbar

Used by the `ScrollArea` component and any consumer that opts into themed native scrollbars. Thumb alpha is tuned so the resolved thumb-on-surface contrast clears WCAG 1.4.11 (3:1) over common light- and dark-mode surface tokens.

| Token                            | Default                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `--cinder-scrollbar-size`        | `0.625rem`                                                 |
| `--cinder-scrollbar-track`       | `light-dark(oklch(0% 0 0 / 0.04), oklch(100% 0 0 / 0.04))` |
| `--cinder-scrollbar-thumb`       | `light-dark(oklch(0% 0 0 / 0.45), oklch(100% 0 0 / 0.45))` |
| `--cinder-scrollbar-thumb-hover` | `light-dark(oklch(0% 0 0 / 0.65), oklch(100% 0 0 / 0.65))` |

## Focus ring

The ring tokens drive the focus-visible outline used across interactive primitives. See [`focus-ring-policy.md`](./focus-ring-policy.md) for when components are expected to render the ring vs. when they delegate to the user agent.

| Token                        | Default                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--cinder-ring-width`        | `3px`                                                                                                      |
| `--cinder-ring-offset`       | `1px`                                                                                                      |
| `--cinder-ring-offset-color` | `var(--cinder-bg)`                                                                                         |
| `--cinder-ring-color`        | `light-dark(oklch(from var(--cinder-accent) 55% 0.12 195), oklch(from var(--cinder-accent) 70% 0.14 195))` |

## Z-index layers

Stacking order is fixed: tooltip < dropdown ≈ popover < modal ≈ sheet < toast. Toast sits above modal so confirmations and warnings still reach the user when a modal is open. Override these only if you are integrating cinder into an app with its own established stacking contract.

| Token                 | Default |
| --------------------- | ------- |
| `--cinder-z-tooltip`  | `1000`  |
| `--cinder-z-dropdown` | `1100`  |
| `--cinder-z-popover`  | `1100`  |
| `--cinder-z-modal`    | `1200`  |
| `--cinder-z-sheet`    | `1200`  |
| `--cinder-z-toast`    | `1300`  |

## Overlay surfaces

Shared backdrop, blur, padding, and radius for Modal, Sheet, and Popover. Adjust these once and every overlay primitive picks up the change.

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

| Token                    | Default                        |
| ------------------------ | ------------------------------ |
| `--cinder-button-bg`     | `var(--cinder-surface-raised)` |
| `--cinder-button-fg`     | `var(--cinder-text)`           |
| `--cinder-button-border` | `var(--cinder-border)`         |
| `--cinder-button-radius` | `var(--cinder-radius-md)`      |

### Size: xs

| Token                          | Default                   |
| ------------------------------ | ------------------------- |
| `--cinder-button-padding-x-xs` | `var(--cinder-space-1-5)` |
| `--cinder-button-padding-y-xs` | `var(--cinder-space-0-5)` |
| `--cinder-button-height-xs`    | `1.5rem`                  |
| `--cinder-button-font-size-xs` | `var(--cinder-text-xs)`   |
| `--cinder-button-radius-xs`    | `var(--cinder-radius-sm)` |

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
| `--cinder-button-font-size-lg` | `var(--cinder-text-sm)`   |
| `--cinder-button-radius-lg`    | `var(--cinder-radius-md)` |

### Size: xl

| Token                          | Default                   |
| ------------------------------ | ------------------------- |
| `--cinder-button-padding-x-xl` | `var(--cinder-space-3-5)` |
| `--cinder-button-padding-y-xl` | `var(--cinder-space-2-5)` |
| `--cinder-button-height-xl`    | `2.5rem`                  |
| `--cinder-button-font-size-xl` | `var(--cinder-text-sm)`   |
| `--cinder-button-radius-xl`    | `var(--cinder-radius-md)` |
