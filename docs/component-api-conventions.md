# Component API Conventions

Cinder component props use one public vocabulary. Mechanically checkable naming
rules are enforced by `packages/components/scripts/check-prop-conventions.ts`;
the composition rules define the review standard for public APIs, while
cross-cutting visual policies are documented alongside them and require
component-level review.

## Handlers

- Native DOM event props use Svelte 5 lowercase names such as `onclick`,
  `onchange`, `oninput`, and `onkeydown`. A lowercase `on*` name is only legal
  when the handler's first parameter extends `Event` — `check:prop-conventions`
  enforces this with the type checker, so a value-carrying callback cannot
  squat on a native name.
- Custom component notifications use camelCase `onNounVerb` names, such as
  `onSearchChange`, `onFacetChange`, and `onValueChange`.
- Value interceptors are not notifications. A callback that can replace or veto
  a proposed value must be named `onValueChangeRequest`.

## Bindable values

Do not expose `defaultValue`. Use `value = $bindable(fallback)` in the
component. If native form reset needs a target, capture the mount-time `value`
internally with `untrack(() => value)` and keep that closure variable private.

## Strings and snippets

- Use strings for plain labels and values whose semantic wrapper is fully owned
  by the component.
- Use a named `Snippet` prop for a structural region such as `actions`,
  `breadcrumbs`, `header`, or `footer`. Region names describe placement and
  purpose; do not collapse multiple regions into generic `children`.
- When a text-first region intentionally supports rich phrasing, accept
  `string | Snippet` under the region's semantic name. The component still owns
  the heading, paragraph, or label element, and the snippet must respect that
  element's content model.
- Reserve `children` for components with exactly one obvious, primary content
  region. If consumers need to reconstruct the component's layout inside
  `children`, the API needs named regions instead.

## Boolean props

Boolean prop names must describe state or capability as adjectives. Do not use
`show*`, `allow*`, or `use*` prefixes. Prefer names such as
`languageLabelVisible`, `searchVisible`, `customValueAllowed`, and
`nativeShareEnabled`.

## Shared vocabulary

Use one name for one concept:

- `filter`, not `filterItem`
- `fieldClassName`, not `fieldClass`
- `textInputValue`, not `inputValue`
- `as`, not `component`, for polymorphic rendered elements

The checker also treats reordered camel-case words as the same concept. For example, after `onValueChange` exists, `onChangeValue` is rejected even though it is not a pre-listed alias. This keeps a new spelling from quietly creating a second public name for an established API concept; add a deliberate redirect to the vocabulary only when the words themselves differ.

`as` props should use the narrowed non-void element tag-name union exported from
`packages/components/src/utilities/html-element-types.ts`.

## Full words

Do not abbreviate public prop or component names. Current banned forms:

- `mono` → `monospace` (typeface meaning — and `monochrome` is likewise banned: the Badge prop renders a monospace font, not a single-color treatment)
- `colSpan` → `columnSpan`
- `lockScroll` → `scrollLocked`
- `CtaSection` → `CallToActionSection`
- `FloatingActionButton` → `FloatingAction`
- `Stat` / `StatGroup` → `Statistic` / `StatisticGroup` (no `StatisticsSection`
  component exists in the tree; the family's collection is the compound
  `StatisticGroup` parent, not a separate `*Section` component)

## `*Group` versus plural component names

A `*Group` component name (`AvatarGroup`, `ButtonGroup`, `CheckboxGroup`,
`DropdownGroup`, `RadioGroup`, `SideNavigationGroup`, `StatisticGroup`) is a
curated collection of N instances of its matching singular component
(`Avatar`, `Button`, `Checkbox`, `Dropdown`, `RadioItem`, `SideNavigation`,
`Statistic`). What "grouping" means — shared accessible label, fieldset/legend
semantics, a layout grid, or a collapsible bucket — varies per family and is
documented in that component's `@purpose` metadata; `*Group` itself only
promises the collection relationship, not a specific grouping mechanic.

A bare plural component name (no matching singular component composed inside
it) is permitted only as a domain mass noun — a name for a kind of thing, not
a container of named instances. It is never legal as a collection name: a new
component that collects instances of an existing singular component must be
named `<Singular>Group`, not a bare plural of that singular. `check:prop-conventions`
enforces this mechanically: it enumerates existing component directory names
and rejects a candidate new component name that, once stripped of a trailing
`s`, matches an existing singular component's directory name.

No existing component is renamed by this convention; it governs new component
names going forward. See [`docs/decisions/group-vs-plural-naming.md`](./decisions/group-vs-plural-naming.md)
for the decision record.

## Icons

Use the shared Lucide icon vocabulary for interactive affordances. Disclosures
that render an indicator use a rotating chevron; nested submenus use
direction-aware lateral chevrons, while intentionally text-only disclosures
remain icon-free. Directional transfer uses single or double chevrons; do not
use `+`, `-`, `−`, `<`, or `>` text glyphs in their place. See [Icon
vocabulary](./icon-vocabulary.md) for sizing utilities, accessible-name
guidance, and the current audit.

## Surfaces and controls

Form controls sit on `--cinder-surface-raised` in both themes.
`--cinder-surface` is a page or panel surface and must never be used as an
input fill. Use `--cinder-border-muted` for interior dividers and reserve
`--cinder-border` for a component's outer edge. The repository stylelint rules
`cinder/no-surface-on-form-control` and `cinder/interior-border-weight` enforce
these contracts.
