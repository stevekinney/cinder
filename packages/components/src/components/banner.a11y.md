# Banner Accessibility

`banner.svelte` is a page-level notification strip. It uses
`role="region"` with a variant-derived `aria-label` so that screen-reader
users can find and identify it via landmark navigation without being
interrupted by an assertive live-region announcement on every page load.

## Role + Semantics

The root element is a `<div>` with:

- `role="region"` — marks the banner as a navigable landmark. ARIA's
  `region` role only qualifies as a landmark when it has an accessible
  name; that is always supplied here.
- `aria-label="{variant label}"` by default — derived from the `variant`
  prop via the table below. Suppressed when `aria-labelledby` is passed.

| `variant` | Default `aria-label` |
| --------- | -------------------- |
| `info`    | `Information`        |
| `success` | `Success`            |
| `warning` | `Warning`            |
| `danger`  | `Error`              |

`danger` maps to `"Error"` (not `"Danger"`) because screen-reader users
hear a semantically meaningful word. The variant token name remains
`danger` to match `--cinder-danger`.

### Accessible-name precedence

The component computes the accessible name in three tiers:

1. If the consumer passes `aria-labelledby`, the root emits
   `aria-labelledby` alone — the default `aria-label` is suppressed so
   accessible-name computation has a single unambiguous source.
2. Else if the consumer passes `aria-label`, that value is used.
3. Else the variant-derived default applies.

`role` is intentionally locked. The component's `BannerProps` `Omit`s
`role` from the underlying `HTMLAttributes`, so callers cannot silently
turn the banner into `role="alert"`. The component also strips
`aria-live`, `aria-atomic`, `aria-relevant`, and `aria-busy` from
rest-props at runtime — the type system permits them (they live on
`HTMLAttributes`), but the banner is a landmark, not a live region, and
allowing those attributes through would reintroduce the assertive-
announcement behavior `role="region"` was chosen to avoid.

## Why not `role="alert"`?

1. **`role="alert"` implies `aria-live="assertive"`.** A persistent
   banner that renders on every page load would interrupt the
   screen-reader's page-orientation announcement (heading, landmarks)
   every time, which is jarring.
2. **Banners are not dynamically injected feedback.** `role="alert"` is
   correct for content that appears as a _consequence of user action_
   (form submission failed, item saved). A banner present at initial
   render does not meet that bar — it is part of the page's furniture.
3. **`role="banner"` is taken.** The ARIA `banner` role is reserved for
   the site masthead (`<header>`). Reusing it here would create two
   `banner` landmarks per page.
4. **`region` is the right landmark.** Labelled `region` is exactly what
   ARIA provides for a navigable, named section of page content.

## Distinction from `alert.svelte` and `callout.svelte`

| Trait       | `banner.svelte`                                                        | `alert.svelte`                                                    | `callout.svelte` (forthcoming)              |
| ----------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| Scope       | Page-level strip                                                       | Contextual card                                                   | Inline prose admonition                     |
| Role        | `region`                                                               | `alert` + `aria-live="polite"`                                    | none (static prose)                         |
| Persistence | Persistent, dismissible                                                | Dynamic, sometimes dismissible                                    | Permanent, not dismissible                  |
| Width       | Full-width                                                             | Inline within content                                             | Inline within prose                         |
| Variants    | `info \| success \| warning \| danger`                                 | `info \| success \| warning \| error`                             | `note \| tip \| warning \| danger`          |
| Use when…   | Site-wide condition (trial expiry, maintenance window, cookie consent) | A user action produced feedback that needs immediate announcement | A note appears within flowing documentation |

The `danger` vs `error` variant divergence with `alert.svelte` is
intentional: the ROADMAP specifies `danger` for banner, and the semantic
token is `--cinder-danger`. A future unification pass across the trio is
tracked as a separate ROADMAP item.

## Keyboard interaction

Banner is not a focus trap. Tab order:

1. Interactive elements inside `children`.
2. Interactive elements inside `actions` (when provided).
3. The dismiss button (when `dismissible` is `true`).

Enter or Space on the dismiss button fires the handler. Once dismissed,
the banner is removed from the DOM; focus moves to the next focusable
element in document order via the browser's default focus-recovery
behavior.

## Dismiss button

- `<button type="button" aria-label="Dismiss banner">` with an inline
  SVG × icon marked `aria-hidden="true"`.
- The interactive hit area is expanded to 44×44 px via a non-layout
  `::after` pseudo-element (WCAG 2.5.5 Target Size).
- The visible focus ring uses a two-tone offset + colored ring derived
  from the active variant token.
- The dismiss button's `aria-label` is hardcoded to English. Internationalization
  is not yet plumbed through this component (sibling `alert.svelte` has the
  same constraint); a future `dismissLabel` prop or i18n integration will
  unify both.

## Color and contrast

Variant tokens mirror `alert.svelte`'s contrast model — same lightness
and chroma derivations against `--cinder-info | success | warning |
danger`. The package does not currently ship an automated contrast check
for component variants, so this document does **not** assert WCAG AA
compliance: the colors are designed to mirror `alert.svelte`'s contrast
model; verify manually against your specific background before shipping.

## Forced-colors mode

In Windows High Contrast / forced-colors mode the variant background is
dropped and the strip uses `CanvasText` for its `border-block` and
`ButtonText` for the dismiss-button focus outline.

## Layout caveats

"Full-width" means the banner fills its **parent container's inline
size**, not the viewport. To bleed edge-to-edge of the viewport, render
the banner outside any `max-inline-size` content column — for example,
as a direct child of the layout shell rather than the content wrapper.

## Multiple banners

Nothing in the API prevents mounting two banners on a page, but doing
so produces two `region` landmarks with potentially identical accessible
names, which is noisy under screen-reader landmark navigation. Use one
page-level banner at a time; for additional simultaneous notifications,
use `alert.svelte` for the contextual ones.

## Persistence

Dismiss state is purely internal to the component. Consumers who need a
banner to stay dismissed across navigations should persist that state
themselves via the `onDismiss` callback (e.g., to `localStorage`).
Consumers who need a dismissed banner to reappear must `{#key}`-wrap or
unmount-and-remount the component — re-rendering with the same props
does not resurrect a dismissed banner.
