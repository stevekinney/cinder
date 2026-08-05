---
'@lostgradient/cinder': patch
---

Align public component contracts across sibling components (#1158, #1159):

- Add native `HTMLAttributes` passthrough (`{...rest}`, component-owned attributes always win) to `Steps`, `CheckboxGroup`, `TabList`, `Tab`, `TabPanel`, `TableBody`, `TableHeader`, `Breadcrumbs`, and `Meter`.
- Fix `title` attribute collisions on `StatisticsSection` and `FeatureSection` — the native tooltip `title` is now excluded from the type so only the domain heading meaning is reachable (type-only; runtime behavior was already correct).
- `Rating` now renders the same visible required-marker asterisk as `PhoneInput`/`PinInput` when `required` is set.
- `TagInput` now emits a dev-only warning when its native `required` prop is set without the wrapping `FormField` supplying `required` context, matching its existing id-mismatch warning.
- `TableHeader`'s `allSelected`/`someSelected`/`onSelectAll` trio is remodeled as a two-arm discriminated union (`TableHeaderSelectionProps`), matching `TableRow`'s pattern. This is a compile-time-only tightening: any prop combination that type-checks today keeps type-checking, and the only newly-rejected calls are ones that already threw at runtime (Table.selectable with a partial selection prop set). No prop name is added, removed, or renamed.
- `CommandItem.selectionMode`'s JSDoc (types + README) now states plainly that it only controls whether `onSelect` is required at compile time and has no runtime effect on activation dispatch — no behavior changed.
- `CallToActionSection`'s and `CapabilityGate`'s `SchemaProps` interfaces now both explicitly list their function/snippet props and carry a one-line comment stating the schema-surface rule (every public prop is either JSON-Schema-expressible or surfaced via `unsupportedProps`). Note: the generated schema/README output for `CallToActionSection` was already correct before this change — `scripts/generate-component-schema.ts` already auto-surfaces function/snippet props omitted from a `SchemaProps` allowlist into `unsupportedProps` — this is a source-level consistency fix, not an output fix.
- `TableOfContents.target`'s schema-facing JSDoc and README now note that the schema surface accepts the CSS-selector string form only, while the live component prop additionally accepts an `HTMLElement` reference.
- `Tab`'s `onclick`/`onkeydown` are additionally excluded from its `HTMLAttributes` intersection (beyond the issue's literal instruction) because the component sets both unconditionally on its root `<button>`; leaving them reachable via `rest` would let a consumer's forwarded handler type-check while silently never firing.
