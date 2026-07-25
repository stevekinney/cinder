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
import { basename, relative, resolve } from 'node:path';

import { parse as parseCss, type Rule } from 'postcss';
import { parse as parseSvelte } from 'svelte/compiler';

const workspaceRoot = resolve(import.meta.dir, '../../..');
const componentsRoot = resolve(workspaceRoot, 'packages/components/src/components');

// Expected visible-control occurrences. Zero-count migrations are removed
// immediately so a stale record cannot authorize a later regression.
const allowedRawControlCounts = new Map([
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

const allowedGridCounts = new Map<string, number>(
  [
    'action-row/action-row.css',
    'access-gate/access-gate.css',
    'approval-card/approval-card.css',
    'bento-grid/bento-grid.css',
    'blog-section/blog-section.css',
    'calendar/calendar.css',
    'choice-grid/choice-grid.css',
    'data-grid/data-grid.css',
    'date-picker/date-picker.css',
    'event-stream-viewer/event-stream-viewer.css',
    'feature-section/feature-section.css',
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
    'statistic/statistic.css',
    'statistic-group/statistic-group.css',
    'team-section/team-section.css',
    'testimonial-section/testimonial-section.css',
    'timeline/timeline.css',
    'transfer-list/transfer-list.css',
  ].map((filePath) => [filePath, 1] as const),
);
allowedGridCounts.set('description-list/description-list.css', 2);
allowedGridCounts.set('feature-section/feature-section.css', 2);
allowedGridCounts.set('footer/footer.css', 2);
allowedGridCounts.set('kanban-board/kanban-board.css', 2);
allowedGridCounts.set('mega-menu/mega-menu.css', 2);
allowedGridCounts.set('run-step-timeline/run-step-timeline.css', 2);
allowedGridCounts.set('steps/steps.css', 2);

const allowedFloatingCounts = new Map<string, number>(
  [
    'area-chart/area-chart.css',
    'backdrop/backdrop.css',
    'bar-chart/bar-chart.css',
    'button-group/button-group.css',
    'checkbox/checkbox.css',
    'combobox/combobox.css',
    'command-menu/command-menu.css',
    'drawer/drawer.css',
    'dropdown/dropdown.css',
    'grid-list/grid-list.css',
    'hover-card/hover-card.css',
    'kanban-board/kanban-board.css',
    'line-chart/line-chart.css',
    'marquee/marquee.css',
    'matrix-chart/matrix-chart.css',
    'meter/meter.css',
    'navigation-bar/navigation-bar.css',
    'popover/popover.css',
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
allowedFloatingCounts.set('menu-bar/menu-bar.css', 2);

const allowedFieldWrapperCounts = new Map<string, number>(
  [
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
  ].map((filePath) => [filePath, 1] as const),
);
allowedFieldWrapperCounts.set('approval-card/approval-card-actions.svelte', 2);
allowedFieldWrapperCounts.set('date-range-field/date-range-field.svelte', 2);

export type PrimitiveCompositionViolation = {
  filePath: string;
  message: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function walkAst(node: unknown, visit: (record: UnknownRecord) => void): void {
  if (!isRecord(node)) return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visit);
    } else if (isRecord(value)) {
      walkAst(value, visit);
    }
  }
}

function parseSvelteFragment(source: string): UnknownRecord | undefined {
  const root: unknown = parseSvelte(source, { modern: true });
  if (!isRecord(root) || !isRecord(root['fragment'])) return undefined;
  return root['fragment'];
}

function staticStringFromExpression(
  expression: unknown,
  bindings: ReadonlyMap<string, string>,
): string | undefined {
  if (!isRecord(expression)) return undefined;
  if (expression['type'] === 'Literal' && typeof expression['value'] === 'string')
    return expression['value'];
  if (
    expression['type'] === 'TemplateLiteral' &&
    Array.isArray(expression['expressions']) &&
    expression['expressions'].length === 0 &&
    Array.isArray(expression['quasis']) &&
    isRecord(expression['quasis'][0])
  ) {
    const value = expression['quasis'][0]['value'];
    return isRecord(value) && typeof value['cooked'] === 'string' ? value['cooked'] : undefined;
  }
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string')
    return bindings.get(expression['name']);
  return undefined;
}

function staticStringBindings(source: string): Map<string, string> {
  const root: unknown = parseSvelte(source, { modern: true });
  const bindings = new Map<string, string>();
  if (!isRecord(root) || !isRecord(root['instance']) || !isRecord(root['instance']['content']))
    return bindings;
  const body = root['instance']['content']['body'];
  if (!Array.isArray(body)) return bindings;
  for (const statement of body) {
    if (!isRecord(statement) || statement['type'] !== 'VariableDeclaration') continue;
    const declarations = statement['declarations'];
    if (!Array.isArray(declarations)) continue;
    for (const declaration of declarations) {
      if (
        !isRecord(declaration) ||
        !isRecord(declaration['id']) ||
        declaration['id']['type'] !== 'Identifier' ||
        typeof declaration['id']['name'] !== 'string'
      )
        continue;
      const value = staticStringFromExpression(declaration['init'], bindings);
      if (value !== undefined) bindings.set(declaration['id']['name'], value);
    }
  }
  return bindings;
}

function staticAttributeValue(attribute: UnknownRecord): string | undefined {
  const value = attribute['value'];
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) return undefined;
  return value[0]['type'] === 'Text' && typeof value[0]['data'] === 'string'
    ? value[0]['data']
    : undefined;
}

function attributeValueWithDynamics(
  attribute: UnknownRecord,
  bindings: ReadonlyMap<string, string> = new Map(),
): string | undefined {
  const value = attribute['value'];
  if (value === true) return undefined;
  const parts = Array.isArray(value) ? value : [value];
  return parts
    .map((part) => {
      if (isRecord(part) && part['type'] === 'Text' && typeof part['data'] === 'string')
        return part['data'];
      if (isRecord(part) && part['type'] === 'ExpressionTag')
        return (
          staticStringFromExpression(part['expression'], bindings) ?? 'var(--cinder-dynamic-value)'
        );
      return 'var(--cinder-dynamic-value)';
    })
    .join('');
}

function hasStaticHiddenAttribute(element: UnknownRecord): boolean {
  const attributes = element['attributes'];
  if (!Array.isArray(attributes)) return false;
  return attributes.some((attribute) => {
    if (!isRecord(attribute) || attribute['type'] !== 'Attribute') return false;
    if (attribute['name'] === 'hidden') return attribute['value'] === true;
    return (
      attribute['name'] === 'type' && staticAttributeValue(attribute)?.toLowerCase() === 'hidden'
    );
  });
}

export function visibleControlCount(source: string): number {
  const fragment = parseSvelteFragment(source);
  const bindings = staticStringBindings(source);
  if (fragment === undefined) return 0;
  let count = 0;
  walkAst(fragment, (node) => {
    const elementName =
      node['type'] === 'RegularElement'
        ? node['name']
        : node['type'] === 'SvelteElement'
          ? staticStringFromExpression(node['tag'], bindings)
          : undefined;
    if (
      (elementName === 'input' || elementName === 'select' || elementName === 'textarea') &&
      !hasStaticHiddenAttribute(node)
    )
      count += 1;
  });
  return count;
}

type CssPrimitiveCounts = {
  grid: number;
  floating: number;
};

function declarationMap(rule: Rule): Map<string, string> {
  const declarations = new Map<string, string>();
  rule.each((node) => {
    if (node.type !== 'decl') return;
    declarations.set(node.prop.toLowerCase(), node.value.toLowerCase());
  });
  return declarations;
}

function selectorTargetClasses(selector: string): Set<string>[] {
  return selector.split(',').map((branch) => {
    const target =
      branch
        .trim()
        .split(/[\s>+~]+/)
        .at(-1) ?? '';
    return new Set([...target.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1] ?? ''));
  });
}

function selectorsCanMatchSameElement(left: Rule, right: Rule): boolean {
  if (left === right) return true;
  const leftTargets = selectorTargetClasses(left.selector);
  const rightTargets = selectorTargetClasses(right.selector);
  return leftTargets.some((leftClasses) =>
    rightTargets.some((rightClasses) =>
      [...leftClasses].some((className) => rightClasses.has(className)),
    ),
  );
}

function isInsideKeyframes(rule: Rule): boolean {
  let parent: unknown = rule.parent;
  while (isRecord(parent)) {
    if (parent['type'] === 'atrule' && /keyframes$/i.test(String(parent['name']))) return true;
    parent = parent['parent'];
  }
  return false;
}

function ruleUsesSharedFloatingSurface(
  rule: Rule,
  sharedClassSets: readonly ReadonlySet<string>[],
): boolean {
  if (rule.selector.includes('cinder-_floating-surface')) return true;
  return selectorTargetClasses(rule.selector).some((targetClasses) =>
    sharedClassSets.some((sharedClasses) =>
      [...targetClasses].some(
        (className) => className !== 'cinder-_floating-surface' && sharedClasses.has(className),
      ),
    ),
  );
}

export function cssPrimitiveCounts(
  source: string,
  sharedClassSets: readonly ReadonlySet<string>[] = [],
): CssPrimitiveCounts {
  let root = parseCss(source);
  if (root.nodes.some((node) => node.type === 'decl')) root = parseCss(`:root { ${source} }`);
  const rules: Array<{ rule: Rule; declarations: Map<string, string> }> = [];
  root.walkRules((rule) => {
    if (!isInsideKeyframes(rule)) rules.push({ rule, declarations: declarationMap(rule) });
  });
  const templateRules = rules.filter(
    ({ declarations }) =>
      declarations.has('grid-template') || declarations.has('grid-template-columns'),
  );
  const grid = rules.filter(({ rule, declarations }) => {
    const display = declarations.get('display');
    return (
      (display === 'grid' || display === 'inline-grid') &&
      templateRules.some(({ rule: templateRule }) =>
        selectorsCanMatchSameElement(rule, templateRule),
      )
    );
  }).length;
  let floating = 0;
  for (const { rule, declarations } of rules) {
    const position = declarations.get('position');
    if (
      (position === 'absolute' || position === 'fixed') &&
      declarations.has('z-index') &&
      !ruleUsesSharedFloatingSurface(rule, sharedClassSets)
    )
      floating += 1;
  }
  return { grid, floating };
}

function elementClassSet(element: UnknownRecord): Set<string> {
  const attributes = element['attributes'];
  if (!Array.isArray(attributes)) return new Set();
  for (const attribute of attributes) {
    if (!isRecord(attribute) || attribute['type'] !== 'Attribute' || attribute['name'] !== 'class')
      continue;
    return new Set(staticAttributeValue(attribute)?.split(/\s+/).filter(Boolean) ?? []);
  }
  return new Set();
}

function collectSharedFloatingClassSets(source: string): Set<string>[] {
  const fragment = parseSvelteFragment(source);
  const classSets: Set<string>[] = [];
  if (fragment === undefined) return classSets;
  walkAst(fragment, (node) => {
    if (node['type'] !== 'RegularElement') return;
    const classes = elementClassSet(node);
    if (classes.has('cinder-_floating-surface')) classSets.push(classes);
  });
  return classSets;
}

function inlineStylePrimitiveCounts(source: string): CssPrimitiveCounts {
  const fragment = parseSvelteFragment(source);
  const bindings = staticStringBindings(source);
  const total: CssPrimitiveCounts = { grid: 0, floating: 0 };
  if (fragment === undefined) return total;
  walkAst(fragment, (node) => {
    if (node['type'] !== 'RegularElement' || !Array.isArray(node['attributes'])) return;
    const classes = elementClassSet(node);
    const directives = new Map<string, string>();
    for (const attribute of node['attributes']) {
      if (!isRecord(attribute)) continue;
      if (attribute['type'] === 'Attribute' && attribute['name'] === 'style') {
        const value = attributeValueWithDynamics(attribute, bindings);
        if (value === undefined || !value.includes(':')) continue;
        const counts = cssPrimitiveCounts(value);
        total.grid += counts.grid;
        if (!classes.has('cinder-_floating-surface')) total.floating += counts.floating;
      }
      if (attribute['type'] === 'StyleDirective' && typeof attribute['name'] === 'string')
        directives.set(
          attribute['name'].toLowerCase(),
          attributeValueWithDynamics(attribute, bindings)?.toLowerCase() ??
            'var(--cinder-dynamic-value)',
        );
    }
    const display = directives.get('display');
    if (
      (display === 'grid' || display === 'inline-grid') &&
      (directives.has('grid-template') || directives.has('grid-template-columns'))
    )
      total.grid++;
    const position = directives.get('position');
    if (
      (position === 'absolute' || position === 'fixed') &&
      directives.has('z-index') &&
      !classes.has('cinder-_floating-surface')
    )
      total.floating++;
  });
  return total;
}

function renderedMarkupEvidence(source: string): { labelCount: number; terms: string } {
  const fragment = parseSvelteFragment(source);
  let labelCount = 0;
  const terms: string[] = [];
  if (fragment === undefined) return { labelCount, terms: '' };
  walkAst(fragment, (node) => {
    if (node['type'] === 'RegularElement' && node['name'] === 'label') labelCount += 1;
    if (node['type'] === 'Text' && typeof node['data'] === 'string') terms.push(node['data']);
    if (
      (node['type'] === 'ExpressionTag' || node['type'] === 'IfBlock') &&
      typeof node['start'] === 'number' &&
      typeof node['end'] === 'number'
    )
      terms.push(source.slice(node['start'], node['end']));
    if (
      node['type'] === 'Attribute' &&
      typeof node['start'] === 'number' &&
      typeof node['end'] === 'number'
    )
      terms.push(source.slice(node['start'], node['end']));
  });
  return { labelCount, terms: terms.join(' ') };
}

export function fieldWrapperCount(source: string): number {
  const markup = renderedMarkupEvidence(source);
  return /(?:description|help(?:text)?|hint|assist)/i.test(markup.terms) &&
    /(?:error|validation|invalid|message)/i.test(markup.terms)
    ? markup.labelCount
    : 0;
}

export function shouldCheckComponentSource(filePath: string): boolean {
  const fileName = basename(filePath);
  return !fileName.endsWith('.fixture.svelte') && !fileName.endsWith('.type-test.svelte');
}

export function findPrimitiveCompositionViolations(
  source: string,
  filePath: string,
  companionSource = '',
): PrimitiveCompositionViolation[] {
  const normalized = filePath.replaceAll('\\', '/').replace(/^.*components\//, '');
  const violations: PrimitiveCompositionViolation[] = [];
  const rawControlCount = normalized.endsWith('.svelte') ? visibleControlCount(source) : 0;
  const expectedRawControlCount = allowedRawControlCounts.get(normalized);
  if (rawControlCount > 0 && expectedRawControlCount === undefined) {
    violations.push({
      filePath,
      message: 'Compose the canonical form-control primitive instead of rendering a raw control.',
    });
  }
  if (expectedRawControlCount !== undefined && expectedRawControlCount !== rawControlCount) {
    violations.push({
      filePath,
      message:
        'A tracked raw-control count changed; migrate it or update the explicit migration record.',
    });
  }
  const counts = normalized.endsWith('.css')
    ? cssPrimitiveCounts(source, collectSharedFloatingClassSets(companionSource))
    : normalized.endsWith('.svelte')
      ? inlineStylePrimitiveCounts(source)
      : { grid: 0, floating: 0 };
  const expectedGridCount = allowedGridCounts.get(normalized);
  if (counts.grid > 0 && expectedGridCount === undefined) {
    violations.push({
      filePath,
      message: 'Compose Grid instead of hand-rolling a grid column layout.',
    });
  }
  if (expectedGridCount !== undefined && expectedGridCount !== counts.grid) {
    violations.push({
      filePath,
      message: 'A tracked grid-layout count changed; migrate it or update the migration record.',
    });
  }
  const expectedFloatingCount = allowedFloatingCounts.get(normalized);
  if (counts.floating > 0 && expectedFloatingCount === undefined) {
    violations.push({
      filePath,
      message: 'Consume _floating-surface.css for positioned, layered surfaces.',
    });
  }
  if (expectedFloatingCount !== undefined && expectedFloatingCount !== counts.floating) {
    violations.push({
      filePath,
      message:
        'A tracked floating-surface count changed; migrate it or update the migration record.',
    });
  }
  const wrappers = normalized.endsWith('.svelte') ? fieldWrapperCount(source) : 0;
  const expectedWrapperCount = allowedFieldWrapperCounts.get(normalized);
  if (wrappers > 0 && expectedWrapperCount === undefined) {
    violations.push({
      filePath,
      message: 'Compose FormField instead of hand-rolling label, description, and error wrappers.',
    });
  }
  if (expectedWrapperCount !== undefined && expectedWrapperCount !== wrappers) {
    violations.push({
      filePath,
      message: 'A tracked field-wrapper count changed; migrate it or update the migration record.',
    });
  }
  return violations;
}

async function main(): Promise<void> {
  const violations: PrimitiveCompositionViolation[] = [];
  const glob = new Glob('**/*.{svelte,css}');
  for await (const absolutePath of glob.scan({ cwd: componentsRoot, absolute: true })) {
    const relativePath = relative(componentsRoot, absolutePath).replaceAll('\\', '/');
    if (!shouldCheckComponentSource(relativePath)) continue;
    const companionPath = absolutePath.endsWith('.css')
      ? absolutePath.replace(/\.css$/, '.svelte')
      : '';
    const companionSource =
      companionPath !== '' && (await Bun.file(companionPath).exists())
        ? await Bun.file(companionPath).text()
        : '';
    violations.push(
      ...findPrimitiveCompositionViolations(
        await Bun.file(absolutePath).text(),
        relativePath,
        companionSource,
      ),
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
