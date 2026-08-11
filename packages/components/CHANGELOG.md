# @lostgradient/cinder

## 0.24.0

### Minor Changes

- [#1255](https://github.com/stevekinney/cinder/pull/1255) [`d13d4cd`](https://github.com/stevekinney/cinder/commit/d13d4cd39bea7b3024793ea8996021b2c8eafc68) Thanks [@stevekinney](https://github.com/stevekinney)! - Polish FileUpload with configurable dropzone copy, accept-derived descriptions,
  file-type icons, maximum-file validation, retry actions, and optional focus and
  drag-active border emphasis. Rename `triggerLabel` to `browseLabel`, rename the
  accepted-file callback to `onFilesAccepted`, and make `onFilesChange` report the
  full locally resolved `FileUploadEntry[]` queue.

### Patch Changes

- [#1264](https://github.com/stevekinney/cinder/pull/1264) [`b0583e2`](https://github.com/stevekinney/cinder/commit/b0583e2e0a44a3757000167ac4cc4171f5a7473b) Thanks [@stevekinney](https://github.com/stevekinney)! - perf(text-direction): skip stylesheets that declare no `direction` before walking them

  Every component that resolves text direction — `Dropdown.Menu`, `DropdownMenu`,
  `ContextMenu`, `CommandMenu`, `MegaMenu`, `MenuBar`, `Slider` — walked every CSS
  rule in every stylesheet in the document, per element, per ancestor, per call,
  with no memoization at any layer: `resolveTextDirection` allocates a fresh
  `WeakMap` on each call and `elementDirectionStyleOverride` passes none at all.

  Measured in a consuming app, a single `Dropdown` mount walked a 179-sheet /
  7651-rule document about 42 times — 7518 `sheet.cssRules` reads plus 44184
  nested reads, ~370ms of blocking main-thread time, 74% of all sampled CPU — to
  answer a question whose answer was `false` for every element, because that app's
  CSS contains no `direction` declarations at all. The cost scaled linearly with
  CPU, so on a loaded machine it delayed first paint of the tab that mounted the
  dropdown past five seconds.

  `matchesDirectionStyleRule` has exactly one way to return `true`: a style rule
  whose `style.direction` is truthy and whose selector matches. A stylesheet that
  declares `direction` nowhere in its rule tree therefore cannot contribute a
  match, and skipping it is behavior-preserving by construction. A new per-sheet
  index answers that question once and caches it, keyed by stylesheet and
  validated against the sheet's top-level rule count.

  Only negative results are cached, since a positive one just sends the caller
  down the walk it would have run anyway. Three kinds of sheet opt out of negative
  caching rather than risk a stale skip: constructed stylesheets (no `ownerNode`),
  because `replace()`/`replaceSync()` throw on anything else and so those are
  exactly the sheets whose contents can be swapped without the rule count moving;
  sheets containing `@import`, whose imported sheet can gain rules asynchronously;
  and sheets whose CSSOM is unreadable, which are reported as "declares direction"
  so the caller still runs its own guarded walk.

  Two mutations on a non-constructed sheet remain invisible to a rule-count key:
  an in-place declaration edit (`rule.style.direction = 'rtl'`), and a
  `deleteRule`/`insertRule` pair between two queries that lands on the same count.
  Both are covered by `invalidatePortalDirection()` — the existing public hook for
  "a CSSOM edit that emits no DOM mutation" — which now clears this index
  unconditionally, including when no portal is currently observing direction.

  Resolves stevekinney/cinder#1262.

## 0.23.1

### Patch Changes

- [#1256](https://github.com/stevekinney/cinder/pull/1256) [`61b1bee`](https://github.com/stevekinney/cinder/commit/61b1bee92854ea8cdf9fc0a856d41e922b2c3966) Thanks [@stevekinney](https://github.com/stevekinney)! - fix(statistic): restore the muted text hierarchy for unthemed Statistics

  `Statistic` resolved its colours through `resolveChartTheme()`, whose
  unthemed defaults are `currentColor` for both `foreground` and `muted`.
  Because the component writes those as **inline** custom properties, the
  `var(--_cinder-chart-*, …)` fallbacks in `statistic.css` could never apply —
  so a `Statistic` rendered without an explicit `theme` painted its label,
  icon, and change description at full text colour, visually identical to the
  value. The label/value hierarchy that `--cinder-text-muted` provided was
  silently lost for every consumer that doesn't pass a chart theme.

  The chart components absorb the same `currentColor` default with a
  compensating `opacity` on their tick labels. That is the wrong tool here:
  this is body text, which has to clear the 4.5:1 AA floor rather than land
  wherever a multiplier puts it — the same reasoning that moved status text
  off the fill tokens in 0.21.

  Unthemed `Statistic` now defaults to the contrast-tuned text tokens
  (`--cinder-text` / `--cinder-text-muted`). The substitution is all-or-nothing on
  `theme`'s presence rather than per-field: supplying any theme — including a
  partial one — keeps `resolveChartTheme()`'s `currentColor` inheritance for the
  fields it omits, so `theme={{ foreground: 'white', background: 'black' }}`
  leaves the label inheriting white instead of dropping the application's dark
  muted token onto a black panel. `background` keeps its `transparent` default.
  To make an otherwise-unthemed Statistic follow an ancestor's `color`, ask for
  it explicitly with `theme={{ foreground: 'currentColor', muted: 'currentColor' }}`.
  No API change.

## 0.23.0

### Minor Changes

- [#1254](https://github.com/stevekinney/cinder/pull/1254) [`0db00f8`](https://github.com/stevekinney/cinder/commit/0db00f891e94ab9c9c4776af1608654b03003de0) Thanks [@stevekinney](https://github.com/stevekinney)! - feat(badge)!: rename `monochrome` to `monospace` ([#1251](https://github.com/stevekinney/cinder/issues/1251))

  BREAKING: Badge's `monochrome` prop is renamed to `monospace`, and the
  `data-cinder-monochrome` attribute (CSS/test hook) to
  `data-cinder-monospace`. No compatibility alias — cinder is pre-release.

  The prop has always rendered the badge label in a monospace font (version
  strings, error codes, commit SHAs); the `monochrome` name came from the
  0.22 no-abbreviations sweep expanding the old `mono` to the wrong full
  word — "monochrome" is color vocabulary, not typeface vocabulary.
  `check:prop-conventions` now bans both `mono` and `monochrome` with
  pointed messages, so a stale name fails the gate instead of silently
  type-erroring. Internal consumers (RunStepTimeline's attempt badges,
  ApprovalCard's environment badge) are migrated.

  Also repaired in the same sweep-audit: comments and an identifier mangled
  by the original blanket replace (`monorepoRoot` had become
  `monochromerepoRoot` in `run-consumer-fixture.ts`, "monorepo root" had
  become "monochromerepo root" in a toast-region test comment, and the
  playground's `dx-spec__val--mono` class had become `--monochrome` while
  still applying `--cinder-font-mono`).

- [#1248](https://github.com/stevekinney/cinder/pull/1248) [`649a5ee`](https://github.com/stevekinney/cinder/commit/649a5eea8056501f009aeee2b7f32e52ed67c595) Thanks [@stevekinney](https://github.com/stevekinney)! - Unify Cinder charts around a shared SVG scene model with measured guide spacing,
  stable interaction targets, bounded high-cardinality rendering, opt-in tooltips,
  custom mark snippets, and inheritable theme and palette overrides. Apply the
  same theme contract across matrix, audio, Sparkbar, and Statistic displays.

## 0.22.0

### Minor Changes

- [#1226](https://github.com/stevekinney/cinder/pull/1226) [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05) Thanks [@stevekinney](https://github.com/stevekinney)! - feat(feed)!: cut the chronological family to three — delete EventTimeline, fold EventStreamViewer into Feed

  BREAKING: the chronological display family is now `Timeline` (display),
  `RunStepTimeline` (execution state), and `Feed` (activity and operational
  streams). No compatibility aliases are shipped — cinder is pre-release.
  - **`EventTimeline` is deleted, not repaired.** Four independent reviews
    concluded its layout model was wrong rather than mistuned. Its subpaths
    (`@lostgradient/cinder/event-timeline` + `/schema`, `/variables`, `/styles`,
    `/examples`) and types (`EventTimelineDate/Item/Props/Size/State`) are gone.
    Its use case — a bounded horizontal window with proportionally positioned
    events — is out of scope for the family; compose a chart or an external
    scheduling library.
  - **`EventStreamViewer` is folded into `Feed`** as the new `kind="log"` arm:
    a `role="log"` viewport with follow-latest scrolling (pause on scroll-away,
    resume at bottom or via the built-in control), `loading` skeleton,
    `truncated` notice, and `connectionState` StatusDot. Migration:
    - `events` array → authored `{#each}` of `Feed.Event` children (new `tone`
      prop carries severity on the rail marker; render source/details in the
      entry body — `JsonViewer` composition replaces built-in detail panels).
    - Reconnect boundaries and sequence-gap markers → the new compose-only
      `Feed.Boundary` leaf (`role="separator"`, consumer-owned wording);
      `detectSequenceGaps` has no replacement — emit boundaries yourself.
    - `onFilter`/`filterQuery`/`onCopyVisible` → consumer-composed controls via
      the log arm's `toolbar` snippet.
    - The built-in empty state (`data-cinder-empty` + "No events to display.")
      is gone — with authored children the component cannot know the stream is
      empty; render your own `role="status"` message when your source array is
      empty.
    - `following`/`loading`/`truncated`/`connectionState`/`label` carry over
      unchanged; types `EventSeverity`/`EventStreamState` are replaced by
      `FeedEventTone`/`FeedConnectionState`.
  - `Feed.Event` gains `tone?: 'neutral' | 'info' | 'success' | 'warning' |
'error'` for the rail marker (non-text colour only — pair with distinct
    icons or wording).
  - The Timeline "Custom dot styles" example renders real Lucide icons instead
    of literal `+` / `!` / `x` characters, and `.example.svelte` files may now
    import `lucide-svelte/icons/*`.
  - `docs/decisions/chronological-display-boundaries.md` is rewritten for the
    three-component reality.

- [#1232](https://github.com/stevekinney/cinder/pull/1232) [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4) Thanks [@stevekinney](https://github.com/stevekinney)! - Refresh component hierarchy, spacing, selection, navigation, and overflow treatments against the expanded token palette. Add interactive Card roots and elevation levels, a single-list TransferList, structured ScheduleBuilder cron fields, an interactive ColorField picker trigger with HWB input, and multi-format ColorPicker copy actions.

- [#1232](https://github.com/stevekinney/cinder/pull/1232) [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove the `DatePicker.triggerLabel` prop. The trigger now always renders a calendar icon while retaining its contextual accessible name.

- [#1226](https://github.com/stevekinney/cinder/pull/1226) [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05) Thanks [@stevekinney](https://github.com/stevekinney)! - feat(drawer)!: merge Sheet into Drawer behind a `placement` prop

  BREAKING: `Sheet` is gone. `Drawer` now covers all three edges via
  `placement: 'left' | 'right' | 'bottom'` (default `'right'`), and the
  `side` prop is renamed to `placement`. No compatibility alias is shipped —
  cinder is pre-release.

  Migration, former Drawer consumers:
  - `side="left" | "right"` → `placement="left" | "right"` (default is still `right`)
  - `DrawerSide` type → `DrawerPlacement`
  - `data-cinder-side` attribute (CSS/test hooks) → `data-cinder-placement`
  - Initial focus on open now lands on the body container (unless a child has
    `[autofocus]`) instead of the first tabbable — the Modal/Sheet policy the
    Drawer a11y notes already documented.
  - Header/footer padding tightened to align with Modal
    (`space-4/space-5` header, `space-3/space-5` footer).

  Migration, former Sheet consumers:
  - `import { Sheet } from '@lostgradient/cinder/sheet'` →
    `import { Drawer } from '@lostgradient/cinder/drawer'`
  - `<Sheet …>` → `<Drawer placement="bottom" …>`; `SheetProps` → `DrawerProps`
  - `.cinder-sheet*` classes → the `.cinder-drawer*` equivalents;
    `aria-label="Close sheet"` → `"Close drawer"`
  - `@lostgradient/cinder/sheet/{schema,variables,styles,examples}` →
    `/drawer/{…}`
  - `--cinder-z-sheet` token and `Z_LAYERS.sheet` are removed (both components
    already rendered at `--cinder-z-modal`).
  - Geometry is identical under `placement="bottom"` (100% width, 90dvh cap,
    rounded top corners, optional `dragHandleVisible` drag handle); `size` is
    ignored for `bottom`.

  Every placement now has an explicit `@starting-style` + closing rule pair, and
  a unit test pins one per placement (derived from the generated schema enum) so
  a future edge can't ship a pop-in.

  Also fixed in the shared sliding-dialog layer, affecting Modal too:
  - Reopening a dialog while its close transition is still running now re-fires
    the initial-focus policy — previously focus stayed stranded on
    `document.body` behind the open dialog.
  - Modal's "focus the body unless a child is autofocused" open behavior
    actually works now: it ran synchronously before the panel subtree flushed,
    so the body element never existed when it looked. Both components share one
    deferred `focusDialogBodyUnlessAutofocused` helper.

- [#1226](https://github.com/stevekinney/cinder/pull/1226) [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05) Thanks [@stevekinney](https://github.com/stevekinney)! - feat!: demote the marketing-section family to documented compositions

  BREAKING: ten marketing-section components stop being standalone components
  and become documented examples on the primitives they wrap (decision 3 —
  reversible by design: the composition logic is relocated, not deleted). No
  compatibility aliases — cinder is pre-release.

  Removed components (each loses its `./<id>` subpath plus `/schema`,
  `/variables`, `/styles`, `/examples`, and its exported types):

  | Removed             | Recipe now lives on                             |
  | ------------------- | ----------------------------------------------- |
  | BlogSection         | `card` — "Blog post grid" example               |
  | CallToActionSection | `container` — "Call to action" example          |
  | FeatureSection      | `grid` — "Feature grid" example                 |
  | HeroSection         | `container` — "Hero section" example            |
  | LogoCloud           | `grid` — "Logo cloud" example                   |
  | NewsletterSection   | `input` — "Newsletter signup" example           |
  | PricingSection      | `pricing-card` — "Pricing section" example      |
  | StatisticsSection   | `statistic-group` — "Marketing metrics" example |
  | TeamSection         | `card` — "Team roster" example                  |
  | TestimonialSection  | `card` — "Testimonial grid" example             |

  **Retained**: `PricingCard` and `StatisticGroup` — both carry genuine
  behavior (feature de-duplication + selected-state semantics; group
  labelling + the compound `StatisticGroup.Statistic` namespace) and stay
  first-class.

  Migration: replace each removed component with the composition shown in its
  host primitive's example. Notable upgrades baked into the recipes: the blog
  grid uses the real `Card` component (the old component hand-wrote
  `cinder-card` classes), and the statistics recipe passes full
  `StatisticChange` objects including the `label` accessibility field the old
  flattened `changeValue`/`changeDirection`/`changeDescription` props could
  not express. Old container-query breakpoints are re-expressed as intrinsic
  `auto-fit` grids, so collapse points now derive from item width rather than
  fixed breakpoints.

  Also removed: the internal `PersonByline` helper and `section-skeleton.css`
  (only this family used them).

- [#1226](https://github.com/stevekinney/cinder/pull/1226) [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05) Thanks [@stevekinney](https://github.com/stevekinney)! - feat(props)!: naming-standardization sweep — polarity, aria spellings, and collision renames

  BREAKING prop renames beyond the value-callback sweep (documented in its own
  changeset). Same values, same behavior — only the names and, for the
  visibility props, the polarity change:
  - **Positive-polarity visibility props** — `hide*` booleans become `*Visible`
    with a `true` default, so hiding is now an explicit `{false}`:
    - `hideLabel` → `labelVisible` on FormField, Input, PhoneInput, PinInput,
      Rating, SegmentedControl, Select, StatusDot, and Toggle
      (`hideLabel` → `labelVisible={false}`).
    - DateRangeField `hidePresets` → `presetsVisible`.
    - DiffStatistics `hideZero` → `zeroVisible`.
  - **`aria-labelledby` spelling standardized** to `ariaLabelledby` (lowercase
    `b`, matching the attribute) everywhere the prop appears: ButtonGroup,
    ChoiceGrid, DropdownGroup, Drawer, MenuBar, Meter, Popover, Progress,
    TabList, and TabPanel previously used a mix of `labelledBy` and
    `ariaLabelledBy`.
  - **SegmentedControl** `disallowEmptySelection` → `selectionRequired`.
  - **Tree** `disableTypeahead` → `typeaheadDisabled` (adjective-last state
    name, matching `labelVisible`-style naming).
  - **Tree item** `draggable` → `reorderHandleVisible` — the old name collided
    with the native HTML `draggable` attribute.
  - **PricingCard** `cta` → `callToActionLabel` (no abbreviations in
    identifiers) and `onSelect` → `onPlanSelect` (names the noun).

  `check:prop-conventions` bans every removed name with a pointed message, so a
  stale prop fails the gate instead of silently type-erroring.

- [#1232](https://github.com/stevekinney/cinder/pull/1232) [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove the unused `Typography` component. Compose text hierarchy with semantic HTML and the published typography tokens instead.

- [#1226](https://github.com/stevekinney/cinder/pull/1226) [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05) Thanks [@stevekinney](https://github.com/stevekinney)! - feat(props)!: snippet conversions, shared dialog vocabulary, and the FilterBar rename

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

- [#1226](https://github.com/stevekinney/cinder/pull/1226) [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05) Thanks [@stevekinney](https://github.com/stevekinney)! - feat(props)!: value-carrying callbacks stop squatting on native handler names

  BREAKING: 28 lowercase `onchange`/`oninput`/`onsearch`/`onsubmit` props whose
  first parameter was a VALUE (not an Event) are renamed to camelCase
  `on<Noun>Change`-family names, matching the Checkbox/Input/Toggle/Tabs
  exemplars. Lowercase `on*` names remain reserved for native DOM passthrough.

  | Component                                                                                                                                                                                               | Old → New                                                 |
  | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
  | autocomplete                                                                                                                                                                                            | `oninput` → `onValueChange`                               |
  | calendar, color-field, color-swatch-picker, combobox, date-picker, date-range-field, number-input, pin-input, rating, schedule-builder, segmented-control, slider, tag-input, time-field, transfer-list | `onchange` → `onValueChange`                              |
  | color-picker                                                                                                                                                                                            | `oninput` → `onValueChange`, `onchange` → `onValueCommit` |
  | file-upload                                                                                                                                                                                             | `onchange` → `onFilesChange`                              |
  | invocation-rule-builder                                                                                                                                                                                 | `onchange` → `onValueChange` (both arms)                  |
  | json-schema-editor                                                                                                                                                                                      | `onchange` → `onSchemaChange`                             |
  | kanban-board                                                                                                                                                                                            | `onchange` → `onColumnsChange`                            |
  | phone-input                                                                                                                                                                                             | `onchange` → `onValueChange`                              |
  | schema-form                                                                                                                                                                                             | `onsubmit` → `onSubmit`                                   |
  | search-field                                                                                                                                                                                            | `oninput` → `onValueChange`, `onsearch` → `onSearch`      |
  | FacetedFilterBar `CustomFacet.control` snippet                                                                                                                                                          | param `onchange` → `onValueChange`                        |

  Native passthrough handlers (e.g. TagInput's `HTMLInputAttributes` forwards,
  Backdrop/NavigationItem `onclick`) are unchanged, and the native names stay
  omitted from rest-attribute surfaces where they were omitted before.

  **This can't recur**: `check:prop-conventions` is now type-aware. It builds
  one TypeScript program over every `*.types.ts`, resolves each exported Props
  surface (through aliases, intersections, unions, and non-exported helper
  types — closing the blind spot that let 20+ components drift), and fails any
  lowercase `on*` prop whose call signatures don't take an Event-like first
  parameter (structural probe: `preventDefault`/`stopPropagation`/`bubbles`).

  Cross-package: `@lostgradient/editor`'s review-editor updated for the
  SegmentedControl rename.

### Patch Changes

- [#1226](https://github.com/stevekinney/cinder/pull/1226) [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05) Thanks [@stevekinney](https://github.com/stevekinney)! - chore(tooling): behavior-first admission bar for new components (decision 8)
  - The rule — a new component requires behavior, state, or accessibility
    semantics its parts don't already provide; layout/presentation variations
    become props, variants, or documented example presets — is now checklist
    entry `behavior-first-admission` in `component-conventions.ts`, mirrored to
    all four authoring-checklist copies, spelled out in `packages/components/
AGENTS.md` § Adding a new component, and recorded in
    `docs/decisions/component-admission-bar.md`.
  - New `check:css-duplication` gate (a `lint:invariants` member, registered in
    the pipeline-coverage table): compares every component sidecar pairwise on
    a normalized declaration multiset (selectors dropped, private/component-
    scoped custom properties collapsed, at-rule context kept, compound
    families exempt) and fails on any ≥80% pair not recorded with a written
    reason in `css-duplication-baseline.json`. The baseline ships empty — the
    pre-merge Drawer/Sheet pair was exactly what it exists to catch.
  - Still-open questions are recorded as `**Status:** Open` decision stubs so
    they aren't mistaken for settled: ColorField/ColorPicker output format,
    the `*Group`-vs-plural convention, and SideNavigation vs Sidebar.
    (Table/DataTable/DataGrid is NOT open — `docs/decisions/
tabular-families.md` already decides it.)

- [#1230](https://github.com/stevekinney/cinder/pull/1230) [`28113fc`](https://github.com/stevekinney/cinder/commit/28113fcceb35150ece09325bcf627bf0931e9871) Thanks [@stevekinney](https://github.com/stevekinney)! - fix(feed): re-pin the log arm when the viewport resizes

  `Feed` with `kind="log"` only observed the entry list, so a viewport that
  shrank without a content change — a parent layout shortening, a consumer
  tightening `max-block-size` — left the reading position stale: the latest
  entries fell below the fold while `following` stayed `true` and the resume
  control stayed hidden. The follow effect now observes the viewport as well
  as the list and re-scrolls to the latest entry on either resize.

- [#1234](https://github.com/stevekinney/cinder/pull/1234) [`3641205`](https://github.com/stevekinney/cinder/commit/3641205ff964173a7c2913b77f8511e94fb0896d) Thanks [@stevekinney](https://github.com/stevekinney)! - Use the declared muted text token for ColorPicker copy formats and fallback hex text.

- [#1226](https://github.com/stevekinney/cinder/pull/1226) [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05) Thanks [@stevekinney](https://github.com/stevekinney)! - fix(styles): form dropdown option rows adopt the shared `_row-item` primitive

  `combobox`, `autocomplete`, `multi-select`, and `transfer-list` option rows
  now take their geometry, padding, active fill, keyboard-cursor ring,
  disabled state, and forced-colors treatment from the shared
  `cinder-_option-row` primitive instead of three drifted local copies. The
  shared padding is tuned once at the primitive (`space-1-5` block /
  `space-2` inline — the tightest of the previous three pairs), so combobox,
  autocomplete, and transfer-list rows tighten slightly; multi-select is
  unchanged. Menu/navigation composers (dropdown-item, command-item,
  navigation-item) keep their own roomier padding overrides.

  Behavior deltas: autocomplete's disabled rows converge on
  `--cinder-text-disabled` + `cursor: not-allowed`; transfer-list's keyboard
  cursor drops from a 2px to the system-wide 1px inset ring, gains the shared
  active fill and a forced-colors outline it lacked, and keeps its deliberate
  `--cinder-surface-inset` selected fill (selection must stay distinct from
  the cursor); its disabled rows no longer dim with `opacity`.

## 0.21.0

### Minor Changes

- [#1221](https://github.com/stevekinney/cinder/pull/1221) [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a) Thanks [@stevekinney](https://github.com/stevekinney)! - Carousel and ScrollArea: fine-pointer (mouse) click-and-drag scrolling, with momentum and snap.
  - Carousel now supports click-and-drag scrolling on a mouse automatically — no prop required. Dragging the track moves it with momentum-based physics and snaps to the nearest slide on release, matching the feel of a released touch swipe. Gated on `(hover: hover) and (pointer: fine)` and `!prefers-reduced-motion`; touch and pen are untouched (they already pan the native scroller directly).
  - ScrollArea gets a new opt-in `dragToScroll?: boolean` prop (default `false`) for the same mouse drag-to-scroll behavior, along the scroll area's own `direction`. Not supported when `direction="both"` (logs a dev warning). Keyboard scrolling is unaffected either way.
  - New shared utilities: `useDragScroll` (a `(node) => cleanup` attachment, in the house style of `useResizeObserver`) and `useFinePointer` (a `MediaQuery`-backed `(hover: hover) and (pointer: fine)` hook, mirroring `useReducedMotion`). Both live in `packages/components/src/utilities/` alongside the pure physics (`damp`/`project`/`snapSelect`/`dragSnap`/`shouldSnap`) they're built on.
  - A drag past a 10px threshold suppresses the click it releases into (so a dragged slide link or button doesn't also activate), scoped to the element the engine attached to — never a global click swallow.

  ⚠️ Like the `slidesPerView` behavior shipped earlier, this introduces a new interaction model and has not yet had a human accessibility review — see the "Fine-pointer drag-to-scroll review" sections in `carousel.a11y.md` and `scroll-area.a11y.md` for the self-review that informed this implementation.

- [#1221](https://github.com/stevekinney/cinder/pull/1221) [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a) Thanks [@stevekinney](https://github.com/stevekinney)! - Carousel: fix a `{...rest}` bug that silently dropped consumer `onkeydown`/`onmouseenter`/`onmouseleave`/`onfocusin`/`onfocusout` handlers, add an `onSlideChange` callback, add four `--cinder-carousel-*` theming hooks, and add `indicators`/`indicatorLimit` for large slide counts.
  - **Behavior change:** `loop` now defaults to `false`. Previously the carousel always wrapped past the first/last slide; `Previous`/`Next` now clamp and disable at the ends instead. Pass `loop` to restore the old always-wrap behavior. Autoplay also stops at the last slide instead of wrapping when `loop` is unset. Wrapping (with `loop`) remains seamless only for the first cycle through the deck — see the Carousel README for why.
  - `onkeydown`, `onmouseenter`, `onmouseleave`, `onfocusin`, and `onfocusout` passed to `<Carousel>` were previously overwritten by the component's own internal handlers of the same name (a `{...rest}` spread ordering bug) — they're now composed, consumer handler first. A consumer `onkeydown` that calls `event.preventDefault()` now suppresses the carousel's own Arrow/Home/End handling.
  - New `onSlideChange?: (index, slide) => void`, called whenever the carousel's own navigation (keyboard, controls, dot picker, autoplay, or native scroll settling) moves the active slide. Never fires for a parent-driven `activeIndex` update.
  - New CSS custom properties on `.cinder-carousel`: `--cinder-carousel-slide-size`, `--cinder-carousel-gap`, `--cinder-carousel-aspect-ratio`, `--cinder-carousel-dot-size`.
  - New `indicators?: 'dots' | 'counter' | 'none'` and `indicatorLimit?: number` (default `8`): above the limit the picker automatically switches from dots to a compact `"N / total"` counter unless `indicators` is set explicitly.

- [#1221](https://github.com/stevekinney/cinder/pull/1221) [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a) Thanks [@stevekinney](https://github.com/stevekinney)! - Carousel: add `slidesPerView`, `gap`, and `align` for multi-slide-per-view and peek layouts.
  - `slidesPerView?: number | 'auto'` (default `1`): shows more than one slide at once. A fraction like `1.2` peeks the next slide. `'auto'` lets each slide size itself via its own CSS. Above `1`, more than one slide is simultaneously interactive/non-`inert` (the active range is `[currentIndex, currentIndex + ceil(slidesPerView) - 1]`, clamped to the deck), and the live region announces `"Slides N–M of Total"` instead of a single labelled slide. At the default `1`, behavior is unchanged.
  - `gap?: string`: a CSS length between slides. Only applied when `slidesPerView` is not `1`.
  - `align?: 'start' | 'center'` (default `'start'`): snap alignment of the active slide(s) within the viewport.
  - `slidesPerView` above `1` and `loop` are mutually exclusive: setting both logs a dev warning and `loop` is ignored (wrapping a multi-slide range across the physical-order rotation boundary would leave a partial-width gap).

  ⚠️ This introduces a new interaction model (more than one slide can be active at once) and has not yet had a human accessibility review — see the "Multi-slide-per-view review" section in `carousel.a11y.md` for the self-review that informed this implementation and the open questions flagged for that review.

- [#1221](https://github.com/stevekinney/cinder/pull/1221) [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a) Thanks [@stevekinney](https://github.com/stevekinney)! - Carousel: adopt native `scrollend` for settle detection, add a `slide` snippet for custom slide content, make nearest-slide detection scroll-padding-aware, and move `activeIndex`/announcement writeback to settle-only for touch/wheel gestures.
  - Settle detection (the moment a touch/wheel gesture is considered "done") now uses the native `scrollend` event where supported, falling back to the existing debounce timer where it isn't (Tier 2, `PLATFORM-POLICY.md`).
  - **Behavior change:** during a touch/wheel gesture, `activeIndex`, `onSlideChange`, and the live-region announcement now update once, at settle — not on every intermediate scroll frame. A fast swipe through several slides no longer fires a rapid sequence of live-region announcements. Keyboard, button, and dot-picker navigation are unaffected (unchanged, synchronous). A cosmetic `visualIndex` still tracks the nearest slide every frame so the dot picker visually follows the drag.
  - New `slide?: Snippet<[TSlide, { index, active }]>` prop (with `CarouselProps<TSlide extends CarouselSlide = CarouselSlide>` now generic) renders custom content inside each slide's `<article>`, replacing the built-in image/title/description/link body. `slides` remains the identity and accessible-labeling source of truth; `inert`/`aria-hidden`/`role`/`aria-label` are still owned by the component regardless of which body renders.
  - `nearestVisibleSlideIndex` now reads `scroll-padding-inline-start` off the viewport (LTR) so a consumer-set snap inset is respected, instead of always comparing against the border-box edge.
  - Internal: six separately-coordinated flags collapsed into one `CarouselMotion` state; replaced a hand-rolled ancestor `MutationObserver` for `dir` changes with the shared `observeTextDirection` utility.

- [#1208](https://github.com/stevekinney/cinder/pull/1208) [`06ffb18`](https://github.com/stevekinney/cinder/commit/06ffb181cf73c2984613f93571b037dd721c7734) Thanks [@stevekinney](https://github.com/stevekinney)! - Re-anchor the light-mode surface ramp at white, wash interaction states toward the
  accent, and lighten the focus ring.

  Light mode now anchors at white and stays compressed: `--cinder-surface-inset`
  0.960 → `--cinder-bg` 0.984 → `--cinder-surface` 0.994 → `--cinder-surface-raised`
  1.000. Region separation is carried by border and shadow rather than by fill, which
  is how light interfaces conventionally work — the page canvas reads as white, and a
  card lifts off it with a hairline and a shadow instead of by everything around it
  getting darker. Neutral surface chroma drops roughly 3x (0.010–0.018 → 0.002–0.005)
  so large light surfaces read as white rather than as pale slate; saturation is
  reserved for the accent and the status colors.

  Interaction states change direction in the light arm only. `--cinder-surface-hover`
  and `--cinder-surface-pressed` (and their `-raised-` twins) now mix toward
  `--cinder-accent` at 6% / 12% instead of toward black. Near white a proportional
  black mix is structurally unusable: the resting tiers span 0.040 lightness points
  while a 6% black mix moves a surface 0.060, so every state lands on a resting tier
  regardless of the percentage chosen. Mixing toward the accent separates states by
  chroma and hue as well as lightness, so they stay legible at a step small enough to
  fit the ramp. The dark arm is unchanged — it builds up from near-black across 17
  lightness points, where a proportional lightness mix has room and already works.

  The focus ring goes from 3px at a 1px offset to 2px at a 2px offset — the same 4px
  total footprint, but half of it is now separation, so the ring reads as a ring
  around a control rather than an outline on it and stops merging with an adjacent
  border. `--cinder-ring-offset-color` moves from `--cinder-bg` to
  `--cinder-surface-raised`.

  Also in this release:
  - Soft status surfaces (Alert, Banner, Callout) move from L 0.965 / C 0.015 to
    L 0.945 / C 0.026. The old tint was capped by the sRGB gamut rather than chosen:
    at L 0.965 the maximum in-gamut chroma for the danger hue is 0.0172, so a chroma
    shared across all four statuses could not exceed that and every status was held
    to red's headroom near white. Dropping the lightness raises the binding ceiling
    to 0.0275.
  - The four `--cinder-color-*-bg` triples sit at L 0.945 with re-fitted chroma,
    which fixes a pre-existing bug where `--cinder-color-warning-bg` and
    `--cinder-color-danger-bg` were authored outside the sRGB gamut and had been
    silently clamping to a desaturated grey.
  - `--cinder-border` 0.79 → 0.83 and `--cinder-border-muted` 0.88 → 0.90, with chroma
    dropping alongside the surfaces so a hairline reads as a neutral line rather than
    a faint blue one. `--cinder-border` deliberately stays dark enough to hold the
    secondary Button's outline against its white fill; on a white-anchored ramp that
    border is the only thing making the control read as a control.
  - CodeBlock takes the surface radius and its header no longer paints a fill of its
    own. The header previously filled `--cinder-surface-inset` while the body filled
    `--cinder-surface-raised`, stacking two plates inside one rounded, clipped
    container. The code surface itself is unchanged: it stays pure white in light
    mode, because Shiki's `github-light` palette is fitted to `#ffffff` and its
    keyword red measures only 4.58:1 there against a 4.5:1 AA floor, so any tint
    behind highlighted code fails WCAG.
  - `--cinder-surface-raised` is authored `oklch(100% 0 255)` rather than
    `oklch(100% 0.006 245)`, which was out of gamut and painted as nothing.
  - `SegmentedControl`'s option radius derives from its container's own token
    (`calc(var(--cinder-radius-md) - 1px)`), so the inner and outer corners are
    concentric.

  The radius scale is unchanged from the previous release at 6 / 8 / 12px.

  Consumers that override `--cinder-bg`, `--cinder-surface`, `--cinder-surface-raised`
  or `--cinder-surface-inset` should re-check their own ramp: the light arm's spacing
  and direction have both changed, and a consumer ramp built to sit against a grey
  canvas will need retuning against a white one.

- [#1220](https://github.com/stevekinney/cinder/pull/1220) [`68370b1`](https://github.com/stevekinney/cinder/commit/68370b1d5ac2046855a77f95db36f316eaafa35a) Thanks [@stevekinney](https://github.com/stevekinney)! - Add scroll-driven edge fades and a horizontal-scroll shadow affordance, and fix a forced-colors defect in the existing overlay-body fade.
  - New shared internal partial `_scroll-fade.css`: an opaque, scroll-position-aware edge fade driven by `animation-timeline: scroll()` where supported, falling back to the existing `data-cinder-overflows` attribute path everywhere else — no `CSS.supports()` branch, no hydration divergence. Never a `mask-image` (masking a container that paints its own background reveals whatever is behind it, which is why PR [#972](https://github.com/stevekinney/cinder/issues/972) removed masks from Modal/Drawer/Sheet in the first place).
  - Modal, Drawer, and Sheet bodies now consume the shared recipe instead of three byte-identical copies, which also fixes a real bug: the previous hard-coded gradient had no `forced-colors` carve-out, so it painted a light-gray band across the bottom of every scrollable overlay in high-contrast mode. `--cinder-scroll-fade-size` (1.5rem) is now a themeable public token instead of being hard-coded three times.
  - `overflowFade()` (`utilities/attachments.ts`) no longer registers a `ResizeObserver` on every descendant of a scroll container — only the container itself, with a `MutationObserver` triggering direct re-measurement on content changes. The previous approach was fine for a modal body but registered thousands of observers on a long scroll surface.
  - New opt-in `scrollFadeVisible` prop on `ScrollArea`, `CodeBlock`, and Chat's message timeline — presentation-only, never the sole signal that content scrolls. `CodeBlock`'s fade is horizontal (inline) and intentionally translucent rather than fully opaque, so a partially covered glyph still reads as a glyph. Chat's timeline fades both the top and bottom edges and is only active in `surfaceMode="default"`.
  - `Table`, `PermissionMatrix`, and `TransferList` scroll containers now show `DataGrid`'s existing inset-shadow horizontal(/vertical, for TransferList)-scroll affordance when their content actually overflows, via a new `overflowShadow()` attachment.

### Patch Changes

- [#1214](https://github.com/stevekinney/cinder/pull/1214) [`61bcfbc`](https://github.com/stevekinney/cinder/commit/61bcfbce232427b03b7d11ae552c134800d026a4) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix a set of real interaction and accessibility defects: Meter silently dropping a
  consumer's forwarded `aria-label`; MultiSelect's listbox being clipped by an
  overflow-hidden ancestor instead of portaling; Popover/HoverCard arrow placement being
  overridden by a hardcoded shared inset; asymmetric overlay open/close motion on Modal,
  Drawer, Sheet, and HoverCard (missing `@starting-style`/`allow-discrete`, no real exit
  transition); SelectionPopover dismissing itself immediately when opened via a
  drag-selection gesture that triggers page autoscroll; and menu-open latency from the
  shared anchored-overlay layer's first `@floating-ui/dom` import no longer being prefetched
  ahead of the first open. Also fixes a `_sortable-item.svelte` DOM query
  (`:scope >` → `.children`-based) that silently matched zero rows under happy-dom — a
  test-environment compatibility fix with no change to real-browser drag behavior, which
  was already correct; no runtime change to KanbanBoard.

- [#1216](https://github.com/stevekinney/cinder/pull/1216) [`38a43a0`](https://github.com/stevekinney/cinder/commit/38a43a0cccf557aafbaee2a39486a050a2979854) Thanks [@stevekinney](https://github.com/stevekinney)! - Stop using the status **fill** tokens (`--cinder-success` / `--cinder-info` /
  `--cinder-warning` / `--cinder-danger`) as text color. Those are tuned dark enough
  (L≈0.50) to carry a white label; the paired `--cinder-color-*-fg` tokens (L≈0.40)
  are the foregrounds. Measured as ink on `--cinder-surface-inset`, the fills land at
  3.98 (success), 4.16 (info) and 3.66 (warning) — all below the 4.5:1 AA floor —
  while the `-fg` equivalents land 6.1–6.7. `--cinder-warning` was already failing
  before the light-ramp retune in [#1208](https://github.com/stevekinney/cinder/issues/1208); widening the ramp only made it worse.

  Swaps every `color:` declaration that paints text: form-field, checkbox,
  checkbox-group, radio-group, input, textarea, select, combobox, multi-select,
  tag-input, pin-input, phone-input, time-field, date-picker, date-range-field,
  schema-form, button, dropdown, copy-button, rating, qr-code, json-editor,
  statistic, diff-statistics, status-dot, inline-loading, event-stream-viewer, and
  the shared `_field-label` required marker.

  Deliberately **not** swapped: `background`, `border`, `outline`, focus-ring
  custom properties, and every `color:` whose value is consumed as `currentColor` by
  a painted shape rather than by text — lucide icon strokes (Card's risk icon,
  ApprovalCard's risk icons, PermissionMatrix's cell tokens, SecretValueField's copy
  confirmation), Timeline's `border: 2px solid currentColor` markers, Rating's
  mask-clipped star fill, StatusDot's indicator dot, and JsonEditor's lint squiggle.
  Those are non-text graphics held to the 3:1 floor, which the fill tokens already
  clear; swapping them would have been a visual regression, not an accessibility fix.

  EventStreamViewer needed a structural fix rather than a swap: a single
  `--cinder-event-stream-viewer-severity-color` variable was painting both the 3px
  severity rail and the severity badge text. It is now split into `-color` (the
  rail, on the fill ramp) and `-ink` (the badge, on the `-fg` ramp). Pushing the
  shared variable to `-fg` would have collapsed all four rails into one 88–90%
  lightness band in the dark arm, making the severities indistinguishable.

- [#1215](https://github.com/stevekinney/cinder/pull/1215) [`4531af8`](https://github.com/stevekinney/cinder/commit/4531af81295cec74f50a20b33fa45492ee037bc4) Thanks [@stevekinney](https://github.com/stevekinney)! - Gate Tooltip's portal on visibility, so a hidden tooltip leaves nothing in `document.body`.

  The portal attachment had no `disabled` option, and the panel is not inside a conditional block, so every Tooltip portaled its `[role="tooltip"]` node on mount and left it there for the component's whole lifetime — one detached node per instance, including during SSR. That contradicts `OVERLAY-POLICY.md` ("All overlays render into the portal after hydration. SSR markup is empty."), and every sibling overlay already gates: Popover and HoverCard through `{#if mounted && open && anchorElement}`, Portal / SpeedDial / NavigationBar / DropdownMenu through an explicit `disabled` getter.

  Uses `disabled` rather than wrapping the node in `{#if visible}`: the disabled path calls `restoreInline()`, which returns the panel to its original position inside the wrapper instead of unmounting it, so the `aria-describedby` target keeps resolving while the tooltip is hidden. Conditional rendering would break that association.

  Gated on `visible` rather than `isTooltipExposed`, because the latter also requires `positionReady` and position is computed against the portaled node — gating on it would deadlock a tooltip that can never be positioned because it was never portaled.

- Updated dependencies [[`0fb8912`](https://github.com/stevekinney/cinder/commit/0fb891210be26c2675de870beb931d9f39cdff4c)]:
  - @lostgradient/markdown@0.2.0

## 0.20.0

### Minor Changes

- [#1117](https://github.com/stevekinney/cinder/pull/1117) [`92d17da`](https://github.com/stevekinney/cinder/commit/92d17da743f17902a87645cd5c92b8b0ce35e4c4) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose BentoGrid with the shared Grid layout while preserving responsive collapse behavior.

  This removes the `--cinder-bento-grid-columns`, `--cinder-bento-grid-row-gap`, and
  `--cinder-bento-grid-column-gap` customization points. Pass `columns`, `gap`,
  `rowGap`, or `columnGap` to BentoGrid instead.

- [#1146](https://github.com/stevekinney/cinder/pull/1146) [`6418308`](https://github.com/stevekinney/cinder/commit/641830824c085af3cb50e24075bbebef75d99f78) Thanks [@stevekinney](https://github.com/stevekinney)! - Add semi-transparent inline ghost-text completion to CommandMenu, gated behind a new opt-in `onComplete` prop, with a fully specified keyboard model (ArrowRight/Tab accept, Enter always wins for listbox selection, Escape dismisses ghost text before closing) recorded in `command-menu.a11y.md`. `caretIndex` is now optional, deriving from the anchor's live selection when omitted.

- [#977](https://github.com/stevekinney/cinder/pull/977) [`7ec4689`](https://github.com/stevekinney/cinder/commit/7ec46892c9d467f932fe32086a6e47312a48b107) Thanks [@stevekinney](https://github.com/stevekinney)! - Make DatePicker use its custom calendar as the sole date-picker surface instead of combining it with native date controls.

- [#1193](https://github.com/stevekinney/cinder/pull/1193) [`898dcda`](https://github.com/stevekinney/cinder/commit/898dcda4009d7d7c21b51ad35c2c7e549f568fdd) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix six independent behavior bugs found in a component audit:
  - **FeatureSection**: a caller-forwarded `data-cinder-layout`, `data-cinder-columns`, `data-cinder-media-position`, or `data-cinder-has-media` attribute could silently override the component's own computed layout state (rest-spread ordering).
  - **NewsletterSection**: the form now always calls `preventDefault()` on submit, even when no `onSubmit` prop is provided — previously a consumer that omitted `onSubmit` got a full-page reload on submit.
  - **DatePicker** / **DateRangeField**: date/date-time validation and normalization logic is now shared via `_internal/date-value.ts` instead of duplicated per component. The normalization effect now routes through the same notify-and-write path as user-driven edits, so `onchange` fires when the component itself corrects a malformed or out-of-range initial `value`, or truncates a value after a `granularity` change — previously these corrections were silent. **Consumer-visible behavior change**: a mounted `DatePicker`/`DateRangeField` with a malformed or out-of-range initial `value` now fires `onchange` once during initial mount. `DatePicker` gains a `triggerLabel` prop (defaults to `"Open"`) for the calendar-trigger button's visible text. **Breaking type change**: `DateRangeField.id` is now required (previously optional with an auto-generated fallback), matching the required-`id` convention already used by `Input`, `Textarea`, `NumberInput`, `TimeField`, and `DatePicker`.
  - **DropdownMenu** / **DropdownTrigger**: a consumer-supplied `style` prop no longer silently overwrites the CSS Anchor Positioning declarations (`position-anchor`/`anchor-name`) these components depend on for correct positioning — the two are now merged, with the internal declaration winning on a direct conflict.
  - **SearchField**: deleted a duplicate, buggy form-reset handler that raced against `Input`'s own canonical reset-sync and could restore a frozen mount-time value instead of the live native default. Reset now delegates entirely to `Input`. Also guarded the derived `hasValue` computation against a bound `value` that becomes `undefined` after mount.
  - Five small independent fixes:
    - **FileUpload**: investigated a proposed dragleave/dragenter guard-symmetry fix; not applied — it would have reverted a prior, deliberately tested fix ("clear drag state after cancelled upload") for a stuck-open drag overlay. See PR body for detail.
    - **CopyButton**: gains an `onError` callback prop, called when the clipboard write fails (permission denied, insecure context, or the legacy fallback also failing); also emits a dev-only console warning.
    - **DiffStatistics**: emits a dev-only, once-per-instance console warning when `density="toolbar"` is used without `variant="compact"` (that combination is otherwise a silent no-op).
    - **GridItem**: narrows the `as` polymorphic-tag type to exclude document-metadata and non-content tags (`script`, `title`, `html`, `head`, `body`, `style`, `noscript`, `colgroup`, `optgroup`, `option`), which previously type-checked but rendered invisible or broken markup. **Breaking type change**: a consumer passing one of those tag names to `as` now gets a type error where none existed before.
    - **MenuBar**: id-based element lookups (used for keyboard focus management) are now shadow-DOM aware instead of always querying the global `document`, matching the pattern already used by `MegaMenu`.

- [#920](https://github.com/stevekinney/cinder/pull/920) [`323399a`](https://github.com/stevekinney/cinder/commit/323399ab5e8bbbb7f2118d5163bb607db71340b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Extract the Cinder MCP server into a standalone `@lostgradient/cinder-mcp` package.

  `@lostgradient/cinder` no longer ships the `cinder mcp` command, the MCP SDK, or Zod — installing it never pulls in either. It now exposes a Node-only `@lostgradient/cinder/knowledge` subpath so external packages can load Cinder's component metadata without depending on the CLI.

  If you were running `cinder mcp`, install `@lostgradient/cinder-mcp` instead:

  ```sh
  npm install --save-dev @lostgradient/cinder-mcp
  ```

  and point your MCP client at the installed binary:

  ```sh
  npx --no-install cinder-mcp
  ```

  Every tool, resource, and prompt keeps its existing name and behavior — see `packages/mcp/README.md` for verified client configuration (Claude Code, Codex, GitHub Copilot, VS Code Copilot). There is no forwarding command or compatibility shim; `cinder mcp` is removed outright.

- [#1020](https://github.com/stevekinney/cinder/pull/1020) [`dbcc986`](https://github.com/stevekinney/cinder/commit/dbcc986919d2bddb3dd4e3bda0c2089699595dfc) Thanks [@stevekinney](https://github.com/stevekinney)! - Give PageHeader named `title`, `description`, `breadcrumbs`, and `actions`
  regions. Replace `meta` with `description`, move trailing content from
  `children` to `actions`, and pass rich title or description content as snippets
  under those names.

- [#1001](https://github.com/stevekinney/cinder/pull/1001) [`7f924e1`](https://github.com/stevekinney/cinder/commit/7f924e1c3f4eca10530606d14bf6c8778f998455) Thanks [@stevekinney](https://github.com/stevekinney)! - Standardize component prop API vocabulary across handlers, bindable values,
  boolean props, polymorphic `as` props, and component names. This removes
  `defaultValue` public props in favor of bindable `value`, splits value
  interceptors to `onValueChangeRequest`, renames lowercase custom callbacks to
  camelCase notification props, and adds an AST guard that prevents these
  conventions from drifting.

- [#1195](https://github.com/stevekinney/cinder/pull/1195) [`42262d1`](https://github.com/stevekinney/cinder/commit/42262d1f7378ce6c85dc4ac60123991fee0004a1) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix the README/generated-props documentation pipeline end to end:
  - Fix every README `## Usage` example that failed to compile, rendered nothing, or documented the API incorrectly (roughly 53 components).
  - Add a `validate:consumer:readme-usage-examples` gate that compile-checks every component README's `## Usage` fence against the built package on every merge.
  - Extend the Playground's default-value extractor to resolve negative numbers, static template literals, and object-literal defaults; fix `@default` JSDoc quote-handling so single-quoted tags (e.g. `@default 'auto'`) no longer render as doubled quotes; backfill missing `@default` tags across ~20 components so their generated README Default column is no longer a false `—`.
  - Migrate `date-range-field`'s hand-authored README, and `faceted-filter-bar`'s and `resizable-panels`' READMEs, onto the standard `components:generate` markers so their prop tables stay in sync automatically.
  - **Narrows `class` from a broad attribute-style type to `string`** on `Radio`, `Avatar`, `Card`, `Checkbox`, `ChoiceGrid`, `FileUpload`, `Image`, `Input`, `Label`, `NumberInput`, `SearchField`, `Select`, `SideNavigationGroup`, and `Textarea` — these components previously reported `class` as unclassifiable/opaque in their generated schema even though the runtime prop only ever accepted a plain string; array/object `class` values are no longer accepted on these 14 components. (`GridList`'s equivalent fix is blocked on a separate type-soundness issue and is not included here.)

- [#1130](https://github.com/stevekinney/cinder/pull/1130) [`057b1ee`](https://github.com/stevekinney/cinder/commit/057b1ee1d0a1f82eed05e682565fc8d7d6f9745a) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose GridList with the shared Grid sizing contract. This removes the
  `--cinder-grid-list-min-width` CSS variable; pass `minColumnWidth` to GridList
  instead.

- [#1192](https://github.com/stevekinney/cinder/pull/1192) [`c5bd054`](https://github.com/stevekinney/cinder/commit/c5bd05414313548118fe9c8aa5eab645ba1ec6dd) Thanks [@stevekinney](https://github.com/stevekinney)! - Type hygiene and barrel export cleanup across four areas:
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

### Patch Changes

- [#1064](https://github.com/stevekinney/cinder/pull/1064) [`9faa142`](https://github.com/stevekinney/cinder/commit/9faa1422658ceddac3b758e313be3c2d6696bada) Thanks [@stevekinney](https://github.com/stevekinney)! - Constrain EventTimeline cluster surfaces to the available height inside overlay owners.

- [#1200](https://github.com/stevekinney/cinder/pull/1200) [`7ab0910`](https://github.com/stevekinney/cinder/commit/7ab091009749ccaf39b24ce3548b7374c2353e92) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal build-pipeline change: the Svelte build plugin (`packages/components/scripts/svelte-plugin.ts`, shared cross-package by chat, editor, and playground) now wraps the published `@lostgradient/bun-plugin-svelte` instead of invoking `svelte/compiler` directly for the common client/library-server case. No public component API changes. Published `dist/` output was verified byte-identical (file list + shasum) against a clean build of `main`, aside from the expected build-cache fingerprint file.

- [#1191](https://github.com/stevekinney/cinder/pull/1191) [`67f51a7`](https://github.com/stevekinney/cinder/commit/67f51a73a603d04f1858050a60abfed793a0a178) Thanks [@stevekinney](https://github.com/stevekinney)! - Align public component contracts across sibling components ([#1158](https://github.com/stevekinney/cinder/issues/1158), [#1159](https://github.com/stevekinney/cinder/issues/1159)):
  - Add native `HTMLAttributes` passthrough (`{...rest}`, component-owned attributes always win) to `Steps`, `CheckboxGroup`, `TabList`, `Tab`, `TabPanel`, `TableBody`, `TableHeader`, `Breadcrumbs`, and `Meter`.
  - Fix `title` attribute collisions on `StatisticsSection` and `FeatureSection` — the native tooltip `title` is now excluded from the type so only the domain heading meaning is reachable (type-only; runtime behavior was already correct).
  - `Rating` now renders the same visible required-marker asterisk as `PhoneInput`/`PinInput` when `required` is set.
  - `TagInput` now emits a dev-only warning when its native `required` prop is set without the wrapping `FormField` supplying `required` context, matching its existing id-mismatch warning.
  - `TableHeader`'s `allSelected`/`someSelected`/`onSelectAll` trio is remodeled as a two-arm discriminated union (`TableHeaderSelectionProps`), matching `TableRow`'s pattern. This is a compile-time-only tightening: passing a partial subset of the trio (e.g. `allSelected` alone) now fails to type-check, whereas previously it type-checked and threw at runtime instead. Every call site that both type-checked AND did not throw at runtime keeps type-checking unchanged. No prop name is added, removed, or renamed.
  - `CommandItem.selectionMode`'s JSDoc (types + README) now states plainly that it only controls whether `onSelect` is required at compile time and has no runtime effect on activation dispatch — no behavior changed.
  - `CallToActionSection`'s and `CapabilityGate`'s `SchemaProps` interfaces now both explicitly list their function/snippet props and carry a one-line comment stating the schema-surface rule (every public prop is either JSON-Schema-expressible or surfaced via `unsupportedProps`). Note: the generated schema/README output for `CallToActionSection` was already correct before this change — `scripts/generate-component-schema.ts` already auto-surfaces function/snippet props omitted from a `SchemaProps` allowlist into `unsupportedProps` — this is a source-level consistency fix, not an output fix.
  - `TableOfContents.target`'s schema-facing JSDoc and README now note that the schema surface accepts the CSS-selector string form only, while the live component prop additionally accepts an `HTMLElement` reference.
  - `Tab`'s `onclick`/`onkeydown` are additionally excluded from its `HTMLAttributes` intersection (beyond the issue's literal instruction) because the component sets both unconditionally on its root `<button>`; leaving them reachable via `rest` would let a consumer's forwarded handler type-check while silently never firing.

- [#912](https://github.com/stevekinney/cinder/pull/912) [`899801b`](https://github.com/stevekinney/cinder/commit/899801bdb9192e0b62799c184b74681fbfb72136) Thanks [@stevekinney](https://github.com/stevekinney)! - Add phase and browser-state diagnostics when hydration smoke teardown fails.

- [#996](https://github.com/stevekinney/cinder/pull/996) [`dca8fbf`](https://github.com/stevekinney/cinder/commit/dca8fbfd7fb5fad5cb429e346e5f13e9af789518) Thanks [@stevekinney](https://github.com/stevekinney)! - Allow an open Backdrop with an onclick handler to dismiss on Escape.

- [#1081](https://github.com/stevekinney/cinder/pull/1081) [`a1f1880`](https://github.com/stevekinney/cinder/commit/a1f1880703e0e0f941b4a348555f009af9630796) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep anchored surfaces owned by an open Modal visible outside the modal content clipping boundary.

- [#1080](https://github.com/stevekinney/cinder/pull/1080) [`8ea6973`](https://github.com/stevekinney/cinder/commit/8ea69733a09812ee81ace349d4289e3011ad07b2) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix NavigationBar mobile Tab focus bridging to preserve the before-brand destination while positioning is pending and to ignore enabled items removed from the sequential tab order.

- [#1083](https://github.com/stevekinney/cinder/pull/1083) [`91eb73c`](https://github.com/stevekinney/cinder/commit/91eb73c6a336e652b7033f75a1c27d051c18a4de) Thanks [@stevekinney](https://github.com/stevekinney)! - Validate written neighbour rationale metadata for every component.

- [#1068](https://github.com/stevekinney/cinder/pull/1068) [`cf18ed7`](https://github.com/stevekinney/cinder/commit/cf18ed74fd31ebc90b2a06fa36a7c2588b529e92) Thanks [@stevekinney](https://github.com/stevekinney)! - Preserve computed CSS direction when portaling surfaces without an explicit `dir` ancestor.

- [#1134](https://github.com/stevekinney/cinder/pull/1134) [`7f6de70`](https://github.com/stevekinney/cinder/commit/7f6de7056bbfe347aa7b7fe019efaea8bc06c6f0) Thanks [@stevekinney](https://github.com/stevekinney)! - Use a shared sequential-tabbability algorithm for NavigationBar and SpeedDial focus bridging.

- [#1009](https://github.com/stevekinney/cinder/pull/1009) [`76c3da6`](https://github.com/stevekinney/cinder/commit/76c3da6ccc1356dfa0687129fe1b3bfb40f7a4ce) Thanks [@stevekinney](https://github.com/stevekinney)! - Cap Sheet panels by viewport height and keep overflowing content within the internally scrolling body.

- [#1010](https://github.com/stevekinney/cinder/pull/1010) [`4766190`](https://github.com/stevekinney/cinder/commit/47661907620f26eb61f50b3592c73c013b94e6ea) Thanks [@stevekinney](https://github.com/stevekinney)! - Add native touch scrolling and scroll snapping to Carousel.

- [#1066](https://github.com/stevekinney/cinder/pull/1066) [`6983b8e`](https://github.com/stevekinney/cinder/commit/6983b8e8c00a05e948ff0f02abe4d50c6c7e0a30) Thanks [@stevekinney](https://github.com/stevekinney)! - Settle Carousel native-scroll ownership from the debounce after a touch or pen pointer is cancelled.

- [#995](https://github.com/stevekinney/cinder/pull/995) [`c58514f`](https://github.com/stevekinney/cinder/commit/c58514f6c636695e795c93867f508a896ec9aa32) Thanks [@stevekinney](https://github.com/stevekinney)! - Apply the shared table styling to chart data-table fallbacks.

- [#1128](https://github.com/stevekinney/cinder/pull/1128) [`5ff29c6`](https://github.com/stevekinney/cinder/commit/5ff29c6acdd8040e09b613f1cb05cccea2713c24) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose ChoiceGrid with the shared Grid layout primitive while preserving its selection behavior.

- [#1118](https://github.com/stevekinney/cinder/pull/1118) [`c5d2235`](https://github.com/stevekinney/cinder/commit/c5d22353105f1ea52cefc8ad34a1e348342094f7) Thanks [@stevekinney](https://github.com/stevekinney)! - Document the distinct domains and neighbour guidance for chronological display components.

- [#1123](https://github.com/stevekinney/cinder/pull/1123) [`fca6b6a`](https://github.com/stevekinney/cinder/commit/fca6b6a3c9aa212c84f37cf15d63a1962c37eeef) Thanks [@stevekinney](https://github.com/stevekinney)! - Preserve Combobox root-scoped styling on portaled options and empty panels.
  Popover now exposes `portalScopeClass` for components that need root-scoped
  consumer selectors to include a portaled floating surface.

- [#980](https://github.com/stevekinney/cinder/pull/980) [`761cd8e`](https://github.com/stevekinney/cinder/commit/761cd8e9ea529866a32e0496699917822c20b1c1) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep slash-command menus dismissed after Escape until the host input state changes.

- [#1111](https://github.com/stevekinney/cinder/pull/1111) [`16671d8`](https://github.com/stevekinney/cinder/commit/16671d86f9b467ddae8f9aee5b36ed1d0d662d84) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove duplicated CommandMenu floating-surface chrome declarations so shared overlay styling owns the panel surface.

- [#1122](https://github.com/stevekinney/cinder/pull/1122) [`115705d`](https://github.com/stevekinney/cinder/commit/115705d23092b7663d3045a07327b04b2e77d1fc) Thanks [@stevekinney](https://github.com/stevekinney)! - Document CommandPalette's intentional native modal dialog boundary.

- [#1002](https://github.com/stevekinney/cinder/pull/1002) [`6bffc7d`](https://github.com/stevekinney/cinder/commit/6bffc7d07e6c7d390a6f111bc85f396201fc36e0) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep sparse footer link groups compact with tighter, wrapping-safe spacing.

- [#998](https://github.com/stevekinney/cinder/pull/998) [`abce2be`](https://github.com/stevekinney/cinder/commit/abce2bedbef200211a2aa1f19b8643949cb0291f) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep PhoneInput's country selector compact instead of sizing it to the longest country name.

- [#1107](https://github.com/stevekinney/cinder/pull/1107) [`b22ee52`](https://github.com/stevekinney/cinder/commit/b22ee527c2cab50b2eec851e0b8991316d8a0d21) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose Autocomplete's editable control from the Input primitive.

- [#994](https://github.com/stevekinney/cinder/pull/994) [`05f9d06`](https://github.com/stevekinney/cinder/commit/05f9d0632018b8ba8c2cdfd5c1ad9bcaa149820c) Thanks [@stevekinney](https://github.com/stevekinney)! - Render TableOfContents with one continuous rail behind its links.

- [#1115](https://github.com/stevekinney/cinder/pull/1115) [`1fb92e0`](https://github.com/stevekinney/cinder/commit/1fb92e05faf5660103124a8520aaa31443286746) Thanks [@stevekinney](https://github.com/stevekinney)! - Document the distinct Modal, ConfirmDialog, and AlertDialog preset boundaries.

- [#1145](https://github.com/stevekinney/cinder/pull/1145) [`1a9b577`](https://github.com/stevekinney/cinder/commit/1a9b5779c07023ca263d8a34f0365307d00129af) Thanks [@stevekinney](https://github.com/stevekinney)! - Resolve additional `@container` and `@scope` text-direction spec-parity gaps:
  - Evaluate comma-separated `@container` condition lists (`CSSContainerRule.conditions`) as independent name+query entries, OR'd together, instead of failing closed on the blanked legacy `containerName`/`containerQuery` accessors.
  - Resolve relative (non-exact) `:scope` scope-start selectors (`@scope (:scope > .child)`) against the enclosing scope's root(s) instead of failing closed.
  - Preserve the supported exact `:scope` alternative in a mixed all-`:scope` root list (`@scope (:scope, :scope > .theme)`) even when a sibling relative alternative can't resolve.
  - Resolve outside-ancestor context in scoped rule selectors (`main :scope .shell`) against the scope root's real ancestor chain instead of losing it to the detached-clone fallback's isolated subtree.
  - Normalize each item of a rule selector list independently for leading-combinator shorthand (`.unused, > .shell`), instead of gating on whether the whole list starts with a combinator.

- [#981](https://github.com/stevekinney/cinder/pull/981) [`e1a27b8`](https://github.com/stevekinney/cinder/commit/e1a27b82c650fc8efe71598227e9afad94cb2188) Thanks [@stevekinney](https://github.com/stevekinney)! - Dismiss SelectionPopover when scrolling or resizing so it cannot remain detached from its selection.

- [#1112](https://github.com/stevekinney/cinder/pull/1112) [`cdd0215`](https://github.com/stevekinney/cinder/commit/cdd0215ae3f843c5d0ebf665a3791400ebc904d6) Thanks [@stevekinney](https://github.com/stevekinney)! - Document the distinct ownership boundaries for editor and Cinder diff viewers plus Cinder and Chat message surfaces.

- [#990](https://github.com/stevekinney/cinder/pull/990) [`76759d3`](https://github.com/stevekinney/cinder/commit/76759d3175b26b664d345e803c7ec5431516aa51) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove empty EventStreamViewer toolbars and use the shared Input primitive for filtering.

- [#1047](https://github.com/stevekinney/cinder/pull/1047) [`81f7b91`](https://github.com/stevekinney/cinder/commit/81f7b91c8c8e80be88a058f47bb3547fd716abd2) Thanks [@stevekinney](https://github.com/stevekinney)! - Use the full-strength border token on the EventTimeline cluster trigger, which is a raised surface with a full outer border.

- [#1011](https://github.com/stevekinney/cinder/pull/1011) [`e113c49`](https://github.com/stevekinney/cinder/commit/e113c49dd2206e1893c0ba970d0f182fbdf0b20c) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix EventTimeline label collisions with measured container sizing, leader-line offsets, and accessible clustered events.

- [#1087](https://github.com/stevekinney/cinder/pull/1087) [`6130fbb`](https://github.com/stevekinney/cinder/commit/6130fbbb97181e26df63e080a070567f5d964c8b) Thanks [@stevekinney](https://github.com/stevekinney)! - Fail closed when text-direction container queries contain syntax the evaluator cannot fully parse.

- [#1202](https://github.com/stevekinney/cinder/pull/1202) [`b12595e`](https://github.com/stevekinney/cinder/commit/b12595e2a16db3d497fcbb5a831db95a9ac84187) Thanks [@stevekinney](https://github.com/stevekinney)! - Make DataGrid range selection O(1) per cell instead of enumerating the range on every pointermove, and remove DataGridSelectionModel.selectedCells.

- [#991](https://github.com/stevekinney/cinder/pull/991) [`a1b532b`](https://github.com/stevekinney/cinder/commit/a1b532b827a6304c249eb32e3d1b226d31c2b602) Thanks [@stevekinney](https://github.com/stevekinney)! - Make FeatureSection split layouts continuous across responsive widths and bound media height.

- [#1144](https://github.com/stevekinney/cinder/pull/1144) [`5ff75da`](https://github.com/stevekinney/cinder/commit/5ff75da61a812351849333db0f51abef4ac71896) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose FormField across the remaining field wrappers — Radio, Combobox, DatePicker, JsonEditor, MultiSelect, Select, Textarea, and TimeField now render their label, description, and error text through the shared `FormFieldFrame` primitive instead of hand-rolled markup, matching Input/Checkbox/Toggle. `FormFieldFrame` gained `labelClass`, `errorAlwaysMounted`, and a `message` snippet slot to support the remaining shapes, plus generic HTML attribute passthrough on its root element.

- [#983](https://github.com/stevekinney/cinder/pull/983) [`b26c1b4`](https://github.com/stevekinney/cinder/commit/b26c1b4089030a0b995fe66339df376634af5c7a) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove the duplicate border from empty Avatar placeholders.

- [#978](https://github.com/stevekinney/cinder/pull/978) [`490098c`](https://github.com/stevekinney/cinder/commit/490098c0d8647bae9e51177ac6e1017456ec73a2) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep Card header and footer padding intact when `padding="none"` makes body content full-bleed.

- [#1197](https://github.com/stevekinney/cinder/pull/1197) [`74a58e6`](https://github.com/stevekinney/cinder/commit/74a58e6cc68f7b5db632090f80e0f81a7d62c66b) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix eight accessibility defects: chart focus targets no longer tabbable while loading, media-controls stays focusable with aria-disabled, permission-matrix cell labeling is de-duplicated, capability-gate dismiss buttons are uniquely labeled, button-group/side-navigation/side-navigation-group/sidebar no longer render or throw on empty labels, checkbox-group's fieldset-disabled cascade dims child labels, and event-stream-viewer's scrollable log uses a plain suppressed element instead of svelte:element.

- [#1088](https://github.com/stevekinney/cinder/pull/1088) [`5bf2b09`](https://github.com/stevekinney/cinder/commit/5bf2b09d59b62dc7cd61b01aafd076c5133977ca) Thanks [@stevekinney](https://github.com/stevekinney)! - Resolve MegaMenu keyboard focus targets from the component root so shadow-root navigation and focus restoration work correctly.

- [#984](https://github.com/stevekinney/cinder/pull/984) [`dc90b46`](https://github.com/stevekinney/cinder/commit/dc90b4675e59f263ea6ee402e5375ec01fa9620b) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep SortableList content and its trailing drag handle aligned in one resting row.

- [#1120](https://github.com/stevekinney/cinder/pull/1120) [`4a279a2`](https://github.com/stevekinney/cinder/commit/4a279a28b9423559e6e33fe5123696a275ea2006) Thanks [@stevekinney](https://github.com/stevekinney)! - Consolidate Input, Checkbox, and Toggle field presentation under FormField and remove Checkbox's pre-release fieldClassName prop.

- [#1202](https://github.com/stevekinney/cinder/pull/1202) [`b12595e`](https://github.com/stevekinney/cinder/commit/b12595e2a16db3d497fcbb5a831db95a9ac84187) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix fourteen performance regressions found across twelve components ([#1186](https://github.com/stevekinney/cinder/issues/1186)).

  `command-menu`, `mega-menu`'s direction/indicator recompute, and `marquee`'s mutation+resize sync now coalesce their scroll/resize/mutation-driven recomputation onto a single `requestAnimationFrame`, instead of doing the work synchronously on every event. `toolbar` and `navigation-bar` cache CSS-visibility/`getComputedStyle` lookups per sync pass instead of re-walking the same shared ancestor chain for every item. `mega-menu` also gates its ancestor-chain `ResizeObserver` behind the menu actually being open. `matrix-chart` hoists its `Intl.NumberFormat` instance out of the per-cell formatting loop. `multi-select` hoists its `querySelectorAll` result out of a `flatMap`. `table-of-contents` scopes both of its `MutationObserver`s with `attributeFilter` so unrelated attribute churn no longer triggers a rescan. `menu-bar` short-circuits its document-wide focusin handler when no menu or submenu is open. `spectrogram` samples a bounded number of frames/bins into its SVG plot instead of rendering one element per raw data point. `access-gate` skips its disabled-control resync when a `MutationObserver` batch could not have added or removed an interactive control.

  `grid` (and `bento-grid`, which composes it) replace their `ResizeObserver`/`MutationObserver`-driven narrow-layout measurement with a native CSS `@container` query, removing all JS-side width measurement. The container-query collapse rule targets every direct child (`grid-column: 1 / -1`) rather than reassigning `grid-template-columns` on the querying element itself — a query container excludes itself when resolving which container a rule queries, so a self-referential override would silently never apply. Verified with `bun run test:playwright` that the narrow/wide layout actually toggles at the container breakpoint in a real browser.

- [#1016](https://github.com/stevekinney/cinder/pull/1016) [`44e11a5`](https://github.com/stevekinney/cinder/commit/44e11a52cd1b1169dc2dd075964114aa32f318d4) Thanks [@stevekinney](https://github.com/stevekinney)! - Give HeroSection media a full-width aspect-ratio contract, remove the default card frame, and enable split layouts from 48rem.

- [#1121](https://github.com/stevekinney/cinder/pull/1121) [`2b92897`](https://github.com/stevekinney/cinder/commit/2b92897a03395096d185d6545435fb2554bbd0f7) Thanks [@stevekinney](https://github.com/stevekinney)! - Observe text-direction media queries declared in recursively imported stylesheets.

- [#1085](https://github.com/stevekinney/cinder/pull/1085) [`d4a63dc`](https://github.com/stevekinney/cinder/commit/d4a63dcf0d40d9f6dae52962a8a30e6893c1675d) Thanks [@stevekinney](https://github.com/stevekinney)! - Expose a lifecycle-scoped native element attachment on Input.

- [#989](https://github.com/stevekinney/cinder/pull/989) [`06d7002`](https://github.com/stevekinney/cinder/commit/06d7002e9a0356dd922eb236772e06789a978b6f) Thanks [@stevekinney](https://github.com/stevekinney)! - Use the shared rotating chevron disclosure affordance for Kanban column collapse.

- [#985](https://github.com/stevekinney/cinder/pull/985) [`b33f757`](https://github.com/stevekinney/cinder/commit/b33f7575e87f1226f603f2e122fae3942a3d349f) Thanks [@stevekinney](https://github.com/stevekinney)! - Align Kanban elevation and scroll-edge treatments with themeable tokens.

- [#1126](https://github.com/stevekinney/cinder/pull/1126) [`6166a73`](https://github.com/stevekinney/cinder/commit/6166a73d90e71745d4357a2a0d3a536d327b10a7) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose LogoCloud layout with Grid while preserving its responsive column behavior.

- [#1023](https://github.com/stevekinney/cinder/pull/1023) [`e81880b`](https://github.com/stevekinney/cinder/commit/e81880b47717b07fb83830faee4ee91204d16727) Thanks [@stevekinney](https://github.com/stevekinney)! - Replace remaining add and disclosure text glyphs in InvocationRuleBuilder,
  MultiSelect, and JsonSchemaEditor with consistently sized Lucide icons.

- [#993](https://github.com/stevekinney/cinder/pull/993) [`876c600`](https://github.com/stevekinney/cinder/commit/876c60083dc674b648f47c99aeff59d62e15b4aa) Thanks [@stevekinney](https://github.com/stevekinney)! - Clarify MegaMenu nested submenu master/detail layout with a divider and active trigger panel.

- [#1022](https://github.com/stevekinney/cinder/pull/1022) [`6bd8d76`](https://github.com/stevekinney/cinder/commit/6bd8d76074bf471898a476bde91041a7cc9ca047) Thanks [@stevekinney](https://github.com/stevekinney)! - Use a directional chevron icon for MenuBar submenu indicators.

- [#1119](https://github.com/stevekinney/cinder/pull/1119) [`41fdd11`](https://github.com/stevekinney/cinder/commit/41fdd11644884db69b7cffe8ee9bf1b1921d8974) Thanks [@stevekinney](https://github.com/stevekinney)! - Use the shared Checkbox indicator and command-list interaction state in MultiSelect while preserving its multi-value selection API.

- [#1018](https://github.com/stevekinney/cinder/pull/1018) [`40bd219`](https://github.com/stevekinney/cinder/commit/40bd219c80a4411f81d82a2105f477c1554a45dd) Thanks [@stevekinney](https://github.com/stevekinney)! - Clarify navigation component alternatives in the generated component manifest.

- [#1131](https://github.com/stevekinney/cinder/pull/1131) [`412f275`](https://github.com/stevekinney/cinder/commit/412f27521e7f339c5e62649c3980eeb355f38cd7) Thanks [@stevekinney](https://github.com/stevekinney)! - Resolve the nearest portal owner across shadow roots and native top-layer boundaries.

- [#1132](https://github.com/stevekinney/cinder/pull/1132) [`f5d2ec6`](https://github.com/stevekinney/cinder/commit/f5d2ec62a878282f9faa10c9c3d67819b77f7213) Thanks [@stevekinney](https://github.com/stevekinney)! - Resolve direction overrides authored with native CSS nesting selectors.

- [#997](https://github.com/stevekinney/cinder/pull/997) [`a96c5c0`](https://github.com/stevekinney/cinder/commit/a96c5c09fd5ef025d79d97006bd6ea0b71a78db3) Thanks [@stevekinney](https://github.com/stevekinney)! - Mark ColorField's decorative swatch as non-interactive to match its text-input contract.

- [#1108](https://github.com/stevekinney/cinder/pull/1108) [`462b85b`](https://github.com/stevekinney/cinder/commit/462b85b8cad5859bbcd97c86428fc10d839aa255) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose NumberInput's editable control through Input while preserving locale-aware parsing, validation, native attachments, stepper behavior, and the visible-frame class hook. Input now exposes `groupClassName` for styling composed grouped controls.

- [#1021](https://github.com/stevekinney/cinder/pull/1021) [`a39d748`](https://github.com/stevekinney/cinder/commit/a39d74892a06cae40f13aa663f0d250598cc094b) Thanks [@stevekinney](https://github.com/stevekinney)! - Replace NumberInput stepper text glyphs with the canonical Lucide plus and minus icons.

- [#1205](https://github.com/stevekinney/cinder/pull/1205) [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal restructuring: move KanbanBoard's pointer hit-testing helpers into `kanban-board-helpers.ts` (parameterized, no closures over component locals) and extract column lift/drop/collapse state into `KanbanBoardColumnReorder`. Also deduplicates the two identical drop-placeholder `<li>` blocks into a shared snippet. No behavior or public API change; markup is unchanged.

- [#1205](https://github.com/stevekinney/cinder/pull/1205) [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal restructuring: deduplicate ScheduleBuilder's triplicated field-reseed block into `applySeedToFields` (all 12 fields, used by the prop-resync and allowed-modes-change effects) and `applyPresetSeedToFields` (the 8 preset-only fields, used by the presets branch of a mode switch, which must not touch `authoringMode`/cron/interval fields). No behavior or public API change; the 11 flat `$state` declarations and the three authoring-mode panels are unchanged.

- [#1205](https://github.com/stevekinney/cinder/pull/1205) [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal restructuring: extract SchemaFormBody's path-keyed editing state (form value, validation errors, and five auxiliary draft maps) into `SchemaFormState`, instantiated fresh on every schema remount. No behavior or public API change; `renderField` and all markup are unchanged.

- [#1205](https://github.com/stevekinney/cinder/pull/1205) [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal restructuring: extract SelectionPopover's virtual-keyboard-dismissal heuristic into `createVirtualKeyboardDismissal`, a factory that owns its own `$effect`. No behavior or public API change; adds unit test coverage for logic that was previously only reachable through a full popover mount plus real `visualViewport`/`navigator.virtualKeyboard` events.

- [#1205](https://github.com/stevekinney/cinder/pull/1205) [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal restructuring: split `source-diff-viewer.utilities.ts` into path-normalization, git-header-parsing, binary-notice, and label-formatting modules. No behavior or public API change.

- [#1205](https://github.com/stevekinney/cinder/pull/1205) [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal restructuring: extract `TableOfContents`'s heading-derivation and active-heading-tracking observer state machines into `table-of-contents-heading-registry.svelte.ts` and `table-of-contents-active-heading.svelte.ts`. No behavior or public API change; adds unit test coverage for logic that was previously only reachable through a full component mount.

- [#1205](https://github.com/stevekinney/cinder/pull/1205) [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal restructuring: extract TreeItem's inline-rename state machine into `TreeItemRenameController`, keyboard/pointer drag handling into `TreeItemDragHandlers`, the async `loadChildren` lifecycle into `TreeItemAsyncLoader`, and the filter-highlight splitter into a plain `splitLabelForHighlight` function. Checkbox-selection reconciliation and tree registration stay inline, matching their existing precisely-ordered same-file guarantees. No behavior or public API change; markup is unchanged.

- [#1205](https://github.com/stevekinney/cinder/pull/1205) [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal restructuring: extract Tree's search/filter state (controlled-vs-uncontrolled value, debounced results announcement, filter input keyboard shortcuts) into `TreeFilterController`, and pointer-drag autoscroll (edge detection, scroll nudging, drop-target re-resolution while scrolling) into `TreeAutoscrollController`, both under `src/_internal/` alongside Tree's existing companion modules. Typeahead dispatch and both render paths (DOM-registry and virtualized) are unchanged. No behavior or public API change.

- [#1141](https://github.com/stevekinney/cinder/pull/1141) [`7d069b6`](https://github.com/stevekinney/cinder/commit/7d069b6cac6287737fa7623c8e8b3e99249e1ea8) Thanks [@stevekinney](https://github.com/stevekinney)! - Ship `src/_internal/**/*.svelte` in the published tarball. The FormField
  composition refactor moved control markup into internal Svelte components that
  all three packing surfaces (the generated `files` globs, the exports
  generator's static list, and pack-for-publish's staged list) excluded, so
  consumer installs crashed during hydration. Fixture modules
  (`*.fixture.ts`/`*.fixtures.ts`) no longer ship. A new packed-import-closure
  test validates that every relative import reachable from packed sources is
  itself packed, for both glob surfaces, in per-PR CI.

- [#1133](https://github.com/stevekinney/cinder/pull/1133) [`925a0fc`](https://github.com/stevekinney/cinder/commit/925a0fc905c80ec6663f22d908d31ad7d3fdbe9a) Thanks [@stevekinney](https://github.com/stevekinney)! - Preserve mouse-event parity and the original composed path when bridging portaled NavigationBar and SpeedDial interactions.

- [#1065](https://github.com/stevekinney/cinder/pull/1065) [`3897000`](https://github.com/stevekinney/cinder/commit/389700023af97651b11ff4bf1d21962a935a76ba) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep SpeedDial Tab navigation contiguous across its portaled actions, including arrow-focused untabbable actions.

- [#971](https://github.com/stevekinney/cinder/pull/971) [`034413c`](https://github.com/stevekinney/cinder/commit/034413cf9591d1c31ad439349cab6d0bbed6df5a) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a validation guard that tracks and prevents new hand-rolled primitive implementations in components.

- [#976](https://github.com/stevekinney/cinder/pull/976) [`d99561f`](https://github.com/stevekinney/cinder/commit/d99561fe37c49ef4791109e220d242cde11b67db) Thanks [@stevekinney](https://github.com/stevekinney)! - Route SpeedDial actions, Combobox empty results, and collapsed NavigationBar
  menus through the shared portal and Floating UI positioning path so clipping
  and local stacking contexts cannot obscure them. Make the public z-index scale
  the single source of truth, including a top-level drag-preview token, and add a
  Stylelint guard against token fallbacks and unexplained layer values.

- [#1078](https://github.com/stevekinney/cinder/pull/1078) [`e7e92ad`](https://github.com/stevekinney/cinder/commit/e7e92ad8d59b11864bb10a5f915afc5ddacfc192) Thanks [@stevekinney](https://github.com/stevekinney)! - Hide the closed SpeedDial floating-surface chrome while preserving action exit motion.

- [#1006](https://github.com/stevekinney/cinder/pull/1006) [`4c6455c`](https://github.com/stevekinney/cinder/commit/4c6455c84e97cce49a2e2defd8f823e2903e8a0f) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix command-menu dismissal, load-more sentinel throttling, and resting layouts for sortable lists, logo clouds, and cards.

- [#1124](https://github.com/stevekinney/cinder/pull/1124) [`f621c7e`](https://github.com/stevekinney/cinder/commit/f621c7e0fd98dd76982575c5e55ae901018bcb55) Thanks [@stevekinney](https://github.com/stevekinney)! - Respect `@scope` boundaries when resolving direction from stylesheet rules.

- [#987](https://github.com/stevekinney/cinder/pull/987) [`277503a`](https://github.com/stevekinney/cinder/commit/277503a78d7b3cdad23a6b3b10ad4b7ea4a1415d) Thanks [@stevekinney](https://github.com/stevekinney)! - Overlap Popover caret fills with the panel border so the arrow reads as one silhouette.

- [#1109](https://github.com/stevekinney/cinder/pull/1109) [`3b3685f`](https://github.com/stevekinney/cinder/commit/3b3685f63ca518a6006a5212c78c837b2e4ba91f) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose SearchField with the shared Input control while preserving its search, clear behavior, and interactive hit targets.

- [#988](https://github.com/stevekinney/cinder/pull/988) [`fad8c3f`](https://github.com/stevekinney/cinder/commit/fad8c3f7a5a618534c71b413a82db7d88f290c0f) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep SelectableRow hover backgrounds continuous and align leading indicators to wrapped titles.

- [#1067](https://github.com/stevekinney/cinder/pull/1067) [`928ce6a`](https://github.com/stevekinney/cinder/commit/928ce6a3e26a0a101f1cb7a8b6a94d6708a88ab9) Thanks [@stevekinney](https://github.com/stevekinney)! - Dismiss SelectionPopover movement caused by an external keyboard after focus lands on the collapsed action.

- [#1114](https://github.com/stevekinney/cinder/pull/1114) [`cfc7fa8`](https://github.com/stevekinney/cinder/commit/cfc7fa80cfa2e21150830c7f66d68b78da37f99e) Thanks [@stevekinney](https://github.com/stevekinney)! - Share row and option-item geometry and state styling across list primitives.

- [#1113](https://github.com/stevekinney/cinder/pull/1113) [`09ab845`](https://github.com/stevekinney/cinder/commit/09ab8459df15bcdbddec2737e0f98bafb1c2f796) Thanks [@stevekinney](https://github.com/stevekinney)! - Share the responsive section skeleton across BlogSection, TestimonialSection, and TeamSection.

- [#982](https://github.com/stevekinney/cinder/pull/982) [`4aa510d`](https://github.com/stevekinney/cinder/commit/4aa510d7a59382a53c1344ba79df43313b91fde9) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep AccessGate's granted and denied states aligned to a shared inline baseline wrapper.

- [#979](https://github.com/stevekinney/cinder/pull/979) [`4fe3131`](https://github.com/stevekinney/cinder/commit/4fe313159e6ee88d13ec6a10a15acb5347c00bbe) Thanks [@stevekinney](https://github.com/stevekinney)! - Prevent LoadMore from repeatedly auto-loading while its sentinel remains within the observer root.

- [#1125](https://github.com/stevekinney/cinder/pull/1125) [`a73801c`](https://github.com/stevekinney/cinder/commit/a73801c4ffc5d651e358b9e36fea9fb51dcf3059) Thanks [@stevekinney](https://github.com/stevekinney)! - Preserve SpeedDial positioning and focus state through visible exit and open-surface repositioning.

- [#1199](https://github.com/stevekinney/cinder/pull/1199) [`f59f9f9`](https://github.com/stevekinney/cinder/commit/f59f9f93ce3f209a20e46ebb1891b5ebeeec757e) Thanks [@stevekinney](https://github.com/stevekinney)! - Replace hand-rolled component icons, remove duplicate copy state, reuse the shared announcer, and normalize an internal portal utility import.

- [#986](https://github.com/stevekinney/cinder/pull/986) [`1f6f63e`](https://github.com/stevekinney/cinder/commit/1f6f63e78b1f23a6000d8ffba790976804f43b49) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep Callout's accent stripe straight by squaring its leading corners.

- [#1029](https://github.com/stevekinney/cinder/pull/1029) [`cb2e132`](https://github.com/stevekinney/cinder/commit/cb2e13237a014058a5adbad8a6ff1768040f25a1) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep ToastRegion's built-in icons compatible with strict `style-src` Content Security Policies.

- [#972](https://github.com/stevekinney/cinder/pull/972) [`7b9be9d`](https://github.com/stevekinney/cinder/commit/7b9be9d9d76024df7af698f96e760c725af2dd9a) Thanks [@stevekinney](https://github.com/stevekinney)! - Strengthen light and dark surface hierarchy, standardize form-control fills, and enforce muted interior dividers with stylelint guardrails.

- [#1188](https://github.com/stevekinney/cinder/pull/1188) [`912c785`](https://github.com/stevekinney/cinder/commit/912c785c93286da98c93f58e38e7e13ae5614292) Thanks [@stevekinney](https://github.com/stevekinney)! - Sweep index-keyed `{#each}` blocks and `$effect` anti-patterns to idiomatic Svelte 5 across twelve sites: `breadcrumbs`, `keyboard-shortcuts` (two blocks), and `shortcut-hint` now key on item identity (falling back to a `${field}-${index}` composite when the field isn't type-guaranteed unique) instead of loop position, so a reorder/insert/delete no longer reuses the wrong DOM node's local state; `waveform` keys its bar list on the mathematically-injective `bar.x`. `backdrop` reads `onclick` directly instead of mirroring it into `$state` via an `$effect` (Svelte 5 destructured props already stay live in closures). `tooltip` and `toast-region` swap a reactive-look `$effect` for the more specific `onDestroy`/`onMount` lifecycle hook. `secret-value-field`'s prop-resync guard (`previousValue`) is now a plain non-reactive `let` instead of `$state`, removing a self-dependency where the effect's own write invalidated a dependency it had just read. `button-group` replaces a `<script module>`-scoped mutable ID counter (shared, unbounded, cross-request state in a long-lived server process) with `$props.id()`.

  `calendar`'s `todayIso` is a genuine behavior fix, not just a refactor: it was `$derived` with zero tracked dependencies, so it silently froze at first render instead of tracking the real date. It is now `$state`, refreshed by a small `$effect` on a 60-second interval and on `visibilitychange`, so a long-lived session correctly moves `aria-current="date"` to the new day after midnight.

- [#1197](https://github.com/stevekinney/cinder/pull/1197) [`74a58e6`](https://github.com/stevekinney/cinder/commit/74a58e6cc68f7b5db632090f80e0f81a7d62c66b) Thanks [@stevekinney](https://github.com/stevekinney)! - Make Tabs emit a correct roving-tabindex tab stop during server rendering.

- [#1110](https://github.com/stevekinney/cinder/pull/1110) [`0a43737`](https://github.com/stevekinney/cinder/commit/0a43737b4cc04a8d13628fbb47879fb5f5ba117b) Thanks [@stevekinney](https://github.com/stevekinney)! - Document the boundaries between the Table, DataTable, and DataGrid component families.

- [#1116](https://github.com/stevekinney/cinder/pull/1116) [`5b640a3`](https://github.com/stevekinney/cinder/commit/5b640a3b043c33667a243c526c79ddd72e6912a2) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose TimeField's editable time control with the shared Input primitive.

- [#992](https://github.com/stevekinney/cinder/pull/992) [`dc3dc20`](https://github.com/stevekinney/cinder/commit/dc3dc20153e59b03cceb5c0d6c505111af44f4e9) Thanks [@stevekinney](https://github.com/stevekinney)! - Render TransferList move controls with directional Lucide icons while preserving their accessible names.

- [#1149](https://github.com/stevekinney/cinder/pull/1149) [`43eb35b`](https://github.com/stevekinney/cinder/commit/43eb35bb96c50cefdeb61c121a540eec5049fc9f) Thanks [@stevekinney](https://github.com/stevekinney)! - Compose Combobox's roving active-option state on the shared `createCommandListState` utility instead of a hand-rolled index, matching the MultiSelect/CommandMenu/CommandPalette precedent. Adds an `autoActivateFirst` option to the utility so an editable combobox can leave no option highlighted until the user types or navigates, and Combobox now scrolls the active option into view during keyboard navigation. Public API and observable behavior are unchanged.

## 0.19.1

### Patch Changes

- [#914](https://github.com/stevekinney/cinder/pull/914) [`8efb8b6`](https://github.com/stevekinney/cinder/commit/8efb8b6b27d3f705dca8b2197df2fb33f80b0339) Thanks [@stevekinney](https://github.com/stevekinney)! - Prevent FacetedFilterBar select labels from clipping by allowing controls to grow to fit their line box.

- [#916](https://github.com/stevekinney/cinder/pull/916) [`eaa52b6`](https://github.com/stevekinney/cinder/commit/eaa52b6b5d359ca071df8eb5039b261c0ac4b40f) Thanks [@stevekinney](https://github.com/stevekinney)! - Add visually hidden Select labels and warn when a bound value does not match any option.

- [#915](https://github.com/stevekinney/cinder/pull/915) [`79cc14b`](https://github.com/stevekinney/cinder/commit/79cc14b49750cdeae92e3cb16a75bc4ef77d1582) Thanks [@stevekinney](https://github.com/stevekinney)! - Load Stat styles when using the StatGroup compound component API.

## 0.19.0

### Minor Changes

- [#876](https://github.com/stevekinney/cinder/pull/876) [`cb98477`](https://github.com/stevekinney/cinder/commit/cb98477807816e19c7736e0ca875c8b1bddfe838) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `@lostgradient/cinder/highlighters/shiki/curated`, a curated adapter entrypoint where `shikiHighlighter` accepts `languageLoaders` and `themeLoaders` maps so Vite consumers can ship only the Shiki grammars and themes they use.

## 0.18.0

### Minor Changes

- [#872](https://github.com/stevekinney/cinder/pull/872) [`e12e2e9`](https://github.com/stevekinney/cinder/commit/e12e2e97c200f4bcb8586bdc6dc2dd95a1e74dfe) Thanks [@stevekinney](https://github.com/stevekinney)! - Allow conditions-only `InvocationRuleBuilder` fields to accept arbitrary keys through a free-text combobox while retaining `fieldOptions` as suggestions and type metadata.

- [#874](https://github.com/stevekinney/cinder/pull/874) [`4bb7c93`](https://github.com/stevekinney/cinder/commit/4bb7c93ea3ad4741a515026f21197513ac4889a2) Thanks [@stevekinney](https://github.com/stevekinney)! - Add an opt-in lazy-highlighted mode to `JsonEditor` with inline JSON parse annotations while keeping the native textarea contract as the default.

### Patch Changes

- [#870](https://github.com/stevekinney/cinder/pull/870) [`92e7ab3`](https://github.com/stevekinney/cinder/commit/92e7ab3ff9d05176f08498c5f0948a4d6827d153) Thanks [@stevekinney](https://github.com/stevekinney)! - Expose StatusDot labels as accessible names when live connection indicators hide their visible label.

## 0.17.0

### Minor Changes

- [#852](https://github.com/stevekinney/cinder/pull/852) [`ffbbb2f`](https://github.com/stevekinney/cinder/commit/ffbbb2f3b6fc9ac8bbb14c598716e49cff72c517) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a controlled, accessible JsonEditor primitive with native textarea editing, parse feedback, and no code-editor bundle dependency.

- [#861](https://github.com/stevekinney/cinder/pull/861) [`caa5b36`](https://github.com/stevekinney/cinder/commit/caa5b36ea46511a8e62f514d89e2f4a5726f9fc9) Thanks [@stevekinney](https://github.com/stevekinney)! - Finish the markdown/editor extraction (Phases 4 and 5 of the package-boundaries plan, see
  `docs/decisions/package-boundaries.md`). This is the breaking-change release train that pays off
  the whole extraction: `@lostgradient/cinder` no longer exposes `./markdown/*`, `./editor/*`, or
  `./commentary/*` at all. Every consumer that used those subpaths must depend on
  `@lostgradient/markdown` or `@lostgradient/editor` directly.

  ## Migration table

  | Removed cinder subpath                                                                    | New home                                                                                                                                                                                                                                            |
  | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `@lostgradient/cinder/markdown` and every `./markdown/*` subpath                          | `@lostgradient/markdown` (same subpath shape, e.g. `./markdown/pipeline` → `@lostgradient/markdown/pipeline`, `./markdown/diff/line-diff` → `@lostgradient/markdown/diff/line-diff`, `./markdown/rendering*` → `@lostgradient/markdown/rendering*`) |
  | `@lostgradient/cinder/editor`, `./editor/component-runtime`, `./editor/test-utilities`    | `@lostgradient/editor/editor`, `@lostgradient/editor/editor/component-runtime`, `@lostgradient/editor/editor/test-utilities`                                                                                                                        |
  | `@lostgradient/cinder/editor/sanitize-html`, `/template-placeholders`, `/template-render` | `@lostgradient/markdown/templates/sanitize-html`, `/template-placeholders`, `/template-render`                                                                                                                                                      |
  | `@lostgradient/cinder/commentary` (root) and every `./commentary/*` subpath               | `@lostgradient/editor` root barrel and its matching subpath (e.g. `./commentary/anchor-decorations` → `@lostgradient/editor/anchor-decorations`, `./commentary/comments` → `@lostgradient/editor/comments`)                                         |

  (`@lostgradient/cinder/diff` and `./diff/line-diff` were already removed in the earlier
  `@lostgradient/markdown` publish — see that changeset. `markdown-editor`, `review-editor`, and
  `diff-viewer` were already removed from cinder in the `@lostgradient/editor` publish — import
  those from `@lostgradient/editor` directly, unchanged by this release.)

  ## What else changed
  - Deleted the generated re-export shim directories `src/markdown/`, `src/editor/`,
    `src/commentary/` and the `derive-upstream-reexports.ts` / `CINDER_KEY_OVERRIDES` machinery that
    generated them. Cinder's `dist/` no longer vendors `@lostgradient/markdown`'s or
    `@lostgradient/editor`'s compiled output at all.
  - Two retained cinder files depend on `@lostgradient/markdown` directly now —
    `src/utilities/change-tracker.svelte.ts` and `src/components/json-schema-editor/diff-view.svelte`
    import `@lostgradient/markdown/pipeline` and `@lostgradient/markdown/diff/line-diff`.
    `@lostgradient/markdown` moves from a build-only `devDependency` to a real, published
    `dependencies` entry cinder's consumers install transitively — cinder exposes none of its
    subpaths, but genuinely depends on it now.
  - `@lostgradient/editor` is no longer a cinder dependency of any kind (no `devDependency`, no
    runtime dependency) — no retained cinder source imports it.
  - Dropped now-orphaned dependencies empirically verified unused by any retained cinder source:
    the full milkdown/prosemirror peer set (`@milkdown/ctx`, `@milkdown/kit`, `@milkdown/prose`,
    `prosemirror-inputrules`, `prosemirror-model`, `prosemirror-state`, `prosemirror-view`), the
    markdown-pipeline dependency stack (`comlink`, `diff-match-patch`, `hast-util-sanitize`,
    `js-yaml` — moved to a scripts-only `devDependency`, still used by workspace tooling that parses
    CI YAML — `rehype-katex`, `rehype-sanitize`, `rehype-stringify`, `remark-gfm`, `remark-math`,
    `remark-parse`, `remark-rehype`, `remark-stringify`, `unified`, `unist-util-visit`,
    `@types/hast`, `@types/mdast`, `@types/unist`), and `@shikijs/langs` (never imported by name in
    cinder's own source — only a transitive dependency of `shiki` itself). `shiki`,
    `@shikijs/engine-oniguruma`, and `@shikijs/types` are KEPT: cinder's own
    `src/highlighters/shiki/index.ts` imports all three directly.
  - Cinder's published package weight dropped sharply: 3.81 MB packed / 18.71 MB unpacked / 4,498
    files, down from an 8 MB / 32 MB / 5,500-file budget beforehand.
  - Chat's `markdown-preview.svelte` now dynamically imports `@lostgradient/markdown/rendering`
    directly instead of `@lostgradient/cinder/markdown/rendering` — this was the migration
    rehearsal the decision doc called for. `@lostgradient/markdown` joins chat's `peerDependencies`
    (required, not optional — chat always renders through it) and `devDependencies`.

- [#854](https://github.com/stevekinney/cinder/pull/854) [`23a5ebc`](https://github.com/stevekinney/cinder/commit/23a5ebc161be56d1198829fb269372e67f85d5bb) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a flat conditions mode to `InvocationRuleBuilder` for controlled implicit-AND lists without rule-group metadata or controls.

- [#845](https://github.com/stevekinney/cinder/pull/845) [`35732d8`](https://github.com/stevekinney/cinder/commit/35732d8d15240082ccb5d7b4be6d6216a05c40ea) Thanks [@stevekinney](https://github.com/stevekinney)! - Move the Worker-based Markdown rendering API to `@lostgradient/cinder/markdown/rendering/async` so sync-only consumers do not bundle the Worker entry and its dependencies.

- [#855](https://github.com/stevekinney/cinder/pull/855) [`d7ecfc4`](https://github.com/stevekinney/cinder/commit/d7ecfc4cece464edddef9e027ae5176d40313766) Thanks [@stevekinney](https://github.com/stevekinney)! - Expose complete live SchemaForm drafts through `ondraftchange` while preserving seed-only `value` semantics and validated `onsubmit` output.

- [#817](https://github.com/stevekinney/cinder/pull/817) [`fffa0ab`](https://github.com/stevekinney/cinder/commit/fffa0abf2ee41c9cf0a0e100eb5ee99447f5d5f4) Thanks [@stevekinney](https://github.com/stevekinney)! - Expose PayloadInspector depth controls for its composed JsonViewer.

- [#856](https://github.com/stevekinney/cinder/pull/856) [`006641e`](https://github.com/stevekinney/cinder/commit/006641ebfd998a78e0c2d0459b503c750f9a014c) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish `@lostgradient/editor` (Phase 3 of the package-boundaries plan, see
  `docs/decisions/package-boundaries.md`). `@cinder/commentary` is renamed to `@lostgradient/editor`
  and absorbs the ProseMirror/Milkdown half of the former `@cinder/editor` package. Three components
  move out of `@lostgradient/cinder` and into this new package: `markdown-editor`, `review-editor`,
  and `diff-viewer` — `review-editor` composes the other two, so all three had to move together.

  `@lostgradient/cinder`'s `markdown-editor`, `review-editor`, and `diff-viewer` subpaths (and their
  `/schema`, `/variables`, `/styles`, `/examples` siblings) are **removed** — this is a breaking
  change for any external consumer of those subpaths, hence the minor (not patch) bump on
  `@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a minor per semver's own
  pre-1.0 carve-out (the same reasoning `@lostgradient/markdown`'s publish used for the removed
  `./diff` aliases). That is the ONLY subpath removal in this release — Phase 3's scope is those
  three Svelte components, nothing else. Cinder's `./editor`, `./editor/component-runtime`,
  `./editor/test-utilities`, the bare `./commentary` root barrel, and every `./commentary/*` subpath
  (`anchor-decorations`, `anchoring`, `comments`(+`/types`), `export`(+`/types`), `session`
  (+`/types`), `shared/anchor-types`) are unaffected — they now mirror `@lostgradient/editor`'s
  headless runtime instead of `@cinder/commentary`'s, with no change to their public shape.

  We evaluated re-exporting the three Svelte components back through Cinder as generated shims (the
  `derive-upstream-reexports.ts` / `CINDER_KEY_OVERRIDES` pattern used for the headless subpaths
  above), but that mechanism only understands `.ts` value/type re-exports — `generate-exports.ts`'s
  component pipeline requires a component to physically live under
  `packages/components/src/components/`, and cannot re-export a compiled `.svelte` file from a
  sibling package. A hand-authored shim `.svelte` file was rejected too: it is exactly the kind of
  compatibility scaffolding this repo's conventions avoid on a pre-release package, and Phase 5 of
  the package-boundaries plan deletes Cinder's remaining shims outright — so a temporary
  `markdown-editor`/`review-editor`/`diff-viewer` shim here would be written only to be deleted in
  the very next phase. Consumers of these three components should migrate their import specifier
  from `@lostgradient/cinder/<component>` to `@lostgradient/editor/<component>` directly.

  `@lostgradient/editor`'s peers are `@lostgradient/cinder` (`^0.17.0`), `@lostgradient/markdown`
  (`^0.1.0`), `svelte`, and the milkdown/prosemirror stack — all host-supplied singletons. Its only
  regular `dependencies` are `@floating-ui/dom` and `esm-env`, matching `@lostgradient/cinder`'s own
  treatment of those same two vendored utilities (see `package-boundary.test.ts`): small, stateless
  libraries where a duplicate copy across the install graph causes no functional issue, unlike the
  singleton-sensitive peers above.

- [#806](https://github.com/stevekinney/cinder/pull/806) [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish `@lostgradient/markdown` (Phase 2 of the package-boundaries plan, see
  `docs/decisions/package-boundaries.md`). `@cinder/markdown` is renamed to `@lostgradient/markdown`
  and absorbs the former `@cinder/diff` package — its word/line-diff engine is now inlined at
  `@lostgradient/markdown/diff/line-diff` rather than re-exported from a separate workspace package.
  `@cinder/diff` no longer exists. `@lostgradient/markdown` now declares `@shikijs/engine-oniguruma`,
  `@shikijs/langs`, and `@shikijs/types` as its own runtime dependencies (previously these existed
  only as transitive dependencies of `@lostgradient/cinder`, which vendors and re-exports markdown's
  compiled output). `@lostgradient/cinder` keeps declaring all three too: `engine-oniguruma` and
  `types` because cinder's own `./highlighters/shiki` adapter imports them directly, and `langs`
  because cinder's build vendors markdown's `./rendering` pipeline (which lazily loads per-language
  grammars from `@shikijs/langs`) into its own published dist under `./markdown/rendering*`. `shiki`
  itself stays a direct dependency of both packages, as before.
  `@lostgradient/cinder`'s `./markdown/*` re-export shims are unaffected; the top-level `./diff` and
  `./diff/line-diff` cinder aliases (sourced from the now-deleted `@cinder/diff` package) are
  **removed** — `./markdown/diff/line-diff` was already the canonical, actually-used path for every
  in-repo consumer, but this is a breaking change for any external consumer of those aliases, hence
  the minor (not patch) bump on `@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a
  minor per semver's own pre-1.0 carve-out. `@cinder/commentary`'s `workspace:*` dependency on
  markdown is repointed to the new package name. `@lostgradient/chat`'s `peerDependencies` on
  `@lostgradient/cinder` widens from `^0.16.0` to `^0.16.0 || ^0.17.0` — cinder's minor bump here
  would otherwise leave chat's declared peer range unsatisfied against the version this release
  actually produces, per `.changeset/README.md`'s "keep that peer range aligned with the Cinder
  version released alongside it" contract.

- [#829](https://github.com/stevekinney/cinder/pull/829) [`4376c18`](https://github.com/stevekinney/cinder/commit/4376c18e2f0dd055ec629cd02035447f8f6e13b2) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove the `brand` snippet from `Sidebar`. Consumers that used it should move that markup into their own shell chrome, such as a top bar or a region above `Sidebar`; there is no replacement API.

- [#823](https://github.com/stevekinney/cinder/pull/823) [`2174be0`](https://github.com/stevekinney/cinder/commit/2174be0182d834d8aa3f1dbe82a2b3fe54b153db) Thanks [@stevekinney](https://github.com/stevekinney)! - Add RunStepTimeline selected-step and row-click selection props.

- [#853](https://github.com/stevekinney/cinder/pull/853) [`31fd201`](https://github.com/stevekinney/cinder/commit/31fd20103079bc6cebeadab8c0e11390119754f3) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a domain-neutral `timed-out` terminal status to RunStepTimeline with a distinct label, danger tone, public schema support, and consumer mapping guidance.

### Patch Changes

- [#832](https://github.com/stevekinney/cinder/pull/832) [`fdecd5e`](https://github.com/stevekinney/cinder/commit/fdecd5e63a0ea2e3ca8e3d997efa3f815d1bd664) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep shared local validation gate waiters alive while the recorded lock holder process is still running.

- [#851](https://github.com/stevekinney/cinder/pull/851) [`955adb0`](https://github.com/stevekinney/cinder/commit/955adb0459272b9d08ed8a5eb13b579ce83997a7) Thanks [@stevekinney](https://github.com/stevekinney)! - Avoid nested navigation landmarks when composing Sidebar with SideNavigation.

- [#833](https://github.com/stevekinney/cinder/pull/833) [`30feaa5`](https://github.com/stevekinney/cinder/commit/30feaa509548f436e77c47520d9b49193f76c6f4) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix a `hydration_mismatch` warning on the first SSR load of any Cinder component that renders an icon (including Chat, which renders one unconditionally in its composer toolbar).

  `lucide-svelte` was a loosely-ranged (`>=0.400.0 <1`) `peerDependency`. Cinder's prebuilt server bundle (`dist/server`, resolved via the `node` export condition under SSR) bakes in whatever `lucide-svelte` version was installed in Cinder's own build at publish time. A consuming application's client bundle, however, resolves `lucide-svelte` fresh at whatever version its own package manager picked within that peer range. Lucide periodically redraws icon artwork (different `<path>` counts or coordinates for the same icon name), so any consumer whose installed `lucide-svelte` differs from Cinder's build-time version got structurally different icon markup between the server-rendered HTML and the client's hydrated render — a real, reproducible `[svelte] hydration_mismatch`, confirmed against a real SvelteKit dev server and a real browser.

  `lucide-svelte` is now a pinned, exact-version regular `dependency` of `@lostgradient/cinder` instead of a peer, so its own server and client builds resolve the same `lucide-svelte` install without depending on what version — if any — your application installs for its own icons. (See the known follow-up below for the one case this does not fully close.)

  **Consumer impact:** if your app currently lists `lucide-svelte` as a direct dependency solely to satisfy `@lostgradient/cinder`'s former peer requirement, you can remove it — Cinder now supplies its own pinned copy for its own components. If your app also renders Lucide icons directly, keep your own dependency; npm/bun will install and resolve it independently of Cinder's pinned copy (they do not conflict).

  **Known follow-up:** if your application pins its _own_ `lucide-svelte` version and your bundler's deduplication happens to collapse Cinder's nested pinned copy onto your application's version for Cinder's client-side (browser/`svelte` condition) source compile — while Cinder's prebuilt `dist/server` still resolves its own pinned copy — the two could still diverge. This is inherent to Cinder shipping both prebuilt server output and raw source for Svelte-aware bundlers. Closing that residual case fully would mean vendoring icon path data directly into Cinder rather than depending on `lucide-svelte` at all; that is out of scope for this fix and is tracked as a follow-up.

  **Known caveat — `lucide-svelte`'s own declared peer range:** every published `lucide-svelte` release, including the latest (`1.0.1` as of this writing), declares `peerDependencies: { svelte: "^3 || ^4 || ^5.0.0-next.42" }` — it has never been updated to include a stable Svelte 5 release, even though it works correctly with one (this repository has used `lucide-svelte@0.503.0` against stable Svelte `5.56.x` for a long time). This is not something this fix can work around by choosing a different `lucide-svelte` version, since none of them declare a stable-Svelte-5 peer range. Under npm/bun's default (non-strict) peer resolution this only produces a warning, same as it did when `lucide-svelte` was Cinder's own peer dependency. Consumers using `pnpm` or `npm --strict-peer-deps` may see this warning surface from inside Cinder's dependency tree now rather than from their own top-level install; if it blocks your install, an `overrides`/`resolutions` entry or a peer-dependency-rule exception for `lucide-svelte` in your package manager's config resolves it, same as it would have before this change.

- [#821](https://github.com/stevekinney/cinder/pull/821) [`f86e857`](https://github.com/stevekinney/cinder/commit/f86e8577f03cedad95858f5fb60a20f3265a2407) Thanks [@stevekinney](https://github.com/stevekinney)! - Add an `allowedModes` prop to `ScheduleBuilder` so consumers can restrict the authoring UI, including cron-only rendering with `allowedModes={['cron']}` that never emits interval values.

- [#805](https://github.com/stevekinney/cinder/pull/805) [`204928e`](https://github.com/stevekinney/cinder/commit/204928e8b07e6e1e7ea7f16c994ae3e201933bf9) Thanks [@stevekinney](https://github.com/stevekinney)! - Deferred `ajv` in `json-schema-editor` the same way `schema-form` already does, so meta-schema validation and compile checks no longer ship Ajv in the base install path. `applyJsonDraft` is now async as a result.

  Moved `zod` and `@modelcontextprotocol/sdk` from `dependencies` to optional `peerDependencies` — both are only used by the `mcp` CLI command (`bin.cinder mcp`), not by any component, so every consumer no longer has to install them. Running `mcp` without them now fails with an actionable message instead of a raw module-resolution error.

- [#793](https://github.com/stevekinney/cinder/pull/793) [`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal reshuffle: dissolve the private `@cinder/editor` workspace package (Phase 1 of the
  package-boundaries plan, see `docs/decisions/package-boundaries.md`). The headless
  template-placeholder trio (`sanitize-html.ts`, `template-placeholders.ts`, `template-render.ts`,
  `placeholder-security.ts`) moved into `@cinder/markdown`'s new `templates/` directory. The
  ProseMirror/Milkdown editor integration moved into `@cinder/commentary`'s new `editor/`
  directory. `@lostgradient/cinder`'s published `./editor/*` subpaths are unaffected — the
  generated re-export shims now source from the new locations, but the exported symbol sets and
  `package.json#exports` entries are byte-identical to before. Pure internal code movement; no
  public API change.

- [#819](https://github.com/stevekinney/cinder/pull/819) [`0ef0a27`](https://github.com/stevekinney/cinder/commit/0ef0a272568e716e0dac034e60347f5cf3f611d6) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `triggerLabel` to `FileUpload` so consumers can customize the visible picker button text while keeping Cinder's native input wiring, drag-and-drop validation, disabled state, and live-region announcements.

- [#820](https://github.com/stevekinney/cinder/pull/820) [`e9c1146`](https://github.com/stevekinney/cinder/commit/e9c11464ca1ef5af0801439270f4e0e09411ad41) Thanks [@stevekinney](https://github.com/stevekinney)! - Route `ToastRegion` warning toasts through the polite `role="status"` live-region channel while keeping danger toasts assertive.

- [#802](https://github.com/stevekinney/cinder/pull/802) [`280ba3e`](https://github.com/stevekinney/cinder/commit/280ba3e9eed6e76d7534bd0f4f78ff8890cf05df) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix the Shiki adapter behind `<CodeBlock>` (`highlighters/shiki`) to build on `shiki/core` + `@shikijs/engine-oniguruma`, resolving languages and themes through `shiki/langs` / `shiki/themes` instead of the default `shiki` barrel, converging on the same pattern `packages/markdown` already uses. This closes a build-time regression risk: cinder's own build (`splitting: false`) previously kept only the bare `shiki` specifier external, so any future `shiki/*` subpath import would have been inlined whole into cinder's published dist (measured at ~10 MB). `scripts/build.ts` now externalizes `shiki/*` and `@shikijs/engine-oniguruma` too. No change to the public `shikiHighlighter()` API, behavior, or supported language/theme set — and no change to what a consumer's own bundler ships, since `shiki` was already external there.

- [#822](https://github.com/stevekinney/cinder/pull/822) [`7e9d2f6`](https://github.com/stevekinney/cinder/commit/7e9d2f65b1b464762f6858a0e6429c1c6c52d4d1) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a `mobileBreakpoint` prop to Sidebar so app shells can raise or lower the drawer breakpoint while keeping the JavaScript media query and Sidebar presentation contract aligned.

- [#816](https://github.com/stevekinney/cinder/pull/816) [`356c5d7`](https://github.com/stevekinney/cinder/commit/356c5d7f7a4d3a7e9306b71e6039ce05382c7aa7) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep Tabs triggers single-line inside scrollable tab lists, so overflow resolves by horizontally scrolling the tab strip instead of shrinking and wrapping individual tab labels.

- [#798](https://github.com/stevekinney/cinder/pull/798) [`282b380`](https://github.com/stevekinney/cinder/commit/282b38060b765340a58f07487c53a0f9710d4033) Thanks [@stevekinney](https://github.com/stevekinney)! - Thinned `pre-push` to a fast, fail-open sanity check (no more local lint/typecheck/test dispatch or gate lock) now that PR CI and required branch-protection status checks own that validation. No published runtime behavior changes — this only touches internal `scripts/husky/*` tooling and `check-pipeline-coverage.ts`'s declaration table.

- [#792](https://github.com/stevekinney/cinder/pull/792) [`88d8b17`](https://github.com/stevekinney/cinder/commit/88d8b17d99e74742d0819094b3c6a5740079d6c3) Thanks [@stevekinney](https://github.com/stevekinney)! - Teach `check:pipeline-coverage` and `validate:release-workflow` to recognize `turbo run <task>` (including repeated `--filter=<pkg>` flags) as equivalent to `bun run --filter=<pkg> <task>`, so the workspace's move to Turborepo-orchestrated build/test/typecheck/lint doesn't silently blind the CI-gate coverage map. No published runtime behavior changes — dev-tooling scripts only.

- [#841](https://github.com/stevekinney/cinder/pull/841) [`09bdd26`](https://github.com/stevekinney/cinder/commit/09bdd2627ef2a36edf502add662ffd08a9b6ae41) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep horizontal BarChart category labels visible without sacrificing the plot area.

- Updated dependencies [[`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667), [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c)]:
  - @lostgradient/markdown@0.1.0

## 0.16.1

### Patch Changes

- [#766](https://github.com/stevekinney/cinder/pull/766) [`01cfe20`](https://github.com/stevekinney/cinder/commit/01cfe20711569effdd5643c3b985603a1536f7df) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a first-class scrollable wrapper option to the compositional Table API.

## 0.16.0

### Minor Changes

- [#760](https://github.com/stevekinney/cinder/pull/760) [`a373800`](https://github.com/stevekinney/cinder/commit/a373800445a0b11e4b6d84b94d5167999b071879) Thanks [@stevekinney](https://github.com/stevekinney)! - Extract the Chat component into the peer-dependency-only `@lostgradient/chat` package and remove it from Cinder's core package exports.

## 0.15.0

### Minor Changes

- [#757](https://github.com/stevekinney/cinder/pull/757) [`792a36d`](https://github.com/stevekinney/cinder/commit/792a36dcf267dcc3f5362f2716b5ab8060b34b5b) Thanks [@stevekinney](https://github.com/stevekinney)! - Improve Chat dependency ownership, streaming exports, and automatic component CSS imports.

### Patch Changes

- [#759](https://github.com/stevekinney/cinder/pull/759) [`278ed74`](https://github.com/stevekinney/cinder/commit/278ed74bc6125daa4be3fdfaaa41c78114c6d009) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix Chat SSR hydration stability for empty conversations.

## 0.14.0

### Minor Changes

- [#747](https://github.com/stevekinney/cinder/pull/747) [`fd1f5dc`](https://github.com/stevekinney/cinder/commit/fd1f5dcc73f279450523deae2b4aed3641581cb7) Thanks [@stevekinney](https://github.com/stevekinney)! - Add SelectableRow with a native primary button or link and independent trailing actions.

### Patch Changes

- [#748](https://github.com/stevekinney/cinder/pull/748) [`f2d7f43`](https://github.com/stevekinney/cinder/commit/f2d7f43b054aee08e57ddc477cc6b5473ba6655b) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep published Svelte source and server bundles on the same scoped-style identity so SSR component trees hydrate without mismatches.

## 0.13.0

### Minor Changes

- [#740](https://github.com/stevekinney/cinder/pull/740) [`ddefe5c`](https://github.com/stevekinney/cinder/commit/ddefe5c7fb2beff3b2593ea1179cc1bb6ed56bae) Thanks [@stevekinney](https://github.com/stevekinney)! - Add link-backed SegmentedControl navigation options for route filters.

## 0.12.1

### Patch Changes

- [#737](https://github.com/stevekinney/cinder/pull/737) [`3600db8`](https://github.com/stevekinney/cinder/commit/3600db878c53ae5d7048487207b08a60d5421b22) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish the post-0.12 downstream fixes for Chat full-height layout metadata and dense inspector styling hooks.

## 0.12.0

### Minor Changes

- [#721](https://github.com/stevekinney/cinder/pull/721) [`a6ee978`](https://github.com/stevekinney/cinder/commit/a6ee9784198ff450c1a9493e3c52a2f2c0965b62) Thanks [@stevekinney](https://github.com/stevekinney)! - Add public source-excerpt styling variables to CodeBlock, typed confirmation to ConfirmDialog, and a facet-only mode to FacetedFilterBar.

### Patch Changes

- [#725](https://github.com/stevekinney/cinder/pull/725) [`a2a3254`](https://github.com/stevekinney/cinder/commit/a2a3254df455b37f74abf4f73e8e8030017af309) Thanks [@stevekinney](https://github.com/stevekinney)! - Render compensation steps directly beneath the forward-step subtree they reverse.

## 0.11.0

### Minor Changes

- [#717](https://github.com/stevekinney/cinder/pull/717) [`28ddb39`](https://github.com/stevekinney/cinder/commit/28ddb39dd9ca9014bf93c71e4bbe401e304773b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a `commitOnSubmit` option to TagInput so native forms can commit a pending draft before submission.

## 0.10.0

### Minor Changes

- [#711](https://github.com/stevekinney/cinder/pull/711) [`6ae21f8`](https://github.com/stevekinney/cinder/commit/6ae21f837f85dd88fd8caf6f3110d80ad950304b) Thanks [@stevekinney](https://github.com/stevekinney)! - Add four additive surfaces for coordination and scheduling UIs:
  - **RunStepTimeline** gains branch/coordination groups — a `kind: 'branch'` entry with parallel sub-lanes (`won` / `lost` / `settled` outcomes, winner emphasized, losers muted, collapsible), a per-step `rewound` flag for speculatively-executed-then-unwound steps, and a per-step `compensates` linkage that renders a compensating step inset beneath its forward step with a reversal affordance. Existing `RunStep[]` timelines render unchanged.
  - **ConnectionIndicator** (new) — a standalone live-connection status pill with `connecting` / `live` / `reconnecting` / `polling` / `stale` / `closed` states. `live` pulses (static under reduced motion), `reconnecting` exposes an attempt-count slot, and `polling` reads distinctly quieter than `live`. Status is conveyed by icon + text (never color alone) with a `status` role, and reuses StatusDot's semantic tokens so it composes cleanly beside EventStreamViewer.
  - **ScheduleBuilder** (new) — a date-library-free recurrence control with Presets / Cron / Interval modes behind a SegmentedControl, an always-visible plain-English summary, a "next N fires" preview (computed via an injected `computeNextFires` callback, hidden when absent), and a timezone slot. Emits a discriminated `{ mode: 'cron' | 'interval', ... }` value; presets lower losslessly to one of those two.
  - **InvocationRuleBuilder** gains a conditions-only mode: rules carry conditions with no action target, operators constrained to `eq` / `gt` / `lt` / `gte` / `lte`, and typed value inputs inferred from field type. The existing conditions-plus-actions mode is unchanged and remains the default.

## 0.9.0

### Minor Changes

- [#693](https://github.com/stevekinney/cinder/pull/693) [`124e7b2`](https://github.com/stevekinney/cinder/commit/124e7b2740d8243e434c1eb831e2c760dab6265a) Thanks [@stevekinney](https://github.com/stevekinney)! - Move `conversationalist` from a transitive dependency to a required peer
  dependency. Consumers that use Chat or Cinder's conversation helpers must
  install `conversationalist@^0.2.1` and `zod@4.4.1` directly so the application
  and Cinder share one conversation type/schema instance.

## 0.8.0

### Minor Changes

- [`9686390`](https://github.com/stevekinney/cinder/commit/9686390483ce91eebe82f2f28852e436c1f2724a) Thanks [@stevekinney](https://github.com/stevekinney)! - `Chat` composer public API: added `clearInput()`, `getComposerValue()`, and an `oncomposerinput` callback prop so consumers can read, clear, and observe the composer's plain-text value without reaching into `.chat-input-editor` DOM directly (useful for building slash-command, mention, or autocomplete UX layered on top of the composer).

  Also re-exported the `ChatAttachment` type from the public `@lostgradient/cinder/chat` entry — previously consumers had to derive it from `ChatSubmitEvent['attachments'][number]`.

### Patch Changes

- [#675](https://github.com/stevekinney/cinder/pull/675) [`e55561d`](https://github.com/stevekinney/cinder/commit/e55561db6d348573e29df711c095b2ec18e197ef) Thanks [@stevekinney](https://github.com/stevekinney)! - Close a collapsed top NavigationBar mobile menu after enabled item activation.

- [#667](https://github.com/stevekinney/cinder/pull/667) [`d9ce2c3`](https://github.com/stevekinney/cinder/commit/d9ce2c3660805d8b6a7e964f3f671174c61ca819) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal build and validation overhaul: content-hash build caching (with the cache marker excluded from the published tarball), global test cleanup registration, and a lint script split into `lint` and `lint:invariants`.

## 0.7.0

### Minor Changes

- [#662](https://github.com/stevekinney/cinder/pull/662) [`e7c9eac`](https://github.com/stevekinney/cinder/commit/e7c9eac23f572d5068fb723df96fc17e2443c4ed) Thanks [@stevekinney](https://github.com/stevekinney)! - Raise the Svelte peer dependency floor to 5.56 and fix packed SvelteKit client hydration for public component exports.

### Patch Changes

- [#661](https://github.com/stevekinney/cinder/pull/661) [`96cad34`](https://github.com/stevekinney/cinder/commit/96cad34315a2cc4daa3b6ba53d7622bbb3316436) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep chat server bundles from pulling rich editor and markdown peer dependencies by default.

- [#660](https://github.com/stevekinney/cinder/pull/660) [`cfa3d5d`](https://github.com/stevekinney/cinder/commit/cfa3d5dcc7816a170339bf889276ab309d20288b) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix the published package manifest so Svelte-aware consumers resolve Cinder component source instead of compiled component output, while stripping TypeScript-only syntax from staged Svelte source files so Vite can optimize the package.

- [#663](https://github.com/stevekinney/cinder/pull/663) [`3fc860b`](https://github.com/stevekinney/cinder/commit/3fc860bd9cc3cc3640fbe43def3e1a726a23d3bf) Thanks [@stevekinney](https://github.com/stevekinney)! - Add skipped state support to Steps items.

- [#668](https://github.com/stevekinney/cinder/pull/668) [`ba2a5ba`](https://github.com/stevekinney/cinder/commit/ba2a5baa931b1549b2d4233f6f66c5b35a01e25b) Thanks [@stevekinney](https://github.com/stevekinney)! - Re-export paired component leaves from their parent subpaths and trim duplicate server metadata artifacts from the published package.

## 0.6.0

### Minor Changes

- [#638](https://github.com/stevekinney/cinder/pull/638) [`f0a6ac2`](https://github.com/stevekinney/cinder/commit/f0a6ac23c75a2ee8361f27a67649418452d550c3) Thanks [@stevekinney](https://github.com/stevekinney)! - Move rich editor, markdown rendering, and syntax-highlighting packages out of the base install path. Styles-only and lightweight component consumers no longer install Milkdown, ProseMirror, Shiki, remark, or rehype trees unless they opt into the rich feature surfaces.

  Consumers importing `@lostgradient/cinder/chat` with the default composer, `@lostgradient/cinder/markdown-editor`, `@lostgradient/cinder/review-editor`, `@lostgradient/cinder/markdown`, `@lostgradient/cinder/markdown/*`, `@lostgradient/cinder/editor`, `@lostgradient/cinder/editor/*`, `@lostgradient/cinder/commentary`, `@lostgradient/cinder/commentary/*`, `@lostgradient/cinder/highlighters/shiki`, or relying on `Chat` built-in markdown/tool message rendering or `CodeBlock` automatic highlighting should install the listed optional peer dependencies, including the public markdown AST type packages, for those rich features. `MarkdownEditor` and `ReviewEditor` are now subpath-only imports so the root barrel can stay usable without rich optional peers.

### Patch Changes

- [#646](https://github.com/stevekinney/cinder/pull/646) [`a5dc7c0`](https://github.com/stevekinney/cinder/commit/a5dc7c04cee27f18b20470f3d6edc669fcb9045e) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `ActionRow`, a selectable full-width button row primitive for master-detail lists, timelines, and sidebar selection surfaces.

- [#642](https://github.com/stevekinney/cinder/pull/642) [`a51a733`](https://github.com/stevekinney/cinder/commit/a51a733c8ef7a48719bded3b64c9e876ea2d68e5) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep the collapsible NavigationBar menu toggle grouped with trailing actions on narrow bars.

- [#643](https://github.com/stevekinney/cinder/pull/643) [`5322ca3`](https://github.com/stevekinney/cinder/commit/5322ca376874cf637b8bbb4649aa78b02fedd7e4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add SourceDiffViewer for bounded, accessible unified source patches.

## 0.5.0

### Minor Changes

- [#547](https://github.com/stevekinney/cinder/pull/547) [`68a194d`](https://github.com/stevekinney/cinder/commit/68a194df6fcb7a588cb10ff61a06f3252a091df3) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a new `InlineLoading` component for inline async-action lifecycle feedback (`inactive | active | finished | error`), with `description`, `iconDescription`, and `successDelay` props, polite live-region announcements, and auto-reset from `finished` back to `inactive`.

- [#546](https://github.com/stevekinney/cinder/pull/546) [`0f68943`](https://github.com/stevekinney/cinder/commit/0f6894361f609b99625d8217772f528c33a3f7d4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add the new `TableOfContents` component export, styles, schema, and examples to `@lostgradient/cinder`.

- [#545](https://github.com/stevekinney/cinder/pull/545) [`2c080cb`](https://github.com/stevekinney/cinder/commit/2c080cb77f7b6a6b3c9296adb553e335aa4f1b2b) Thanks [@stevekinney](https://github.com/stevekinney)! - Add new `QrCode` and `Marquee` components, including generated schemas/examples metadata and public exports.

- [#541](https://github.com/stevekinney/cinder/pull/541) [`423f785`](https://github.com/stevekinney/cinder/commit/423f785027dc03d261b72107cd67a8f138c2e77d) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a new `Meter` component for bounded measurements with `role="meter"` semantics, threshold-aware state mapping, generated docs/schema artifacts, and playground examples.

- [#543](https://github.com/stevekinney/cinder/pull/543) [`76516b8`](https://github.com/stevekinney/cinder/commit/76516b85660f084d5002c0f10a8c86800a47cd83) Thanks [@stevekinney](https://github.com/stevekinney)! - Add the new `BentoGrid` layout primitive with `BentoGrid.Cell`/`BentoCell` support for asymmetric span mosaics, plus generated docs/schema artifacts and playground examples.

### Patch Changes

- [#641](https://github.com/stevekinney/cinder/pull/641) [`ec89bc1`](https://github.com/stevekinney/cinder/commit/ec89bc11) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking CSS utility rename:** the icon sizing helpers exported from `@lostgradient/cinder/styles` and `@lostgradient/cinder/styles/utilities` are now namespaced as `.cinder-icon-xs`, `.cinder-icon-sm`, `.cinder-icon-md`, and `.cinder-icon-lg`. Cinder components use the namespaced utilities internally so application-level `.icon-*` classes cannot change component icon sizing. Consumer markup that used `.icon-xs`, `.icon-sm`, `.icon-md`, or `.icon-lg` should rename those classes to the matching `.cinder-icon-*` class.

- [#559](https://github.com/stevekinney/cinder/pull/559) [`9628078`](https://github.com/stevekinney/cinder/commit/96280780a150a69f74a3abfa60d9006fd2be3c6c) Thanks [@stevekinney](https://github.com/stevekinney)! - Align Chat's conversation model with the published `conversationalist` package instead of maintaining bespoke mirrored transcript types.

- [#577](https://github.com/stevekinney/cinder/pull/577) [`f4a9386`](https://github.com/stevekinney/cinder/commit/f4a938605a20ff0fdfe401f43db32248930af0e5) Thanks [@stevekinney](https://github.com/stevekinney)! - Preserve server component identity in the published SSR bundle so SvelteKit development SSR can render Cinder snippet content without crashing. Fixes [#572](https://github.com/stevekinney/cinder/issues/572) and [#573](https://github.com/stevekinney/cinder/issues/573).

- [#579](https://github.com/stevekinney/cinder/pull/579) [`a7be36a`](https://github.com/stevekinney/cinder/commit/a7be36ae001ffff5b81b7c134ccb2b01c177e526) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove an unused transitive dependency that produced TypeScript 6 peer warnings, and strengthen consumer validation to assert TypeScript 6 install compatibility.

- [#542](https://github.com/stevekinney/cinder/pull/542) [`3c0f267`](https://github.com/stevekinney/cinder/commit/3c0f267db9895a1797f761eb8b2cac83af23ecca) Thanks [@stevekinney](https://github.com/stevekinney)! - Add the new public `@lostgradient/cinder/multi-select` export with its docs/examples artifacts.

- [#544](https://github.com/stevekinney/cinder/pull/544) [`a9ee834`](https://github.com/stevekinney/cinder/commit/a9ee834c882246414a2bb610886762e6a62311b4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add Carousel, Footer, and MegaMenu as public components with generated exports,
  styles, docs artifacts, and playground examples.

## 0.4.1

### Patch Changes

- [#535](https://github.com/stevekinney/cinder/pull/535) [`fb757d1`](https://github.com/stevekinney/cinder/commit/fb757d1afb82f85457800ba0bb1561906c1a93ce) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix Node SSR export condition precedence so resolvers with both `node` and `svelte` active load compiled server artifacts instead of source entries.

## 0.4.0

### Minor Changes

- [#524](https://github.com/stevekinney/cinder/pull/524) [`680c499`](https://github.com/stevekinney/cinder/commit/680c499a8822882693f387f93f0eab9c086a12b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Add the alpha ApprovalCard component for durable human-in-the-loop tool approvals.

- [#475](https://github.com/stevekinney/cinder/pull/475) [`9349f11`](https://github.com/stevekinney/cinder/commit/9349f11e71874b3056f59a68609eb705ed185aca) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove write-back $effects from rating, pin-input, chat, and image-lightbox; fix schema-form schema-change reset.

  **No-write-back contract for rating and pin-input.** The `value` bindable in `Rating` and `PinInput` is no longer mutated back to the normalized/filtered value. The displayed and submitted value is derived internally via `$derived`, but the bound prop reflects exactly what the consumer set. Consumers relying on the binding being silently normalized should read from `onchange` instead.

  **Chat scroll/unread bindables now update via explicit callbacks.** The `isAtBottom`, `unreadCount`, and `hasNewMessageIndicator` bindables are maintained through the existing `onscrollstatechange`, `onunreadindicatorchange`, and `onReachBottom` callback paths — no $effect write-back. The `handleSubmit` path now also writes `isAtBottom = true` after `scrollState.setIsAtBottom(true)` so the binding stays current after the user sends a message.

  **SchemaForm schema-change now genuinely resets form state.** The internal form body has been extracted into a child component (`schema-form-body.svelte`). The outer component renders `{#key schema}<SchemaFormBody />` so that changing `schema` destroys and recreates the child — causing genuine `$state` recreation (formValue, errors, rawDrafts, arrayKeys, serializedValue) rather than only DOM reconciliation. Changing `value` with the same schema does NOT reset the form (seed-only contract, documented on the prop).

  **image-lightbox index reset.** The `previousOpen $state + $effect` write-back is replaced by a `navigationIndex` (null = no navigation yet) with `effectiveIndex = $derived(navigationIndex ?? clampedInitialIndex)`. Calling `close()` resets `navigationIndex` to null so the next open starts at `initialIndex` without any $effect.

- [#473](https://github.com/stevekinney/cinder/pull/473) [`51355f8`](https://github.com/stevekinney/cinder/commit/51355f83cf0d56f7ccaf3bec27a9c2c34d26006a) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking: `DataList` now requires a `key` extractor.** `DataListProps.key` was
  optional and silently fell back to an unkeyed `{#each}` block when omitted, which
  made a stable data-display primitive use index-based reconciliation for mutable
  lists (O(n) row churn and incorrect row instance reuse on insert/remove/filter/
  reorder). `key` is now required and the unkeyed fallback is removed. Consumers
  that omitted `key` must pass a stable extractor, e.g. `key={(item) => item.id}`.

  **Breaking: `Masonry.as` is narrowed to a layout-safe element union.** `as` was
  typed as any `string`, allowing void elements (`img`, `input`, `br`, `hr`) that
  cannot validly contain masonry children. It now accepts a `MasonryElement` union
  (`article | aside | div | footer | header | main | nav | section | ul | ol`).

- [#520](https://github.com/stevekinney/cinder/pull/520) [`7b0baa4`](https://github.com/stevekinney/cinder/commit/7b0baa4667907744d56973d49411edc6370e346d) Thanks [@stevekinney](https://github.com/stevekinney)! - Backfill missing component accessibility documentation, gate `.a11y.md` presence in `components:check`, and tighten DataGrid/DataTable audit fixes.

  DataGrid columns can now opt into `role="rowheader"` with `rowHeader: true`, virtualized-column overflow keeps a stable gutter and edge cue, and DataTable sortable headers describe the next sort action while focused rows receive the same hover affordance. The package also normalizes optional Svelte component function parameters so packed source remains valid for downstream SvelteKit consumers.

- [#524](https://github.com/stevekinney/cinder/pull/524) [`680c499`](https://github.com/stevekinney/cinder/commit/680c499a8822882693f387f93f0eab9c086a12b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Add EventStreamViewer reconnect replay markers and advisory sequence-gap markers.

- [#458](https://github.com/stevekinney/cinder/pull/458) [`731784d`](https://github.com/stevekinney/cinder/commit/731784d59ea655a469f596e7de4574e336c35c9b) Thanks [@stevekinney](https://github.com/stevekinney)! - Unify form-control consistency and accessibility, and rebuild `SchemaForm` on the
  real cinder components.

  **Required indicator.** Every form control now renders a visible required marker
  on its own `label`/`legend` — previously the asterisk only appeared when a control
  was wrapped in `FormField`, so `<Textarea required label="…">` silently showed no
  indicator. The marker is a shared, centered red asterisk (`*`, not a color-only
  dot) so the meaning is conveyed by glyph shape (WCAG 1.4.1). Screen readers rely
  on the native `required`/`aria-required` attribute, so there is no double
  announcement. Affects Input, Textarea, Select, NumberInput, Combobox, Autocomplete,
  Checkbox, PinInput, PhoneInput, CheckboxGroup, RadioGroup, FormField, and Label.

  **`SchemaForm` now composes cinder components** (Input, NumberInput, Select,
  Checkbox, Textarea) via Svelte 5 function-bindings instead of rendering raw HTML
  controls. Boolean fields render as a `Checkbox` (a deferred form boolean) rather
  than a bespoke switch. This removes all behavior/style drift between SchemaForm and
  the standalone controls.

  **Consistency fixes.** Combobox now inherits id/`aria-describedby`/`disabled` from a
  wrapping `FormField` and gained a `required` prop. Toggle inherits `disabled` from
  `FormField` context. Input and NumberInput now share the same ARIA resolver as the
  other controls (Input no longer drops a wrapping FormField's describedby id).
  CheckboxGroup sets `aria-required` to match RadioGroup. Select and Textarea labels
  gained their missing class/disabled styling.

  **Breaking changes:**
  - `ColorField`: `ariaLabel` → `aria-label`, `ariaLabelledby` → `aria-labelledby`.
  - `CheckboxGroup` and `RadioGroup`: the `legend` prop is renamed to `label` for
    consistency with every other form control (still rendered as a `<legend>`).

- [#476](https://github.com/stevekinney/cinder/pull/476) [`58072f7`](https://github.com/stevekinney/cinder/commit/58072f7b694a54a1704a7f78b0a0bce86aeff401) Thanks [@stevekinney](https://github.com/stevekinney)! - Idiom & developer-experience cleanups (audit [#468](https://github.com/stevekinney/cinder/issues/468)).

  **Breaking type rename.** `diff-viewer`'s exported `ViewMode` type is renamed to
  `DiffViewerMode` for a self-describing, collision-free public name. There is no
  compatibility alias (per the audit's no-shim requirement) — consumers importing
  `ViewMode` from `@lostgradient/cinder` or `@lostgradient/cinder/diff-viewer` must
  import `DiffViewerMode` instead.

  **Accessibility.** `CheckboxGroup` and `RadioGroup` now emit a development-only
  warning when they render a `<fieldset>` without an accessible group name
  (`<legend>`/label), matching the rest of the form-control suite.

  **Correctness.** The `run-step-timeline` rail uses logical positioning
  (`inset-inline-start`/`inset-block-start`/`inline-size`) so it lays out correctly
  in right-to-left contexts. Several icon-button hit areas were enlarged for touch.

  **Maintenance (no behavior change).** Svelte 4 lifecycle helpers migrated to
  `$effect`, hand-rolled `ResizeObserver` setups moved to the shared
  `useResizeObserver` utility, and `use:`-actions converted to `{@attach}`
  attachments. Form-control `error` props consistently include `undefined`.
  Review-editor types are consolidated into one authoritative module.

- [#477](https://github.com/stevekinney/cinder/pull/477) [`15a46b3`](https://github.com/stevekinney/cinder/commit/15a46b35247473b87beebbb2088795fc3352c9be) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking: PascalCase event-callback props renamed to lowercase.** Svelte 5 event
  props use the same lowercase syntax as DOM handler props (`onclick`, `ondismiss`),
  and cinder's convention is all-lowercase. The following public callback props are
  renamed to their lowercase forms across the affected components (alert, banner,
  capability-gate, collapsible, click-away-listener, data-grid, load-more,
  markdown-editor, media-controls, table, table-header, table-row, transfer-list,
  tree, tree-item):

  `onDismiss`→`ondismiss`, `onToggle`→`ontoggle`, `onReorder`→`onreorder`,
  `onPlay`→`onplay`, `onLoadMore`→`onloadmore`, `onSelectedChange`→`onselectedchange`,
  `onSelectionChange`→`onselectionchange`, `onFilterChange`→`onfilterchange`,
  `onPause`→`onpause`, `onReplay`→`onreplay`, `onLoadError`→`onloaderror`,
  `onRename`→`onrename`, `onChange`→`onchange`, `onClickAway`→`onclickaway`,
  `onSortChange`→`onsortchange`, `onSortModelChange`→`onsortmodelchange`,
  `onSelectionModelChange`→`onselectionmodelchange`, `onReady`→`onready`.

  Each renamed callback keeps the same payload arguments and invocation timing. No
  compatibility aliases are provided — update call sites to the lowercase names.

  The stable-promotion `PROP_NAME_DENYLIST` is now compared case-insensitively for
  `on*` props, so a PascalCase event-callback prop can no longer slip past the gate.

- [#524](https://github.com/stevekinney/cinder/pull/524) [`680c499`](https://github.com/stevekinney/cinder/commit/680c499a8822882693f387f93f0eab9c086a12b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Enhance RunStepTimeline with waiting-approval state, nested child lanes, step links, and action counts.

- [#524](https://github.com/stevekinney/cinder/pull/524) [`680c499`](https://github.com/stevekinney/cinder/commit/680c499a8822882693f387f93f0eab9c086a12b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Promote the Stardust agent-operations components based on promotion-gate evidence.

  `EventStreamViewer`, `PayloadInspector`, and `SecretValueField` are now marked stable. `InvocationRuleBuilder` is now marked beta after passing the same readiness gate with tests, accessibility coverage, and prop-name checks passing.

  `SecretValueField` also now uses Svelte's explicit untracked initial-state capture for `initiallyRevealed`, preserving its initial-only behavior while avoiding a local-state warning.

- [#478](https://github.com/stevekinney/cinder/pull/478) [`0302908`](https://github.com/stevekinney/cinder/commit/03029085e54dcc3344d568821e553340f70d17fc) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking: unify public API vocabulary across components.** Several public APIs
  used different words for the same concept; this standardizes them. No compatibility
  aliases are provided (per the audit's no-shim requirement) — update call sites.
  - **Severity spelling.** `alert` and `status-dot` drop the `error` value in favor of
    `danger`, the canonical failure-severity spelling already used by `banner` and
    `callout`. Use `variant="danger"` (Alert) / `status="danger"` (StatusDot) instead
    of `"error"`.
  - **Accessible-name props.** `ariaLabel` / `navAriaLabel` are renamed to `label` on
    `sidebar`, `scroll-area`, `navigation-bar`, and `dropdown-group`; `StatChange.ariaLabel`
    becomes `StatChange.label`.
  - **Chat boolean props.** `isAtBottom` → `atBottom`, `hasNewMessageIndicator` →
    `newMessageIndicatorVisible`, `isStreaming` → `streaming`, `hasMoreHistory` →
    `moreHistoryAvailable`. The per-feature `allow*` flags (`allowAttachments`,
    `allowSearch`, `allowCopy`, `allowEditing`, `allowRetry`) are grouped into a single
    `capabilities` object prop.
  - **FloatingActionButton visual API.** `color` → `variant` (the palette) and
    `variant` → `shape` (filled/extended). The exported types rename accordingly:
    `FloatingActionButtonColor` → `FloatingActionButtonVariant` and the old
    `FloatingActionButtonVariant` → `FloatingActionButtonShape`.

  Generated schemas, README tables, examples, and package exports are updated to match.

### Patch Changes

- [#470](https://github.com/stevekinney/cinder/pull/470) [`644a646`](https://github.com/stevekinney/cinder/commit/644a646edccd03cc6f4394c1ed532643101083b0) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `@media (forced-colors: active)` focus-ring fallbacks to nine components whose `:focus-visible` ring relied exclusively on `box-shadow` — which Windows High Contrast Mode (forced-colors) removes. Keyboard focus was invisible in HCM for users of CapabilityGate, KanbanBoard, MediaControls, PermissionMatrix, ShareCard, TransferList, Table, MenuBar, and ChatConversationList.

  Each fallback repaints the outline with `ButtonText` at the correct offset for the control type: `3px` for bordered controls (separates the ring from `ButtonBorder`, which shares the `ButtonText` color family in HCM), `2px` for borderless controls, and an inset `calc(-1 * var(--cinder-ring-width))` for the TransferList scrollable panel (which has `overflow: auto` — a positive offset would be clipped). Each fallback also sets `box-shadow: none` explicitly so forced-colors suppression is unambiguous across engines.

  A new Stylelint rule (`cinder/require-forced-colors-focus-fallback`) is wired into root `.stylelintrc.json` and into the test suite, so any future `:focus-visible` rule that relies on `box-shadow` without a matching forced-colors fallback will fail linting.

## 0.3.0

### Minor Changes

- [#368](https://github.com/stevekinney/cinder/pull/368) [`4e5847e`](https://github.com/stevekinney/cinder/commit/4e5847e7ec6e5960bda464c998c9f2701f29f88c) Thanks [@stevekinney](https://github.com/stevekinney)! - Enrich the component manifest (`components.json`) with structured accessibility metadata and restructure `avoidWhen` guidance.
  - `avoidWhen` entries change from flat strings to `{ reason, alternative? }` objects, where `alternative` is the kebab-case id of the component to reach for instead. Authored as `@avoidWhen <reason> | <kebab-id>` (the alternative is optional). This is a breaking change to the published manifest schema for external consumers that read `avoidWhen`.
  - New optional `a11y` metadata per component (`{ pattern?, keyboard?, notes? }`), authored via `@a11yPattern`, `@keyboardShortcut <keys> | <action>`, and `@a11yNote` JSDoc tags. Components without these tags omit the field entirely.

  The manifest generator now also fails if an `avoidWhen.alternative` does not resolve to a real component id.

- [#439](https://github.com/stevekinney/cinder/pull/439) [`a4a414d`](https://github.com/stevekinney/cinder/commit/a4a414dba7d8a714ea8971c5c7ddd5f30c5f2cbd) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking:** Removed `TimelineItem` from the public API. The
  `@lostgradient/cinder/timeline-item` import path (and its `/schema`,
  `/variables`, `/styles` subpaths) and the top-level `TimelineItem` /
  `TimelineItemProps` exports are gone.

  `TimelineItem` is now an internal implementation detail of `Timeline` — compose
  `Timeline` (which renders its items for you) instead of building a rail out of
  bare `TimelineItem`s. The public timeline surface is `Timeline` and
  `RunStepTimeline`, which model distinct domains (an entries-driven event rail vs.
  async run/step state).

- [#428](https://github.com/stevekinney/cinder/pull/428) [`5d0a325`](https://github.com/stevekinney/cinder/commit/5d0a32506b97b51b5955917dda7c2898dceb5d74) Thanks [@stevekinney](https://github.com/stevekinney)! - Retune the color palette around an indigo brand, polish the command-palette and timeline, and remove the previously-deprecated experimental-timeline aliases (a pre-1.0 export-map removal shipping in this minor — see the migration note below).

  **Palette (visible default change for every consumer):**
  - Brand accent is now indigo (hue 270) and carries white labels in light mode. `--cinder-accent` moves to `oklch(50% 0.22 270)` (light) / `oklch(72% 0.14 270)` (dark) and `--cinder-accent-contrast` flips to white in light mode — primary buttons, the active command-palette item, and every solid accent fill show white text on indigo (6.45:1, clears WCAG AA). `--cinder-accent-text` (links/icons) and the focus ring re-hue automatically; the ring's light-arm lightness clamp drops 0.58 → 0.55 so the indigo ring keeps ≥3:1 (WCAG 1.4.11) on near-white surfaces.
  - Info status nudged hue 245 → 230 so the blue "info" state no longer competes with the indigo brand.
  - The 8 categorical chart series are retuned: brand-safe (no hue in 248–292) and strongly distinguishable in normal vision (min CIEDE2000 ΔE00 ≥ 12). Each arm additionally keeps a minimum pairwise CIE L\* separation of ≥ 4 so lightness stays a usable secondary distinguishing channel when hue contrast degrades for color-vision-deficient viewers. The light and dark arms are tuned independently for in-theme contrast and gamut, so a series is not guaranteed the same hue across themes.
  - Status fills (success/warning/danger) refitted to the sRGB gamut — several were authored over-chroma and silently clamped (warning especially). The danger button's hover and active states are now authored explicitly instead of derived by darkening the fill at constant chroma: red sits near the gamut boundary, so the old constant-chroma derivation clamped the pressed/hover states to a duller red than specified. Each light-arm state is now pinned to its in-gamut chroma maximum, so the darkening is both monotonic and exactly rendered (white labels stay ≥ 6.7:1).
  - A new gate, `check-token-contrast.test.ts` (`bun run colors:contrast`), parses the actual token values and asserts WCAG contrast, sRGB-gamut integrity, and chart distinguishability so the palette can't silently regress.

  **Command palette:** the search input no longer carries its own 3px focus ring (it read as a stray floating box around the edgeless input). Keyboard focus is now indicated by the search row's bottom border recoloring to the ring color on `:focus-within`; the border is reserved at 2px at rest so focusing causes no layout shift.

  **Timeline:** the connector line now runs continuously from each marker's center to the next marker's center, instead of leaving stubby gaps that didn't reach the dots. The geometry is derived from the marker's center coordinates — the marker is a fixed-size box (`--_cinder-timeline-marker-size`) that custom `marker` snippets fill rather than resize — so the line meets the dot in the default and custom-marker examples alike. The previous fixed-offset calibration left the line short of the next dot.

  **Migration — removed the previously-deprecated `@lostgradient/cinder/experimental/timeline` and `@lostgradient/cinder/experimental/timeline-item` export paths.** These aliases were deprecated once the stable paths shipped; removing them pre-1.0 ships as a minor (no major bump). Import from `@lostgradient/cinder/timeline` and `@lostgradient/cinder/timeline-item` instead.

- [#367](https://github.com/stevekinney/cinder/pull/367) [`c6764d0`](https://github.com/stevekinney/cinder/commit/c6764d04a42547ee2b788bad41d6b1112a5d650c) Thanks [@stevekinney](https://github.com/stevekinney)! - Add seven operational components for agent/workflow tooling: `FacetedFilterBar`
  ([#352](https://github.com/stevekinney/cinder/issues/352)), `EventStreamViewer` ([#354](https://github.com/stevekinney/cinder/issues/354)), `PayloadInspector` ([#355](https://github.com/stevekinney/cinder/issues/355)), `RunStepTimeline`
  ([#356](https://github.com/stevekinney/cinder/issues/356)), `DateRangeField` ([#357](https://github.com/stevekinney/cinder/issues/357)), `SecretValueField` ([#359](https://github.com/stevekinney/cinder/issues/359)), and
  `InvocationRuleBuilder` ([#360](https://github.com/stevekinney/cinder/issues/360)). Also adds operational-payload examples to
  `JsonViewer` ([#358](https://github.com/stevekinney/cinder/issues/358)).

### Patch Changes

- [#414](https://github.com/stevekinney/cinder/pull/414) [`77ec914`](https://github.com/stevekinney/cinder/commit/77ec91420c5f7fe91b45882e2007a83a0871d619) Thanks [@stevekinney](https://github.com/stevekinney)! - Resolve component-side findings from the keyboard/ARIA accessibility audit ([#382](https://github.com/stevekinney/cinder/issues/382), [#377](https://github.com/stevekinney/cinder/issues/377), [#383](https://github.com/stevekinney/cinder/issues/383)).
  - **`Autocomplete`, `Combobox`, `Dropdown`** — the keyboard-active option in floating lists is now an unambiguous, WCAG 1.4.11-clearing indicator. Two parts: (1) `Autocomplete` previously pinned its active-row background to `--cinder-surface-raised` — the exact token the floating panel uses for its own background — so the highlight disappeared in light mode; that component-local override is removed so the row inherits the shared treatment. (2) The shared `.cinder-_option-row[data-cinder-active]` rule now adds an inset `--cinder-ring-color` keyboard-cursor ring on top of the `--cinder-surface-hover` background. The background tint alone is a deliberately subtle ~1.1:1 step (fine for pointer hover) but fails the 3:1 non-text-contrast floor for the _sole_ keyboard-position indicator; the ring clears it in both themes. The ring is scoped to the keyboard cursor (`data-cinder-active`), keeping it visually distinct from a committed `aria-selected` choice, and falls back to a `forced-colors` `outline: Highlight`. This applies to every floating list built on `.cinder-_option-row` (Autocomplete, Combobox, Dropdown).
  - **`Avatar`** — documented that a placeholder-only avatar (no `src`, no `name`) renders a decorative `aria-hidden` placeholder and has no accessible name; consumers that need such a slot announced (e.g. an "unassigned" avatar) can pass `aria-label` through the forwarded rest props, which lands on the root element. No behavior change.
  - **`DiffStatistics`** — clarified the `variant` prop description (`default` shows full statistic markup; `compact` trims it for tight surfaces) and distinguished it from the separate `density` prop, which adjusts control height.

- [#421](https://github.com/stevekinney/cinder/pull/421) [`7aa96e4`](https://github.com/stevekinney/cinder/commit/7aa96e4251589a24f31d0d118d7775950b5a6e06) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix the component-example generator's metadata extraction so escaped delimiters
  and line continuations inside an example's `title`/`description` string literal
  no longer truncate the value or leak the `<script module>` block into the
  published `code` field ([#420](https://github.com/stevekinney/cinder/issues/420)). The extraction grammar is now escape-aware and
  the parsed value is decoded to its true string. No existing example artifact
  changes — this only affects future examples whose metadata contains an escape
  sequence.

- [#428](https://github.com/stevekinney/cinder/pull/428) [`5d0a325`](https://github.com/stevekinney/cinder/commit/5d0a32506b97b51b5955917dda7c2898dceb5d74) Thanks [@stevekinney](https://github.com/stevekinney)! - Tame the overlay entrance/exit motion. The shared `--cinder-ease-spring` timing function was a back-ease (`cubic-bezier(0.34, 1.56, 0.64, 1)`) whose `y1` control point of `1.56` overshot to 156% of the animated travel before settling. On `Sheet` and `Drawer` — where the panel translates a full 100% of its own width/height — that overshoot flung the panel well past the viewport edge mid-transition. `Modal` and `CommandPalette` (which share the token) showed the same pop on a smaller scale. The token is now a settled ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`): the same snappy decelerate-in feel with no overshoot, so overlays slide cleanly to rest. No API change.

- [#412](https://github.com/stevekinney/cinder/pull/412) [`ed74f22`](https://github.com/stevekinney/cinder/commit/ed74f2228f933cda5f8219237765e738ffd848f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Add descriptions for previously-undocumented public props so every prop now renders a Description in its generated README table and JSON schema ([#373](https://github.com/stevekinney/cinder/issues/373)). Documentation only — no runtime or type-shape changes.

- [#410](https://github.com/stevekinney/cinder/pull/410) [`52efdcf`](https://github.com/stevekinney/cinder/commit/52efdcfecb06e4a93c280c85dfeb5373e85b4ba6) Thanks [@stevekinney](https://github.com/stevekinney)! - Correct generated schema/documentation prop surfaces flagged in the component audit ([#393](https://github.com/stevekinney/cinder/issues/393)).
  - **`Textarea`** — `required` and `maxlength` now appear as first-class typed props (`boolean` / `number`) in the schema and README props table instead of being silently dropped as inherited HTML attributes. Both already drive component behavior (form validation wiring and the `showCount` character counter).
  - **`Timeline`** — the internal `role` escape-hatch is now typed `never` instead of `unknown`, matching the public contract (which omits `role` so consumers cannot clobber the `<ol>`'s implicit `list` role). No public API change.
  - **`TreeItem`** — replaced a leaked internal note ("see tree.svelte plan for rationale") on the `branch` prop with a consumer-facing description of branch semantics.

  Also regenerates schema artifacts that had drifted from their source types on `main`, surfacing two props that were already accepted but undocumented:
  - **`AvatarGroup`** — `label` (`string`, default `"Collaborators"`) now appears in the schema and README as the accessible name for the avatar stack.
  - **`Popover`** — `closeOnEscape` (`boolean`, default `true`) now appears in the schema and README; it controls whether Escape closes the Popover (set `false` when a parent composite widget owns Escape for the whole interaction).

- [#436](https://github.com/stevekinney/cinder/pull/436) [`4a68b09`](https://github.com/stevekinney/cinder/commit/4a68b09108bdf9b3501f730293631c286840d6ef) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix two component CSS defects surfaced by the playground:
  - **Timeline connector** now spans each marker's center to the next marker's
    center instead of stopping `space-1` short, so the rail reads as one
    continuous line through the dots rather than disconnected stubs (notably with
    custom marker snippets). The connector's `bottom` offset now accounts for the
    marker's own `margin-top` inside the next event grid.
  - **Code block** no longer renders per-token background bands in dark mode. The
    generated `<code>` element (and Shiki line/token spans) are forced transparent
    so the single `<pre>` surface shows through as one uniform field; only token
    foreground colors apply. The header copy button also gains real button
    affordance — a 28px-square hit target (clearing WCAG 2.5.8) with a subtle
    resting chip background — instead of a bare floating glyph.

## 0.2.0

### Minor Changes

- API-ergonomics refinements across several components ([#328](https://github.com/stevekinney/cinder/issues/328), resolving [#307](https://github.com/stevekinney/cinder/issues/307), [#309](https://github.com/stevekinney/cinder/issues/309), [#315](https://github.com/stevekinney/cinder/issues/315)). All additive and backward-compatible.
  - **Card `padding="none"`** — removes body padding for full-bleed content, replacing the consumer workaround that reached into the internal `.cinder-card__body` class. Stamps `data-cinder-padding` on the body.
  - **`Dropdown.Item` polymorphism** — renders `<a href>` when `href` is present and lets `type="submit"` flow to the `<button>`. Shared event handlers are typed at the `HTMLElement` base so existing button consumers with inline handlers keep typechecking; `role="menuitem"`, roving `tabindex`, and close-on-select are preserved on both branches.
  - **Alert `variant="danger"`** — an additive alias for `error`.
  - **NavigationBar** type refinements, **Badge `mono`**, and additional **StatusDot** statuses.

- `Button` now forwards the popup-trigger ARIA attributes `aria-expanded`, `aria-controls`, and `aria-haspopup` ([#306](https://github.com/stevekinney/cinder/issues/306)), so a button that opens a menu, dialog, or disclosure can be wired up without reaching past the component's prop surface.

- Add the `ChoiceGrid` compound component ([#332](https://github.com/stevekinney/cinder/issues/332), resolving [#318](https://github.com/stevekinney/cinder/issues/318)).

  A responsive grid of large selectable choices with roving keyboard focus, single/multi-select, and correct/incorrect/pending feedback states — for quiz, assessment, and answer-selection surfaces. `ChoiceGrid` composes `ChoiceGrid.Item` via context. Single-select renders a `radiogroup` (arrow keys move selection, per WAI-ARIA); multi-select renders a `group` of checkboxes (arrows move focus only). Disabled items are skipped by both focusable-item computation and arrow navigation. Supports `columns="responsive"` (auto-fill) or a fixed 1–4.

- Add `DataTable`, `PricingCard`, and `SubscriptionBadge` components ([#340](https://github.com/stevekinney/cinder/issues/340), resolving [#334](https://github.com/stevekinney/cinder/issues/334)–[#336](https://github.com/stevekinney/cinder/issues/336)).
  - **DataTable** — a data-driven `<DataTable rows columns caption />` wrapper over the compositional Table family: sortable columns (reusing Table's bindable `sort` + `aria-sort`), a horizontal-scroll responsive container, and `<th scope="row">` row-header semantics via a new additive `as?: 'td' | 'th'` prop on `TableCell` (default `'td'`, so existing consumers are unchanged).
  - **PricingCard** — a plan tile with name, price, feature list, an optional consumer-supplied caveat line, and a selectable state shown with both accent treatment and a visible "Selected" text flag (WCAG 1.4.1). The CTA is a real cinder `Button`.
  - **SubscriptionBadge** — an opinionated `Badge` variant for the six billing states.

- Add `MatrixChart` and the signal-visualization chart components ([#333](https://github.com/stevekinney/cinder/issues/333), resolving [#319](https://github.com/stevekinney/cinder/issues/319) and [#324](https://github.com/stevekinney/cinder/issues/324)).
  - **MatrixChart** — a categorical × categorical heatmap (confusion matrices, correlation grids) with sequential and zero-centered diverging color scales, cell + axis labels, and an accessible data-table fallback. Sparse/missing and non-finite cells render predictably as "missing".
  - **Waveform** — time-domain amplitude as a path or bars, with min/max-envelope downsampling for large buffers.
  - **SpectrumChart** — frequency-bin magnitude bars with a zero-guarded real max.
  - **Spectrogram** — a time × frequency heatmap.

  All reuse the shared `_internal/chart` infrastructure (palette, formatting, accessible fallback) plus a new shared `_internal/chart/heatmap-utilities`.

- Add `MediaControls`, `CapabilityGate`, `ShareCard`, `KeyboardShortcuts`, and `ShortcutHint` components ([#339](https://github.com/stevekinney/cinder/issues/339), resolving [#320](https://github.com/stevekinney/cinder/issues/320)–[#323](https://github.com/stevekinney/cinder/issues/323)).
  - **MediaControls** — accessible play/pause/replay with optional progress; the play/pause control is a stable-label `aria-pressed` toggle, with distinct loading and unavailable states and both compact icon-only and expanded layouts.
  - **CapabilityGate** — presents a feature's availability (supported / unsupported / permission-needed / permission-denied / loading / unavailable) with primary, fallback, and dismiss actions, backed by a `role="status"` live region carrying `aria-busy`.
  - **ShareCard** — copy-link / copy-text / native `navigator.share` with a graceful copy fallback; user-cancel (`AbortError`) is silent.
  - **KeyboardShortcuts** and **ShortcutHint** — keyboard-shortcut discovery surfaces.

- Add the `SkipLink` (skip-to-content) component ([#329](https://github.com/stevekinney/cinder/issues/329), resolving [#308](https://github.com/stevekinney/cinder/issues/308)).

  A composed skip-to-content primitive that owns the non-obvious focus management internally: the tabindex save → focus → restore-on-blur dance, `prefers-reduced-motion` handling, and a native-anchor-jump fallback when the target id is absent. Composes over `VisuallyHidden` (`as="a"`, `focusable`). The prop surface is intentionally minimal (`target`, `children`, `class`).

- [#312](https://github.com/stevekinney/cinder/pull/312) [`dd69bba`](https://github.com/stevekinney/cinder/commit/dd69bba51e4784a0051b9fa5cfc9f9992dbe413c) Thanks [@stevekinney](https://github.com/stevekinney)! - Visual-token refinement that improves light/dark separation and accent legibility, plus six new semantic alias tokens.
  - **Accent reads more like ink.** `--cinder-accent` is now `light-dark(oklch(66% 0.16 195), oklch(78% 0.13 195))` — the light arm darkens from the previous bright cyan toward a more ink-like read (its foreground contrast improves from ~2:1 to ~2.7:1, though it still uses the dedicated `--cinder-accent-text` token for foreground use), and the dark-arm chroma calms from 0.15 to 0.13 to stop the cyan vibrating. As a fill it carries the dark-ink `--cinder-accent-contrast` label at ~7.2:1. Because `--cinder-accent-hover` and `--cinder-accent-active` derive from `--cinder-accent` with `oklch(from …)`, both hover and active states re-derive automatically. `--cinder-accent-text` keeps its dark-arm chroma in lockstep at 0.13.
  - **New `--cinder-accent-active-on-fill` token keeps pressed primary buttons AA-legible.** Darkening the base accent dropped the general `--cinder-accent-active` (a `−0.15` lightness step → `L=0.51`) to ~4.09:1 for the dark-ink label on a pressed primary `Button`/`FloatingActionButton`, below WCAG AA. The new token uses a gentler `−0.11` step (light `L=0.55` ~4.79:1, dark ~7.1:1); those two components now consume it for their pressed fill. `--cinder-accent-active` is unchanged for every other consumer.
  - **Wider dark surface ladder.** The dark elevation steps now run 15 → 20 → 26 → 11 (`--cinder-surface-raised` 24% → 26%, `--cinder-surface-inset` 12% → 11%); `--cinder-bg` and `--cinder-surface` are unchanged.
  - **Stronger borders in both arms.** `--cinder-border` becomes `light-dark(oklch(79% 0.013 245), oklch(40% 0.05 245))` for a more defined edge against surfaces.
  - **Deeper small elevation.** `--cinder-shadow-sm` gains a second hairline layer and higher alphas in both arms; `--cinder-shadow-md` and `--cinder-shadow-lg` raise their dark-arm alphas (light arms unchanged).
  - **Disabled text holds AA against the widened dark surfaces.** `--cinder-text-disabled` dark arm moves from 62% to 64% so disabled labels keep ≥4.5:1 on the lifted dark `--cinder-surface-raised` (a disabled RadioGroup legend would otherwise drop to ~3.6:1).
  - **Six new semantic alias tokens** (additive, public) that express intent over the raw scale: `--cinder-pad-control`, `--cinder-pad-card`, `--cinder-gap-stack`, `--cinder-gap-inline`, `--cinder-radius-control`, and `--cinder-radius-surface`.

### Patch Changes

- Fix the `AvatarGroup` trigger focus ring ([#331](https://github.com/stevekinney/cinder/issues/331)) — restore the ring by replacing an invalid offset token with `--cinder-ring-offset` plus a fallback.

- Add keyboard focus rings to chart marks. Area, bar, and line charts now render an SVG focus ring on keyboard focus (driven by the shared `_internal/chart/chart-focus-ring` helper) and respond to the pointer-vs-keyboard focus modality, so the ring shows for keyboard navigation without flashing on click.

- Promote the transparency-checkerboard colors to public theme-aware tokens ([#330](https://github.com/stevekinney/cinder/issues/330)). The color picker, color field, and swatch picker now repoint their alpha checkerboards to the shared tokens, and the color-picker thumb keeps its dark-contrast edge across themes with an added dark-mode support ring.

- Normalize domain/editor focus indicators ([#313](https://github.com/stevekinney/cinder/issues/313)). Chat, review-editor, diff-viewer, and markdown-editor surfaces now use the shared focus-ring recipe (`--_cinder-focus-ring-shadow`) instead of hand-rolled `box-shadow` rings, with documented inset variants where dense-surface geometry would otherwise clip the outer ring.

- Packaging fixes for consumers ([#327](https://github.com/stevekinney/cinder/issues/327), resolving [#311](https://github.com/stevekinney/cinder/issues/311) and [#314](https://github.com/stevekinney/cinder/issues/314)).
  - **`lucide-svelte` is now a peer dependency** (`>=0.400.0 <1`) instead of a regular dependency, so consumers use their own copy rather than a nested duplicate. It stays a devDependency so cinder's own build, tests, and playground still resolve the icons it imports.
  - **`types` condition on the CSS-only style subpaths** (`./styles`, `./styles/all`, `./styles/tokens`, `./styles/foundation`, `./styles/utilities`) — a side-effect `import '@lostgradient/cinder/styles'` now resolves types correctly under `moduleResolution: bundler` (the SvelteKit default).

## 0.1.1

### Patch Changes

- Harden the release pipeline (no library/runtime changes):
  - `verify-release-version.ts` now prefers `TAG_NAME` over `GITHUB_REF_NAME`, so a `workflow_dispatch` release no longer needs a tag-ref workaround to pass the version check.
  - Pin Bun to `1.3.13` in `release.yaml` and `release-manual.yaml` (was the stale `1.3.2`), aligning them with the rest of CI and fixing the `dequal` bundler "Multiple files share the same output path" collision.
  - Disable npm provenance consistently in both `NPM_CONFIG_PROVENANCE` and `publishConfig.provenance`, since `npm publish` runs under Bun's BoringSSL which fails provenance signing (`ERR_OSSL_NO_DEFAULT_DIGEST`).

## 0.1.0

### Major Changes

- [#260](https://github.com/stevekinney/cinder/pull/260) [`f47aac5`](https://github.com/stevekinney/cinder/commit/f47aac589f31eb98fcdadaf36a00d83a756f2fd3) Thanks [@stevekinney](https://github.com/stevekinney)! - Chat: vendor the conversation data model and drop the `conversationalist` dependency.

  Chat now defines its own conversation/message/tool types (`cinder/chat` exports `ConversationHistory`, `Message`, `ToolCall`, `ToolResult`, `ToolCallPair`, etc.) and ships small builders (`createConversation`, `appendUserMessage`, `appendAssistantMessage`, `appendMessages`). The vendored types are a faithful structural mirror of `conversationalist`'s shapes, so a `conversationalist` `Message` or an `armorer` tool call/result satisfies them with no adaptation.

  **Breaking:** `ChatProps.conversation` is now `ConversationHistory` (a plain transcript snapshot) instead of `conversationalist`'s `Conversation`. If you use `conversationalist`, its `Conversation` class exposes the snapshot via its `.current` getter (`<Chat conversation={conversation.current} />`) — the shapes are structurally compatible, so no mapping is needed.

  Also in this change:
  - The tool-call message role is now `'tool-call'` (was `'tool-use'`).
  - Tool-result errors render the structured `error.message` instead of `[object Object]`, and `action_required` outcomes now render a distinct state with the requested action's message.
  - The public `Chat` component now forwards the imperative streaming + scroll API — `beginStreaming(messageId)`, `pushToken(token)`, `endStreaming()`, `scrollToBottom()`, `scrollToTop()`, `focusInput()` — so consumers can drive token-by-token streaming through a `bind:this` to `<Chat>` (additive; previously these lived only on the unexported inner implementation).

- [#209](https://github.com/stevekinney/cinder/pull/209) [`f9e424c`](https://github.com/stevekinney/cinder/commit/f9e424c45e254f72ccf29c9da88b27e642919564) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking: `<CinderProvider>` is removed; `<CodeBlock>` highlights automatically.**

  `<CinderProvider>` and `CinderProviderProps`, plus the `cinder/cinder-provider`,
  `cinder/cinder-provider/schema`, and `cinder/cinder-provider/variables` subpath
  exports, are gone. `<CodeBlock>` now highlights itself: set a `language` and it
  lazy-loads the bundled `cinder/highlighters/shiki` adapter on the client and
  highlights with no provider and no wiring. Highlighting is a two-phase,
  client-only enhancement — the server emits the plain `<pre><code>` fallback and
  the client swaps in highlighted HTML once Shiki resolves.

  Trade-off: the provider's one capability — scoping a single custom (non-Shiki)
  highlighter to a whole subtree — is gone. The common case (Shiki, default
  theme) now requires zero configuration; a custom highlighter is passed
  per-instance via the new `highlighter` prop instead.

  **Migration:**

  ```svelte
  <!-- before -->
  <script lang="ts">
    import { CinderProvider, CodeBlock } from 'cinder';
    import { shikiHighlighter } from 'cinder/highlighters/shiki';

    const highlighter = shikiHighlighter();
  </script>

  <CinderProvider {highlighter}>
    <CodeBlock {code} language="ts" />
  </CinderProvider>
  ```

  ```svelte
  <!-- after: the common case needs nothing — CodeBlock auto-loads Shiki -->
  <script lang="ts">
    import { CodeBlock } from 'cinder';
  </script>

  <CodeBlock {code} language="ts" />
  ```

  ```svelte
  <!-- after: a custom highlighter is now per-instance via the `highlighter` prop -->
  <script lang="ts">
    import { CodeBlock } from 'cinder';
    import { shikiHighlighter } from 'cinder/highlighters/shiki';

    const highlighter = shikiHighlighter({ theme: 'github-light' });
  </script>

  <CodeBlock {code} language="ts" {highlighter} />
  ```

  New `<CodeBlock>` props:
  - `highlighter?: Highlighter` — a custom highlighter for this instance, used in
    place of the bundled default. Its output is rendered **verbatim via `{@html}`**
    and must escape any user-provided `code` (cinder only guarantees the bundled
    Shiki default's output is escaped).
  - `highlight?: boolean` — defaults to `true` whenever `language` is set.
    `highlight={false}` is an absolute off switch: it disables all highlighting
    (including an explicit `highlighter`), triggers no Shiki import, and renders
    the escaped plain `<pre><code>` fallback while keeping the `language` label.

  **Rollback:** this ships as a single atomic commit (deletion, CodeBlock change,
  docs, and generated artifacts), so reverting that one commit restores the
  previous state in full.

- [#272](https://github.com/stevekinney/cinder/pull/272) [`ace7c34`](https://github.com/stevekinney/cinder/commit/ace7c34978cfec705bf7206507213f2f58c8365c) Thanks [@stevekinney](https://github.com/stevekinney)! - Breaking: `Message` replaces the single `time` prop with `datetime` and `timestamp`.

  The old `time` prop was placed on both the machine-readable `<time datetime>`
  attribute and the visible text, so a human label like `"9:41 AM"` produced an
  invalid `datetime` value. Now:
  - `datetime` — the machine-readable value for the `<time datetime>` attribute
    (e.g. `"2026-04-29T09:41"`).
  - `timestamp` — the human-readable display text. Falls back to `datetime` when
    omitted.

  Migration: replace `time="9:41 AM"` with
  `datetime="2026-04-29T09:41" timestamp="9:41 AM"`. If you were already passing a
  valid ISO value, `datetime="…"` alone is sufficient.

  Also: `Message` now forwards native HTML attributes (`id`, `data-*`, `aria-*`,
  etc.) to its root `<article>`. Component-controlled attributes (`data-cinder-role`,
  `class`) cannot be clobbered.

- [#170](https://github.com/stevekinney/cinder/pull/170) [`5238aab`](https://github.com/stevekinney/cinder/commit/5238aabe5273b6235b679ef6488e4570b971546b) Thanks [@stevekinney](https://github.com/stevekinney)! - Breaking: StatusDot status `"building"` renamed to `"pending"`. Update `status="building"` → `status="pending"`. The dot color is unchanged (still info-blue) — only the status token name changed.

### Minor Changes

- [#276](https://github.com/stevekinney/cinder/pull/276) [`ba665e0`](https://github.com/stevekinney/cinder/commit/ba665e0f122bae181da46c5fced39fa6090a3f72) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `ClickAwayListener` — a headless utility that calls `onClickAway` when the user
  presses a pointer (mouse or touch) outside its subtree.
  - Listens on `pointerdown` (covers mouse + touch), falling back to `mousedown` +
    `touchstart` on browsers without the Pointer Events API.
  - `enabled` (default `true`) detaches the listener without unmounting.
  - Headless — renders only a wrapper element around its `children`, no styling.

  Use it for custom inline-edit fields, custom dropdowns, or any overlay that should
  dismiss on outside interaction. Popover, Dropdown, and Modal already handle this
  internally.

- [#275](https://github.com/stevekinney/cinder/pull/275) [`f62b5a4`](https://github.com/stevekinney/cinder/commit/f62b5a483c88f7de6c60ce581f9dca49d16923f1) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `FloatingActionButton` (FAB) — a circular button for the single most important
  action on a screen.
  - `variant`: `'filled'` (circular) | `'extended'` (pill with icon + label).
  - `size`: `'sm'` | `'md'` | `'lg'`; `color`: `'primary'` | `'secondary'` | `'surface'`.
  - Renders a `<button type="button">`, or an `<a>` when `href` is passed. A disabled
    link withholds its `href` and is removed from the tab order so it can't navigate.
  - Requires an accessible name (`aria-label`/`aria-labelledby`, or `children`); emits a
    dev-mode warning when one is missing.
  - Does not manage positioning — wrap it in your own fixed/sticky container.

- [#274](https://github.com/stevekinney/cinder/pull/274) [`899b7ee`](https://github.com/stevekinney/cinder/commit/899b7eefadc252276fd12e9dbc6b32c9247d43e4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add Link — inline text link (typography) with configurable underline behavior and color, external link safety, and disabled state.

- [#273](https://github.com/stevekinney/cinder/pull/273) [`b888707`](https://github.com/stevekinney/cinder/commit/b888707bf6c0c2fa41b14d554a7093cb998d24d9) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `Typography` — a text component that renders a named typographic variant
  (`h1`–`h6`, `subtitle1/2`, `body1/2`, `caption`, `overline`, `label`) mapped to
  the cinder design-token scale, on a semantically appropriate but overridable
  HTML element.
  - `variant` drives the type style; the element defaults to the semantically
    correct tag (`h1`→`<h1>`, `body1`→`<p>`, `caption`→`<span>`, subtitles→`<p>`).
  - `component` overrides the rendered element while keeping the variant's style
    (e.g. `variant="h1" component="span"` for SEO/structure control).
  - `gutterBottom` adds bottom margin; `noWrap` truncates to a single line with an
    ellipsis.
  - Forwards native HTML attributes to the rendered element.

- [#173](https://github.com/stevekinney/cinder/pull/173) [`b460e92`](https://github.com/stevekinney/cinder/commit/b460e92a4b96e1da565ca8017c1d6cecd82a8321) Thanks [@stevekinney](https://github.com/stevekinney)! - Polish Data Display and Surfaces visual contracts across table, feed, description-list, grid-list, diff-statistics, card, avatar, diff-viewer, and supporting examples.

  `PageLayout` now renders breadcrumbs inside `.cinder-page-layout-header`; update direct-child selectors from `.cinder-page-layout > .cinder-page-layout-breadcrumbs` to `.cinder-page-layout-header .cinder-page-layout-breadcrumbs`.

  `Surface tone="transparent"` no longer shows a visible border.

- [#111](https://github.com/stevekinney/cinder/pull/111) [`5ae5627`](https://github.com/stevekinney/cinder/commit/5ae562725e254c3de6e545a1cc84ca851e22c0d0) Thanks [@stevekinney](https://github.com/stevekinney)! - New first-party Shiki adapter at `cinder/highlighters/shiki`. `<CodeBlock>` already auto-loads it with default options when a `language` is set, so you only need it directly to customize the theme or preload grammars — then pass it via the `highlighter` prop. No manual `codeToHtml` wrapper required.

  ```svelte
  <script lang="ts">
    import { CodeBlock } from 'cinder';
    import { shikiHighlighter } from 'cinder/highlighters/shiki';

    const highlighter = shikiHighlighter({ theme: 'github-light' });
  </script>

  <CodeBlock {code} language="ts" {highlighter} />
  ```

  **Options:**
  - `theme?: string | { light: string; dark: string }` — single theme string, or the dual-theme object form that emits CSS variables for `light-dark()`-driven theming. Defaults to `{ light: 'github-light', dark: 'github-dark' }`.
  - `langs?: readonly string[]` — languages to preload at first highlight (otherwise Shiki resolves on demand).

  **Fallback contract:** empty, missing, or unknown languages render as escaped plaintext wrapped in `<pre><code>` (no throw, warns once per language). Internal Shiki errors are caught and produce the same fallback. The plaintext path HTML-escapes its input so `{@html}` injection stays safe.

  **Bundle impact:** Shiki is dynamic-imported on the first highlight call inside the factory's returned function. Consumers who never import `cinder/highlighters/shiki` ship zero Shiki bytes in their entry chunk; consumers who do ship a lazy chunk that loads when the first `<CodeBlock>` highlights.

- [#206](https://github.com/stevekinney/cinder/pull/206) [`31cce14`](https://github.com/stevekinney/cinder/commit/31cce1483b033bab644b6eda22008a06d6b16fc8) Thanks [@stevekinney](https://github.com/stevekinney)! - Promote a batch of beta and experimental components to stable.

  **Beta → stable (12 components):** collapsible, container, autocomplete, command-menu, load-more, selection-popover, menu-bar, resizable-panels, kanban-board, area-chart, bar-chart, line-chart. Each passed the stable-promotion gate (`bun run components:promotion-check`).

  **Experimental → stable, with new import paths (5 components):** connection-indicator, json-viewer, message, timeline, timeline-item moved out of `src/components/experimental/` into the main tree. They are now imported from `cinder/<name>` (for example `cinder/timeline`) instead of `cinder/experimental/<name>`.

  The old `cinder/experimental/<name>` import paths still resolve as **deprecated aliases** that re-export the promoted component. Importing an alias logs a one-time deprecation warning in development pointing at the new path. The alias paths — `cinder/experimental/<name>` plus their `/schema`, `/variables`, `/styles`, and `/examples` subpaths — will be removed in the next major version. Migrate to `cinder/<name>` at your convenience.

  No runtime behavior changed for any promoted component; this is a status and import-path change.

### Patch Changes

- [#171](https://github.com/stevekinney/cinder/pull/171) [`7559330`](https://github.com/stevekinney/cinder/commit/755933055284981d4789485dd42aa44af5279735) Thanks [@stevekinney](https://github.com/stevekinney)! - Buttons & Actions visual polish.
  - New `--cinder-text-md` design token (15px) and a clearer button font-size ladder: `lg` now uses `--cinder-text-md` (15px) and `xl` uses `--cinder-text-lg` (16px), so large buttons read as visibly larger than the default. `xs`/`sm`/`md` are unchanged.
  - Ghost buttons keep their muted text color on hover and only change background, so hover no longer brightens the label.
  - Button groups draw a single deterministic 1px seam between members via a pseudo-element instead of overlapping borders with negative margins, so mixed-variant groups no longer hairline-notch at transparent-bordered boundaries.
  - Dropdown danger items now show a danger-colored focus ring (`--cinder-danger`) instead of the neutral ring.
  - Segmented-control selected and pressed segments now respond to hover (the accent fill darkens) so they no longer read as disabled.

- [#225](https://github.com/stevekinney/cinder/pull/225) [`ec216d4`](https://github.com/stevekinney/cinder/commit/ec216d48fd7e23530ebed36e1452c9ac36c61de4) Thanks [@stevekinney](https://github.com/stevekinney)! - Use the staged publish artifact for consumer validation, release dry-runs, and npm publishing; broaden the Svelte peer contract to tested Svelte 5 versions; and add package-weight reporting with release budgets.
