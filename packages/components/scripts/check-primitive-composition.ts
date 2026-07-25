/**
 * Primitive-composition guard for component source.
 *
 * Cinder's migration toward one implementation per primitive is intentionally
 * incremental. The explicit allow-lists below are the migration tracker: each
 * entry is a known offender and must disappear as its migration PR lands.
 * New hand-rolled controls, grids, floating surfaces, or field wrappers fail
 * immediately instead of silently creating another copy.
 */

import { Glob } from 'bun';
import { relative, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dir, '../../..');
const componentsRoot = resolve(workspaceRoot, 'packages/components/src/components');

const allowedRawControlPaths = new Set([
  'autocomplete/autocomplete.svelte',
  'selection-popover/selection-popover.svelte',
  'file-upload/file-upload.svelte',
  'toggle/toggle.svelte',
  '_radio/radio.svelte',
  'multi-select/multi-select.svelte',
  'segmented-control/segmented-control.svelte',
  'pin-input/pin-input.svelte',
  'json-editor/json-editor.svelte',
  'schema-form/schema-form-body.svelte',
  'event-stream-viewer/event-stream-viewer.svelte',
  'time-field/time-field.svelte',
  'rating/rating.svelte',
  'combobox/combobox.svelte',
  'number-input/number-input.svelte',
  'slider/slider.svelte',
  'date-picker/date-picker.svelte',
  'phone-input/phone-input.svelte',
  'command-palette/command-palette.svelte',
  'invocation-rule-builder/invocation-rule-builder.svelte',
  'color-field/color-field.svelte',
  'radio-group/radio-group.svelte',
  'faceted-filter-bar/faceted-filter-bar.svelte',
  'approval-card/approval-card-actions.svelte',
  'tag-input/tag-input.svelte',
  'tree-item/tree-item.svelte',
  'search-field/search-field.svelte',
  'color-picker/color-picker.svelte',
  'table-row/table-row.svelte',
  'schedule-builder/schedule-builder.svelte',
  'select/select.svelte',
  'select/select.type-test.svelte',
  'json-schema-editor/json-view.svelte',
  'json-schema-editor/property-editor.svelte',
  'json-schema-editor/property-list.svelte',
  'textarea/textarea.svelte',
  'confirm-dialog/confirm-dialog.svelte',
  'newsletter-section/newsletter-section.svelte',
  'tree/tree.svelte',
  'checkbox/checkbox.svelte',
  'input/input.svelte',
]);

const allowedGridPaths = new Set([
  'testimonial-section/testimonial-section.css',
  'bento-grid/bento-grid.css',
  'stacked-list-item/stacked-list-item.css',
  'action-row/action-row.css',
  'pricing-section/pricing-section.css',
  'transfer-list/transfer-list.css',
  'stat-group/stat-group.css',
  'file-upload/file-upload.css',
  'area-chart/area-chart.css',
  'time-field/time-field.css',
  'description-list/description-list.css',
  'stats-section/stats-section.css',
  'schema-form/schema-form.css',
  'event-stream-viewer/event-stream-viewer.css',
  'bar-chart/bar-chart.css',
  'kanban-board/kanban-board.css',
  'permission-matrix/permission-matrix.css',
  'calendar/calendar.css',
  'form-section/form-section.css',
  'data-grid/data-grid.css',
  'feed/feed.css',
  'autocomplete/autocomplete.css',
  'spectrogram/spectrogram.css',
  'run-step-timeline/run-step-timeline.css',
  'matrix-chart/matrix-chart.css',
  'event-timeline/event-timeline.css',
  'feature-section/feature-section.css',
  'spectrum-chart/spectrum-chart.css',
  'phone-input/phone-input.css',
  'hero-section/hero-section.css',
  'source-diff-viewer/source-diff-viewer.css',
  'carousel/carousel.css',
  'stat/stat.css',
  'steps/steps.css',
  'newsletter-section/newsletter-section.css',
  'line-chart/line-chart.css',
  'access-gate/access-gate.css',
  'cta-section/cta-section.css',
  'selectable-row/selectable-row.css',
  'grid-list/grid-list.css',
  'date-picker/date-picker.css',
  'schedule-builder/schedule-builder.css',
  'team-section/team-section.css',
  'logo-cloud/logo-cloud.css',
  'approval-card/approval-card.css',
  'blog-section/blog-section.css',
  'radio-group/radio-group.css',
  'tag-input/tag-input.css',
  'footer/footer.css',
  'menu-bar/menu-bar.css',
  'choice-grid/choice-grid.css',
  'waveform/waveform.css',
  'sparkbar/sparkbar.css',
  'timeline/timeline.css',
  'mega-menu/mega-menu.css',
  'grid/grid.css',
]);

const allowedFloatingPaths = new Set([
  'checkbox/checkbox.css',
  'multi-select/multi-select.css',
  'hover-card/hover-card.css',
  'toggle/toggle.css',
  'event-stream-viewer/event-stream-viewer.css',
  'toast-region/toast-region.css',
  'chip/chip.css',
  'file-upload/file-upload.css',
  'json-editor/json-editor.css',
  'kanban-board/kanban-board.css',
  'resizable-panels/resizable-panels.css',
  'navigation-bar/navigation-bar.css',
  'virtual-list/virtual-list.css',
  'input/input.css',
  'combobox/combobox.css',
  'avatar-group/avatar-group.css',
  'color-swatch-picker/color-swatch-picker.css',
  'line-chart/line-chart.css',
  'grid-list/grid-list.css',
  'area-chart/area-chart.css',
  'segmented-control/segmented-control.css',
  'permission-matrix/permission-matrix.css',
  'date-range-field/date-range-field.css',
  'spectrogram/spectrogram.css',
  'command-menu/command-menu.css',
  'spectrum-chart/spectrum-chart.css',
  'selection-popover/selection-popover.css',
  'button-group/button-group.css',
  'run-step-timeline/run-step-timeline.css',
  'backdrop/backdrop.css',
  'bar-chart/bar-chart.css',
  'sortable-list/sortable-list.css',
  'slider/slider.css',
  'mega-menu/mega-menu.css',
  'rating/rating.css',
  'drawer/drawer.css',
  'speed-dial/speed-dial.css',
  'dropdown/dropdown.css',
  'faceted-filter-bar/faceted-filter-bar.css',
  'tree/tree.css',
  'search-field/search-field.css',
  'meter/meter.css',
  'color-picker/color-picker.css',
  'tooltip/tooltip.css',
  'sheet/sheet.css',
  'modal/modal.css',
  'timeline/timeline.css',
  'carousel/carousel.css',
  'waveform/waveform.css',
  'command-palette/command-palette.css',
  'feed/feed.css',
  'marquee/marquee.css',
  'event-timeline/event-timeline.css',
  'matrix-chart/matrix-chart.css',
  'invocation-rule-builder/invocation-rule-builder.css',
  'steps/steps.css',
  'table/table.css',
  'popover/popover.css',
  'radio-group/radio-group.css',
  'tag-input/tag-input.css',
  'select/select.css',
  'sidebar/sidebar.css',
  'tabs/tabs.css',
  'menu-bar/menu-bar.css',
  'spinner/spinner.css',
  'sparkbar/sparkbar.css',
  'data-grid/data-grid.css',
]);

const allowedFieldWrapperPaths = new Set([
  'toggle/toggle.svelte',
  '_radio/radio.svelte',
  'input/input.svelte',
  'multi-select/multi-select.svelte',
  'json-editor/json-editor.svelte',
  'autocomplete/autocomplete.svelte',
  'combobox/combobox.svelte',
  'number-input/number-input.svelte',
  'time-field/time-field.svelte',
  'textarea/textarea.svelte',
  'date-picker/date-picker.svelte',
  'approval-card/approval-card-actions.svelte',
  'date-range-field/date-range-field.svelte',
  'select/select.svelte',
  'checkbox/checkbox.svelte',
  'form-field/form-field.svelte',
]);

export type PrimitiveCompositionViolation = {
  filePath: string;
  message: string;
};

export function findPrimitiveCompositionViolations(
  source: string,
  filePath: string,
): PrimitiveCompositionViolation[] {
  const normalized = filePath.replaceAll('\\', '/').replace(/^.*components\//, '');
  const violations: PrimitiveCompositionViolation[] = [];
  if (
    /\.svelte$/.test(normalized) &&
    /<(?:input|select|textarea)\b/i.test(source) &&
    !allowedRawControlPaths.has(normalized)
  ) {
    violations.push({
      filePath,
      message: 'Compose the canonical form-control primitive instead of rendering a raw control.',
    });
  }
  if (
    /\.css$/.test(normalized) &&
    /display\s*:\s*grid\b/i.test(source) &&
    /grid-template-columns\s*:/i.test(source) &&
    !allowedGridPaths.has(normalized)
  ) {
    violations.push({
      filePath,
      message: 'Compose Grid instead of hand-rolling a grid column layout.',
    });
  }
  if (
    /\.css$/.test(normalized) &&
    /position\s*:\s*(?:absolute|fixed)\b/i.test(source) &&
    /z-index\s*:/i.test(source) &&
    !allowedFloatingPaths.has(normalized) &&
    !/@import[^;]*_floating-surface\.css/.test(source)
  ) {
    violations.push({
      filePath,
      message: 'Consume _floating-surface.css for positioned, layered surfaces.',
    });
  }
  if (
    /\.svelte$/.test(normalized) &&
    /<label\b/i.test(source) &&
    /description/i.test(source) &&
    /error/i.test(source) &&
    !allowedFieldWrapperPaths.has(normalized)
  ) {
    violations.push({
      filePath,
      message: 'Compose FormField instead of hand-rolling label, description, and error wrappers.',
    });
  }
  return violations;
}

async function main(): Promise<void> {
  const violations: PrimitiveCompositionViolation[] = [];
  const glob = new Glob('**/*.{svelte,css}');
  for await (const absolutePath of glob.scan({ cwd: componentsRoot, absolute: true })) {
    const relativePath = relative(componentsRoot, absolutePath).replaceAll('\\', '/');
    violations.push(
      ...findPrimitiveCompositionViolations(await Bun.file(absolutePath).text(), relativePath),
    );
  }
  if (violations.length === 0) {
    process.stdout.write(
      'check-primitive-composition — OK (known primitive copies are explicitly tracked).\n',
    );
    return;
  }
  process.stderr.write(
    'check-primitive-composition — untracked hand-rolled primitives detected.\n\n',
  );
  for (const violation of violations)
    process.stderr.write(`  ${violation.filePath}\n    ${violation.message}\n`);
  process.exitCode = 1;
}

if (import.meta.main) await main();
