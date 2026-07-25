import { parse as parseCss, type Rule } from 'postcss';
import selectorParser from 'postcss-selector-parser';

export type CssPrimitiveCounts = {
  grid: number;
  floating: number;
};

export const gridDefinitionProperties = [
  'grid',
  'grid-template',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'grid-auto-columns',
  'grid-auto-rows',
] as const;

export function declarationMap(rule: Rule): Map<string, string> {
  const declarations = new Map<string, string>();
  rule.each((node) => {
    if (node.type === 'decl') declarations.set(node.prop.toLowerCase(), node.value.toLowerCase());
  });
  return declarations;
}

type SelectorTarget = {
  tag?: string;
  id?: string;
  classes: Set<string>;
  attributes: Map<
    string,
    { operator: string | undefined; value: string | undefined; insensitive: boolean }
  >;
};

function selectorTargets(selector: string): SelectorTarget[] {
  const targets: SelectorTarget[] = [];
  selectorParser((root) => {
    root.each((selectorNode) => {
      const lastCombinator = selectorNode.nodes.findLastIndex((node) => node.type === 'combinator');
      const targetNodes = selectorNode.nodes.slice(lastCombinator + 1);
      if (targetNodes.some((node) => node.type === 'pseudo' && node.value.startsWith('::'))) return;
      const target: SelectorTarget = {
        classes: new Set(),
        attributes: new Map(),
      };
      for (const node of targetNodes) {
        if (node.type === 'class') target.classes.add(node.value);
        if (node.type === 'id') target.id = node.value;
        if (node.type === 'tag') target.tag = node.value.toLowerCase();
        if (node.type === 'attribute')
          target.attributes.set(node.attribute.toLowerCase(), {
            operator: node.operator,
            value: node.value,
            insensitive: node.insensitive === true,
          });
      }
      targets.push(target);
    });
  }).processSync(selector);
  return targets;
}

function targetsCanMatchSameElement(left: SelectorTarget, right: SelectorTarget): boolean {
  const hasConflictingAttribute = [...left.attributes].some(([attribute, leftConstraint]) => {
    const rightConstraint = right.attributes.get(attribute);
    if (
      rightConstraint?.operator !== '=' ||
      leftConstraint.operator !== '=' ||
      rightConstraint.value === undefined ||
      leftConstraint.value === undefined
    )
      return false;
    return leftConstraint.insensitive || rightConstraint.insensitive
      ? leftConstraint.value.toLowerCase() !== rightConstraint.value.toLowerCase()
      : leftConstraint.value !== rightConstraint.value;
  });
  const shareAnchor =
    (left.id !== undefined && left.id === right.id) ||
    (left.tag !== undefined && left.tag === right.tag) ||
    [...left.classes].some((className) => right.classes.has(className)) ||
    [...left.attributes.keys()].some((attribute) => right.attributes.has(attribute));
  return (
    shareAnchor &&
    !hasConflictingAttribute &&
    (left.id === undefined || right.id === undefined || left.id === right.id) &&
    (left.tag === undefined || right.tag === undefined || left.tag === right.tag)
  );
}

type ConditionalScope = { name: string; parameters: string };

function conditionalScope(rule: Rule): ConditionalScope[] {
  const scope: ConditionalScope[] = [];
  let parent = rule.parent;
  while (parent !== undefined) {
    if (
      parent.type === 'atrule' &&
      ['container', 'document', 'media', 'supports'].includes(parent.name.toLowerCase())
    )
      scope.unshift({
        name: parent.name.toLowerCase(),
        parameters: parent.params.trim().replace(/\s+/g, ' ').toLowerCase(),
      });
    const nextParent = parent.parent;
    if (nextParent?.type === 'document') break;
    parent = nextParent;
  }
  return scope;
}

function widthBounds(parameters: string): { minimum?: number; maximum?: number } {
  const minimumMatch = /\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/i.exec(parameters);
  const maximumMatch = /\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/i.exec(parameters);
  return {
    ...(minimumMatch?.[1] === undefined ? {} : { minimum: Number(minimumMatch[1]) }),
    ...(maximumMatch?.[1] === undefined ? {} : { maximum: Number(maximumMatch[1]) }),
  };
}

function discreteConditions(parameters: string): Map<string, string> {
  const conditions = new Map<string, string>();
  for (const match of parameters.matchAll(
    /\(\s*(orientation|prefers-color-scheme|prefers-reduced-motion)\s*:\s*([^)]+?)\s*\)/gi,
  ))
    if (match[1] !== undefined && match[2] !== undefined)
      conditions.set(match[1].toLowerCase(), match[2].toLowerCase());
  return conditions;
}

function conditionalScopesConflict(left: ConditionalScope, right: ConditionalScope): boolean {
  if (left.name !== right.name) return false;
  if (left.name === 'supports') {
    const leftWithoutNot = left.parameters.replace(/^not\s+/, '');
    const rightWithoutNot = right.parameters.replace(/^not\s+/, '');
    return (
      leftWithoutNot === rightWithoutNot &&
      left.parameters.startsWith('not ') !== right.parameters.startsWith('not ')
    );
  }
  if (left.name !== 'media' && left.name !== 'container') return false;
  const leftBounds = widthBounds(left.parameters);
  const rightBounds = widthBounds(right.parameters);
  const minimum = Math.max(leftBounds.minimum ?? -Infinity, rightBounds.minimum ?? -Infinity);
  const maximum = Math.min(leftBounds.maximum ?? Infinity, rightBounds.maximum ?? Infinity);
  if (minimum > maximum) return true;
  const leftDiscrete = discreteConditions(left.parameters);
  const rightDiscrete = discreteConditions(right.parameters);
  return [...leftDiscrete].some(
    ([feature, value]) => rightDiscrete.has(feature) && rightDiscrete.get(feature) !== value,
  );
}

function conditionalScopesCanOverlap(left: Rule, right: Rule): boolean {
  const leftScope = conditionalScope(left);
  const rightScope = conditionalScope(right);
  return !leftScope.some((leftCondition) =>
    rightScope.some((rightCondition) => conditionalScopesConflict(leftCondition, rightCondition)),
  );
}

function selectorsCanMatchSameElement(left: Rule, right: Rule): boolean {
  if (!conditionalScopesCanOverlap(left, right)) return false;
  const leftTargets = selectorTargets(left.selector);
  const rightTargets = selectorTargets(right.selector);
  return leftTargets.some((leftTarget) =>
    rightTargets.some(
      (rightTarget) => left === right || targetsCanMatchSameElement(leftTarget, rightTarget),
    ),
  );
}

function isInsideKeyframes(rule: Rule): boolean {
  let parent = rule.parent;
  while (parent !== undefined) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return true;
    const nextParent = parent.parent;
    if (nextParent?.type === 'document') break;
    parent = nextParent;
  }
  return false;
}

function ruleUsesSharedFloatingSurface(
  rule: Rule,
  sharedClassSets: readonly ReadonlySet<string>[],
): boolean {
  const targets = selectorTargets(rule.selector);
  return (
    targets.length > 0 &&
    targets.every(
      (target) =>
        target.classes.has('cinder-_floating-surface') ||
        (target.classes.size > 0 &&
          sharedClassSets.some((sharedClasses) =>
            [...target.classes].every((className) => sharedClasses.has(className)),
          )),
    )
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
    if (!isInsideKeyframes(rule) && selectorTargets(rule.selector).length > 0)
      rules.push({ rule, declarations: declarationMap(rule) });
  });

  const templateRules = rules.filter(({ declarations }) =>
    gridDefinitionProperties.some((property) => declarations.has(property)),
  );
  const displayRules = rules.filter(({ declarations }) => {
    const display = declarations.get('display');
    return display === 'grid' || display === 'inline-grid';
  });
  const grid = displayRules.reduce(
    (count, { rule }) =>
      count +
      templateRules.filter(({ rule: templateRule }) =>
        selectorsCanMatchSameElement(rule, templateRule),
      ).length,
    0,
  );

  const positionRules = rules.filter(({ declarations }) => {
    const position = declarations.get('position');
    return position === 'absolute' || position === 'fixed';
  });
  const cssWideKeywords = new Set([
    'auto',
    'inherit',
    'initial',
    'revert',
    'revert-layer',
    'unset',
  ]);
  const zIndexRules = rules.filter(({ declarations }) => {
    const zIndex = declarations.get('z-index')?.trim();
    return zIndex !== undefined && !cssWideKeywords.has(zIndex);
  });
  const floating = positionRules.reduce(
    (count, { rule }) =>
      count +
      zIndexRules.filter(
        ({ rule: zIndexRule }) =>
          selectorsCanMatchSameElement(rule, zIndexRule) &&
          !ruleUsesSharedFloatingSurface(rule, sharedClassSets) &&
          !ruleUsesSharedFloatingSurface(zIndexRule, sharedClassSets),
      ).length,
    0,
  );

  return { grid, floating };
}
