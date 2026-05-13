# Design System Roadmap

Audit of the existing Svelte component set in `packages/components/src/components` against the Tailwind UI application UI patterns. The design system is not yet in production use, so changes here can break existing APIs freely. Each section captures the pattern, best-practice notes, and a concrete checklist of work.

## Summary Decision Table

| Pattern             | Decision | Target                                                       |
| ------------------- | -------- | ------------------------------------------------------------ |
| Page headings       | UPDATE   | `page-layout.svelte`                                         |
| Section headings    | ADD      | `section-heading.svelte`                                     |
| Description lists   | ADD      | `description-list.svelte`                                    |
| Statistics          | ADD      | `stat.svelte`, `stat-group.svelte`                           |
| Stacked lists       | ADD      | `stacked-list-item.svelte`                                   |
| Tables              | UPDATE   | table primitive set                                          |
| Grid lists          | ADD      | `grid-list.svelte`, `grid-list-item.svelte`                  |
| Feeds               | ADD      | `feed.svelte`, `feed-event.svelte`                           |
| Form layouts        | ADD      | `form-field.svelte`, `form-section.svelte`                   |
| Input groups        | UPDATE   | `input.svelte`                                               |
| Select menus        | UPDATE   | `select.svelte`, `combobox.svelte`                           |
| Textareas           | UPDATE   | `textarea.svelte`                                            |
| Radio groups        | UPDATE   | `radio.svelte`, `radio-group.svelte`                         |
| Checkboxes          | ADD      | `checkbox-group.svelte`                                      |
| Sign-in forms       | SKIP     | composition, not a primitive                                 |
| Navbars             | UPDATE   | `navigation-bar.svelte`, `navigation-item.svelte`            |
| Vertical navigation | ADD      | `side-navigation.svelte`, `side-navigation-group.svelte`     |
| Sidebar navigation  | ADD      | `sidebar.svelte`                                             |
| Progress bars       | ADD      | `steps.svelte` (+ reduced-motion audit on `progress.svelte`) |
| Drawers             | ADD      | `drawer.svelte`                                              |
| Buttons             | UPDATE   | `button.svelte`                                              |
| Button groups       | ADD      | `button-group.svelte`                                        |
| Color picker        | ADD      | `color-picker.svelte`                                        |
| Visually hidden     | ADD      | `visually-hidden.svelte`                                     |
| Segmented control   | REWRITE  | `segmented-control.svelte` (absorb multi-select)             |
| Surface             | REVIEW   | `surface.svelte` (existing — reconcile tone vs. variant API) |
| Color swatch picker | ADD      | `color-swatch-picker.svelte`                                 |
| Date picker         | ADD      | `date-picker.svelte`                                         |
| Time picker         | ADD      | `time-picker.svelte`                                         |
| Number input        | ADD      | `number-input.svelte`                                        |
| File upload         | ADD      | `file-upload.svelte`                                         |
| Slider              | ADD      | `slider.svelte`                                              |
| Color field         | ADD      | `color-field.svelte`                                         |
| Search field        | ADD      | `search-field.svelte`                                        |
| Tag input           | ADD      | `tag-input.svelte`                                           |
| Chip                | ADD      | `chip.svelte`                                                |
| Banner              | ADD      | `banner.svelte`                                              |
| Callout             | ADD      | `callout.svelte`                                             |
| Status dot          | ADD      | `status-dot.svelte`                                          |
| Popover             | ADD      | `popover.svelte`                                             |
| Command palette     | ADD      | `command-palette.svelte`                                     |
| Sheet               | ADD      | `sheet.svelte`                                               |
| Confirmation dialog | ADD      | `confirm-dialog.svelte`                                      |
| Divider             | ADD      | `divider.svelte`                                             |
| Layout primitives   | ADD      | `stack`, `inline`, `cluster`, `center`, `spacer` (one PR)    |
| Container           | AUDIT    | `page-layout.svelte` (extract `--cinder-content-width`)      |
| Aspect ratio        | ADD      | `aspect-ratio.svelte`                                        |
| Scroll area         | ADD      | `scroll-area.svelte`                                         |
| Image               | ADD      | `image.svelte`                                               |
| Toast API docs      | DOCS     | `toast-region.svelte` (audit + usage docs)                   |
| Infinite scroll     | ADD      | `infinite-scroll.svelte` (+ load-more fallback)              |
| Sortable list       | ADD      | `sortable.svelte`                                            |
| Tree                | ADD      | `tree.svelte` + `tree-item.svelte`                           |
| Calendar display    | ADD      | `calendar.svelte`                                            |
| Theme switcher      | ADD      | `theme-switcher.svelte` + dark-mode strategy                 |
| Token docs          | DOCS     | public `--cinder-*` token reference                          |
| RTL audit           | AUDIT    | `stylelint-use-logical` + logical-property migration         |
| Focus ring policy   | AUDIT    | unify `:focus-visible` styling across components             |
| useReducedMotion    | ADD      | `utilities/use-reduced-motion.svelte.ts`                     |
| Skip-link recipe    | DOCS     | recipe using `visually-hidden` `focusable`                   |
| Announcer export    | DOCS     | export `useAnnouncer` from package index + docs              |
| Maturity badges     | PROCESS  | JSDoc `@status` convention + lint                            |

## Headings & Data Display

### Page headings — UPDATE `page-layout.svelte`

Tailwind variants combine title, breadcrumbs, meta (role/date/location), avatar, and actions. The core structure is always: optional breadcrumb row, title row, optional action row.

Best-practice notes: `<header>` is sufficient as a landmark — don't add `aria-label`; primary action goes rightmost in LTR; meta should be `<dl>` with visually hidden `<dt>` so each value is announced with context; DOM order must match visual stacking so focus flow stays logical.

- [ ] Add optional `breadcrumbs` snippet slot above the title row (consumer passes in `<Breadcrumbs>`, keeps `page-layout` decoupled from breadcrumb data shape).
- [ ] Add optional `meta` snippet slot rendered beneath the `<h1>` for role/date/location content.
- [ ] Add optional `avatar` snippet slot rendered to the left of the title.
- [ ] Accept `title` as `string | Snippet` (discriminated union) so consumers can override the `<h1>`.
- [ ] Ensure the actions row preserves a 44px minimum block height and aligns buttons to the end of the flex row.

### Section headings — ADD `section-heading.svelte`

Variants: title-only, title+description, title+actions, title+input group, title+tabs (below or inline), title+label, title+badge+dropdown.

Best-practice notes: heading level must be configurable (sections nest, hardcoding `<h2>` is a frequent a11y mistake); tabs and title share a single `<header>` so AT groups them; the small uppercase "label" variant should use `<hgroup>` to associate label and heading; action buttons must not dominate over the heading itself.

- [ ] Create `section-heading.svelte` with props `title: string`, `description?: string`, `level?: 2 | 3 | 4` (default `2`), and snippets `label?`, `actions?`, `tabs?`.
- [ ] Render the heading via `<svelte:element this={'h' + level}>`.
- [ ] When both `actions` and `tabs` snippets are present, place `tabs` in a second row below the title+actions row inside a shared `<header>`.
- [ ] When `label` snippet is provided, wrap label + heading in `<hgroup>`.
- [ ] Use `data-cinder-variant` to drive CSS variants (e.g. `inline-tabs`) without prop proliferation.

### Description lists — ADD `description-list.svelte`

Variants: left-aligned stacked, left-aligned in a card, striped rows, two-column at wide viewports, inline per-row actions, and a narrow variant with visually hidden `<dt>`. `data-list.svelte` is a generic iterator and should not be repurposed.

Best-practice notes: always `<dl>` / `<dt>` / `<dd>` — never `<div>` pairs or `<table>`; wrapping `<div>` inside `<dl>` is valid and required for striping or row-level actions; in two-column layouts the pair must remain sibling DOM order so linearization keeps the term/definition association; hidden labels use `sr-only`, never `aria-hidden`; per-row `Edit` actions need `aria-label="Edit <field name>"` to disambiguate.

- [ ] Create `description-list.svelte` with props `items: Array<{ term: string; definition: string; actions?: Snippet }>`, `variant?: 'default' | 'striped' | 'two-column' | 'narrow'`, `class?: string`.
- [ ] Render as `<dl>` with each pair wrapped in `<div class="cinder-description-list__row">`.
- [ ] In `narrow` variant, render `<dt>` with `sr-only` rather than removing it from the DOM.
- [ ] When a row's `actions` snippet is provided, render it inside the row alongside `<dd>`; document the `aria-label` requirement for action links.
- [ ] Leave `data-list.svelte` untouched.

### Statistics — ADD `stat.svelte` and `stat-group.svelte`

Variants: with trending indicator, simple label+number, in cards, with icon, with shared borders. `diff-statistics.svelte` is a specialized diff widget — leave it alone.

Best-practice notes: each stat wrapped in `role="group"` with `aria-label` equal to the label so the value+label is announced as one unit; trend direction must not rely on color alone (arrow icon is the second channel); the change value needs an explicit `aria-label` that words the sign ("increased by 4.75 percent") rather than relying on screen readers to parse "+"; grid layouts use `auto-fit` + `minmax` for responsive reflow without breakpoint shenanigans.

- [ ] Create `stat.svelte` with props `label: string`, `value: string | number`, `change?: { value: string; direction: 'up' | 'down' | 'neutral'; description?: string }`, `icon?: Snippet`, `class?: string`.
- [ ] Add `role="group"` and `aria-label={label}` on the stat root.
- [ ] Render the change indicator with `aria-label` derived from `change.description` (fallback: `"${direction === 'up' ? 'increased' : 'decreased'} by ${value}"`).
- [ ] Create `stat-group.svelte` with props `columns?: 1 | 2 | 3 | 4 | 'auto'`, `variant?: 'default' | 'cards' | 'shared-borders'`, `children: Snippet`, `class?: string`; renders a CSS grid container driven by `data-cinder-variant`.

## Lists & Tables

### Stacked lists — ADD `stacked-list-item.svelte`

Rich vertical list rows with avatar/icon, primary label, secondary metadata, and optional trailing action or badge.

Best-practice notes: use `<ul>` / `<li>` semantically; place the interactive element inside `<li>`, never on `<li>` itself; each row's action needs a disambiguated accessible label ("Edit Jane Cooper", not "Edit"); at narrow widths trailing metadata typically needs to stack beneath the primary label.

- [ ] Create `stacked-list-item.svelte` with snippets `leading`, `title`, `description`, `meta`, `trailing`.
- [ ] Accept an optional `href` prop: when present render the title as `<a>`, otherwise plain text.
- [ ] Add `data-cinder-density` (`comfortable` / `condensed`) for row-height variants without class spam.
- [ ] Write accessible-label guidance in `stacked-list-item.a11y.md` covering disambiguated row labels.

### Tables — UPDATE table primitive set

The primitives (table, body, cell, header, header-cell, row) exist. Gaps are higher-level patterns: selectable rows with indeterminate select-all, sticky header, density variants, mobile collapse.

Best-practice notes: `position: sticky` on `<thead>` inside a scroll container works natively but z-index must be explicit; select-all uses `aria-checked="mixed"` when partial; row action menus need `aria-label` tied to the row identity; mobile collapse to card-stack can't be CSS-only when columns are dynamic.

- [ ] Add `selectable` boolean prop to `TableRow`; when true, render a leading `<td>` with a checkbox wired via context.
- [ ] Add select-all support to `TableHeader`: `onSelectAll` callback plus controlled `allSelected` / `someSelected` props driving `aria-checked="mixed"`.
- [ ] Add `density` prop (`comfortable` | `condensed` | `spacious`) to `Table`, surfaced as `data-cinder-density`.
- [ ] Audit existing `sortable` on `TableHeaderCell`: confirm the sort indicator icon meets 3:1 non-text contrast and the inner button has a visible `:focus-visible` ring.
- [ ] Document the mobile-collapse pattern in `table.a11y.md`: recommend `@container`-driven column hiding for simple cases; flag that full card-stack collapse is a consumer-level structural change.

### Grid lists — ADD `grid-list.svelte` and `grid-list-item.svelte`

A CSS Grid gallery of card-shaped items (people directories, integration tiles, asset grids). Distinct from `DataList` because it needs semantic `<ul>` + responsive grid plus richer per-item composition.

Best-practice notes: wrap with `<ul role="list">` to preserve list semantics that Safari drops on styled lists; avoid full-card links when the card also contains secondary actions — use the stretched-link pattern instead; `repeat(auto-fill, minmax(<min>, 1fr))` is the idiomatic responsive implementation; min touch target 44×44px for action buttons inside cards.

- [ ] `grid-list.svelte`: `<ul role="list">` wrapper, `columns` prop expressed as a min-item-width token (e.g. `"16rem"`) used in `minmax()`.
- [ ] `grid-list-item.svelte`: `<li>` with snippets `image`, `title`, `subtitle`, `meta`, `actions`; stretched-link via opt-in `href` prop.
- [ ] Reuse `Avatar`, `Badge`, and `Card` tokens — no new visual variables.
- [ ] Verify keyboard focus order across rows is logical (left-to-right, top-to-bottom) and actions inside items don't trap focus.

### Feeds — ADD `feed.svelte` and `feed-event.svelte`

A vertically ordered activity timeline with a connecting line and per-event icons, timestamps, and content. Nothing in the current set models this.

Best-practice notes: use `<ol>` (chronological) with `<li>` per event; connector line is purely CSS via `::before`, `aria-hidden`; timestamps use `<time datetime="ISO-8601">`; for streaming feeds, set `aria-live="polite"` and `aria-atomic="false"` on the `<ol>`.

- [ ] `feed.svelte`: `<ol aria-label>` wrapper; optional `live` boolean adding `aria-live="polite" aria-atomic="false"`.
- [ ] `feed-event.svelte`: `<li>` with snippets `icon`, `content`, `timestamp`; connector line via `::before`, toggled off on the last child.
- [ ] Accept `datetime` (ISO string) on `feed-event` and render `<time {datetime}>` internally — never rely on consumer formatting.
- [ ] Add `data-cinder-variant` (`icon` | `minimal`) to support both icon-badge and simple dot variants.

## Forms

### Form layouts — ADD `form-field.svelte` and `form-section.svelte`

The most load-bearing missing primitive. Without a generic label/description/error wrapper, multi-column form layouts force every consumer to re-wire `aria-describedby` for custom controls.

Best-practice notes: each logical group should be `<fieldset>` + `<legend>`, not a `<div>` with a heading; column changes should respond to container queries, not viewport breakpoints, so the layout adapts inside narrower panels; required must be both visual and programmatic, with the indicator's meaning explained once per form.

- [ ] `form-field.svelte` with props `id`, `label`, `description`, `error`, `required`, `class`; renders `<label for={id}>`, description `<p>`, error `<p>`, and `{@render children()}`.
- [ ] Compose `aria-describedby` on the control slot via a context key so child controls inherit the composed ID without re-declaring it.
- [ ] `form-section.svelte`: heading + optional description + responsive grid of `form-field` slots driven by container queries.

### Input groups — UPDATE `input.svelte`

`input.svelte` has no slot for inline addons. Adding them blocks any realistic form with currency/URL prefix/suffix inputs.

Best-practice notes: decorative addons need `aria-hidden="true"`; informational addons must be referenced via `aria-describedby` on the input; the focus ring must surround the entire group, not just the inner `<input>`.

- [ ] Add `leading?: Snippet` and `trailing?: Snippet` props; render them in a `.cinder-input-group` wrapper when present.
- [ ] Wrapper handles combined focus ring (`:focus-within`) and padding offsets to clear addon widths.
- [ ] Addon text nodes get `aria-hidden="true"` by default; document that meaningful addons must carry their own label.
- [ ] Add `autocomplete` guidance to `input.a11y.md`.

### Select menus — UPDATE `select.svelte` (+ extend `combobox.svelte`)

`select.svelte` is missing the field-control contract (`description`, `error`, `aria-invalid`). The "rich" custom select with avatars and descriptions is functionally the same as `combobox.svelte`'s listbox.

Best-practice notes: keep the native `<select>` tier — it wins on mobile, keyboard, and screen readers; the custom listbox variant needs full `listbox`/`option` ARIA with `aria-selected`, `aria-disabled`, `aria-activedescendant`; the trigger needs `aria-haspopup="listbox"` and `aria-expanded` wired to open state.

- [ ] Add `description`, `error`, and `required` props to `select.svelte`; wire `aria-describedby` and `aria-invalid` via the shared `field-control.ts`.
- [ ] Extend `ComboboxOption` with optional `description?: string` and `avatar?: string` fields; render them in the listbox option template.
- [ ] Update `select.a11y.md` with the new props.

### Textareas — UPDATE `textarea.svelte`

The component already has the field-control contract; the gap is character count and auto-resize.

Best-practice notes: character count must be in an `aria-live="polite"` region or wired via `aria-describedby`; auto-resize via `field-sizing: content` with a JS height-sync fallback; `rows` is advisory, not a hard cap.

- [ ] Add `showCount?: boolean`; when true and `maxlength` is set, render `<p aria-live="polite">` with `{value.length}/{maxlength}` below the textarea.
- [ ] Include the count element ID in `composeDescribedBy`.
- [ ] Add `field-sizing: content` to `.cinder-textarea` with the JS fallback documented in `textarea.a11y.md`.

### Radio groups — UPDATE `radio.svelte` (+ small `radio-group.svelte` follow-ups)

`radio-group.svelte` already uses `<fieldset>` + `<legend>` correctly. The gap is per-option descriptions for the card variant.

Best-practice notes: a checked-border highlight must not be the sole checked indicator; per-option descriptions must associate to the individual `<input>` via `aria-describedby`, not to the group; the inline segmented strip variant is already served by `segmented-control.svelte`.

- [ ] Add `description?: string` prop to `radio.svelte`; render `<p id="{id}-description">` and add to `aria-describedby` on the `<input>`.
- [ ] Add `variant?: 'default' | 'card'` to `RadioGroup`; emit `data-variant` for CSS to drive bordered card layout.
- [ ] Confirm `radio.svelte` reads `invalid` from `RadioGroupContext` and sets `aria-invalid`.

### Checkboxes — ADD `checkbox-group.svelte`

`checkbox.svelte` is in good shape (it already exposes `description` and indeterminate). The gap is a semantic group wrapper.

Best-practice notes: mirror `radio-group.svelte`'s `<fieldset>` + `<legend>` pattern; same sole-indicator caveat for card-variant checked borders.

- [ ] Create `checkbox-group.svelte` mirroring `radio-group.svelte`'s structure (without shared `value`/`name` context — each checkbox owns its own `name`).
- [ ] Add `variant?: 'default' | 'card'` consistent with `RadioGroup`.
- [ ] Add `checkbox-group.a11y.md` documenting the fieldset requirement and indeterminate parent pattern.

### Sign-in forms — SKIP

Composition concern, not a primitive. All building blocks exist.

- [ ] Add a note to `input.a11y.md` calling out `autocomplete="current-password"` and `autocomplete="email"` as required for auth inputs.
- [ ] Add a sign-in composition example to Storybook demonstrating the top-of-form `aria-live="assertive"` auth-error pattern.

## Navigation & Overlays

### Navbars — UPDATE `navigation-bar.svelte` (+ `navigation-item.svelte`)

The wrapper and item handle the core pattern. Missing: mobile collapse + hamburger toggle.

Best-practice notes: wrap with `<nav aria-label="Main navigation">`; active item uses `aria-current="page"`; mobile toggle needs `aria-expanded` + `aria-controls`; in-bar dropdowns must trap arrow-key navigation and close on Escape, returning focus to the trigger.

- [ ] Add `mobileMenuOpen: boolean = $bindable(false)` plus a `menuToggle` snippet slot.
- [ ] Wire `aria-expanded` + `aria-controls` on the toggle, matching the collapsible region's `id`.
- [ ] Add a `mobile` variant prop to `NavigationItemProps` for stacked layout.
- [ ] Make `<nav>` `aria-label` configurable via prop (currently hardcoded).

### Vertical navigation — ADD `side-navigation.svelte` and `side-navigation-group.svelte`

No existing component covers a vertical stacked nav list with collapsible section grouping. Reuse `navigation-item.svelte` as the leaf.

Best-practice notes: wrap in `<nav>` with a label distinct from any top navbar; section headers should be `role="presentation"` labels or `aria-labelledby` on the `<ul>` — not `<h2>`/`<h3>` unless they're truly document headings; collapsible group triggers need `aria-expanded` + `aria-controls`.

- [ ] `side-navigation.svelte`: `<nav>` + `<ul>` scaffold with required `aria-label` prop.
- [ ] `side-navigation-group.svelte`: collapsible disclosure with `aria-expanded`, `aria-controls`, `id`, and a `label` prop for the section header.
- [ ] Support `icon` and `badge` snippet props on group headers.
- [ ] Reuse `navigation-item.svelte` as the leaf — no duplication.

### Sidebar navigation — ADD `sidebar.svelte`

Layout-level concern combining branding, vertical nav, footer/user-account, and a collapsible icon-only mode. Delegates the actual nav list to `side-navigation.svelte`.

Best-practice notes: outer landmark is `<aside aria-label="Sidebar">` with `<nav>` inside; collapsed/icon-only mode requires `aria-label` on each `navigation-item` to substitute for hidden text; on mobile, this pattern transitions into a drawer — coordinate with `drawer.svelte`.

- [ ] Create `sidebar.svelte` with `collapsed: boolean = $bindable(false)` and snippets `brand`, `navigation`, `footer`.
- [ ] Propagate `collapsed` via context so `side-navigation-group` and `navigation-item` can switch to icon-only mode.
- [ ] Below the `md` breakpoint, render via `drawer.svelte` instead of inline `<aside>`.

### Progress bars — ADD `steps.svelte` (audit `progress.svelte`)

`progress.svelte` already covers determinate + indeterminate, bar + ring variants, and sizes. Step indicators (wizard progress) are a different pattern — navigation, not metering — and need their own component.

Best-practice notes: step indicators use `aria-current="step"` on the active step and do not use `role="progressbar"`; `prefers-reduced-motion` should disable the existing indeterminate animation.

- [ ] Create `steps.svelte` with `steps: { label: string; description?: string }[]` and `currentStep: number`.
- [ ] Mark active step with `aria-current="step"`; mark completed steps with a checkmark and equivalent `aria-label`.
- [ ] Support horizontal and vertical orientations.
- [ ] Verify `progress.svelte` CSS applies `@media (prefers-reduced-motion: reduce)` to the indeterminate animation.

### Drawers — ADD `drawer.svelte`

Edge-anchored slide-in panel. Don't extend `modal.svelte` — modal is center-overlay. Share the underlying focus-trap utilities instead.

Best-practice notes: use native `<dialog>` with `showModal()` for focus trap + ESC handling; `aria-labelledby` to the title (or `aria-label` if no title); apply body scroll lock on open and release on close; the slide transform should respect `prefers-reduced-motion` and fall back to a fade.

- [ ] `drawer.svelte` using `<dialog showModal()>` with `side: 'left' | 'right' = 'right'` and `size: 'sm' | 'md' | 'lg' | 'xl' = 'md'`.
- [ ] Reuse `captureFocus` / `restoreFocusTo` from `_internal/overlay.ts`; accept `triggerRef` matching `modal.svelte`'s API shape.
- [ ] Snippets `header`, `children`, `footer`; include a close button in the header.
- [ ] Apply body scroll lock on open and restore on close.
- [ ] CSS slide animation from the correct edge; reduced-motion fallback to fade.
- [ ] Wire `aria-labelledby` to the header title element via `useId`.

## Buttons

### Buttons — UPDATE `button.svelte`

Current variants are `primary | secondary | danger | ghost | ghost-danger`; current sizes are `xs | sm | md | lg`. Tailwind's reference set adds `soft`, distinguishes `outline` from filled secondary, includes an `xl` size, and standardizes leading/trailing icon slots.

Best-practice notes: icon-only buttons need `aria-label` (never label-less); loading state needs both `aria-busy="true"` and `aria-disabled="true"`; minimum 44×44px touch target — the xs/sm sizes likely need a hit-area expansion; the loading spinner must be `aria-hidden="true"` and the visible label must remain in the DOM (not swapped out) so the button's accessible name doesn't disappear.

- [ ] Add `soft` to `ButtonVariant` (tinted background, mid-emphasis).
- [ ] Decide between renaming/aliasing `secondary` → `outline`, or adding `outline` as a distinct variant; document the distinction.
- [ ] Add `soft-danger` for tinted destructive actions.
- [ ] Add `xl` to `ButtonSize`.
- [ ] Add `leadingIcon` and `trailingIcon` snippet props for consistent structural treatment and gap tokens.
- [ ] Add an `iconOnly` boolean (or detect from prop shape) that applies square padding and enforces `aria-label` in dev mode.
- [ ] Verify xs and sm sizes meet 44px touch targets; add hit-area expansion if not.
- [ ] Confirm the loading spinner is `aria-hidden="true"` and the visible label remains rendered during loading.

### Button groups — ADD `button-group.svelte`

Categorically distinct from `segmented-control.svelte`. `segmented-control` is a single-select radio-group pattern (one option active, roving tabindex, `role="radiogroup"`). `button-group` is a layout + border-collapse container for independent action buttons with no built-in selection state. Mixing them would trap users in the wrong keyboard model.

Best-practice notes: container needs `role="group"` with `aria-label`; toggle buttons inside need `aria-pressed`, not `aria-checked`; focused buttons must elevate `z-index` so focus rings aren't clipped by adjacent siblings; split-button dropdown trigger needs `aria-haspopup="true"` and `aria-expanded`.

- [x] Create `button-group.svelte` as a layout container: `role="group"`, required `label: string` for `aria-label`, `class` passthrough, `orientation: 'horizontal' | 'vertical'` (default horizontal).
- [x] Border-collapse via adjacent-sibling selectors or data attributes so internal shared borders render as a single 1px line, not 2px doubled.
- [x] Elevate focused child `z-index` so focus rings aren't clipped by the group's border context.
- [x] Document the split-button composition in Storybook using the existing `dropdown.svelte` as the trailing trigger — no new split-button primitive.
- [x] Do NOT add selection-state logic to `button-group` — keep that boundary clean against `segmented-control`.

## Forms — Additional Components

### Color picker — ADD `color-picker.svelte`

Visual color selection via a 2D HSL gradient plus hue slider, optional alpha slider, and predefined swatch support. Reference: Shopify App Home `s-color-picker`. No existing color primitive in the system. Pairs with a future `color-field` for combined visual + text-based selection.

Best-practice notes: accept hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`), `rgb()`/`rgba()`, and `hsl()`/`hsla()` as input; always emit hex from the `change` event so consumers have one canonical format; the 2D gradient is mouse/touch-only by nature — surrounding controls (hue slider, alpha slider, swatch list) must be fully keyboard-operable with `aria-label`s and arrow-key behavior; the gradient region needs `role="application"` with documented limitation about fine-grained keyboard selection rather than pretending it's accessible; integrate with the field-control contract (`form-field.svelte`) for label/description/error wiring; respect `prefers-reduced-motion` for any animated handle transitions; participate in form reset via native `<form>` reset so the value reverts to `defaultValue`.

- [ ] Create `color-picker.svelte` with props `value: string` (controlled), `defaultValue?: string` (uncontrolled initial), `alpha?: boolean = false`, `name?: string`, `swatches?: string[]`, `disabled?: boolean`, `class?: string`.
- [ ] Internally store color in HSL/HSLA; parse `value` from hex/`rgb()`/`hsl()` on the way in; emit hex (or hex-with-alpha when `alpha` is true) on `change` and `input` events.
- [ ] Render gradient region with `role="application"` and an `aria-label` explaining the picker; expose hue and alpha as `role="slider"` with `aria-valuemin`/`max`/`now` and arrow-key support.
- [ ] Render an optional swatch list when `swatches` is provided: `<ul role="listbox">` with each swatch as `<li role="option">`, keyboard-navigable via arrow keys, `aria-label` per swatch with the hex value and any consumer-supplied name.
- [ ] When `alpha={false}` and an alpha-bearing value comes in (e.g. `#FF0000FF`), drop alpha silently on emit but keep the input parser tolerant.
- [ ] Return an empty string from the value getter when the input string fails to parse, matching the Shopify behavior.
- [ ] Wire form-reset support: on the nearest `<form>` reset, revert to `defaultValue`. Use Svelte's form-reset mechanism rather than re-inventing a callback prop.
- [ ] Render a small preview swatch next to the picker showing the selected color (with checkerboard background when alpha is enabled).
- [ ] Document the keyboard-fine-grained-selection limitation in `color-picker.a11y.md` along with the touch-precision caveat and the recommendation to pair with a future `color-field` for exact entry.
- [ ] Tests: hex/rgb/hsl parser round-trips; alpha on/off emit format; arrow-key on hue and alpha sliders; swatch keyboard navigation; form reset reverts to `defaultValue`; invalid input yields empty-string value.

## Utilities

### Visually hidden — ADD `visually-hidden.svelte`

Hide content visually while keeping it announced to assistive technology. The CSS technique already exists as `.cinder-sr-only` in `styles/utilities.css`; what's missing is a reusable Svelte primitive so consumers stop reinventing it with inline `class="sr-only"` and component-local `<style>` blocks. Reference: Ariakit `VisuallyHidden`.

Today's state in the repo:

- `.cinder-sr-only` exists in `styles/utilities.css` (correct clip-rect technique).
- `.cinder-visually-hidden` is duplicated inside `styles/components/avatar.css`.
- Several components (`chat-input`, `message-attachments`, `chat-status-announcer`) define their own local `.sr-only` rules.
- `spinner.svelte` uses its own `.cinder-spinner__sr-only`.

Consolidate around one `<VisuallyHidden>` component and one canonical class. Migrate call sites in a follow-up so this task stays small.

Best-practice notes: render as `<span>` by default so the component is inline-flow-compatible; expose an `as` prop (or `element` prop) for cases that need block semantics (`<div>` inside a `<dl>`, `<dt>` inside a screen-reader-only `<dl>` row); support a `focusable` mode for skip-links and "Skip to main content" patterns — when `focusable` is on, the element becomes visible on `:focus`/`:focus-within` by overriding the clip; never use `display: none` or `visibility: hidden` (both remove from the AT tree); never use `aria-hidden="true"` (that's the _opposite_ of what this component does); the canonical CSS is the clip-rect/1px/absolute pattern already present in `utilities.css`.

- [ ] Create `visually-hidden.svelte` with props `as?: keyof HTMLElementTagNameMap = 'span'`, `focusable?: boolean = false`, `class?: string`, plus `children: Snippet`.
- [ ] Render via `<svelte:element this={as}>` so block-vs-inline use cases are covered with one component.
- [ ] Apply `cinder-sr-only` by default; when `focusable` is true, apply an additional `cinder-sr-only-focusable` class that reverts the clip on `:focus`, `:focus-within`, and `:focus-visible`.
- [ ] Add the `.cinder-sr-only-focusable` rule alongside `.cinder-sr-only` in `styles/utilities.css` — keep the visually-hidden utilities co-located, do not introduce a new stylesheet.
- [ ] Delete the duplicate `.cinder-visually-hidden` rule in `styles/components/avatar.css`; update `avatar.svelte` to use the new `<VisuallyHidden>` component (or `cinder-sr-only` class — pick the component for parity).
- [ ] Spread `...rest` so consumers can pass `id`, `aria-*`, `data-*`, etc. through to the rendered element.
- [ ] Forward `class` via `classNames(...)` so consumers can layer additional classes without losing the utility.
- [ ] Write `visually-hidden.a11y.md`: covers when to use this vs. an `aria-label`/`aria-labelledby` (rule of thumb: prefer aria attributes when the visible UI already names the element; use `<VisuallyHidden>` when you need additional context only ATs should hear, or when the visible UI is non-text like an icon-only button with adjacent state text); skip-link example using `focusable`; explicit warning never to confuse this with `aria-hidden`.
- [ ] Tests: renders as `<span>` by default; respects `as` prop; applies `cinder-sr-only`; applies focusable class when prop is set; passes through arbitrary attributes; content is queryable via `getByText` (i.e., not pruned from the DOM).
- [ ] Storybook story: default usage inside an icon-only button; skip-link usage with `focusable` showing the visible-on-focus behavior; usage as a `<dt>` inside a description list "narrow" variant (ties to the description-list task).
- [ ] Follow-up cleanup (not blocking this task): migrate `chat-input`, `message-attachments`, `chat-status-announcer`, and `spinner` to use the component and remove their local `.sr-only` declarations. File a separate task once the primitive ships.

## Selection Controls

### Segmented control — REWRITE `segmented-control.svelte` to absorb multi-select

Hero UI's `ToggleButtonGroup` covers two distinct selection modes (single, multiple) with one component. Today our `segmented-control.svelte` only does single (`role="radiogroup"`, one bindable `value`). Rather than ship a parallel `toggle-button-group` and live with two adjacent components, **keep the `segmented-control` name and broaden it** so the design system has one selection-group primitive — distinct from the (queued) `button-group.svelte`, which remains layout-only with no selection state.

This is a **breaking API change**, but consumers are limited and all currently use single-select, so a `selectionMode` default of `'single'` keeps existing call sites working. Reference: Hero UI `ToggleButtonGroup`.

Current consumers to verify after the rewrite: `markdown-editor.svelte`, `review-editor-controls.svelte`, `diff-toolbar.svelte`, the playground example, and the test file.

Best-practice notes: in `single` mode use `role="radiogroup"` with `role="radio"` children, roving tabindex, and arrow-key selection (today's behavior — keep it); in `multiple` mode use `role="group"` with regular `<button>` children, `aria-pressed` per button, and Tab/Shift+Tab traversal (no roving — multi-select toolbars use normal tab order so users can reach individual buttons); never mix `aria-pressed` with `role="radio"` (that's a category error); `disallowEmptySelection` is a `single`-mode-only concept and should be a no-op in `multiple` mode; the separator (Hero UI's `ToggleButtonGroup.Separator`) is a visual divider and must be `aria-hidden`; sizes propagate from the group to children via context, never via prop drilling on each option.

- [ ] Rewrite `segmented-control.svelte` props. Common: `id`, `label`, `hideLabel?`, `disabled?`, `size?: 'sm' | 'md' | 'lg' = 'md'`, `orientation?: 'horizontal' | 'vertical' = 'horizontal'`, `detached?: boolean = false`, `fullWidth?: boolean = false`, `selectionMode?: 'single' | 'multiple' = 'single'`, `options: readonly SegmentedControlOption<T>[]`, `class?`. Mode-specific: `value?: T` (single) or `value?: Set<T>` (multiple) — discriminated union on `selectionMode`. Add `disallowEmptySelection?: boolean = false` (single-only).
- [ ] In `single` mode: keep current radiogroup behavior — `role="radiogroup"`, `role="radio"` children, `aria-checked`, roving tabindex via the existing `roving-tabindex.ts` utility, arrow-key selection.
- [ ] In `multiple` mode: emit `role="group"` on the container, render children as `<button type="button">` with `aria-pressed`, drop the roving tabindex — let normal Tab order apply.
- [ ] Add a separator child component (`segmented-control-separator.svelte`) or render an internal separator between options when `detached={false}`. Separator must be `aria-hidden="true"`. Consider just doing this in CSS via `:not(:first-child)::before` to avoid a public separator component.
- [ ] Add `detached` mode: gaps between buttons, independent border-radius per button. Default is attached (current behavior).
- [ ] Add `fullWidth` mode: container is `display: flex`, children `flex: 1`.
- [ ] Add `orientation: 'vertical'` support: flex-direction column, arrow keys flip from left/right to up/down in single mode.
- [ ] Size propagation: group-level `size` prop sets a context value; children read it. No per-option `size`.
- [ ] In `multiple` mode, value is `Set<T>` — clicking toggles membership; in `single` mode value is `T | undefined` — clicking sets, with `disallowEmptySelection` controlling whether the active option can be re-clicked to clear.
- [ ] Migrate all current consumers: `markdown-editor.svelte`, `review-editor-controls.svelte`, `diff-toolbar.svelte`, and the playground example. All are single-select today, so the migration is mostly verifying the default `selectionMode="single"` produces the same DOM/behavior. Add `selectionMode` explicitly to each call site so intent is obvious.
- [ ] Update `segmented-control.test.ts`: add multi-select coverage (Tab order, `aria-pressed` toggling, no roving), keep all existing single-select tests passing.
- [ ] Update `segmented-control.css`: `data-cinder-orientation`, `data-cinder-detached`, `data-cinder-full-width`, `data-cinder-size` selectors. BEM-ish naming kept consistent with rest of the codebase.
- [ ] Document the single vs. multiple ARIA distinction in a new `segmented-control.a11y.md` (or update if one exists): explain why we don't use `aria-pressed` on radios, why multi-select uses regular tab order, when to reach for `button-group` (layout-only) vs. `segmented-control` (selection state).
- [ ] Storybook: stories for single, multiple, horizontal/vertical, attached/detached, full-width, sm/md/lg, disabled (whole group + individual), `disallowEmptySelection`, with-icons (icon-only and icon+label).

### Surface — REVIEW `surface.svelte` against Hero UI's variant model

We already have `surface.svelte` with a `tone: 'default' | 'raised' | 'inset'` API. Hero UI's `Surface` uses `variant: 'default' | 'secondary' | 'tertiary' | 'transparent'` — a _prominence_ / _elevation depth_ model rather than the raised/inset visual-affordance model we have today. These describe different things; the choice between them is a design-language decision, not a mechanical port.

Two options to evaluate before committing to changes:

1. **Keep `tone`, add `transparent` as a fourth value.** Minimal churn. Our `raised`/`inset` semantic stays intact; we just gain a no-background mode for overlay scenarios.
2. **Switch to a prominence model** (`level: 1 | 2 | 3` or `variant: 'default' | 'secondary' | 'tertiary' | 'transparent'`). Aligns with Hero UI's mental model and reads more naturally when you have nested surfaces ("an L2 panel inside an L1 page"). Bigger conceptual shift.

This task is a **review-and-decide**, not a hands-on rewrite — start by writing a short ADR-style decision doc inside the plan, then implement the chosen path.

Best-practice notes: surfaces are presentational, not landmarks — do not add `role="region"` or `aria-label` by default (consumers add those if the surface happens to wrap a landmark); a `SurfaceContext` (Hero UI does this) so nested form components can pick a lower-emphasis variant automatically is genuinely useful — worth porting regardless of which API model we pick; transparent variant must still be focusable-content-friendly (no `pointer-events: none`).

- [ ] Write a brief ADR in the task plan: tone vs. variant/prominence — pick one. Include rationale, migration cost, and whether nested surfaces are a real use case in cinder today.
- [ ] If switching API: rename `SurfaceTone` → `SurfaceVariant` (or similar), update `data-cinder-tone` → `data-cinder-variant`, migrate consumers (grep the codebase for `<Surface ` first to size the change).
- [ ] Add `transparent` variant either way: `background: transparent; border: 1px solid var(--cinder-border);` — useful for nested surfaces that should not double up backgrounds.
- [ ] Add `SurfaceContext` via Svelte `setContext` keyed by a `Symbol`: exposes the current variant/tone. Document that children may opt into a lower-emphasis form variant by reading this context.
- [ ] Update `card.svelte` if it currently shares the surface visual style — confirm whether `card` composes `surface` or duplicates the styling. If duplication, file a follow-up task to consolidate (do NOT bundle into this task).
- [ ] Tests: each variant renders the correct `data-cinder-*` attribute; context is set and readable by descendants; transparent variant has no background-color but retains the border.
- [ ] Storybook: each variant in isolation, nested surfaces (e.g. tertiary inside secondary inside default), and a "form inside surface" example showing the context-driven form variant pickup.

## Color Primitives

### Color swatch picker — ADD `color-swatch-picker.svelte`

A standalone swatch list for selecting a color from a predefined palette. Distinct from the queued `color-picker.svelte` (which has a full HSL gradient + sliders): a swatch picker is a small, self-contained primitive for theme pickers, status-dot pickers, tag colors, and similar "pick from this fixed set" cases where the HSL gradient would be overkill.

Reference: Hero UI `ColorSwatchPicker`. Important relationship: `color-picker.svelte`'s built-in `swatches` prop should be implemented by **composing this component internally** rather than re-implementing the swatch grid. That keeps the keyboard/ARIA behavior in one place.

Best-practice notes: use `<ul role="listbox">` + `<li role="option">` with `aria-selected` (matches the queued color-picker swatch-list approach — keep these consistent); each swatch needs an accessible name that conveys the color (`aria-label="#F43F5E"` at minimum, or a consumer-supplied name when available); arrow-key navigation between swatches, Enter/Space to select, Home/End for first/last; selected swatch shows an indicator (default: a check icon inside the swatch with high-contrast color computed from the swatch's luminance — black on light swatches, white on dark); supports a checkerboard background for swatches with alpha; circle vs. square shape is purely cosmetic — same ARIA either way; respect `prefers-reduced-motion` for hover-scale animations.

- [ ] Create `color-swatch-picker.svelte` with props `value?: string` (controlled), `defaultValue?: string`, `colors: ColorSwatch[]`, `shape?: 'circle' | 'square' = 'circle'`, `size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md'`, `layout?: 'grid' | 'stack' = 'grid'`, `disabled?: boolean`, `class?`, plus `onchange?: (color: string) => void`. `ColorSwatch` type: `{ color: string; name?: string; disabled?: boolean }`.
- [ ] Render as `<ul role="listbox">` with each entry as `<li role="option">` carrying `aria-selected`, `aria-label={name ?? color}`, and `tabindex` via roving (reuse `roving-tabindex.ts`).
- [ ] Arrow-key navigation: Left/Right in grid layout (and Up/Down when wrapped); Up/Down in stack layout; Home/End for first/last; Enter/Space to select.
- [ ] Selected swatch shows a check-icon indicator computed for contrast (compute swatch luminance, pick black or white). Allow consumers to override via a `indicator` snippet prop for custom indicators (heart, dot, etc., per Hero UI's example).
- [ ] When a swatch's color includes alpha (e.g. `#FF0000AA`), render a checkerboard background behind it so transparency is visible.
- [ ] Size tokens map to consistent dimensions: `xs=16px`, `sm=24px`, `md=32px`, `lg=36px`, `xl=40px`. Surfaced via `data-cinder-size`.
- [ ] Shape via `data-cinder-shape`: `circle` (`border-radius: 50%`) vs. `square` (`border-radius: var(--cinder-radius-sm)`).
- [ ] Layout via `data-cinder-layout`: `grid` (`display: flex; flex-wrap: wrap`) vs. `stack` (`display: flex; flex-direction: column`).
- [ ] Disabled at item level (`<li aria-disabled="true">`) and at group level (whole listbox unfocusable, `aria-disabled="true"`).
- [ ] Respect `prefers-reduced-motion` for the hover-scale animation.
- [ ] Tests: arrow-key navigation in grid + stack layouts; Home/End; Enter/Space selection; selected state syncs to `value` prop; disabled items are skipped during navigation; indicator slot override renders custom content; alpha swatches render the checkerboard.
- [ ] Storybook: basic palette, all sizes side-by-side, circle vs. square, grid vs. stack, with default value, controlled with displayed selected hex, disabled (group + individual), custom indicator (heart icon), palette with alpha swatches.
- [ ] **Cross-task coordination**: the `color-picker.svelte` task (id `6fcd42f3`) currently specifies its own swatch list. Update that task to **compose `color-swatch-picker.svelte`** instead. Implement `color-swatch-picker` first so `color-picker` can lean on it.

## Forms — Date, Time, Number, File, Slider, Color Field, Search, Tag Input

### Date picker — ADD `date-picker.svelte`

Calendar popover anchored to a text field. The text field accepts typed date entry; the popover shows a navigable month grid. Range mode turns the single selection into a start/end pair. Locale and range are MVP, not deferred—these are the parts everyone botches.

Best-practice notes: the trigger input uses `type="text"` with `aria-haspopup="dialog"` and `aria-expanded`; the popover is a `<dialog>` with `role="dialog"` and `aria-label`; each day cell is a `<button>` inside a `<table>` with `role="grid"`, `role="gridcell"`, and `aria-selected`; arrow keys move focus within the grid, Page Up/Down advance month, Ctrl+Page Up/Down advance year, Home/End move to first/last of the week row; locale formatting uses `Intl.DateTimeFormat` and should compose with `format-date.ts`; range selection requires two focusable endpoints with distinct `aria-label`s ("Start date", "End date") and a visual highlight between them that is not the sole indicator of selection.

- [ ] Create `date-picker.svelte` with props `value?: Date | [Date, Date]` (controlled), `defaultValue?: Date | [Date, Date]`, `mode?: 'single' | 'range' = 'single'`, `locale?: string` (defaults to `navigator.language`), `min?: Date`, `max?: Date`, `disabled?: boolean`, `name?: string`, `class?: string`, plus `onchange?: (value: Date | [Date, Date]) => void`.
- [ ] Render the trigger as an `<input type="text">` paired with a calendar icon button; both elements participate in `aria-controls` pointing at the popover `<dialog>`.
- [ ] Implement month-grid calendar as `<table role="grid">` with column headers (`<th scope="col">`) for day-of-week abbreviations (locale-aware via `Intl.DateTimeFormat`).
- [ ] Wire full keyboard nav: arrow keys within the grid, Page Up/Down for month, Ctrl+Page Up/Down for year, Home/End for row start/end, Enter/Space to select, Escape to close and return focus to trigger.
- [ ] In range mode, track `hoverDate` state to render the hover-preview range; use distinct CSS data attributes (`data-range-start`, `data-range-end`, `data-in-range`) so the highlight is not color-only.
- [ ] Use `format-date.ts` for display formatting; emit `Date` objects from change events (never strings) so consumers control serialization.
- [ ] Compose with `form-field.svelte` for label/description/error wiring; wire `aria-describedby` and `aria-invalid` from the field-control context.
- [ ] Anchor popover with `popover` API or manual positioning; ensure it stays in-viewport and re-positions on scroll/resize.
- [ ] Participate in form reset by reverting to `defaultValue` on the nearest `<form>` reset event.
- [ ] Tests: keyboard navigation (arrows, Page Up/Down, Home/End, Enter, Escape); locale formatting round-trip; range selection sets start then end; min/max disables out-of-range days; form reset reverts value; `aria-selected` reflects chosen date.
- [ ] Storybook: single date, range, with min/max, with locale (`de-DE`, `ja-JP`), disabled, inside a `form-field`.

### Time picker — ADD `time-picker.svelte`

Sibling to `date-picker`. A text input accepting `HH:MM` (or `HH:MM:SS`) with an optional scroll-list popover for hour/minute/second columns. Locale-aware 12h/24h display. Like the date picker, locale support is MVP—don't defer it.

Best-practice notes: prefer `<input type="time">` where native UX is acceptable (mobile especially); the custom popover is an enhancement for desktop; each scroll column is a `role="listbox"` with `role="option"` items, `aria-selected`, and arrow-key navigation; columns connect via `aria-label` ("Hours", "Minutes", "Seconds") so screen readers announce context; AM/PM toggle (12h mode) is a pair of `role="radio"` buttons inside a `role="radiogroup"`.

- [ ] Create `time-picker.svelte` with props `value?: string` (ISO `HH:MM` or `HH:MM:SS`, controlled), `defaultValue?: string`, `hourCycle?: 'h11' | 'h12' | 'h23' | 'h24'` (defaults from `Intl`), `seconds?: boolean = false`, `min?: string`, `max?: string`, `step?: number`, `disabled?: boolean`, `name?: string`, `class?: string`, plus `onchange?: (value: string) => void`.
- [ ] Primary input is `<input type="time">`; custom scroll-list popover is a progressive enhancement rendered via `<dialog>`.
- [ ] Each time column is a `<ul role="listbox">` with `<li role="option">` items; arrow Up/Down navigate the column, Tab advances to the next column, Escape closes the popover.
- [ ] In 12h mode, render an AM/PM `role="radiogroup"` as the final column.
- [ ] Compose with `form-field.svelte` for label/description/error wiring.
- [ ] Note in `time-picker.a11y.md` that `date-picker` and `time-picker` share a scroll-list column primitive—if both are being built simultaneously, extract that into an internal `_internal/time-column.svelte` to avoid duplication.
- [ ] Tests: arrow-key column navigation; 12h/24h emit format; AM/PM toggle; min/max clamping; form reset.

### Number input — ADD `number-input.svelte`

A styled number control with increment/decrement stepper buttons, min/max clamping, step snapping, and locale-aware display formatting. Distinct from a bare `<input type="number">` in that it renders visible stepper controls and formats display value with `Intl.NumberFormat` (commas, currency, percent, etc.).

Best-practice notes: the underlying field must be `<input type="number">` (or `type="text"` with `inputmode="decimal"` when locale-formatted display would conflict with the numeric value); stepper buttons need `aria-label` ("Increment" / "Decrement") since they have no visible text; `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` belong on the input, not the container; hold-to-repeat (long-press steppers) must stop on pointer-up/pointer-cancel and must not fire if the pointer leaves the button; clamping on blur (not on every keystroke) gives users room to type intermediate values.

- [ ] Create `number-input.svelte` with props `value?: number` (controlled), `defaultValue?: number`, `min?: number`, `max?: number`, `step?: number = 1`, `format?: Intl.NumberFormatOptions`, `locale?: string`, `disabled?: boolean`, `name?: string`, `class?: string`, plus `onchange?: (value: number) => void`.
- [ ] Use `format-number.ts` for display formatting; store raw numeric value internally; emit `number` from change events.
- [ ] Render stepper buttons with `aria-label="Increment"` / `aria-label="Decrement"`, `disabled` when at min/max respectively.
- [ ] Implement hold-to-repeat: after a delay, fire repeated steps at an accelerating interval; cancel on `pointerup`, `pointercancel`, or button blur.
- [ ] Clamp and snap to step on blur; do not clamp on every keystroke.
- [ ] Wire `aria-valuemin`, `aria-valuemax`, `aria-valuenow` on the input element.
- [ ] Compose with `form-field.svelte` for label/description/error wiring.
- [ ] Tests: step increment/decrement; min/max clamping on blur; locale formatting display; hold-repeat stops on pointerup; `aria-valuenow` updates; form reset.

### File upload — ADD `file-upload.svelte`

A drag-and-drop region that also exposes a button trigger for the native file picker. Shows per-file progress, validation errors, and a list of accepted/rejected files. The dropzone is the visually prominent surface; the button trigger is always present for keyboard/assistive-technology users who can't drag.

Best-practice notes: the drag region is a `<div role="button" tabindex="0">` with keyboard activation (Enter/Space opens the picker) or use a visually styled `<label>` wrapping a hidden `<input type="file">`; drag-state visual changes (border highlight, overlay text) must not be color-only; `aria-live="polite"` region announces file acceptance/rejection after drop; progress per file uses `role="progressbar"` with `aria-valuenow`/`aria-valuemax`; rejected files need a visible error message associated to each file entry via `aria-describedby`; multiple-file selection obeys the `multiple` prop.

- [ ] Create `file-upload.svelte` with props `accept?: string`, `multiple?: boolean = false`, `maxSize?: number` (bytes), `disabled?: boolean`, `name?: string`, `class?: string`, snippets `idle`, `dragActive`, `fileList?`, plus `onchange?: (files: File[]) => void`, `onreject?: (files: File[]) => void`.
- [ ] Implement dropzone as a visually styled `<label>` wrapping `<input type="file" class="sr-only">` — this is keyboard and AT accessible with zero ARIA overhead; do not use a raw `<div role="button">`.
- [ ] Wire `dragenter`, `dragover`, `dragleave`, `drop` events; toggle `data-drag-active` on the label for CSS state; prevent `dragleave` flicker by tracking pointer entry count.
- [ ] Validate each dropped file against `accept` and `maxSize`; emit accepted files via `onchange`, rejected files (with reason) via `onreject`.
- [ ] Render a file list below the dropzone showing filename, size, and either a `role="progressbar"` (uploading) or a status icon (success/error); each error message is associated via `aria-describedby`.
- [ ] `aria-live="polite"` region announces "{n} file(s) accepted" / "{filename} rejected: file too large" after drop.
- [ ] Compose with `form-field.svelte` for label/description/error wiring.
- [ ] Tests: drag-and-drop acceptance and rejection; keyboard activation opens picker; `accept` MIME filtering; `maxSize` rejection; `aria-live` announcement content; progress state renders correct `aria-valuenow`.

### Slider — ADD `slider.svelte`

Single-thumb and dual-thumb (range) slider. Distinct from `progress.svelte` (passive, no interaction) and from the internal hue/alpha sliders inside `color-picker.svelte`. Must follow WAI-ARIA `role="slider"` fully—arrow keys, Home/End, Page Up/Down are required, not optional.

Best-practice notes: each thumb is `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (for non-numeric display labels), and `aria-label` or `aria-labelledby`; in range mode the two thumbs need distinct labels ("Minimum value", "Maximum value"); arrow keys adjust by `step`, Page Up/Down by a larger jump (10× step or configurable), Home/End snap to min/max; the track click-to-position must also be keyboard-reachable (don't rely on pointer only); visual tick marks and labels are `aria-hidden` since the values are already expressed in `aria-valuenow`; `prefers-reduced-motion` should suppress any thumb-drag animation.

- [ ] Create `slider.svelte` with props `value?: number | [number, number]` (controlled), `defaultValue?: number | [number, number]`, `mode?: 'single' | 'range' = 'single'`, `min?: number = 0`, `max?: number = 100`, `step?: number = 1`, `pageStep?: number` (defaults to 10× step), `label: string`, `valueText?: (value: number) => string`, `ticks?: boolean | number[]`, `disabled?: boolean`, `name?: string`, `class?: string`, plus `onchange?: (value: number | [number, number]) => void`.
- [ ] Each thumb is a `<div role="slider">` with full ARIA attributes; in range mode assign `aria-label="Minimum value"` / `aria-label="Maximum value"` (or derive from `label` prop).
- [ ] Keyboard: Left/Right (or Up/Down) adjust by `step`; Page Up/Down adjust by `pageStep`; Home/End snap to `min`/`max`; Enter has no effect (value already applied on keydown).
- [ ] In range mode, constrain thumbs so minimum never exceeds maximum; when thumbs overlap, bring the moved thumb to front via `z-index`.
- [ ] Track click/tap sets the nearest thumb's value; pointer drag follows the pointer even when it leaves the thumb element (use `pointermove` on `document` during drag).
- [ ] Optional tick marks rendered as `aria-hidden` decorative elements; when `ticks` is an array of numbers, snap to nearest tick.
- [ ] Apply `@media (prefers-reduced-motion: reduce)` to disable thumb-position transitions.
- [ ] Compose with `form-field.svelte` for label/description/error wiring.
- [ ] Tests: arrow key step; Page Up/Down jump; Home/End clamp; range mode thumb constraint; `aria-valuenow` reflects current value; `aria-valuetext` when `valueText` provided; pointer drag; form reset.
- [ ] Storybook: single, range, with ticks, with `valueText` (percentage, currency), disabled, inside a `form-field`.

### Color field — ADD `color-field.svelte`

A text input that validates and normalizes hex, `rgb()`, and `hsl()` strings. Pairs with `color-picker.svelte` and `color-swatch-picker.svelte` for combined visual + text-based color entry. On its own it is a thin composition of `input.svelte` + a color-preview swatch + parser logic—not a standalone picker.

Best-practice notes: validate on blur, not on every keystroke; show a small color-preview swatch as a trailing addon inside the input group (the swatch is `aria-hidden` since the value is already expressed as text); when the input value fails to parse, set `aria-invalid="true"` and surface a descriptive error via `form-field.svelte`; accepted formats are `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb()`, `rgba()`, `hsl()`, `hsla()`; always emit hex from the `change` event for a canonical output format; the component itself should be blocked by `form-field.svelte` (task `78f71115-ad25-4eaa-9f55-81cb2f71e127`) since it relies on the label/error wrapper.

- [ ] Create `color-field.svelte` with props `value?: string` (controlled hex), `defaultValue?: string`, `alpha?: boolean = false`, `formats?: ('hex' | 'rgb' | 'hsl')[]` (accepted input formats, defaults to all three), `disabled?: boolean`, `name?: string`, `class?: string`, plus `onchange?: (value: string) => void`.
- [ ] Compose `input.svelte` with a `trailing` snippet slot rendering a `<span aria-hidden="true">` color swatch; use the `leading`/`trailing` slots added by the input-groups task.
- [ ] Parse input on blur against all accepted formats; on success normalize to hex and call `onchange`; on failure set internal `error` state and surface via `form-field.svelte`.
- [ ] When `alpha={false}`, accept `#RRGGBBAA` but strip alpha on emit.
- [ ] Wire `aria-invalid` from the internal parse error to the underlying `<input>` via `form-field.svelte` context.
- [ ] Tests: hex/rgb/hsl parse and emit round-trips; invalid input sets error state and `aria-invalid`; alpha strip when `alpha={false}`; swatch reflects current valid value; form reset reverts to `defaultValue`.

### Search field — ADD `search-field.svelte`

An input variant with a leading search icon, a clear button that appears when the field has a value, and an optional keyboard shortcut hint (e.g. ⌘K). Distinct from wiring a generic `input.svelte` with addons—the clear behavior, shortcut hint, and search role are specific enough to justify a named primitive.

Best-practice notes: use `<input type="search">` to get native clear-button behavior in WebKit (then suppress the native clear in CSS to use the custom one); `role="searchbox"` is redundant on `type="search"` — don't add it; the clear button needs `aria-label="Clear search"` and should only be in the tab order when the field has a value (`tabindex="-1"` when empty); the shortcut hint badge is `aria-hidden` since the shortcut itself should be wired globally by the consumer; wrapping the field in `<search>` (or `<form role="search">`) is correct when the field performs a live search but is consumer responsibility, not the component's.

- [ ] Create `search-field.svelte` with props `value?: string` (controlled), `defaultValue?: string`, `placeholder?: string`, `shortcut?: string` (e.g. `'⌘K'`, renders as hint badge), `disabled?: boolean`, `name?: string`, `class?: string`, plus `oninput?: (value: string) => void`, `onsearch?: (value: string) => void`, `onclear?: () => void`.
- [ ] Render `<input type="search">` with a leading search icon (`aria-hidden`) and a trailing clear button; suppress WebKit's native clear via CSS (`input[type="search"]::-webkit-search-cancel-button { display: none }`).
- [ ] Clear button: `aria-label="Clear search"`, `type="button"`, `tabindex={value ? 0 : -1}`; visible only when `value` is non-empty; on click sets value to `''` and returns focus to the input.
- [ ] When `shortcut` is provided, render a `<kbd aria-hidden="true">` hint badge as a trailing addon inside the group; the shortcut itself is not wired by this component (consumer's concern).
- [ ] Compose with `form-field.svelte` for label/description/error wiring.
- [ ] Tests: clear button visibility toggled by value; clear returns focus to input; clear button excluded from tab order when empty; shortcut badge is `aria-hidden`; `oninput` fires on every keystroke; `onsearch` fires on Enter.

### Tag input — ADD `tag-input.svelte`

A text input that converts entered values into removable chip tokens. Sibling of `combobox.svelte`—where `combobox` picks from a predefined list, `tag-input` accepts free-form values. Both can coexist in the same form.

Best-practice notes: the chip list is a `<ul role="listbox">` with each chip as `<li role="option">`; the text input is adjacent (not inside the listbox); Backspace on an empty input removes the last chip; Left/Right arrow keys on an empty input move focus into the chip list (shift+Tab also works); each chip's remove button needs `aria-label="Remove {value}"` to be unambiguous; the container acts as a pseudo-field and needs a visible focus ring on `:focus-within`; `aria-describedby` from `form-field.svelte` should attach to the input, not the container.

- [ ] Create `tag-input.svelte` with props `value?: string[]` (controlled), `defaultValue?: string[]`, `delimiter?: string | RegExp` (default: comma and Enter), `max?: number`, `validate?: (tag: string) => boolean | string`, `allowDuplicates?: boolean = false`, `disabled?: boolean`, `name?: string`, `class?: string`, plus `onchange?: (tags: string[]) => void`.
- [ ] Render chips as `<ul role="listbox">` (chips are selected values) with the text input adjacent after the last chip; manage focus between chips and input via `roving-tabindex.ts`.
- [ ] Commit a new tag on delimiter key or Enter; strip whitespace; check `allowDuplicates` and `max`; run `validate` and surface per-tag errors inline.
- [ ] Backspace on empty input focuses the last chip; second Backspace (or Delete on chip) removes it and returns focus to the input.
- [ ] Left/Right arrow key on the input when caret is at position 0 moves focus to the last chip.
- [ ] Each chip remove button: `aria-label="Remove {value}"`, `type="button"`; removing a chip via keyboard should move focus to the previous chip (or to the input if no chips remain).
- [ ] When `name` is provided, render a hidden `<input type="hidden" name={name} value={tags.join(',')}>` for form submission.
- [ ] Compose with `form-field.svelte` for label/description/error wiring; `aria-describedby` wires to the text input.
- [ ] Tests: Enter commits tag; delimiter commits tag; Backspace removes last tag and focuses it; Delete on focused chip removes it; duplicate prevention; max cap; `validate` blocks invalid tags; hidden input reflects current tags; `aria-label` on remove buttons.
- [ ] Storybook: basic free-form, with validation (email tags), with max, pre-populated, disabled.

## Feedback & Status — Chip, Banner, Callout, Status Dot, Popover

| Pattern    | Decision | Target                 |
| ---------- | -------- | ---------------------- |
| Chip / tag | ADD      | `chip.svelte`          |
| Banner     | ADD      | `banner.svelte`        |
| Callout    | ADD      | `callout.svelte`       |
| Status dot | ADD      | `status-dot.svelte`    |
| Popover    | ADD      | `popover.svelte`       |
| Alert      | AUDIT    | `alert.svelte` (below) |

---

### Alert — audit & reconcile

`alert.svelte` is currently a **card-shaped inline notification** with `role="alert"` and `aria-live="polite"`, accepting `variant`, `dismissible`, `onDismiss`, and an optional `icon` snippet. It renders into flow at whatever width its container gives it.

**Verdict: keep `alert.svelte` as the inline card pattern; add `banner.svelte` and `callout.svelte` as distinct components.** The three patterns differ meaningfully:

| Dimension   | Alert                           | Banner                                  | Callout                               |
| ----------- | ------------------------------- | --------------------------------------- | ------------------------------------- |
| Scope       | Inline, contextual to a section | Page-level, full-width                  | Inline inside document/content flow   |
| Dismissible | Optional                        | Usually yes                             | No                                    |
| Width       | Container-driven                | Full viewport/layout width              | Block-level in prose                  |
| Live region | `role="alert"` / `aria-live`    | `role="banner"` conflict — use `region` | Inert block, no live region           |
| Use case    | Form errors, async feedback     | Maintenance notices, cookie consent     | Docs admonitions, contextual guidance |

**Action items for `alert.svelte` before banner/callout ship:**

- [ ] Confirm `role="alert"` is intentional. The component already has it, which is correct for dynamic, programmatically injected alerts. Document that consumers must not use `alert.svelte` for static/decorative notices—they should reach for `callout.svelte` instead.
- [ ] Remove `aria-live="polite"` from the static template; `role="alert"` implies `aria-live="assertive"`. Having both is redundant and potentially confusing to AT. This is a one-line fix.
- [ ] Add a short "when to use which" note to the component's JSDoc so the three patterns stay distinct.

---

### Chip / tag — ADD `chip.svelte`

Pill-shaped, interactive label—the interactive counterpart to `badge.svelte`. Chips represent applied filters, selected items, or user-entered tags. They are frequently removable and occasionally clickable as toggles. The upcoming `tag-input.svelte` composite will render chips as its selected-value display.

Best-practice notes: a chip that can be removed must have a dedicated remove button—never make the whole chip the click target for removal, because that collapses selection and deletion into one gesture; the remove button's accessible name must be `"Remove <label>"` (e.g., `"Remove JavaScript"`), not a bare `"×"`; if the chip is a toggle, use `aria-pressed`; if it's purely display within a group (like an applied filter list), the parent list should be `role="list"` with `<ul>` / `<li>`; chip color variants must pull from the same token set as `badge.svelte` (`neutral`, `success`, `warning`, `danger`, `info`, `accent`) so the two components remain visually consistent; minimum touch target for the remove button is 44×44px (padding can extend the hit area without affecting visual size).

- [ ] Create `chip.svelte` with props `label: string`, `variant?: BadgeVariant` (reuse badge token set), `size?: 'sm' | 'md'`, `removable?: boolean`, `onRemove?: () => void`, `pressed?: boolean`, `onToggle?: () => void`, `disabled?: boolean`, `class?: string`.
- [ ] When `removable` is true, render a `<button>` inside the chip with `aria-label={\`Remove \${label}\`}`and`type="button"`.
- [ ] When `pressed` is defined, render the chip root as a `<button>` with `aria-pressed={pressed}`.
- [ ] When neither `removable` nor `pressed`, render as `<span>` (purely display).
- [ ] Ensure the remove button's hit area reaches 44×44px using padding—do not enlarge the visual dot.
- [ ] Export `ChipProps` and `ChipVariant` from the module block for use by `tag-input.svelte`.
- [ ] Write `chip.a11y.md` documenting the three render modes (display / toggle / removable) and the accessible-name requirement for remove buttons.

---

### Banner — ADD `banner.svelte`

A full-width page-level alert strip, typically rendered just inside the top of the layout (below the navigation bar, above the page content). Banners announce site-wide conditions—maintenance windows, trial expiry, cookie consent—and are almost always dismissible. They are distinct from `alert.svelte` (contextual, card-shaped) and `callout.svelte` (inline prose block, non-dismissible).

Best-practice notes: because `role="banner"` is reserved for `<header>`, use `role="region"` with an `aria-label` matching the variant (e.g., `"Warning"`) so AT users can navigate to it via landmarks; avoid `role="alert"` here—banners are persistent, not injected dynamically, so the assertive live-region behavior would be jarring on page load; the dismiss button must be visually and programmatically labeled; full-width means the component stretches to 100% of its container rather than being constrained by inner content width; if the banner can contain a CTA link, that link must be keyboard reachable and must not rely on the dismiss button's proximity for context.

- [ ] Create `banner.svelte` with props `variant?: 'info' | 'success' | 'warning' | 'danger'` (default `'info'`), `dismissible?: boolean` (default `true`), `onDismiss?: () => void`, `children: Snippet`, `actions?: Snippet`, `class?: string`.
- [ ] Render as `<div role="region" aria-label={variantLabel}>` where `variantLabel` derives from `variant` (e.g., `"Information"`, `"Warning"`).
- [ ] Track dismissed state internally (`let visible = $state(true)`) and expose `onDismiss` as an escape hatch for consumers who need to persist dismissal.
- [ ] Dismiss button: `<button type="button" aria-label="Dismiss banner">` with a visible ×/close icon.
- [ ] Use `data-cinder-variant={variant}` for CSS theming; pull icon color and background from semantic tokens.
- [ ] Ensure the component stretches full-width via `width: 100%` at the block level with no inner max-width constraint.

---

### Callout — ADD `callout.svelte`

An inline highlighted block for contextual guidance, warnings, or tips inside flowing content. Directly analogous to Markdown admonitions (note/warning/danger/tip). Unlike `banner.svelte`, a callout is embedded in a document or section—it is not page-level and is never dismissible. Unlike `alert.svelte`, it is static HTML with no live-region semantics.

Best-practice notes: callouts are decorative/structural, not dynamic notifications—do not add `role="alert"` or `aria-live`; an icon is strongly recommended as a second channel alongside color to convey variant meaning (satisfies WCAG 1.4.1); the icon must be `aria-hidden="true"` with variant meaning conveyed via a visually hidden label or the heading text; keep the callout accessible to keyboard navigation—it should be a regular block element in DOM order, not a positioned overlay; the heading inside a callout should not be a semantic heading element (`<h2>` etc.) unless it genuinely participates in the document outline—prefer a `<strong>` or `<p>` styled as a label.

- [ ] Create `callout.svelte` with props `variant?: 'info' | 'success' | 'warning' | 'danger'` (default `'info'`), `title?: string`, `icon?: Snippet`, `children: Snippet`, `class?: string`.
- [ ] Render as `<aside class="cinder-callout" data-cinder-variant={variant}>` (semantically an aside from the main prose flow).
- [ ] When `icon` snippet is provided, render it `aria-hidden="true"` inside `.cinder-callout__icon`.
- [ ] When `title` is provided, render as `<p class="cinder-callout__title">` (not a heading element)—document the distinction in JSDoc.
- [ ] Do not add `role="alert"` or `aria-live`—callouts are static; add a JSDoc note explaining that `alert.svelte` is the right pick for dynamic feedback.
- [ ] Pull border, background, and icon colors from semantic tokens (`--cinder-info`, `--cinder-success`, `--cinder-warning`, `--cinder-danger`) so callout and banner remain visually consistent.

---

### Status dot / indicator — ADD `status-dot.svelte`

A small colored dot with an optional text label, used to communicate binary or enumerated state—"Online", "Offline", "Building", "Degraded"—in list rows, avatars, and page headers. Small component, but semantically load-bearing: color alone cannot be the sole communication channel.

Best-practice notes: the dot itself must always be paired with either a visible label or an `aria-label` on the wrapper—a colored dot with no text is inaccessible to users who cannot distinguish color; colors must come exclusively from semantic tokens (`--cinder-success`, `--cinder-warning`, `--cinder-danger`, `--cinder-neutral`, etc.)—never hard-coded hex; when the dot is used without a label (e.g., overlaid on an avatar), the parent element should carry the accessible text via `aria-label` or a visually hidden `<span>`; dot size should be expressed as a token-driven scale rather than hard-coded pixels.

- [ ] Create `status-dot.svelte` with props `status: 'online' | 'offline' | 'warning' | 'error' | 'building' | 'neutral'`, `label?: string`, `showLabel?: boolean` (default `true`), `size?: 'sm' | 'md'` (default `'md'`), `class?: string`.
- [ ] Map `status` values to semantic tokens via `data-cinder-status={status}`; CSS handles color—no inline styles.
- [ ] When `showLabel` is false or `label` is omitted, add `aria-label={status}` to the root element so the status is announced to screen readers.
- [ ] When `label` is provided and `showLabel` is true, render `<span class="cinder-status-dot__label">{label}</span>` adjacent to the dot.
- [ ] Export a `StatusDotStatus` type for use in `stacked-list-item.svelte` and other host components.
- [ ] Dot size tokens: `sm` = 8px, `md` = 10px—expressed as CSS custom properties so consumers can override without forking the component.

---

### Popover — ADD `popover.svelte`

An interactive floating panel anchored to a trigger element. The generic container for arbitrary content that needs to appear in a floating layer without being a menu (that's `dropdown.svelte`) or a read-only hint (that's `tooltip.svelte`). Common uses: form field pickers, user profile cards, contextual actions with inputs, confirmation dialogs that don't need full modal weight.

This is the highest-leverage primitive in this group—several upcoming UX patterns (color picker, date picker, command palette trigger) depend on a reliable, accessible popover foundation.

Best-practice notes: the popover must trap focus on open and restore focus to the trigger on close—reuse `captureFocus` / `restoreFocusTo` from `_internal/overlay.ts`, the same infrastructure used by `modal.svelte` and `drawer.svelte`; ESC must close and return focus; click-outside must close (use a `mousedown` listener rather than `click` to avoid edge cases with nested interactive elements); anchor positioning should default to `floating-ui` for broad browser support, with a progressive-enhancement path to CSS anchor positioning once the spec stabilises; arrow/caret positioning is part of the MVP, not a later enhancement—consumers expect it; `aria-expanded` on the trigger and `aria-controls` pointing to the popover panel complete the ARIA relationship; the popover panel should have `role="dialog"` with an `aria-label` or `aria-labelledby` when it contains a distinct content region (e.g., a picker), or `role="group"` when it is a simple action cluster.

- [ ] Create `popover.svelte` with props `open: boolean` (`$bindable`), `placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'` (default `'bottom-start'`), `offset?: number` (default `8`), `showArrow?: boolean` (default `false`), `label?: string`, `triggerRef?: HTMLElement | null`, `children: Snippet`, `trigger?: Snippet`, `class?: string`.
- [ ] Integrate `floating-ui` (`@floating-ui/dom`) for anchor computation; update arrow position reactively when placement flips.
- [ ] On open: call `captureFocus()` from `_internal/overlay.ts`, then move focus to the first focusable element inside the panel.
- [ ] On close (ESC, click-outside, or programmatic): call `restoreFocusTo` to return focus to `triggerRef` or the captured element.
- [ ] Add `keydown` listener for `Escape` that closes the popover from inside the panel.
- [ ] Add `mousedown` listener on `document` (not `click`) to close on outside interaction; exclude the trigger element from this check.
- [ ] Set `aria-expanded={open}` and `aria-controls={panelId}` on the trigger; panel gets `id={panelId}` via `useId`.
- [ ] Panel defaults to `role="dialog"` with `aria-label={label ?? 'Popover'}`; expose a `role` prop for consumers who need `role="group"` or `role="listbox"`.
- [ ] CSS: `position: fixed` with transform-based placement; `z-index` via a token; arrow rendered via a rotated pseudo-element, positioned by floating-ui's arrow middleware.
- [ ] Ensure `prefers-reduced-motion` suppresses the open/close transition.
- [ ] Write `popover.a11y.md` covering: focus management contract, when to use `role="dialog"` vs `role="group"`, trigger `aria-expanded` requirement, and the distinction from `tooltip.svelte` and `dropdown.svelte`.

## Overlays — Command Palette, Sheet, Confirmation Dialog

| Pattern              | Decision | Target                                                      |
| -------------------- | -------- | ----------------------------------------------------------- |
| Command palette      | ADD      | `command-palette.svelte` + Storybook recipe                 |
| Sheet / bottom-sheet | ADD      | `sheet.svelte` (distinct from left/right `drawer.svelte`)   |
| Confirmation dialog  | ADD      | `confirm-dialog.svelte` (opinionated `modal.svelte` preset) |

---

### Command palette — ADD `command-palette.svelte`

Cmd+K pattern: a full-viewport overlay containing a search input, a scrollable list of grouped items, and a keyboard-navigable active-item highlight. The component is a _primitive_—it owns focus, keyboard routing, and ARIA relationships; the consumer supplies items via snippets. A documented Storybook recipe demonstrates the common "search + recent + keyed actions" shell; cinder does not ship a batteries-included Linear/Raycast clone.

Best-practice notes: wrap in `<dialog showModal()>` and reuse `captureFocus`/`restoreFocusTo` from `_internal/overlay.ts`—no new focus-trap code; the input is `role="combobox"` with `aria-expanded` and `aria-controls` pointing at the listbox; the list is `role="listbox"` with `role="option"` items; active item is tracked with `aria-activedescendant` on the input—never by moving DOM focus into the list; `Escape` closes and restores focus; `ArrowUp`/`ArrowDown` cycle the active index; `Enter` fires the active item's handler. Priority 3: high leverage but structurally larger than the other two—implement after sheet and confirm-dialog land.

- [ ] Create `command-palette.svelte` with props `open: boolean`, `placeholder?: string`, `class?: string`, and snippets `items` (receives `query: string`) and `empty?`.
- [ ] Accept an `onclose` callback prop; fire it on `Escape` and backdrop click.
- [ ] Wire `<dialog showModal()>` with `captureFocus`/`restoreFocusTo` from `_internal/overlay.ts`.
- [ ] Implement `role="combobox"` + `aria-controls` + `aria-activedescendant` without moving DOM focus into the list.
- [ ] Keyboard contract: `ArrowDown`/`ArrowUp` move active index; `Enter` fires the active item; `Escape` closes.
- [ ] Export a `CommandItem` sub-component with props `value: string`, `onselect: () => void`, `disabled?: boolean`, and snippets `leading?`, `children`, `trailing?`; it registers itself with the palette via context.
- [ ] Document the Cmd+K recipe in Storybook: keyboard listener sets `open = true`, items array is filtered by `query`, grouped under labeled headings.
- [ ] Ensure the palette backdrop uses `backdrop-filter: blur()` only when `@media (prefers-reduced-motion: no-preference)`.

---

### Sheet / bottom-sheet — ADD `sheet.svelte`

A panel that slides up from the bottom of the viewport—the mobile-native analog to a modal. Structurally distinct from `drawer.svelte` (which slides from the left or right) and shares `<dialog showModal()>` infrastructure with it. Body scroll must be locked while open. Swipe-down-to-close is a stretch goal, not MVP.

Best-practice notes: `<dialog showModal()>` with `captureFocus`/`restoreFocusTo` from `_internal/overlay.ts` handles focus containment—do not reinvent it; position the panel at the bottom with a `max-height` on the panel itself, not the dialog, so the backdrop still covers the full viewport; enter animation is `transform: translateY(100%) → translateY(0)` with `@media (prefers-reduced-motion: reduce)` falling back to a simple opacity fade; body scroll lock via `overflow: hidden` on `<body>` applied in the open `$effect`, removed in cleanup; touch targets on the drag handle and close button must be 44×44px minimum; `aria-labelledby` points to the sheet's title element; a `draggable` boolean prop opts in to swipe-to-close but ships `false` by default.

- [ ] Create `sheet.svelte` with props `open: boolean`, `title: string`, `class?: string`, `triggerRef?: HTMLElement | null`, `draggable?: boolean` (default `false`), and snippets `children`, `footer?`.
- [ ] Reuse `captureFocus`/`restoreFocusTo` from `_internal/overlay.ts`; mirror `modal.svelte`'s `mounted` guard for SSR safety.
- [ ] Apply `document.body.style.overflow = 'hidden'` when open; restore in the `$effect` cleanup.
- [ ] Slide-up enter/exit via CSS `@keyframes`; wrap transform in `@media (prefers-reduced-motion: no-preference)`, with an opacity-only fallback for reduced-motion.
- [ ] Expose a drag handle element (`aria-hidden="true"`) above the title when `draggable` is true; swipe-to-close gesture is a stretch goal gated behind the same prop.
- [ ] Close on backdrop click (target === dialog) and on `Escape` via the native `close` event, then call `restoreFocusTo`.
- [ ] Verify 44×44px minimum touch target on the close button and drag handle at all breakpoints.

---

### Confirmation dialog — ADD `confirm-dialog.svelte`

An opinionated preset over `modal.svelte` for destructive-action confirmation. Renders a title, a body description, a cancel button, and a confirm button—where the confirm button uses the `danger` variant when `destructive` is true. Default focus lands on the _cancel_ button (industry standard: protect against accidental confirms). Composition recipe documents how to build this from `<Modal>` directly when richer content is needed.

Best-practice notes: `modal.svelte` supplies the `<dialog showModal()>`, focus capture, and `aria-labelledby`—`confirm-dialog.svelte` is a thin composition, not a reimplementation; `autofocus` on the cancel button satisfies the WCAG 3.2.1 focus guidance for destructive confirms; the confirm button's `aria-label` should incorporate the action name when `title` alone is ambiguous; the dialog description (`<p>`) should be wired to `aria-describedby` on the dialog via a generated ID; the `destructive` prop maps to `variant="danger"` on the confirm button only—never red text or icon alone.

- [ ] Create `confirm-dialog.svelte` with props `open: boolean`, `title: string`, `description?: string`, `cancelLabel?: string` (default `"Cancel"`), `confirmLabel?: string` (default `"Confirm"`), `destructive?: boolean` (default `false`), `onconfirm: () => void`, `oncancel: () => void`, `triggerRef?: HTMLElement | null`.
- [ ] Compose over `<Modal>` rather than duplicating `<dialog>` logic; pass `title` and `triggerRef` through.
- [ ] Place `autofocus` on the cancel button so default focus protects against accidental destructive actions.
- [ ] When `destructive` is true, render the confirm button with `variant="danger"`; never rely on color alone as the only destructive signal.
- [ ] Wire `description` to a `<p id={descriptionId}>` and pass `descriptionId` to the modal's `aria-describedby`.
- [ ] Fire `onconfirm` then set `open = false`; fire `oncancel` then set `open = false`.
- [ ] Document the composition recipe in Storybook showing direct `<Modal>` + `<Button>` assembly for cases where richer body content is needed.

## Layout & Media — Divider, Layout Primitives, Container, Aspect Ratio, Scroll Area, Image

| Pattern             | Decision | Target                                                                              |
| ------------------- | -------- | ----------------------------------------------------------------------------------- |
| Divider / separator | ADD      | `divider.svelte`                                                                    |
| Every-Layout set    | ADD      | `stack.svelte`, `inline.svelte`, `cluster.svelte`, `center.svelte`, `spacer.svelte` |
| Container / section | AUDIT    | `page-layout.svelte` (extract container if buried)                                  |
| Aspect ratio box    | ADD      | `aspect-ratio.svelte`                                                               |
| Scroll area         | ADD      | `scroll-area.svelte`                                                                |
| Image               | ADD      | `image.svelte`                                                                      |

---

### Divider — ADD `divider.svelte`

A thin rule for visually separating content. Semantically an `<hr>` in the horizontal case; a vertically-oriented `<hr>` via `writing-mode` or `height` override for vertical use. Surfaces as `role="separator"` by default; decorative-only dividers switch to `role="none"` so screen readers skip them.

Best-practice notes: `<hr>` carries implicit `role="separator"` — do not apply `role="separator"` redundantly when using the element; when `decorative={true}`, apply `role="none"` to suppress the AT announcement entirely; vertical orientation requires either `writing-mode: vertical-lr` or a height/width swap — do not use a `<div>` just to avoid this; color must meet 3:1 non-text contrast against adjacent backgrounds; never fake a divider with a bottom/top border on a sibling element—that breaks the semantic model.

- [ ] Create `divider.svelte` rendering `<hr>` with props `orientation: 'horizontal' | 'vertical' = 'horizontal'`, `decorative?: boolean = false`, `class?: string`.
- [ ] When `decorative={true}`, set `role="none"` on the element; otherwise leave the implicit `role="separator"` from `<hr>` intact.
- [ ] Expose `data-cinder-orientation` for CSS to handle the vertical layout (swap inline-size and block-size; set `align-self: stretch` for vertical use inside flex containers).
- [ ] Ensure color token (`--cinder-border`) meets 3:1 non-text contrast in both light and dark themes.
- [ ] Tests: renders `<hr>`; `decorative={true}` sets `role="none"`; orientation data attribute is present; default no explicit `role` attribute.
- [ ] Storybook: horizontal default, vertical, decorative (annotated to show the AT-invisible behavior), inside a flex row.

---

### Every-Layout primitives — ADD `stack.svelte`, `inline.svelte`, `cluster.svelte`, `center.svelte`, `spacer.svelte`

**Decision: YES — ship as a set.** Composition-first layout helpers are in keeping with cinder's approach of providing primitives consumers assemble rather than opinionated page-level patterns. The five primitives cover the vast majority of layout needs without introducing bespoke one-off wrappers in every consuming application. They are CSS-logic components—no visual chrome, no color tokens, no theming surface—so they integrate cleanly alongside `Surface`, `Card`, and form primitives.

Reference: Every Layout by Andy Bell and Heydon Pickering.

Best-practice notes: these are layout-only—no `role`, no ARIA; render as the most semantically neutral element for each context (`<div>` for block contexts, `<span>` for inline contexts via an `as` prop when consumers need inline flow); custom properties (`--stack-gap`, `--cluster-gap`, etc.) make the components overridable without prop drilling; no hardcoded margin or padding outside the design token system; `Spacer` must be `aria-hidden="true"` since it is purely presentational; do not replicate the connector-line pattern from `feed.svelte` here—`Stack` has no visual chrome.

**`Stack`** — vertical flex column. Props: `gap?: string = 'var(--cinder-space-4)'`, `direction?: 'column' | 'column-reverse' = 'column'`, `as?: string = 'div'`, `class?: string`, `children: Snippet`. Renders a flex container with `flex-direction: column` and a configurable gap.

**`Inline`** — horizontal flex row with optional wrapping. Props: `gap?: string = 'var(--cinder-space-4)'`, `wrap?: boolean = true`, `align?: string = 'center'`, `as?: string = 'div'`, `class?: string`, `children: Snippet`.

**`Cluster`** — flex container optimized for groups of tags, buttons, or badges where items wrap freely. Props: `gap?: string = 'var(--cinder-space-2)'`, `align?: string = 'center'`, `justify?: string = 'flex-start'`, `as?: string = 'div'`, `class?: string`, `children: Snippet`. Differs from `Inline` in that its default gap and justify defaults are tuned for tight badge/chip clusters.

**`Center`** — horizontally centered block with a max-width cap. Props: `maxWidth?: string = 'var(--cinder-content-width)'`, `minHeight?: string`, `intrinsic?: boolean = false`, `as?: string = 'div'`, `class?: string`, `children: Snippet`. When `intrinsic={true}`, adds `display: flex; flex-direction: column; align-items: center` so the element centers based on its own content width rather than expanding to fill.

**`Spacer`** — `flex: 1` filler for pushing siblings to opposite ends of an `Inline` or `Cluster`. Props: `as?: string = 'span'`, `class?: string`. Renders `aria-hidden="true"` unconditionally. No children.

- [ ] Create all five components under `packages/components/src/components/` — one file each.
- [ ] Thread gap and layout values through CSS custom properties (e.g. `style:--stack-gap={gap}`) so consumers can override at any level without prop drilling.
- [ ] `Spacer` must always carry `aria-hidden="true"` and render no children.
- [ ] `Center` with `intrinsic={true}` must not clip overflowing content — use `align-items: flex-start` on children or let consumers manage overflow.
- [ ] Export all five from the package's main index alongside existing components.
- [ ] Tests: each component renders the correct element; custom gap threads to the CSS custom property; `Spacer` carries `aria-hidden`; `Center` applies max-width; `intrinsic` mode applies the flex centering.
- [ ] Storybook: each primitive in isolation; `Stack` + `Inline` + `Cluster` composition example; `Center` with and without `intrinsic`; `Spacer` pushing a button to the trailing edge of an `Inline`.

---

### Container / Section — AUDIT `page-layout.svelte`

**Audit result: the container width is buried.** `page-layout.svelte` renders a `<div class="cinder-page-layout">` whose maximum width and padding are controlled entirely inside `styles/components/page-layout.css`—there is no exported prop or sub-component exposing the container constraint. The component does not accept `maxWidth`, does not export a `Container` sub-component, and has no documented token for the content-width cap. Consumers who need a standalone centered container must either nest inside `<PageLayout>` (wrong semantic) or re-implement the constraint themselves.

**Decision: do not add a new `container.svelte` that duplicates `page-layout`'s visual output.** Instead, extract the width constraint into a `--cinder-content-width` token (if not already present), and expose it via the `Center` primitive from the Every-Layout set. Document in `page-layout`'s props that the content width token can be overridden. If audit finds the CSS uses a hardcoded value, convert it to the token.

Best-practice notes: a standalone `<Container>` component is just a `<Center>` with a specific `maxWidth` default—composing `Center` with a content-width token is the right abstraction rather than a new wrapper component; `page-layout`'s `<div>` wrapping the content is itself the container and should remain—just make the constraint token-driven.

- [ ] Audit `styles/components/page-layout.css` for hardcoded `max-width` values.
- [ ] If hardcoded, replace with `var(--cinder-content-width)` and add the token to `styles/tokens.css` (or wherever layout tokens live).
- [ ] Document the token in `page-layout.svelte`'s JSDoc and in Storybook so consumers know how to override the content width.
- [ ] Verify that the forthcoming `Center` component (Every-Layout set) defaults to this same token so the two stay aligned.
- [ ] No new `container.svelte` file — the extracted token + `Center` covers the use case.

---

### Aspect ratio box — ADD `aspect-ratio.svelte`

A wrapper that enforces a fixed aspect ratio on its content. Built on the native `aspect-ratio` CSS property—not the legacy padding-bottom percentage trick. Cinder targets modern browsers where `aspect-ratio` has universal support (baseline 2021).

Best-practice notes: use `aspect-ratio` directly on the wrapper element; `overflow: hidden` by default to clip content that bleeds outside the ratio; `width: 100%` by default so the box fills its container and height is derived; for embedded iframes and videos, the child should be `position: absolute; inset: 0; width: 100%; height: 100%` inside a `position: relative` wrapper—document this composition pattern; the `ratio` prop should accept both `"16/9"` string form and a numeric `16/9` expression (CSS `aspect-ratio` accepts both); do not restrict to preset ratios—accept any valid value so consumers aren't constrained to 16:9, 4:3, 1:1.

- [ ] Create `aspect-ratio.svelte` with props `ratio: string | number = '16/9'`, `overflow?: 'hidden' | 'visible' = 'hidden'`, `as?: string = 'div'`, `class?: string`, `children: Snippet`.
- [ ] Apply `aspect-ratio` and `overflow` via inline `style` or CSS custom property (`--aspect-ratio`).
- [ ] Document the iframe/video embed composition pattern in Storybook (child absolutely positioned inside).
- [ ] Tests: renders correct element; `ratio` prop applies `aspect-ratio`; `overflow` prop applies overflow; custom `as` renders the correct tag.
- [ ] Storybook: 16/9 image, 1:1 avatar/thumbnail, 4:3 embedded video placeholder, custom numeric ratio.

---

### Scroll area — ADD `scroll-area.svelte`

A styled scrollable container with cross-browser overlay scrollbars. This is chrome only—virtualization is a consumer-level concern outside cinder's scope.

Best-practice notes: native scrollbars are preferred for accessibility; custom scrollbar styling should use `scrollbar-width: thin` (Firefox) and `::-webkit-scrollbar-*` (Chromium/Safari) to style rather than replace the browser scrollbar—never hide native scrollbars and substitute a fake `<div>` track, as that breaks keyboard scrolling, touch scrolling, and AT interaction; `overflow: auto` is preferable to `overflow: scroll` (avoids always-visible scrollbar gutters on macOS); the scroll container itself should be keyboard-focusable (`tabindex="0"`) when it has overflow, so keyboard users can scroll it via arrow keys; do not add `role="region"` unconditionally—expose `aria-label` as an optional prop and document when consumers should use it (i.e., when the scroll area is a meaningful landmark, like a chat message list).

- [ ] Create `scroll-area.svelte` with props `direction?: 'vertical' | 'horizontal' | 'both' = 'vertical'`, `maxHeight?: string`, `maxWidth?: string`, `ariaLabel?: string`, `tabindex?: number`, `as?: string = 'div'`, `class?: string`, `children: Snippet`.
- [ ] Apply `overflow-y: auto` / `overflow-x: auto` based on `direction`; expose via `data-cinder-direction`.
- [ ] Include cross-browser scrollbar styling in the component's `<style>` block: `scrollbar-width: thin; scrollbar-color: var(--cinder-scrollbar-thumb) var(--cinder-scrollbar-track)` for Firefox; `::-webkit-scrollbar`, `::-webkit-scrollbar-thumb`, `::-webkit-scrollbar-track` for Chromium/Safari.
- [ ] Add `--cinder-scrollbar-thumb` and `--cinder-scrollbar-track` to the design token set with sensible defaults (semi-transparent on light/dark).
- [ ] When `ariaLabel` is provided, add `role="region"` and `aria-label={ariaLabel}`; otherwise omit both.
- [ ] Apply `tabindex="0"` by default when overflow is active so keyboard users can scroll—document this behavior and allow override via `tabindex` prop.
- [ ] Tests: renders correct element; direction prop sets correct overflow values; `ariaLabel` adds role and label; scrollbar tokens present; `tabindex` prop overrides default.
- [ ] Storybook: vertical (chat-list-like), horizontal (code snippet), bidirectional, with aria-label landmark, styled scrollbar tokens demonstrated.
- [ ] Document explicitly in Storybook that virtualization (e.g., svelte-virtual, TanStack Virtual) is consumer responsibility and pairs with this component for the outer chrome.

---

### Image — ADD `image.svelte`

A general-purpose image wrapper with built-in lazy loading, async decoding, fallback slot, aspect-ratio integration, and a blur-up placeholder for progressive loading. Distinct from `avatar.svelte`, which is specialized for people-shaped circular/square thumbnails with initials fallback.

Best-practice notes: `loading="lazy"` and `decoding="async"` should be the defaults—consumers can override for above-the-fold images that need `loading="eager"`; `alt` must be required with no default—an empty string is a valid accessible choice for decorative images but the consumer must make that choice explicitly, not silently; the fallback slot renders while the image is loading or has errored, giving consumers control over skeleton states without cinder imposing a specific loading UI; the blur-up placeholder technique uses a low-resolution inline base64 image as `background-image` with `image-rendering: pixelated` and transitions to `opacity: 0` when the real image loads—do not use a `<canvas>` approach; `aspect-ratio` integration means the wrapper div enforces the ratio so the layout doesn't reflow when the image loads; never overlap with `avatar.svelte`—this component does not render initials and does not manage person identity.

- [ ] Create `image.svelte` with props `src: string`, `alt: string` (required, no default), `width?: number`, `height?: number`, `ratio?: string`, `loading?: 'lazy' | 'eager' = 'lazy'`, `decoding?: 'async' | 'sync' | 'auto' = 'async'`, `placeholder?: string` (base64 low-res src), `objectFit?: string = 'cover'`, `class?: string`, `fallback?: Snippet`, `children?: Snippet`.
- [ ] Render an `<img>` with `loading`, `decoding`, `alt`, `width`, `height`, and `src`; wrap in a `<div>` only when `ratio` or `placeholder` is provided to avoid unnecessary DOM nodes.
- [ ] When `placeholder` is provided, apply it as `background-image` with `image-rendering: pixelated` on the wrapper; add an `onload` handler to the `<img>` that fades out the placeholder via a CSS class toggle.
- [ ] When `ratio` is provided, apply `aspect-ratio: {ratio}` to the wrapper so layout is stable during load.
- [ ] When the image errors (`onerror`) and `fallback` snippet is provided, unmount the `<img>` and render `{@render fallback()}` instead.
- [ ] `alt=""` is valid for decorative images—do not warn or override it; just ensure it's explicit in the prop type (`alt: string`, not `alt?: string`).
- [ ] Do not replicate `avatar.svelte`'s initials logic—this component has no concept of a person's name.
- [ ] Tests: renders `<img>` with lazy/async defaults; `onerror` triggers fallback snippet; `placeholder` applies background-image; `ratio` applies aspect-ratio to wrapper; `alt=""` passes through without modification.
- [ ] Storybook: basic image, with aspect ratio, with blur-up placeholder, with error fallback (broken src), decorative (`alt=""`), above-the-fold (`loading="eager"`).

## Data & Utility — Toast Audit, Infinite Scroll, Sortable, Tree, Calendar Display

### Toast / notification programmatic API — AUDIT (documentation gap only)

The programmatic surface already ships and works. `toast-region.svelte` sets a typed Svelte context via `setContext<ToastApi>`, and `utilities/use-toast.ts` exposes `useToast()` as the public accessor. Both `useToast` and the full type set (`ToastApi`, `ToastItem`, `ToastOptions`, `ToastVariant`) are re-exported from the package barrel (`index.ts` lines 224–241), so consumers have a single import path. The dual live-region routing (`role="status"` for info/success, `role="alert"` for warning/danger) is correct per WCAG 4.1.3 and the implementation handles deduplication, auto-dismiss, sticky toasts, and action buttons with `keepOpen`.

What's missing is documentation. There is no usage example, no prop table, and the `toast-region.a11y.md` covers DOM structure but not the call-site pattern. A new consumer cannot discover `useToast()` exists without reading source.

Best-practice notes: the region-scoped context model is the right call—process-global singletons leak between SSR requests and route transitions. The `onDestroy` timer teardown prevents orphaned `setTimeout` calls. The `hydrated` gate is correct for overlays that must not appear in SSR markup.

- [ ] Write a usage guide covering `<ToastRegion>` placement, `useToast()` call-site pattern, all `ToastOptions` fields, and the `show()` return value (toast id for targeted dismiss).
- [ ] Add a playground example demonstrating all four variants (`info`, `success`, `warning`, `danger`) and the action-button pattern.
- [ ] Document the `children` prop pattern for modal-scoped regions.
- [ ] Add a note that `useToast()` throws by design when called outside a `<ToastRegion>`—this is intentional, not a bug.

---

### Infinite scroll sentinel / load-more — ADD `use-intersection.svelte.ts` + `load-more.svelte`

Click-based pagination already exists in `pagination.svelte`. The infinite-scroll case is a different use pattern: a streaming list that loads the next page when the user approaches the bottom, with a load-more button as the no-JS and user-preference fallback.

The right primitive is an `IntersectionObserver` attachment factory, not a component. The sentinel element is just a `<div>` the consumer places after the last list item; the attachment fires `onVisible` when the threshold is crossed. A thin `<LoadMore>` wrapper component handles the button fallback, `aria-busy` state during fetch, and the "all loaded" terminal state.

Best-practice notes: always honor `prefers-reduced-motion`—any fade-in animation on new items must be suppressed. When new items _prepend_ (chat, activity feed), focus management is critical: do not steal focus from the user's current position, and announce the item count delta via an `aria-live="polite"` region rather than moving focus. For append-only lists (the common case), no focus management is needed beyond keeping the sentinel out of tab order. Mark the list container `aria-busy="true"` during in-flight requests. Provide an `aria-label` on the sentinel region so screen readers don't announce an unlabeled live region. Cap retries at 5 before surfacing an error state—silent infinite retry loops are a UX antipattern.

- [ ] Create `use-intersection.svelte.ts` exporting an `intersection(options)` attachment factory backed by `IntersectionObserver`. Expose `onVisible`, `threshold`, and `rootMargin` options. Tear down the observer in the returned cleanup function.
- [ ] Create `load-more.svelte` with props: `loading: boolean`, `hasMore: boolean`, `onLoadMore: () => void`, `label?: string` (default "Load more"). Renders a sentinel div (for auto-trigger) and a visible button (for manual trigger / no-JS).
- [ ] Set `aria-busy` on the list container (consumer-provided, via a slot or `aria-controls` reference) during `loading`.
- [ ] Suppress item entrance animations when `prefers-reduced-motion: reduce` is active.
- [ ] Add a terminal "You've reached the end" state when `hasMore` is `false` and at least one page has loaded, announced via `aria-live="polite"`.

---

### Sortable / drag-and-drop list — ADD `sortable-list.svelte` + `sortable-item.svelte`

Reorderable lists are a significant lift. The mouse path (pointer events + drag-over insertion logic) is table stakes; keyboard reorder is the accessibility bar and must ship in the same version—no shipping mouse-only.

Pattern: `<SortableList>` owns the ordered array and fires `onReorder` with the new sequence. `<SortableItem>` is the draggable row; it renders a drag handle button and manages its own lifted/dragging state. The keyboard interaction follows WAI-ARIA Authoring Practices for drag-and-drop: Space to lift the focused item, Arrow Up/Down to move it, Space again to drop, Escape to cancel and return to original position. Announce all state transitions via an `aria-live="assertive"` region: "Item lifted. Current position 2 of 5. Use arrow keys to move. Space to drop, Escape to cancel." / "Item moved to position 3 of 5." / "Item dropped." / "Reorder cancelled."

Best-practice notes: the drag handle must have a visible focus indicator that meets 3:1 contrast ratio against adjacent content (WCAG 2.4.11 at AA). The lifted item should have a visual affordance (e.g., elevated shadow, slight scale) that respects `prefers-reduced-motion`. Touch reorder (long-press to lift) should use pointer events rather than the HTML5 drag-and-drop API, which has no touch support on iOS. The `onReorder` callback receives the full reordered array, not a swap delta—consumers should not need to reconstruct state. Do not use `tabindex=-1` on list items themselves; only the drag handle button is focusable.

- [ ] Design the `SortableList` / `SortableItem` props API and `onReorder` callback shape.
- [ ] Implement keyboard reorder: Space to lift, Up/Down to move, Space to drop, Escape to cancel. Live-region announcements for all transitions.
- [ ] Implement pointer drag reorder with insertion preview (ghost element or shift animation on adjacent items). `prefers-reduced-motion` suppresses shift animation, falls back to static swap.
- [ ] Touch support via pointer events; document that the HTML5 drag API is not used.
- [ ] Drag handle button: visible focus ring, `aria-label="Drag to reorder"` (or equivalent prop), `aria-pressed` when item is lifted.
- [ ] Write keyboard interaction table in the `.a11y.md` companion file.

---

### Tree / tree-view — ADD `tree.svelte` + `tree-item.svelte`

The `json-schema-editor` does _not_ use a shared tree primitive. It renders nested properties through `property-list.svelte` → `property-editor.svelte` recursion, with inline `expanded` state tracked in a plain object. This is a bespoke, editor-domain implementation—not composable as a general tree. Extracting a `tree.svelte` primitive would let json-schema-editor migrate to it, eliminating the duplicated expand/collapse logic. That migration is a follow-on task and should be tracked separately once `tree.svelte` ships.

The ARIA model for tree is well-specified: `role="tree"` on the root, `role="group"` on nested lists, `role="treeitem"` on each node, `aria-expanded` on nodes with children, `aria-selected` for selectable trees. Navigation uses a roving tabindex—only one item is in the tab sequence at a time. Arrow key map: Right expands a collapsed node (or moves to first child if already expanded), Left collapses an expanded node (or moves to parent if already collapsed), Up/Down move between _visible_ items in DOM order, Home/End jump to first/last visible item.

Best-practice notes: `aria-expanded` must be omitted entirely on leaf nodes, not set to `false`—setting `aria-expanded="false"` on a leaf tells AT the node has children but they're hidden, which is incorrect. Multi-select trees need `aria-multiselectable="true"` on the root; single-select trees should omit it. Loading children asynchronously requires `aria-busy="true"` on the expanding item during fetch.

- [ ] Create `tree.svelte` (`role="tree"`, `aria-multiselectable` prop) and `tree-item.svelte` (`role="treeitem"`, `aria-expanded` when has children, roving tabindex).
- [ ] Implement full keyboard navigation: Right/Left expand/collapse, Up/Down traverse visible items, Home/End first/last visible.
- [ ] Omit `aria-expanded` on leaf nodes.
- [ ] Support async child loading: `aria-busy="true"` during fetch, spinner or skeleton inside the node.
- [ ] Selection model: `none` (browse only) | `single` | `multiple`. `aria-selected` only present in single/multiple mode.
- [ ] Note in description: after `tree.svelte` ships, file a follow-on task to migrate `json-schema-editor`'s `property-list` / `property-editor` recursion to consume it.

---

### Calendar display (month/week grid) — ADD `calendar.svelte`

This is the _display-and-event-grid_ case, not the date picker. The date picker task covers calendar-as-picker; this calendar renders appointments, events, and schedule data in month or week grid format for scheduling applications.

The architecture is slot-driven: the calendar owns the grid scaffold (headers, day cells, week cells), and consumers provide event rendering via snippets. This keeps the component free of opinions about event data shape—a `CalendarEvent` type is defined but the visual treatment is entirely consumer-controlled. Locale is handled via `Intl.DateTimeFormat` with an explicit `locale` prop (no bundled locale data). First-day-of-week is configurable (0 = Sunday, 1 = Monday, per locale convention). Week numbers are optional and use `Intl.DateTimeFormat` with `{ week: 'numeric' }`.

Best-practice notes: day cells must have an accessible label that includes the full date, not just the number—"Monday, June 2" rather than "2". Events that span multiple days need `aria-label` spanning the full range. Navigation controls (previous/next month, today) must be keyboard accessible with meaningful labels: "Previous month, May 2025" not "Previous". The grid itself is presentational—use a CSS grid layout, not an HTML `<table>`, because the semantic relationship between dates and events does not map to a data table's row/column model.

- [ ] Create `calendar.svelte` with props: `view: 'month' | 'week'`, `date: Date` (focused month/week), `locale?: string`, `firstDayOfWeek?: 0 | 1`, `weekNumbers?: boolean`, snippets `event?` and `dayHeader?`.
- [ ] Month view: 7-column CSS grid, day cells with full `aria-label` dates, overflow indicator for cells with more events than fit.
- [ ] Week view: time-axis column, 7 day columns, events positioned by start/duration.
- [ ] Navigation: previous/next and "today" controls with descriptive `aria-label` values including the target period name.
- [ ] Locale via `Intl.DateTimeFormat`; week numbers via `{ week: 'numeric' }` option.
- [ ] Emit `ondateselect` and `oneventclick` callback props for interactivity without owning selection state.

## Cross-Cutting — Theming, Tokens, RTL, Focus Ring, Reduced Motion, Skip-Link, Announcer, Component Maturity

---

### 1. Theme switcher / color scheme toggle

**Pattern summary.** Cinder uses `light-dark()` throughout its token layer, which means `color-scheme` is the single lever controlling the whole palette. A theme switcher is a consumer-facing feature (Storybook toolbar, docs site toggle, opt-in component) plus a documented strategy for how applications should set and persist `color-scheme` on `:root`.

**What is there today.**

- `tokens-base.css` uses `light-dark(...)` for every color token.
- `foundation.css` sets no explicit `color-scheme` on `:root` — that is intentionally left to the consumer.
- No toggle component, no utility, no documented pattern.

**What is missing.**

- A documented strategy (e.g., "set `color-scheme` on `:root` via a data attribute + CSS variable; cinder follows automatically").
- An optional `ThemeSwitcher` component or Svelte utility for applications that want a built-in toggle.
- Storybook toolbar integration so docs previews can switch themes.

**Decision.** Ship the documented strategy first. The component is optional and can ship as a recipe. Storybook toolbar is a separate deliverable scoped to the docs package.

**Checklist.**

- [ ] Document the `color-scheme` contract in `docs/theming.md`.
- [ ] Provide a minimal Svelte snippet (not a full component) showing a toggle that sets `color-scheme` on `:root`.
- [ ] Add a Storybook global toolbar for theme switching in the docs package.
- [ ] Verify `@media (prefers-color-scheme)` still works alongside the manual toggle.

---

### 2. Design tokens documentation

**Pattern summary.** Every `--cinder-*` custom property that consumers can rely on should be listed in a single reference document with its purpose and default value. This is the public API contract for the token layer.

**What is there today.**

- `tokens-base.css` — full set of base (scale) tokens.
- `tokens.css` — semantic/alias tokens that reference the base layer.
- `tokens.test.ts` — exists, verifying token structure.
- No consumer-facing documentation of the token surface.

**What is missing.**

- `docs/tokens.md` (or similar) generated from or hand-maintained against the CSS files, listing every token, its purpose, and its default value.

**Decision.** Hand-maintain initially; the token set is stable enough. Add a CI check (`bun run tokens:check` or similar) that compares the documented list against the actual CSS files so drift is caught at review time rather than discovered by consumers.

**Checklist.**

- [ ] Create `docs/tokens.md` with sections: Color, Typography, Spacing, Radius, Shadow, Motion, Ring.
- [ ] List each `--cinder-*` variable: name, purpose, default value.
- [ ] Add a build-time or test-time check that every variable in `tokens-base.css` and `tokens.css` appears in the doc.
- [ ] Link from the main `README.md`.

---

### 3. Localization / RTL support audit

**Pattern summary.** RTL readiness requires replacing physical CSS properties (`margin-left`, `padding-right`, `border-left`, etc.) with their logical equivalents (`margin-inline-start`, `padding-inline-end`, `border-inline-start`). The pending `segmented-control` rewrite is the right moment to establish the pattern before more components land.

**What is there today.**

- Audit of `packages/components/src/styles/` finds **19 occurrences** of physical margin/padding/border properties across component stylesheets.
- No `dir="rtl"` tests, no `stylelint-use-logical` rule, no documented RTL stance.

**What is missing.**

- A `stylelint` rule (`stylelint-use-logical`) added to the linting pipeline to prevent new violations.
- A pass through the 19 existing occurrences to flip each to its logical counterpart.
- Documentation of the RTL stance in `docs/rtl.md` or as a section in `CONTRIBUTING.md`.

**Decision.** Add the lint rule first (zero-cost enforcement going forward), then fix existing violations in a single targeted pass. Do not propose a wholesale rewrite — this is a find-and-replace at 19 sites.

**Checklist.**

- [ ] Install `stylelint-use-logical` and configure it in the stylelint config.
- [ ] Fix all 19 existing physical-property violations.
- [ ] Verify `segmented-control` rewrite uses logical properties from the start.
- [ ] Add a brief RTL note to `CONTRIBUTING.md`.

---

### 4. Focus ring tokens / global focus-visible policy

**Pattern summary.** A single `--cinder-ring-*` token set plus one globally-applied `:focus-visible` rule in `foundation.css` should be the entire focus ring implementation. Components override only when geometry requires it (inset rings, clipped containers). The audit should count how many distinct implementation strategies exist today.

**What is there today.**

- `tokens-base.css` defines `--cinder-ring-width`, `--cinder-ring-offset`, `--cinder-ring-offset-color`, `--cinder-ring-color`. Token coverage is good.
- `foundation.css` applies a global `:focus-visible` rule using those tokens. That is correct baseline behavior.
- **24 component CSS files** contain at least one `:focus-visible` block. Within those, three distinct strategies are in use:
  1. `outline` using the ring tokens directly (breadcrumbs — correctly defers to foundation).
  2. `outline: transparent` + `box-shadow` ring (input, textarea, select, navigation-item) — used to achieve an offset ring with a background-color gap, which `outline-offset` cannot do alone in all browsers.
  3. `outline: none` + `box-shadow: 0 0 0 2px var(--cinder-ring-color)` without offset (dropdown trigger, dropdown items) — inconsistent; skips the offset and does not use ring tokens uniformly.
- Every component that uses `box-shadow` correctly provides a `@media (forced-colors)` fallback outline. That is good.

**What is missing.**

- Strategy 3 (bare `box-shadow` without offset, without using all ring tokens) should be aligned with Strategy 2.
- A brief decision record in `docs/focus-ring-policy.md` stating which strategy to use when and why — so future contributors do not invent a fourth approach.

**Decision.** Strategies 1 and 2 are both valid and intentional. Strategy 3 is a deviation; fix the specific components (dropdown trigger, dropdown items) to use the standard box-shadow pattern from Strategy 2. Document the two-strategy rule.

**Checklist.**

- [ ] Audit `dropdown.css` focus rings; align trigger and item rings to the Strategy 2 pattern.
- [ ] Write `docs/focus-ring-policy.md` documenting the two approved patterns and when to use each.
- [ ] Consider adding a stylelint custom rule or comment annotation to flag bare `outline: none` without a shadow/forced-colors pair.

---

### 5. `useReducedMotion` utility

**Pattern summary.** Multiple upcoming components (drawer, sheet, command-palette, sortable, virtual list) need to gate JS-driven animations behind `prefers-reduced-motion`. Today that check is copy-pasted per component or handled only at the CSS layer. A shared `useReducedMotion` Svelte utility prevents drift and gives a single place to audit.

**What is there today.**

- `foundation.css` has a global `@media (prefers-reduced-motion: reduce)` rule that zeroes durations and transitions — this covers CSS animations.
- Multiple component CSS files duplicate `@media (prefers-reduced-motion: reduce)` blocks (accordion, skeleton, tooltip, toggle, progress, etc.).
- `packages/components/src/utilities/` has no `use-reduced-motion` file — confirmed absent.
- `_internal/OVERLAY-POLICY.md` explicitly requires all overlays to check `prefers-reduced-motion` but provides no shared helper.

**What is missing.**

- `use-reduced-motion.svelte.ts` — a reactive utility that wraps `MediaQuery` from `svelte/reactivity` and exposes a `.current` boolean.

**Decision.** Implement now. Use `MediaQuery` from `svelte/reactivity` (already in the Svelte 5 API) rather than a custom `matchMedia` wrapper. Once this lands, downstream tasks (drawer, sheet, command-palette, etc.) should migrate their inline checks to this utility. Note in each of those task descriptions that the utility exists and is the canonical path — but do not block them on it; each can implement its own `@media` guard until migration.

**Checklist.**

- [ ] Implement `packages/components/src/utilities/use-reduced-motion.svelte.ts` using `MediaQuery` from `svelte/reactivity`.
- [ ] Export `useReducedMotion` from `packages/components/src/index.ts`.
- [ ] Write a test in `use-reduced-motion.svelte.test.ts`.
- [ ] Update `_internal/OVERLAY-POLICY.md` to reference the utility.

---

### 6. Skip-link recipe

**Pattern summary.** A skip link ("Skip to main content") is the first focusable element on a page. It is visually hidden until focused, then revealed. Cinder already provides `visually-hidden` and its `focusable` modifier — the recipe is documentation and a copy-paste snippet, not a new component.

**What is there today.**

- `utilities.css` exports a `.visually-hidden` class and a `.visually-hidden.focusable` (or equivalent) modifier.
- No documentation of the skip-link pattern.

**What is missing.**

- A recipe in `docs/recipes/skip-link.md` showing the HTML, CSS class usage, and a Svelte snippet.

**Decision.** Docs-only task. Do not ship a `SkipLink` component — the pattern is trivial enough that a well-documented snippet is the right deliverable. If demand emerges, promote to a component later.

**Checklist.**

- [ ] Confirm `.visually-hidden` and its focusable modifier are exported and documented.
- [ ] Write `docs/recipes/skip-link.md` with HTML example, Svelte snippet, and placement guidance (first child of `<body>` or `<main>`).
- [ ] Link from the accessibility docs index.

---

### 7. Announcer / live region API — audit and export

**Pattern summary.** `useAnnouncer` is a fully-implemented, well-documented Svelte 5 rune-based utility for ARIA live regions. The audit question is whether it is publicly exported and whether its usage pattern is documented for consumers.

**What is there today.**

- `packages/components/src/utilities/use-announcer.svelte.ts` — exists, fully implemented with debounce, auto-clear, and cleanup. JSDoc is thorough.
- Exports: `useAnnouncer`, `AnnouncerOptions`, `Announcer` types.
- **Not exported from `packages/components/src/index.ts`** — confirmed absent from the index.

**What is missing.**

- An export line in `index.ts`.
- A usage example or recipe page in docs (the JSDoc covers internal usage but consumers need a discoverable reference).

**Decision.** Add the export. Write a short recipe page. No implementation changes needed — the utility is solid.

**Checklist.**

- [ ] Add `export { useAnnouncer } from './utilities/use-announcer.svelte.js'` (and the types) to `packages/components/src/index.ts`.
- [ ] Write `docs/recipes/announcer.md` showing the live-region markup pattern alongside the utility.
- [ ] Confirm the export appears in the built package's type declarations.

---

### 8. Component status / maturity badges

**Pattern summary.** Consumers need to know which components are stable API, which are beta (may have breaking changes in minor versions), and which are alpha (experimental, no stability guarantee). The lightest mechanism is a JSDoc `@status` tag on each component module plus a lint rule that surfaces components missing the tag.

**What is there today.**

- No `@status` tags, no maturity metadata, no documented policy.
- Components range from battle-tested (Button, Input) to experimental (the `experimental/` subdirectory exists but its boundary with stable is informal).

**What is missing.**

- A documented convention: `@status alpha | beta | stable`.
- An oxlint custom rule or a simple grep-based CI check that errors on any component module missing `@status`.
- A Storybook badge or indicator in the component docs page (design decision — could be as simple as a JSDoc `@remarks` rendered in the story description).

**Decision.** Use JSDoc `@status` — no separate metadata file needed. A lint rule (oxlint plugin or a small Bun script) enforces coverage. The Storybook rendering of the badge is a UI polish task that can follow once the tagging convention is established.

**Checklist.**

- [ ] Define the `@status` convention in `CONTRIBUTING.md`.
- [ ] Audit and tag all existing components with `alpha`, `beta`, or `stable`.
- [ ] Add a CI check (oxlint plugin or Bun script) that fails if a component module is missing `@status`.
- [ ] Decide whether to render the badge in Storybook (recommend: yes, via the `parameters.status` Storybook addon or a custom `docs.description` injection).

## Cross-Cutting Priorities

1. `form-field.svelte` (+ `form-section.svelte`) — most load-bearing missing primitive; unblocks every other form composition.
2. `select.svelte` field-control contract — most behind among existing components.
3. `input.svelte` addon slots — required before realistic currency/URL prefix forms.
4. `drawer.svelte` — required for the mobile path of `sidebar.svelte` and as a sibling overlay to `modal.svelte`.
5. `button.svelte` variant/size expansion + icon slots — touches every other component's example surface.
6. `color-picker.svelte` — net-new primitive; benefits from `form-field.svelte` for field-control wiring.
7. `visually-hidden.svelte` — small but high-leverage; replaces five different sr-only patterns scattered across the codebase.
8. `segmented-control.svelte` rewrite — breaking API change; do it before more consumers land. Single-mode default keeps current call sites working.
9. `surface.svelte` review — small scope but blocks any consistent visual-prominence design language.
10. `color-swatch-picker.svelte` — small standalone primitive; build before `color-picker.svelte` so the picker can compose it.
11. `popover.svelte` — high-leverage primitive that unblocks command palette, rich tooltips, and several form patterns; shares focus-trap infra with `modal`/`drawer`.
12. `useReducedMotion` utility — several queued tasks already depend on a JS-side reduced-motion check; ship the helper early so consumers converge on one source of truth.
13. `date-picker.svelte` — biggest single component gap in the system; long lead time so start the design conversation early.
14. `slider.svelte` — small but currently zero alternatives; blocks any fine-control UI (volume, brightness, threshold).
15. Focus ring policy unification — three different `:focus-visible` styles exist today; one mixin + one token before more components ship.
