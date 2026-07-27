/** Reject new hand-rolled primitives while migration maps track existing copies. */

import { parse as parseCss } from 'postcss';
import { parse as parseSvelte } from 'svelte/compiler';

import { isExcludedComponentSource } from './component-source-filter.ts';
import {
  cssPrimitiveCounts,
  declarationMap,
  gridDefinitionProperties,
  type CssPrimitiveCounts,
  type SharedFloatingTarget,
} from './primitive-composition-css.ts';
import { fieldWrapperCount } from './primitive-composition-field.ts';
import {
  allowedFieldWrapperCounts,
  allowedFloatingCounts,
  allowedGridCounts,
  allowedRawControlCounts,
  missingMigrationRecordPaths,
} from './primitive-composition-migrations.ts';
import { runPrimitiveCompositionCheck } from './primitive-composition-runner.ts';
import { styleObjectDeclarations } from './primitive-composition-style-object.ts';

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
  if (
    expression['type'] === 'TSAsExpression' ||
    expression['type'] === 'TSSatisfiesExpression' ||
    expression['type'] === 'TSNonNullExpression'
  )
    return staticStringFromExpression(expression['expression'], bindings);
  return undefined;
}

function possibleStaticStringsFromExpression(
  expression: unknown,
  bindings: ReadonlyMap<string, string>,
): Set<string> {
  const directValue = staticStringFromExpression(expression, bindings);
  if (directValue !== undefined) return new Set([directValue]);
  if (!isRecord(expression)) return new Set();
  if (expression['type'] === 'ConditionalExpression')
    return new Set([
      ...possibleStaticStringsFromExpression(expression['consequent'], bindings),
      ...possibleStaticStringsFromExpression(expression['alternate'], bindings),
    ]);
  if (expression['type'] === 'LogicalExpression')
    return new Set([
      ...possibleStaticStringsFromExpression(expression['left'], bindings),
      ...possibleStaticStringsFromExpression(expression['right'], bindings),
    ]);
  return new Set();
}

function staticStringBindings(source: string): Map<string, string> {
  const root: unknown = parseSvelte(source, { modern: true });
  const bindings = new Map<string, string>();
  if (!isRecord(root) || !isRecord(root['instance']) || !isRecord(root['instance']['content']))
    return bindings;
  const body = root['instance']['content']['body'];
  if (!Array.isArray(body)) return bindings;
  for (const statement of body) {
    if (
      !isRecord(statement) ||
      statement['type'] !== 'VariableDeclaration' ||
      statement['kind'] !== 'const'
    )
      continue;
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
      else if (
        isRecord(declaration['init']) &&
        declaration['init']['type'] === 'Literal' &&
        typeof declaration['init']['value'] === 'boolean'
      )
        bindings.set(declaration['id']['name'], String(declaration['init']['value']));
    }
  }
  return bindings;
}

function possibleMutableControlNames(source: string, expression: unknown): Set<string> {
  if (
    !isRecord(expression) ||
    expression['type'] !== 'Identifier' ||
    typeof expression['name'] !== 'string'
  )
    return new Set();
  const bindingName = expression['name'];
  const root: unknown = parseSvelte(source, { modern: true });
  if (!isRecord(root) || !isRecord(root['instance']) || !isRecord(root['instance']['content']))
    return new Set();
  const possibleControls = new Set<string>();
  const bindings = staticStringBindings(source);
  const walkTopLevel = (current: unknown, shadowed = false): void => {
    if (!isRecord(current)) return;
    const type = current['type'];
    let currentShadowed = shadowed;
    if (
      type === 'FunctionDeclaration' ||
      type === 'FunctionExpression' ||
      type === 'ArrowFunctionExpression'
    ) {
      let declaresBinding = false;
      walkAst(current['body'], (node) => {
        if (
          node['type'] === 'VariableDeclarator' &&
          isRecord(node['id']) &&
          node['id']['name'] === bindingName
        )
          declaresBinding = true;
      });
      currentShadowed ||= declaresBinding;
    }
    const node = current;
    let candidate: unknown;
    if (
      !currentShadowed &&
      node['type'] === 'VariableDeclarator' &&
      isRecord(node['id']) &&
      node['id']['type'] === 'Identifier' &&
      node['id']['name'] === bindingName
    )
      candidate = node['init'];
    if (
      !currentShadowed &&
      node['type'] === 'AssignmentExpression' &&
      isRecord(node['left']) &&
      node['left']['type'] === 'Identifier' &&
      node['left']['name'] === bindingName
    )
      candidate = node['right'];
    for (const candidateValue of possibleStaticStringsFromExpression(candidate, bindings)) {
      const normalizedValue = candidateValue.toLowerCase();
      if (
        normalizedValue === 'input' ||
        normalizedValue === 'select' ||
        normalizedValue === 'textarea'
      )
        possibleControls.add(normalizedValue);
    }
    for (const child of Object.values(current)) {
      if (Array.isArray(child)) child.forEach((item) => walkTopLevel(item, currentShadowed));
      else if (isRecord(child)) walkTopLevel(child, currentShadowed);
    }
  };
  walkTopLevel(root['instance']['content']);
  return possibleControls;
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

function hasStaticHiddenAttribute(
  element: UnknownRecord,
  elementNames: ReadonlySet<string>,
  bindings: ReadonlyMap<string, string>,
): boolean {
  const attributes = element['attributes'];
  if (!Array.isArray(attributes)) return false;
  return attributes.some((attribute) => {
    if (!isRecord(attribute)) return false;
    if (attribute['type'] === 'SpreadAttribute' && isRecord(attribute['expression'])) {
      const expression = attribute['expression'];
      if (expression['type'] !== 'ObjectExpression' || !Array.isArray(expression['properties']))
        return false;
      return expression['properties'].some((property) => {
        if (!isRecord(property) || property['type'] !== 'Property' || property['computed'] === true)
          return false;
        const key = property['key'];
        const name = isRecord(key)
          ? key['type'] === 'Identifier' && typeof key['name'] === 'string'
            ? key['name']
            : key['type'] === 'Literal' && typeof key['value'] === 'string'
              ? key['value']
              : undefined
          : undefined;
        if (
          name !== 'hidden' &&
          !(elementNames.size === 1 && elementNames.has('input') && name === 'type')
        )
          return false;
        const value = property['value'];
        if (name === 'hidden')
          return isRecord(value) && value['type'] === 'Literal' && value['value'] === true;
        return staticStringFromExpression(value, bindings)?.toLowerCase() === 'hidden';
      });
    }
    if (attribute['type'] !== 'Attribute') return false;
    if (attribute['name'] === 'hidden') {
      if (attribute['value'] === true || staticAttributeValue(attribute) !== undefined) return true;
      const value = attribute['value'];
      const expressionTag = isRecord(value)
        ? value
        : Array.isArray(value) && value.length === 1 && isRecord(value[0])
          ? value[0]
          : undefined;
      const expression = expressionTag?.['expression'];
      return (
        expressionTag?.['type'] === 'ExpressionTag' &&
        isRecord(expression) &&
        ((expression['type'] === 'Literal' && expression['value'] === true) ||
          (expression['type'] === 'Identifier' &&
            typeof expression['name'] === 'string' &&
            bindings.get(expression['name']) === 'true'))
      );
    }
    return (
      elementNames.size === 1 &&
      elementNames.has('input') &&
      attribute['name'] === 'type' &&
      attributeValueWithDynamics(attribute, bindings)?.toLowerCase() === 'hidden'
    );
  });
}

export function visibleControlCount(source: string): number {
  const fragment = parseSvelteFragment(source);
  const bindings = staticStringBindings(source);
  if (fragment === undefined) return 0;
  let count = 0;
  walkAst(fragment, (node) => {
    if (node['type'] === 'HtmlTag' && isRecord(node['expression'])) {
      const html = staticStringFromExpression(node['expression'], bindings);
      if (html !== undefined) count += visibleControlCount(html);
      return;
    }
    const elementNames = new Set<string>();
    if (node['type'] === 'RegularElement' && typeof node['name'] === 'string')
      elementNames.add(node['name'].toLowerCase());
    if (node['type'] === 'SvelteElement') {
      for (const name of possibleStaticStringsFromExpression(node['tag'], bindings))
        elementNames.add(name.toLowerCase());
      for (const mutableControlName of possibleMutableControlNames(source, node['tag']))
        elementNames.add(mutableControlName);
    }
    const controlNames = new Set(
      [...elementNames].filter(
        (elementName) =>
          elementName === 'input' || elementName === 'select' || elementName === 'textarea',
      ),
    );
    if (controlNames.size > 0 && !hasStaticHiddenAttribute(node, controlNames, bindings))
      count += 1;
  });
  return count;
}

function elementClassSet(
  element: UnknownRecord,
  bindings: ReadonlyMap<string, string>,
): Set<string> {
  const attributes = element['attributes'];
  if (!Array.isArray(attributes)) return new Set();
  const classes = new Set<string>();
  for (const attribute of attributes) {
    if (!isRecord(attribute)) continue;
    if (
      attribute['type'] === 'ClassDirective' &&
      typeof attribute['name'] === 'string' &&
      isRecord(attribute['expression']) &&
      ((attribute['expression']['type'] === 'Literal' &&
        attribute['expression']['value'] === true) ||
        (attribute['expression']['type'] === 'Identifier' &&
          typeof attribute['expression']['name'] === 'string' &&
          bindings.get(attribute['expression']['name']) === 'true'))
    )
      classes.add(attribute['name']);
    if (attribute['type'] !== 'Attribute' || attribute['name'] !== 'class') continue;
    const staticValue = staticAttributeValue(attribute);
    if (staticValue !== undefined) {
      for (const className of staticValue.split(/\s+/).filter(Boolean)) classes.add(className);
      continue;
    }

    const value = attribute['value'];
    const parts = Array.isArray(value) ? value : [value];
    for (const part of parts) {
      if (!isRecord(part)) continue;
      if (part['type'] === 'Text' && typeof part['data'] === 'string') {
        for (const className of part['data'].split(/\s+/).filter(Boolean)) classes.add(className);
        continue;
      }
      if (part['type'] !== 'ExpressionTag' || !isRecord(part['expression'])) continue;
      const expression = part['expression'];
      if (expression['type'] === 'ArrayExpression' && Array.isArray(expression['elements'])) {
        for (const arrayElement of expression['elements']) {
          const className = isRecord(arrayElement)
            ? staticStringFromExpression(arrayElement, bindings)
            : undefined;
          if (className) className.split(/\s+/).forEach((name) => classes.add(name));
        }
      }
      if (expression['type'] === 'ObjectExpression' && Array.isArray(expression['properties'])) {
        for (const property of expression['properties']) {
          if (
            !isRecord(property) ||
            property['type'] !== 'Property' ||
            property['computed'] === true
          )
            continue;
          const key = property['key'];
          const enabled = property['value'];
          const className = isRecord(key)
            ? (staticStringFromExpression(key, bindings) ??
              (key['type'] === 'Identifier' && typeof key['name'] === 'string'
                ? key['name']
                : undefined))
            : undefined;
          if (
            className &&
            isRecord(enabled) &&
            enabled['type'] === 'Literal' &&
            enabled['value'] === true
          )
            classes.add(className);
        }
      }
      if (
        expression['type'] !== 'CallExpression' ||
        !isRecord(expression['callee']) ||
        expression['callee']['type'] !== 'Identifier' ||
        expression['callee']['name'] !== 'classNames' ||
        !Array.isArray(expression['arguments'])
      )
        continue;
      for (const className of expression['arguments'].flatMap(
        (argument) => staticStringFromExpression(argument, bindings)?.split(/\s+/) ?? [],
      ))
        if (className) classes.add(className);
    }
  }
  return classes;
}

function isPanelLikeClassSet(classes: ReadonlySet<string>): boolean {
  return [...classes].some((className) =>
    /(?:floating|surface|menu|popover|dialog|modal|drawer|tooltip|dropdown|sheet|panel|listbox|combobox|command)/i.test(
      className,
    ),
  );
}

function collectSharedFloatingTargets(source: string): SharedFloatingTarget[] {
  const fragment = parseSvelteFragment(source);
  const bindings = staticStringBindings(source);
  const targets: SharedFloatingTarget[] = [];
  if (fragment === undefined) return targets;
  walkAst(fragment, (node) => {
    if (node['type'] !== 'RegularElement' && node['type'] !== 'SvelteElement') return;
    const classes = elementClassSet(node, bindings);
    if (!classes.has('cinder-_floating-surface')) return;
    const attributes = new Map<string, string | true>();
    let id: string | undefined;
    if (Array.isArray(node['attributes']))
      for (const attribute of node['attributes']) {
        if (
          !isRecord(attribute) ||
          attribute['type'] !== 'Attribute' ||
          typeof attribute['name'] !== 'string' ||
          attribute['name'] === 'class'
        )
          continue;
        const value = attribute['value'] === true ? true : staticAttributeValue(attribute);
        if (value === undefined) continue;
        attributes.set(attribute['name'].toLowerCase(), value);
        if (attribute['name'] === 'id' && typeof value === 'string') id = value;
      }
    const tags =
      node['type'] === 'RegularElement' && typeof node['name'] === 'string'
        ? [node['name'].toLowerCase()]
        : [...possibleStaticStringsFromExpression(node['tag'], bindings)].map((tag) =>
            tag.toLowerCase(),
          );
    for (const tag of tags.length > 0 ? tags : [undefined])
      targets.push({
        ...(tag === undefined ? {} : { tag }),
        ...(id === undefined ? {} : { id }),
        classes,
        attributes,
      });
  });
  return targets;
}

function inlineStylePrimitiveCounts(source: string): CssPrimitiveCounts {
  const fragment = parseSvelteFragment(source);
  const bindings = staticStringBindings(source);
  const total: CssPrimitiveCounts = { grid: 0, floating: 0 };
  const parsedRoot: unknown = parseSvelte(source, { modern: true });
  if (isRecord(parsedRoot) && isRecord(parsedRoot['css'])) {
    const content = parsedRoot['css']['content'];
    const styleSource =
      isRecord(content) && typeof content['styles'] === 'string' ? content['styles'] : undefined;
    if (styleSource !== undefined) {
      const styleCounts = cssPrimitiveCounts(styleSource, collectSharedFloatingTargets(source));
      total.grid += styleCounts.grid;
      total.floating += styleCounts.floating;
    }
  }
  if (fragment === undefined) return total;
  walkAst(fragment, (node) => {
    if (
      (node['type'] !== 'RegularElement' && node['type'] !== 'SvelteElement') ||
      !Array.isArray(node['attributes'])
    )
      return;
    const classes = elementClassSet(node, bindings);
    const declarations = new Map<string, string>();
    for (const attribute of node['attributes']) {
      if (!isRecord(attribute)) continue;
      if (attribute['type'] === 'Attribute' && attribute['name'] === 'style') {
        const attributeValue = attribute['value'];
        const expressionTag =
          isRecord(attributeValue) && attributeValue['type'] === 'ExpressionTag'
            ? attributeValue
            : Array.isArray(attributeValue) &&
                attributeValue.length === 1 &&
                isRecord(attributeValue[0]) &&
                attributeValue[0]['type'] === 'ExpressionTag'
              ? attributeValue[0]
              : undefined;
        for (const [property, declarationValue] of styleObjectDeclarations(
          expressionTag?.['expression'],
          source,
        ))
          declarations.set(property, declarationValue);
        const value = attributeValueWithDynamics(attribute, bindings);
        if (value === undefined || !value.includes(':')) continue;
        const root = parseCss(`:root { ${value} }`);
        const rule = root.first;
        if (rule?.type === 'rule')
          for (const [property, declarationValue] of declarationMap(rule))
            declarations.set(property, declarationValue);
      }
      if (attribute['type'] === 'StyleDirective' && typeof attribute['name'] === 'string') {
        const value = attribute['value'];
        const expressionTag =
          isRecord(value) && value['type'] === 'ExpressionTag'
            ? value
            : Array.isArray(value) && value.length === 1 && isRecord(value[0])
              ? value[0]
              : undefined;
        const possibleValues =
          expressionTag !== undefined
            ? possibleStaticStringsFromExpression(expressionTag['expression'], bindings)
            : new Set<string>();
        const normalizedValues = [...possibleValues].map((candidate) => candidate.toLowerCase());
        const allLayeringValues =
          normalizedValues.length > 0 &&
          normalizedValues.every((candidate) => candidate === 'absolute' || candidate === 'fixed');
        declarations.set(
          attribute['name'].toLowerCase(),
          allLayeringValues
            ? 'absolute'
            : (attributeValueWithDynamics(attribute, bindings)?.toLowerCase() ??
                'var(--cinder-dynamic-value)'),
        );
      }
    }
    const display = declarations.get('display');
    if (
      (display === 'grid' || display === 'inline-grid') &&
      gridDefinitionProperties.some((property) => declarations.has(property))
    )
      total.grid++;
    const position = declarations.get('position');
    const zIndex = declarations.get('z-index')?.trim();
    if (
      (position === 'absolute' || position === 'fixed') &&
      zIndex !== undefined &&
      !['auto', 'inherit', 'initial', 'revert', 'revert-layer', 'unset'].includes(zIndex) &&
      (classes.size === 0 || isPanelLikeClassSet(classes)) &&
      !classes.has('cinder-_floating-surface')
    )
      total.floating++;
  });
  return total;
}

export function shouldCheckComponentSource(filePath: string): boolean {
  return !isExcludedComponentSource(filePath);
}

export { missingMigrationRecordPaths } from './primitive-composition-migrations.ts';

export function findPrimitiveCompositionViolations(
  source: string,
  filePath: string,
  companionSource: string | readonly string[] = '',
): PrimitiveCompositionViolation[] {
  const normalized = filePath
    .replaceAll('\\', '/')
    .replace(/^.*packages\/components\/src\/components\//, '');
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
  const companionSources =
    typeof companionSource === 'string' ? [companionSource] : companionSource;
  const counts = normalized.endsWith('.css')
    ? cssPrimitiveCounts(
        source,
        companionSources.flatMap((candidate) => collectSharedFloatingTargets(candidate)),
      )
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

if (import.meta.main)
  await runPrimitiveCompositionCheck(
    shouldCheckComponentSource,
    findPrimitiveCompositionViolations,
    missingMigrationRecordPaths,
  );
