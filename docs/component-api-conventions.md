# Component API Conventions

Cinder component props use one public vocabulary. Mechanically checkable naming
rules are enforced by `packages/components/scripts/check-prop-conventions.ts`;
the composition rules also define the review standard for public APIs.

## Handlers

- Native DOM event props use Svelte 5 lowercase names such as `onclick`,
  `onchange`, `oninput`, and `onkeydown`.
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

`as` props should use the narrowed non-void element tag-name union exported from
`packages/components/src/utilities/html-element-types.ts`.

## Full words

Do not abbreviate public prop or component names. Current banned forms:

- `mono` → `monochrome`
- `colSpan` → `columnSpan`
- `lockScroll` → `scrollLocked`
- `CtaSection` → `CallToActionSection`
- `FloatingActionButton` → `FloatingAction`
- `Stat` / `StatGroup` / `StatsSection` → `Statistic` / `StatisticGroup` /
  `StatisticsSection`
