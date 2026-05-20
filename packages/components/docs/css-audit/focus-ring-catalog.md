# Focus-ring catalog

Inventory of every `:focus-visible` declaration in `packages/components/src/components/**/*.css`.

Sources: `rg -n ':focus-visible' packages/components/src/components --glob '*.css'` (97 hits across 39 files).

The catalog groups declarations into _shape buckets_. The two foundational tokens
(`--cinder-ring-width`, `--cinder-ring-offset`, `--cinder-ring-offset-color`,
`--cinder-ring-color`) live in `tokens-base.css`. The reset in `foundation.css`
also defines a global `:focus-visible { outline … }` fallback.

## Decision (Batch B.2 gate)

We chose path **B.3b — internal CSS variable only**.

Reasoning: across the 97 declarations, only roughly 22 of the primary rules
match the "standard cinder box-shadow ring" shape. The remainder are
outline-only rings, forced-colors overrides, specialty inset rings
(dropdown items, accordion trigger), or focus-ring _suppressors_
(`.cinder-input-group > .cinder-input:focus-visible`,
`.cinder-search-field__input:focus-visible`,
`.cinder-number-input__input.cinder-input:focus-visible`).
That's well below the 80% shape-match threshold the plan requires for B.3a.

What _does_ collapse cleanly is the **box-shadow formula** — every site that
uses the box-shadow ring writes the identical two-stop value. Extracting that
formula into `--_cinder-focus-ring-shadow` (`src/styles/foundation.css`)
removes duplication without touching DOM, without altering selectors, and
without changing the cascade. Components that need a per-component ring color
keep their `--_cinder-X-ring` override by setting it on the element and
referencing the shared shadow shape through an override (`box-shadow:
0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color), 0 0 0
calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--_cinder-X-ring,
var(--cinder-ring-color))`) — these stay inline because the variable's color
is parameterized, not the whole formula. Components with the plain ring color
swap to `box-shadow: var(--_cinder-focus-ring-shadow)`.

## Shape buckets

### Bucket A — Standard cinder box-shadow ring (plain)

Sites using exactly:

```css
outline: var(--cinder-ring-width) solid transparent;
box-shadow:
  0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
  0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--cinder-ring-color);
```

These migrate to reference `var(--_cinder-focus-ring-shadow)`.

| File:line                                            | Selector                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `select/select.css:62`                               | `.cinder-select:focus-visible`                                         |
| `textarea/textarea.css:68`                           | `.cinder-textarea:focus-visible`                                       |
| `navigation-item/navigation-item.css:46`             | `.cinder-navigation-item:focus-visible`                                |
| `combobox/combobox.css:49`                           | `.cinder-combobox__input:focus-visible`                                |
| `stacked-list-item/stacked-list-item.css:75`         | `.cinder-stacked-list-item__title-link:focus-visible`                  |
| `chip/chip.css:191`                                  | `button.cinder-chip:focus-visible, .cinder-chip__remove:focus-visible` |
| `scroll-area/scroll-area.css:63`                     | `.cinder-scroll-area:focus-visible`                                    |
| `table/table.css:113`                                | `.cinder-table__sort-button:focus-visible`                             |
| `grid-list/grid-list.css:95`                         | `.cinder-grid-list__link:focus-visible`                                |
| `pagination/pagination.css:87`                       | `.cinder-pagination__step, .cinder-pagination__page`                   |
| `side-navigation-group/side-navigation-group.css:46` | `.cinder-side-navigation-group__trigger:focus-visible`                 |
| `tabs/tabs.css:89`                                   | `.cinder-tab:focus-visible`                                            |

### Bucket A′ — Standard box-shadow ring with per-component color override

Same formula, but the inner stop's color is `var(--_cinder-X-ring,
var(--cinder-ring-color))` so a component variant can recolor the ring. The
formula's structure is identical; these sites still benefit from
`--_cinder-focus-ring-shadow` _if_ we accept that the variant override goes
away. Because variant overrides are intentional API (e.g. button variants
recolor the ring), we leave these inline and do **not** migrate them. They are
documented as exceptions.

| File:line                                        | Selector                                            | Override variable                                                             |
| ------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `button/button.css:35`                           | `.cinder-button:focus-visible`                      | `--_cinder-button-ring`                                                       |
| `banner/banner.css:101`                          | `.cinder-banner__dismiss:focus-visible`             | `--_cinder-banner-ring`                                                       |
| `checkbox/checkbox.css:43`                       | `.cinder-checkbox:focus-visible`                    | `--_cinder-checkbox-ring`                                                     |
| `input/input.css:78`                             | `.cinder-input:focus-visible`                       | `--_cinder-input-ring`                                                        |
| `radio-group/radio-group.css:80`                 | `.cinder-radio:focus-visible`                       | `--_cinder-radio-ring`                                                        |
| `alert/alert.css:111`                            | `.cinder-alert__dismiss:focus-visible`              | `--_cinder-alert-ring`                                                        |
| `dropdown/dropdown.css:36`                       | `.cinder-dropdown-trigger:focus-visible`            | `--_cinder-dropdown-trigger-ring`                                             |
| `toggle/toggle.css:45`                           | `.cinder-toggle:focus-visible`                      | `--cinder-toggle-ring` (note: public-style name, with inline token fallbacks) |
| `color-swatch-picker/color-swatch-picker.css:94` | `.cinder-color-swatch-picker__swatch:focus-visible` | (inline `var(--cinder-ring-color, currentColor)` fallback only)               |
| `segmented-control/segmented-control.css:175`    | `.cinder-segmented-control-option:focus-visible`    | literal `outline: 2px` (instead of var) — plain colors                        |

Note: `textarea` also has an `[aria-invalid='true']:focus-visible` variant that
uses `--cinder-danger` for the inner stop (textarea.css:93). Plain
`var(--cinder-danger)` rather than a `--_cinder-X-ring` override — same family,
same exception logic. Left inline.

### Bucket B — Outline-only focus ring

```css
outline: var(--cinder-ring-width) solid var(--cinder-ring-color);
outline-offset: var(--cinder-ring-offset);
```

(or small variations: `outline-offset: 2px` / `1px` / negative offset).

Different shape — outline draws a single stroke, no offset-color sandwich.
Useful in clip-overflow contexts (modal, drawer, sheet — see their inline
comments) and for inputs/tracks that don't need the inner halo. Stay as-is.

| File:line                                        | Selector                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `breadcrumbs/breadcrumbs.css:36`                 | `.cinder-breadcrumbs__link`                                          |
| `slider/slider.css:106`                          | `.cinder-slider__thumb`                                              |
| `sheet/sheet.css:109`                            | `.cinder-sheet__close`                                               |
| `modal/modal.css:103`                            | `.cinder-modal__close` (comment justifies outline)                   |
| `drawer/drawer.css:107`                          | `.cinder-drawer__close`                                              |
| `popover/popover.css:18`                         | `.cinder-popover`                                                    |
| `color-picker/color-picker.css:46,110,189`       | gradient / hue / alpha / swatch                                      |
| `search-field/search-field.css:149`              | `.cinder-search-field__clear`                                        |
| `number-input/number-input.css:89`               | `.cinder-number-input__stepper`                                      |
| `tree/tree.css:20`                               | `.cinder-tree-item` (negative offset)                                |
| `copy-button/copy-button.css:32`                 | `.cinder-copy-button`                                                |
| `tabs/tabs.css:118`                              | `.cinder-tab-panel`                                                  |
| `toast-region/toast-region.css:122,167`          | `.cinder-toast__action`, `.cinder-toast__dismiss`                    |
| `experimental/json-viewer/json-viewer.css:51`    | `.cinder-json-viewer__toggle`                                        |
| `code-block/code-block.css:90`                   | header copy-button (overrides plain copy-button)                     |
| `selection-popover/selection-popover.css:41,128` | button / cancel / submit                                             |
| `sortable-list/sortable-list.css:53`             | `.cinder-sortable-handle` (uses `--cinder-focus-ring` shorthand var) |
| `json-schema-editor/json-schema-editor.css:222`  | `.cinder-jse-property-row__trigger`                                  |
| `accordion-item/accordion-item.css:59`           | inset outline (overflow-clip parent — see comment)                   |

### Bucket C — Specialty inset rings

Don't fit either pattern; designed for menu items where the ring must live
inside the row. Stay as-is.

| File:line                   | Selector                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `dropdown/dropdown.css:160` | `.cinder-dropdown-item[data-cinder-variant='default']:focus-visible` (inset box-shadow) |
| `dropdown/dropdown.css:180` | `.cinder-dropdown-item[data-cinder-variant='danger']:focus-visible` (inset box-shadow)  |

### Bucket D — Ring suppressors

These exist solely to _remove_ a focus ring on a child element when its parent
container owns the ring. Stay as-is.

| File:line                          | Selector                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `search-field/search-field.css:86` | `.cinder-search-field__input:focus-visible`                                |
| `input/input.css:187`              | `.cinder-input-group > .cinder-input:focus-visible`                        |
| `number-input/number-input.css:51` | `.cinder-number-input__input.cinder-input:focus-visible`                   |
| `sheet/sheet.css:135`              | `.cinder-sheet__body:focus:not(:focus-visible)` (`:focus` only suppressor) |

### Bucket E — Forced-colors overrides

Every Bucket A and most Bucket B sites have a sibling
`@media (forced-colors: active)` rule that replaces the box-shadow ring with a
real `outline` because Windows High Contrast ignores `box-shadow`. These rules
are unchanged by this batch — they don't use the formula, they replace it.

## Migration plan (B.3b)

1. Add `--_cinder-focus-ring-shadow` to `:root` in `src/styles/foundation.css`.
2. In each Bucket A file, replace the two-line `box-shadow: 0 0 0 offset
offset-color, 0 0 0 calc(offset + width) ring-color` declaration with
   `box-shadow: var(--_cinder-focus-ring-shadow);`. Leave the `outline:
var(--cinder-ring-width) solid transparent;` line as-is — it is the
   transparent outline that forced-colors mode replaces. Leave every other
   bucket alone.
3. Bucket A′ files are intentionally not migrated; they expose a per-component
   color override variable that requires the inline formula. Documented above.

Component CSS files migrated (12):

- `select/select.css`
- `textarea/textarea.css`
- `navigation-item/navigation-item.css`
- `combobox/combobox.css`
- `stacked-list-item/stacked-list-item.css`
- `chip/chip.css`
- `scroll-area/scroll-area.css`
- `table/table.css`
- `grid-list/grid-list.css`
- `pagination/pagination.css`
- `side-navigation-group/side-navigation-group.css`
- `tabs/tabs.css`

No `.tsx` files touched. No BEM class names changed. No cascade-layer changes.

## Verification

Per migrated component, the resolved `box-shadow` is byte-identical to
pre-migration (same token references, same formula). Forced-colors fallbacks
are unchanged. Disabled-state suppression is unchanged.
