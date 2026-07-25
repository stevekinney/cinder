# Component API Conventions

Cinder component props use one public vocabulary. The rules below are enforced
by `packages/components/scripts/check-prop-conventions.ts`.

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
