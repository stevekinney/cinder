---
'@lostgradient/cinder': minor
---

Type hygiene and barrel export cleanup across four areas:

- Removed nine `as` type assertions that TypeScript already proved unnecessary
  (context-menu, command-menu, dropdown-trigger, faceted-filter-bar, file-upload,
  form-section, marquee, navigation-item, plus a playground-only cast). No behavior
  change; `marquee`'s cast additionally erased a real `null` case from its
  `aria-labelledby` prop type, so the fixed type is stricter and more accurate.
- Fixed type-erasing casts and phantom generics across six components:
  `FloatingAction`'s per-arm `onclick` is now correctly typed instead of pulled out
  of the union; `NumberInput` forwards its rest props with their real type instead
  of `Record<string, unknown>`; `GridList` composes with `Grid` through a single
  cast instead of `as unknown as`; `PermissionMatrix` now genuinely wires its
  `TRow`/`TColumn` generics (previously declared but never threaded through
  `$props()`); `SchemaForm`'s `Schema` generic was removed because it only ever
  narrowed the `schema` field itself; and a duplicated `ChoiceGridItemProps` type
  was deleted in favor of its single canonical declaration.
  **API-visible for three components:** `GridListProps`'s base element type
  widened from `HTMLUListElement` to `HTMLElement`, `PermissionMatrixProps` gained
  a real `<TRow, TColumn>` generic (previously a no-op default), and
  `SchemaFormProps` lost its incomplete `<Schema>` generic. None of these change
  runtime behavior, but a consumer relying on the old type shape (e.g. an
  `HTMLUListElement`-typed inline handler on `GridList`, or an explicit
  `SchemaFormProps<...>` type argument) may see a new `typecheck`/`svelte-check`
  error, hence the minor bump.
- Re-exported five public prop types that were reachable on their component's
  `Props` type but not importable on their own: `PopoverFocusManagement`,
  `PopoverWidthMode`, `SegmentCurrentToken`, `ResizablePanelSizeUnit`,
  `TreeReorderTarget`, and `TreeItemSelectionState`, from both their component
  barrel and the package root.
- Re-exported `ChartDataTableVisibility` (aliased per-component, e.g.
  `WaveformDataTableVisibility`) from all seven chart-family component barrels
  (`waveform`, `bar-chart`, `area-chart`, `line-chart`, `matrix-chart`,
  `spectrum-chart`, `spectrogram`) and the package root, closing the same gap
  for a shared, non-directory-shaped type module.
