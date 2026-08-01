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

function isInternalLayerTarget(target: SelectorTarget): boolean {
  return [...target.classes].some((className) => {
    if (/(?:indicator|track|fill|thumb|handle|icon|caret|separator|progress)/i.test(className))
      return true;
    // `summary` is restricted to the class name's final BEM segment (e.g.
    // `phone-input__country-summary`) rather than a bare substring match —
    // a panel-like class such as `order-summary-panel` legitimately needs
    // the shared floating-surface primitive and must not be exempted just
    // because it contains the word "summary".
    return /(?:^|[-_])summary$/i.test(className);
  });
}

type AttributeConstraint = {
  operator: string | undefined;
  value: string | undefined;
  insensitive: boolean;
};

type SelectorTarget = {
  ancestorSignature?: string;
  tag?: string;
  id?: string;
  classes: Set<string>;
  attributes: Map<string, AttributeConstraint>;
  functionalConstraints: Array<{
    kind: 'not' | 'any';
    alternatives: SelectorTarget[];
  }>;
};

function normalizeAttributeValue(value: string, insensitive: boolean): string {
  return insensitive ? value.toLowerCase() : value;
}

function attributeOperatorMatches(
  operator: string | undefined,
  actual: string,
  expected: string,
): boolean {
  if (operator === undefined) return true;
  if (operator === '=') return actual === expected;
  if (operator === '~=') return actual.split(/\s+/).includes(expected);
  if (operator === '|=') return actual === expected || actual.startsWith(`${expected}-`);
  if (operator === '^=') return actual.startsWith(expected);
  if (operator === '$=') return actual.endsWith(expected);
  if (operator === '*=') return actual.includes(expected);
  return true;
}

function attributeConstraintNecessarilyMatches(
  peer: AttributeConstraint,
  alternative: AttributeConstraint,
): boolean {
  if (alternative.operator === undefined) return true;
  if (
    peer.operator !== alternative.operator ||
    peer.value === undefined ||
    alternative.value === undefined
  )
    return false;
  if (alternative.insensitive) return peer.value.toLowerCase() === alternative.value.toLowerCase();
  return !peer.insensitive && peer.value === alternative.value;
}

function targetNecessarilyMatches(peer: SelectorTarget, alternative: SelectorTarget): boolean {
  return (
    (alternative.tag === undefined || peer.tag === alternative.tag) &&
    (alternative.id === undefined || peer.id === alternative.id) &&
    [...alternative.classes].every((className) => peer.classes.has(className)) &&
    [...alternative.attributes].every(([name, constraint]) => {
      const peerConstraint = peer.attributes.get(name);
      return (
        peerConstraint !== undefined &&
        attributeConstraintNecessarilyMatches(peerConstraint, constraint)
      );
    })
  );
}

function mediaType(query: string): { name: string; negated: boolean } | undefined {
  const match = query.match(/^\s*(not\s+|only\s+)?([a-z][\w-]*)\b/i);
  if (match?.[2] === undefined) return undefined;
  return { name: match[2].toLowerCase(), negated: match[1]?.trim() === 'not' };
}

function mergeSelectorTargets(outer: SelectorTarget, inner: SelectorTarget): SelectorTarget {
  return {
    ...((outer.tag ?? inner.tag) ? { tag: outer.tag ?? inner.tag } : {}),
    ...((outer.id ?? inner.id) ? { id: outer.id ?? inner.id } : {}),
    classes: new Set([...outer.classes, ...inner.classes]),
    attributes: new Map([...outer.attributes, ...inner.attributes]),
    functionalConstraints: [...outer.functionalConstraints, ...inner.functionalConstraints],
  };
}

function selectorTargetFromNodes(nodes: readonly selectorParser.Node[]): SelectorTarget {
  const target: SelectorTarget = {
    classes: new Set(),
    attributes: new Map(),
    functionalConstraints: [],
  };
  for (const node of nodes) {
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
  for (const node of nodes) {
    if (
      node.type === 'pseudo' &&
      (node.value === ':not' || node.value === ':is' || node.value === ':where') &&
      Array.isArray(node.nodes)
    )
      target.functionalConstraints.push({
        kind: node.value === ':not' ? 'not' : 'any',
        alternatives: node.nodes.map((selectorNode) =>
          mergeSelectorTargets(target, selectorTargetFromNodes(selectorNode.nodes)),
        ),
      });
  }
  return target;
}

function lastIndexOfCombinator(nodes: ReadonlyArray<{ type: string }>): number {
  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index];
    if (node && node.type === 'combinator') return index;
  }
  return -1;
}

function selectorTargets(selector: string): SelectorTarget[] {
  const targets: SelectorTarget[] = [];
  selectorParser((root) => {
    root.each((selectorNode) => {
      const lastCombinator = lastIndexOfCombinator(selectorNode.nodes);
      const targetNodes = selectorNode.nodes.slice(lastCombinator + 1);
      if (targetNodes.some((node) => node.type === 'pseudo' && node.value.startsWith('::'))) return;
      const target = selectorTargetFromNodes(targetNodes);
      if (lastCombinator >= 0) {
        const ancestorSignature = selectorNode.nodes
          .slice(0, lastCombinator)
          .map((node) => node.toString())
          .join('')
          .trim();
        if (ancestorSignature) target.ancestorSignature = ancestorSignature;
      }
      targets.push(target);
    });
  }).processSync(selector);
  return targets;
}

function alternativeAddsConstraints(target: SelectorTarget, alternative: SelectorTarget): boolean {
  return (
    (alternative.id !== undefined && alternative.id !== target.id) ||
    [...alternative.classes].some((className) => !target.classes.has(className)) ||
    [...alternative.attributes].some(([name, constraint]) => {
      const targetConstraint = target.attributes.get(name);
      return (
        targetConstraint === undefined ||
        targetConstraint.operator !== constraint.operator ||
        targetConstraint.value !== constraint.value ||
        targetConstraint.insensitive !== constraint.insensitive
      );
    })
  );
}

function negatesTag(target: SelectorTarget, other: SelectorTarget): boolean {
  const mergedTarget = mergeSelectorTargets(target, other);
  return (
    other.tag !== undefined &&
    target.functionalConstraints.some(
      ({ kind, alternatives }) =>
        kind === 'not' &&
        alternatives.some(
          (alternative) =>
            (alternative.tag === other.tag &&
              target.tag === undefined &&
              !alternativeAddsConstraints(target, alternative)) ||
            (alternative.tag === other.tag &&
              targetNecessarilyMatches(mergedTarget, alternative)) ||
            targetNecessarilyMatches(other, alternative),
        ),
    )
  );
}

function hasCompoundNegatedTagAnchor(target: SelectorTarget, other: SelectorTarget): boolean {
  const mergedTarget = mergeSelectorTargets(target, other);
  return (
    target.tag === undefined &&
    other.tag !== undefined &&
    target.functionalConstraints.some(
      ({ kind, alternatives }) =>
        kind === 'not' &&
        alternatives.some(
          (alternative) =>
            alternative.tag === other.tag &&
            alternativeAddsConstraints(target, alternative) &&
            !targetNecessarilyMatches(mergedTarget, alternative),
        ),
    )
  );
}

function targetsCanMatchSameElement(left: SelectorTarget, right: SelectorTarget): boolean {
  if (negatesTag(left, right) || negatesTag(right, left)) return false;
  const leftAncestorIds = [...(left.ancestorSignature?.matchAll(/#([\w-]+)/g) ?? [])].map(
    (match) => match[1],
  );
  const rightAncestorIds = [...(right.ancestorSignature?.matchAll(/#([\w-]+)/g) ?? [])].map(
    (match) => match[1],
  );
  if (
    leftAncestorIds.length > 0 &&
    rightAncestorIds.length > 0 &&
    !leftAncestorIds.some((id) => rightAncestorIds.includes(id))
  )
    return false;
  const hasConflictingAttribute = [...left.attributes].some(([attribute, leftConstraint]) => {
    const rightConstraint = right.attributes.get(attribute);
    if (rightConstraint === undefined) return false;
    const leftValue = leftConstraint.value;
    const rightValue = rightConstraint.value;
    if (leftValue === undefined || rightValue === undefined) return false;
    const insensitive = leftConstraint.insensitive || rightConstraint.insensitive;
    const leftNormalized = normalizeAttributeValue(leftValue, insensitive);
    const rightNormalized = normalizeAttributeValue(rightValue, insensitive);
    if (leftConstraint.operator === '=' && rightConstraint.operator !== '=')
      return !attributeOperatorMatches(rightConstraint.operator, leftNormalized, rightNormalized);
    if (rightConstraint.operator === '=' && leftConstraint.operator !== '=')
      return !attributeOperatorMatches(leftConstraint.operator, rightNormalized, leftNormalized);
    return (
      leftConstraint.operator === '=' &&
      rightConstraint.operator === '=' &&
      leftNormalized !== rightNormalized
    );
  });
  const shareAnchor =
    (left.id !== undefined && left.id === right.id) ||
    (left.tag !== undefined && left.tag === right.tag) ||
    (left.tag !== undefined && right.classes.size > 0) ||
    (right.tag !== undefined && left.classes.size > 0) ||
    [...left.classes].some((className) => right.classes.has(className)) ||
    [...left.attributes.keys()].some((attribute) => right.attributes.has(attribute)) ||
    hasCompoundNegatedTagAnchor(left, right) ||
    hasCompoundNegatedTagAnchor(right, left);
  const functionalAnchor = left.functionalConstraints.some(
    ({ kind, alternatives }) =>
      kind === 'any' &&
      alternatives.some(
        (alternative) =>
          targetsCanMatchSameElement(alternative, right) ||
          (alternative.tag !== undefined && alternative.tag === right.tag),
      ),
  );
  const reverseFunctionalAnchor = right.functionalConstraints.some(
    ({ kind, alternatives }) =>
      kind === 'any' &&
      alternatives.some(
        (alternative) =>
          targetsCanMatchSameElement(alternative, left) ||
          (alternative.tag !== undefined && alternative.tag === left.tag),
      ),
  );
  return (
    (shareAnchor || functionalAnchor || reverseFunctionalAnchor) &&
    !hasConflictingAttribute &&
    (left.id === undefined || right.id === undefined || left.id === right.id) &&
    (left.tag === undefined || right.tag === undefined || left.tag === right.tag)
  );
}

function functionalConstraintsCanOverlap(left: SelectorTarget, right: SelectorTarget): boolean {
  for (const constraint of left.functionalConstraints) {
    if (
      constraint.kind === 'not' &&
      constraint.alternatives.some((alternative) => targetNecessarilyMatches(right, alternative))
    )
      return false;
    if (
      constraint.kind === 'any' &&
      !constraint.alternatives.some((alternative) => targetsCanMatchSameElement(alternative, right))
    )
      return false;
  }
  for (const constraint of right.functionalConstraints) {
    if (
      constraint.kind === 'not' &&
      constraint.alternatives.some((alternative) => targetNecessarilyMatches(left, alternative))
    )
      return false;
    if (
      constraint.kind === 'any' &&
      !constraint.alternatives.some((alternative) => targetsCanMatchSameElement(alternative, left))
    )
      return false;
  }
  return true;
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
  for (const match of parameters.matchAll(
    /\(\s*width\s*(<|<=|>|>=)\s*(\d+(?:\.\d+)?)\s*(px|r?em)\s*\)/gi,
  )) {
    if (match[1] === undefined || match[2] === undefined || match[3] === undefined) continue;
    const operator = match[1];
    bounds.push({
      kind: operator.startsWith('>') ? 'minimum' : 'maximum',
      value: Number(match[2]) + (operator === '>' ? 0.000001 : operator === '<' ? -0.000001 : 0),
      unit: match[3].toLowerCase() === 'px' ? 'px' : 'root-em',
    });
  }
  for (const match of parameters.matchAll(
    /\(\s*(\d+(?:\.\d+)?)\s*(px|r?em)\s*(<|<=|>|>=)\s*width\s*\)/gi,
  )) {
    if (match[1] === undefined || match[2] === undefined || match[3] === undefined) continue;
    const operator = match[3];
    bounds.push({
      kind: operator.startsWith('<') ? 'minimum' : 'maximum',
      value: Number(match[1]) + (operator === '<' ? 0.000001 : operator === '>' ? -0.000001 : 0),
      unit: match[2].toLowerCase() === 'px' ? 'px' : 'root-em',
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

function conditionalQueryBranches(parameters: string): string[] {
  const branches: string[] = [];
  let parenthesisDepth = 0;
  let branchStart = 0;
  for (let index = 0; index < parameters.length; index++) {
    const character = parameters[index];
    if (character === '(') parenthesisDepth++;
    if (character === ')') parenthesisDepth--;
    if (character !== ',' || parenthesisDepth !== 0) continue;
    branches.push(parameters.slice(branchStart, index).trim());
    branchStart = index + 1;
  }
  branches.push(parameters.slice(branchStart).trim());
  return branches.filter(Boolean);
}

function conditionalQueryBranchesConflict(left: string, right: string): boolean {
  const leftType = mediaType(left);
  const rightType = mediaType(right);
  if (
    leftType !== undefined &&
    rightType !== undefined &&
    ((leftType.name !== 'all' && rightType.name !== 'all' && leftType.name !== rightType.name) ||
      leftType.negated !== rightType.negated)
  )
    return true;
  const bounds = [...widthBounds(left), ...widthBounds(right)];
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
  const leftDiscrete = discreteConditions(left);
  const rightDiscrete = discreteConditions(right);
  return [...leftDiscrete].some(
    ([feature, value]) => rightDiscrete.has(feature) && rightDiscrete.get(feature) !== value,
  );
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
  if (left.name === 'container') {
    const leftName = left.parameters.match(/^([\w-]+)\s+/)?.[1] ?? '';
    const rightName = right.parameters.match(/^([\w-]+)\s+/)?.[1] ?? '';
    if (leftName !== rightName) return false;
  }
  const leftBranches = conditionalQueryBranches(left.parameters);
  const rightBranches = conditionalQueryBranches(right.parameters);
  return leftBranches.every((leftBranch) =>
    rightBranches.every((rightBranch) => conditionalQueryBranchesConflict(leftBranch, rightBranch)),
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
      .filter(
        (rightTarget) =>
          targetsCanMatchSameElement(leftTarget, rightTarget) &&
          functionalConstraintsCanOverlap(leftTarget, rightTarget),
      )
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
    ) &&
    target.functionalConstraints.every(({ kind, alternatives }) =>
      kind === 'not'
        ? alternatives.every(
            (alternative) => !targetMatchesSharedFloatingElement(alternative, sharedTarget),
          )
        : alternatives.some((alternative) =>
            targetMatchesSharedFloatingElement(alternative, sharedTarget),
          ),
    )
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
            ([positionTarget, zIndexTarget]) => {
              if (isInternalLayerTarget(positionTarget) || isInternalLayerTarget(zIndexTarget))
                return false;
              const sharedPair = sharedTargets.some(
                (sharedTarget) =>
                  targetMatchesSharedFloatingElement(positionTarget, sharedTarget) &&
                  targetMatchesSharedFloatingElement(zIndexTarget, sharedTarget),
              );
              const bothExplicitlyShared =
                positionTarget.classes.has('cinder-_floating-surface') &&
                zIndexTarget.classes.has('cinder-_floating-surface');
              return !sharedPair && !bothExplicitlyShared;
            },
          ).length,
        0,
      ),
    0,
  );

  return { grid, floating };
}
