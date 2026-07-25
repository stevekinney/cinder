import { parse as parseCss, type Rule } from 'postcss';
import selectorParser from 'postcss-selector-parser';

export type CssPrimitiveCounts = {
  grid: number;
  floating: number;
};

export type SharedFloatingTarget = {
  tag?: string;
  id?: string;
  classes: ReadonlySet<string>;
  attributes: ReadonlyMap<string, string | true>;
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

type AttributeConstraint = {
  operator: string | undefined;
  value: string | undefined;
  insensitive: boolean;
};

type SelectorTarget = {
  tag?: string;
  id?: string;
  classes: Set<string>;
  attributes: Map<string, AttributeConstraint>;
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

type WidthBound = { kind: 'minimum' | 'maximum'; value: number; unit: 'px' | 'root-em' };

function widthBounds(parameters: string): WidthBound[] {
  const bounds: WidthBound[] = [];
  for (const match of parameters.matchAll(
    /\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)\s*(px|r?em)\s*\)/gi,
  )) {
    if (match[1] === undefined || match[2] === undefined || match[3] === undefined) continue;
    bounds.push({
      kind: match[1].toLowerCase() === 'min' ? 'minimum' : 'maximum',
      value: Number(match[2]),
      // Media-query em and rem units both resolve against the initial root font size.
      unit: match[3].toLowerCase() === 'px' ? 'px' : 'root-em',
    });
  }
  return bounds;
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
  const bounds = [...widthBounds(left.parameters), ...widthBounds(right.parameters)];
  for (const unit of ['px', 'root-em'] as const) {
    const comparableBounds = bounds.filter((bound) => bound.unit === unit);
    const minimum = Math.max(
      ...comparableBounds.filter((bound) => bound.kind === 'minimum').map((bound) => bound.value),
      -Infinity,
    );
    const maximum = Math.min(
      ...comparableBounds.filter((bound) => bound.kind === 'maximum').map((bound) => bound.value),
      Infinity,
    );
    if (minimum > maximum) return true;
  }
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

function compatibleSelectorTargetPairs(
  left: Rule,
  right: Rule,
): Array<readonly [SelectorTarget, SelectorTarget]> {
  if (!conditionalScopesCanOverlap(left, right)) return [];
  const leftTargets = selectorTargets(left.selector);
  const rightTargets = selectorTargets(right.selector);
  if (left === right) return leftTargets.map((target) => [target, target] as const);
  return leftTargets.flatMap((leftTarget) =>
    rightTargets
      .filter((rightTarget) => targetsCanMatchSameElement(leftTarget, rightTarget))
      .map((rightTarget) => [leftTarget, rightTarget] as const),
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

function attributeConstraintMatches(
  actualValue: string | true | undefined,
  constraint: AttributeConstraint,
): boolean {
  if (actualValue === undefined) return false;
  if (constraint.operator === undefined) return true;
  if (actualValue === true || constraint.value === undefined) return false;
  const actual = constraint.insensitive ? actualValue.toLowerCase() : actualValue;
  const expected = constraint.insensitive ? constraint.value.toLowerCase() : constraint.value;
  if (constraint.operator === '=') return actual === expected;
  if (constraint.operator === '~=') return actual.split(/\s+/).includes(expected);
  if (constraint.operator === '|=') return actual === expected || actual.startsWith(`${expected}-`);
  if (constraint.operator === '^=') return actual.startsWith(expected);
  if (constraint.operator === '$=') return actual.endsWith(expected);
  if (constraint.operator === '*=') return actual.includes(expected);
  return false;
}

function targetMatchesSharedFloatingElement(
  target: SelectorTarget,
  sharedTarget: SharedFloatingTarget,
): boolean {
  return (
    (target.tag === undefined || target.tag === sharedTarget.tag) &&
    (target.id === undefined || target.id === sharedTarget.id) &&
    [...target.classes].every((className) => sharedTarget.classes.has(className)) &&
    [...target.attributes].every(([name, constraint]) =>
      attributeConstraintMatches(sharedTarget.attributes.get(name), constraint),
    )
  );
}

function targetUsesSharedFloatingSurface(
  target: SelectorTarget,
  sharedTargets: readonly SharedFloatingTarget[],
): boolean {
  return (
    target.classes.has('cinder-_floating-surface') ||
    sharedTargets.some((sharedTarget) => targetMatchesSharedFloatingElement(target, sharedTarget))
  );
}

export function cssPrimitiveCounts(
  source: string,
  sharedTargets: readonly SharedFloatingTarget[] = [],
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
      templateRules.reduce(
        (pairCount, { rule: templateRule }) =>
          pairCount + compatibleSelectorTargetPairs(rule, templateRule).length,
        0,
      ),
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
      zIndexRules.reduce(
        (pairCount, { rule: zIndexRule }) =>
          pairCount +
          compatibleSelectorTargetPairs(rule, zIndexRule).filter(
            ([positionTarget, zIndexTarget]) =>
              !targetUsesSharedFloatingSurface(positionTarget, sharedTargets) &&
              !targetUsesSharedFloatingSurface(zIndexTarget, sharedTargets),
          ).length,
        0,
      ),
    0,
  );

  return { grid, floating };
}
