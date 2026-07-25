// Exact occurrence counts for known primitive-composition migrations.
// Remove a record as soon as its count reaches zero; changing a nonzero count
// must be an explicit migration decision rather than an accidental exemption.

export const allowedRawControlCounts = new Map<string, number>([
  ['_radio/radio.svelte', 1],
  ['approval-card/approval-card-actions.svelte', 2],
  ['autocomplete/autocomplete.svelte', 1],
  ['checkbox/checkbox.svelte', 1],
  ['combobox/combobox.svelte', 1],
  ['command-palette/command-palette.svelte', 1],
  ['date-picker/date-picker.svelte', 2],
  ['faceted-filter-bar/faceted-filter-bar.svelte', 1],
  ['file-upload/file-upload.svelte', 1],
  ['input/input.svelte', 1],
  ['invocation-rule-builder/invocation-rule-builder.svelte', 8],
  ['json-editor/json-editor.svelte', 1],
  ['multi-select/multi-select.svelte', 2],
  ['number-input/number-input.svelte', 1],
  ['pin-input/pin-input.svelte', 1],
  ['phone-input/phone-input.svelte', 2],
  ['search-field/search-field.svelte', 1],
  ['select/select.svelte', 2],
  ['selection-popover/selection-popover.svelte', 1],
  ['table-row/table-row.svelte', 3],
  ['tag-input/tag-input.svelte', 1],
  ['textarea/textarea.svelte', 1],
  ['time-field/time-field.svelte', 2],
  ['tree/tree.svelte', 2],
  ['tree-item/tree-item.svelte', 2],
]);

export const allowedGridCounts = new Map<string, number>(
  [
    'access-gate/access-gate.css',
    'action-row/action-row.css',
    'approval-card/approval-card.css',
    'bento-grid/bento-grid.css',
    'blog-section/blog-section.css',
    'calendar/calendar.css',
    'choice-grid/choice-grid.css',
    'data-grid/data-grid.css',
    'date-picker/date-picker.css',
    'event-stream-viewer/event-stream-viewer.css',
    'feed/feed.css',
    'form-section/form-section.css',
    'grid-list/grid-list.css',
    'grid/grid.css',
    'hero-section/hero-section.css',
    'logo-cloud/logo-cloud.css',
    'newsletter-section/newsletter-section.css',
    'phone-input/phone-input.css',
    'pricing-section/pricing-section.css',
    'radio-group/radio-group.css',
    'schedule-builder/schedule-builder.css',
    'selectable-row/selectable-row.css',
    'source-diff-viewer/source-diff-viewer.css',
    'stacked-list-item/stacked-list-item.css',
    'statistic-group/statistic-group.css',
    'statistic/statistic.css',
    'team-section/team-section.css',
    'testimonial-section/testimonial-section.css',
    'timeline/timeline.css',
    'transfer-list/transfer-list.css',
  ].map((filePath) => [filePath, 1] as const),
);
allowedGridCounts.set('action-row/action-row.css', 4);
allowedGridCounts.set('bento-grid/bento-grid.css', 2);
allowedGridCounts.set('blog-section/blog-section.css', 4);
allowedGridCounts.set('calendar/calendar.css', 2);
allowedGridCounts.set('data-grid/data-grid.css', 2);
allowedGridCounts.set('description-list/description-list.css', 4);
allowedGridCounts.set('feature-section/feature-section.css', 8);
allowedGridCounts.set('footer/footer.css', 3);
allowedGridCounts.set('form-section/form-section.css', 7);
allowedGridCounts.set('kanban-board/kanban-board.css', 5);
allowedGridCounts.set('logo-cloud/logo-cloud.css', 11);
allowedGridCounts.set('mega-menu/mega-menu.css', 2);
allowedGridCounts.set('phone-input/phone-input.css', 2);
allowedGridCounts.set('pricing-section/pricing-section.css', 5);
allowedGridCounts.set('run-step-timeline/run-step-timeline.css', 2);
allowedGridCounts.set('selectable-row/selectable-row.css', 2);
allowedGridCounts.set('source-diff-viewer/source-diff-viewer.css', 2);
allowedGridCounts.set('stacked-list-item/stacked-list-item.css', 6);
allowedGridCounts.set('statistic-group/statistic-group.css', 10);
allowedGridCounts.set('statistic/statistic.css', 2);
allowedGridCounts.set('steps/steps.css', 4);
allowedGridCounts.set('team-section/team-section.css', 5);
allowedGridCounts.set('testimonial-section/testimonial-section.css', 4);
allowedGridCounts.set('timeline/timeline.css', 3);
allowedGridCounts.set('transfer-list/transfer-list.css', 3);

export const allowedFloatingCounts = new Map<string, number>(
  [
    'area-chart/area-chart.css',
    'backdrop/backdrop.css',
    'bar-chart/bar-chart.css',
    'checkbox/checkbox.css',
    'combobox/combobox.css',
    'drawer/drawer.css',
    'dropdown/dropdown.css',
    'kanban-board/kanban-board.css',
    'line-chart/line-chart.css',
    'marquee/marquee.css',
    'matrix-chart/matrix-chart.css',
    'meter/meter.css',
    'navigation-bar/navigation-bar.css',
    'radio-group/radio-group.css',
    'run-step-timeline/run-step-timeline.css',
    'select/select.css',
    'selection-popover/selection-popover.css',
    'sheet/sheet.css',
    'sortable-list/sortable-list.css',
    'spectrogram/spectrogram.css',
    'spectrum-chart/spectrum-chart.css',
    'steps/steps.css',
    'toast-region/toast-region.css',
    'tooltip/tooltip.css',
    'waveform/waveform.css',
  ].map((filePath) => [filePath, 1] as const),
);
allowedFloatingCounts.set('dropdown/dropdown.css', 6);
allowedFloatingCounts.set('menu-bar/menu-bar.css', 2);
allowedFloatingCounts.set('slider/slider.css', 2);
allowedFloatingCounts.set('styles/components/experimental/popover.css', 4);

export const allowedFieldWrapperCounts = new Map<string, number>(
  [
    '_radio/radio.svelte',
    'autocomplete/autocomplete.svelte',
    'checkbox/checkbox.svelte',
    'combobox/combobox.svelte',
    'date-picker/date-picker.svelte',
    'form-field/form-field.svelte',
    'input/input.svelte',
    'json-editor/json-editor.svelte',
    'multi-select/multi-select.svelte',
    'number-input/number-input.svelte',
    'select/select.svelte',
    'textarea/textarea.svelte',
    'time-field/time-field.svelte',
  ].map((filePath) => [filePath, 1] as const),
);
allowedFieldWrapperCounts.set('date-range-field/date-range-field.svelte', 2);
