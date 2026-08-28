// Exact occurrence counts for canonical primitives and known migrations.
// Remove completed migration records as soon as their count reaches zero;
// changing any nonzero baseline must be an explicit composition decision.

export const allowedRawControlCounts = new Map<string, number>([
  ['_radio/radio.svelte', 1],
  ['approval-card/approval-card-actions.svelte', 2],
  ['checkbox/checkbox.svelte', 1],
  ['combobox/combobox.svelte', 1],
  // CommandPalette intentionally retains one native text input inside a modal
  // <dialog>; see docs/decisions/command-palette-native-dialog.md. This exception
  // is bounded to the editable combobox control, not the dialog surface.
  ['command-palette/command-palette.svelte', 1],
  ['date-picker/date-picker.svelte', 2],
  ['filter-bar/filter-bar.svelte', 1],
  ['file-upload/file-upload.svelte', 1],
  ['input/input.svelte', 1],
  ['invocation-rule-builder/invocation-rule-builder.svelte', 8],
  ['json-editor/json-editor.svelte', 1],
  // MultiSelect intentionally retains its filter input and native validation
  // proxy; option selection itself is composed from the shared primitives.
  ['multi-select/multi-select.svelte', 2],
  ['pin-input/pin-input.svelte', 1],
  ['select/select.svelte', 2],
  ['selection-popover/selection-popover.svelte', 1],
  ['table-row/table-row.svelte', 3],
  ['tag-input/tag-input.svelte', 1],
  ['textarea/textarea.svelte', 1],
  ['time-field/time-field.svelte', 1],
  ['tree/tree.svelte', 2],
  ['tree-item/tree-item.svelte', 2],
]);

// Stable descriptors for tracked files where equal-count substitutions must not
// silently pass the migration guard. Other records retain the count guard until
// their primitive migration is completed.
export const allowedRawControlSignatures = new Map<string, readonly string[]>([
  [
    'command-palette/command-palette.svelte',
    [
      'input|aria-activedescendant|aria-autocomplete=list|aria-controls|aria-expanded=true|autocomplete=off|autocorrect=off|class=cinder-command-palette__input|id|oninput|onkeydown|placeholder|role=combobox|spellcheck=false|this|type=text|value',
    ],
  ],
  [
    'approval-card/approval-card-actions.svelte',
    [
      'textarea|class=cinder-approval-card__textarea cinder-approval-card__textarea--reason|id|rows=2|value',
      'input|checked|type=checkbox',
    ],
  ],
  [
    'multi-select/multi-select.svelte',
    [
      'input|aria-activedescendant|aria-autocomplete=list|aria-controls|aria-expanded|aria-haspopup=listbox|aria-labelledby|aria-readonly|class=cinder-_input-frame cinder-multi-select__filter|id|oninput|onkeydown|placeholder=Filter options|readonly|role=combobox|this|type=text|value',
      'input|aria-hidden=true|class=cinder-multi-select__validation-proxy|disabled|oninvalid|required|tabindex=-1|this|type=text|value',
    ],
  ],
]);

export const allowedGridCounts = new Map<string, number>(
  [
    'access-gate/access-gate.css',
    'action-row/action-row.css',
    'approval-card/approval-card.css',
    'calendar/calendar.css',
    'data-grid/data-grid.css',
    'date-picker/date-picker.css',
    'feed-event/feed-event.css',
    'form-section/form-section.css',
    'grid/grid.css',
    'phone-input/phone-input.css',
    'radio-group/radio-group.css',
    'selectable-row/selectable-row.css',
    'sortable-list/sortable-list.css',
    'source-diff-viewer/source-diff-viewer.css',
    'stacked-list-item/stacked-list-item.css',
    'statistic-group/statistic-group.css',
    'statistic/statistic.css',
    'timeline/timeline.css',
  ].map((filePath) => [filePath, 1] as const),
);
allowedGridCounts.set('action-row/action-row.css', 4);
/*
 * CIN-335: the facet row aligns on a grid across wrap boundaries, switched by a container
 * query. Grid cannot express that — its only width behaviour is `narrowCollapseEnabled`, a
 * fixed 48rem single-column collapse, while this breaks at 40rem to match form-section's
 * scale. Tracked for the same reason form-section is.
 *
 * Two pairs, not one: the base rule declares `display: grid` and its own
 * `grid-template-columns` (one pair with itself), and the `@container` override supplies a
 * second `grid-template-columns` that pairs with that same display rule.
 */
allowedGridCounts.set('filter-bar/filter-bar.css', 2);
allowedGridCounts.set('calendar/calendar.css', 2);
allowedGridCounts.set('data-grid/data-grid.css', 2);
allowedGridCounts.set('description-list/description-list.css', 4);
allowedGridCounts.set('footer/footer.css', 2);
allowedGridCounts.set('form-section/form-section.css', 7);
allowedGridCounts.set('kanban-board/kanban-board.css', 5);
// The nested submenu's master/detail column split adds one tracked match
// alongside the top-level section grid and the existing trigger/panel split.
allowedGridCounts.set('mega-menu/mega-menu.css', 3);
allowedGridCounts.set('phone-input/phone-input.css', 2);
allowedGridCounts.set('run-step-timeline/run-step-timeline.css', 2);
allowedGridCounts.set('selectable-row/selectable-row.css', 2);
// The selector-aware analyzer counts the line grid's base and no-number column
// definitions. The lines container has no grid-definition property.
allowedGridCounts.set('source-diff-viewer/source-diff-viewer.css', 2);
allowedGridCounts.set('stacked-list-item/stacked-list-item.css', 6);
allowedGridCounts.set('statistic-group/statistic-group.css', 10);
allowedGridCounts.set('statistic/statistic.css', 2);
allowedGridCounts.set('steps/steps.css', 4);
allowedGridCounts.set('timeline/timeline.css', 3);

export const allowedFloatingCounts = new Map<string, number>(
  [
    'area-chart/area-chart.css',
    'backdrop/backdrop.css',
    'bar-chart/bar-chart.css',
    'drawer/drawer.css',
    'dropdown/dropdown.css',
    'kanban-board/kanban-board.css',
    'line-chart/line-chart.css',
    'marquee/marquee.css',
    'matrix-chart/matrix-chart.css',
    'navigation-bar/navigation-bar.css',
    'run-step-timeline/run-step-timeline.css',
    'select/select.css',
    'selection-popover/selection-popover.css',
    'sortable-list/sortable-list.css',
    'spectrogram/spectrogram.css',
    'spectrum-chart/spectrum-chart.css',
    'steps/steps.css',
    'toast-region/toast-region.css',
    'tooltip/tooltip.css',
    'waveform/waveform.css',
  ].map((filePath) => [filePath, 1] as const),
);
// CommandPalette is intentionally absent from this floating-surface migration:
// its panel remains a native modal <dialog>, not a positioned non-modal surface.
// See docs/decisions/command-palette-native-dialog.md for the bounded exception.
allowedFloatingCounts.set('dropdown/dropdown.css', 6);
allowedFloatingCounts.set('menu-bar/menu-bar.css', 2);
allowedFloatingCounts.set('styles/components/experimental/popover.css', 4);
// phone-input's country-summary is excluded at detection time (see the
// `summary` addition to isInternalLayerTarget() in primitive-composition-css.ts):
// it is a decorative absolutely-positioned label painted over a transparent
// native <select>, not a layered floating panel.

// All tracked field wrappers have been migrated to FormField composition
// (epic #919). Every entry that once lived here — _radio, combobox,
// date-picker, json-editor, multi-select, select, textarea, time-field — now
// composes FormFieldFrame and reports zero hand-rolled label/description/error
// wrappers, so the map is empty rather than deleted outright: a future
// hand-rolled field wrapper still trips the `wrappers > 0` guard below.
export const allowedFieldWrapperCounts = new Map<string, number>();

const migrationMaps: ReadonlyArray<ReadonlyMap<string, unknown>> = [
  allowedRawControlCounts,
  allowedRawControlSignatures,
  allowedGridCounts,
  allowedFloatingCounts,
  allowedFieldWrapperCounts,
];

export function missingMigrationRecordPaths(existingPaths: ReadonlySet<string>): string[] {
  return [...new Set(migrationMaps.flatMap((records) => [...records.keys()]))]
    .filter((filePath) => !existingPaths.has(filePath))
    .sort();
}
