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

- [ ] Create `button-group.svelte` as a layout container: `role="group"`, required `label: string` for `aria-label`, `class` passthrough, `orientation: 'horizontal' | 'vertical'` (default horizontal).
- [ ] Border-collapse via adjacent-sibling selectors or data attributes so internal shared borders render as a single 1px line, not 2px doubled.
- [ ] Elevate focused child `z-index` so focus rings aren't clipped by the group's border context.
- [ ] Document the split-button composition in Storybook using the existing `dropdown.svelte` as the trailing trigger — no new split-button primitive.
- [ ] Do NOT add selection-state logic to `button-group` — keep that boundary clean against `segmented-control`.

## Cross-Cutting Priorities

1. `form-field.svelte` (+ `form-section.svelte`) — most load-bearing missing primitive; unblocks every other form composition.
2. `select.svelte` field-control contract — most behind among existing components.
3. `input.svelte` addon slots — required before realistic currency/URL prefix forms.
4. `drawer.svelte` — required for the mobile path of `sidebar.svelte` and as a sibling overlay to `modal.svelte`.
5. `button.svelte` variant/size expansion + icon slots — touches every other component's example surface.
