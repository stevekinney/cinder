---
'@lostgradient/cinder': minor
---

feat(props)!: snippet conversions, shared dialog vocabulary, and the FilterBar rename

BREAKING:

- **`FacetedFilterBar` → `FilterBar`** (settled rename): the subpath is now
  `@lostgradient/cinder/filter-bar`, `FacetedFilterBarProps` is
  `FilterBarProps`, and the CSS classes are `.cinder-filter-bar*`. The facet
  model keeps its name — `FacetDefinition`, `FacetOption`, `SelectFacet`,
  `CustomFacet`, `AppliedFilter`, and the `facets`/`onFacetChange` props are
  unchanged ("facet" is precise domain vocabulary, not an abbreviation).
- **CapabilityGate**: the three parallel action families
  (`primaryAction`/`onPrimaryAction`, `fallbackAction`/`fallbackHref`/
  `onFallbackAction`, `dismissAction`) are replaced by one
  `actions?: Snippet<[{ dismiss: () => void }]>` — compose your own Buttons
  and links; the provided `dismiss` runs the gate's unmount-and-`onDismiss`
  path (which `onDismiss` keeps documenting). Focus handling now blurs
  whichever consumer control triggered the dismissal.
- **SourceDiffViewer**: `emptyMessage?: string` becomes `empty?: Snippet`
  (matching the nine chart/command-family `empty` snippets); the default
  "No patch lines to display." text remains the fallback, and the schema
  generator's string special-case is deleted.
- **AlertDialog / ConfirmDialog** now share one `DialogCancelProps`
  vocabulary type (`utilities/dialog-props.ts`) instead of two independent
  `cancelLabel`/`onCancel` declarations. Labels deliberately stay strings;
  each dialog documents its own rendering semantics (AlertDialog: no cancel
  button unless `cancelLabel` is set; ConfirmDialog: always rendered,
  defaults to "Cancel").

Non-breaking widenings: `StepItem.label`/`.description` and
`PricingCard.caveat` accept `string | Snippet`; `ShareCardAction` gains
`labelSnippet?: Snippet` for rich visible content while `label` remains the
accessible name.
