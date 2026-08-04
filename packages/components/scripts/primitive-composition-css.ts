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
  const importantProperties = new Set<string>();
  rule.each((node) => {
    if (node.type !== 'decl') return;
    const property = node.prop.toLowerCase();
    const important = node.important || /!important\s*$/i.test(node.value);
    if (!important && importantProperties.has(property)) return;
    const value = node.value
      .replace(/\s*!important\s*$/i, '')
      .trim()
      .toLowerCase();
    declarations.set(property, value);
    if (important) importantProperties.add(property);
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
  directParentTag?: string;
  directParentId?: string;
  tag?: string;
  id?: string;
  impossible?: boolean;
  classes: Set<string>;
  attributes: Map<string, AttributeConstraint>;
  attributeConstraints: Map<string, AttributeConstraint[]>;
  functionalConstraints: Array<{
    kind: 'not' | 'any';
    alternatives: SelectorTarget[];
  }>;
  unknownPseudos: Set<string>;
};

function attributeConstraintsFor(
  target: SelectorTarget,
  name: string,
): readonly AttributeConstraint[] {
  return (
    target.attributeConstraints.get(name) ??
    (target.attributes.get(name) ? [target.attributes.get(name)!] : [])
  );
}

function normalizeAttributeValue(value: string, insensitive: boolean): string {
  return insensitive ? value.toLowerCase() : value;
}

function exactPositionalPseudo(pseudo: string): { axis: string; position: number } | undefined {
  const match = pseudo.match(
    /^:(nth-child|nth-last-child|nth-of-type|nth-last-of-type)\(\s*([+-]?\d+)\s*\)$/,
  );
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  return { axis: match[1], position: Number(match[2]) };
}

function positionalPseudosConflict(
  leftPseudos: ReadonlySet<string>,
  rightPseudos: ReadonlySet<string>,
): boolean {
  const leftPositions = [...leftPseudos]
    .map(exactPositionalPseudo)
    .filter((value) => value !== undefined);
  const rightPositions = [...rightPseudos]
    .map(exactPositionalPseudo)
    .filter((value) => value !== undefined);
  return leftPositions.some((left) =>
    rightPositions.some((right) => left.axis === right.axis && left.position !== right.position),
  );
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
  if (peer.value === undefined || alternative.value === undefined) return false;
  if (!alternative.insensitive && peer.insensitive) return false;
  const insensitive = alternative.insensitive || peer.insensitive;
  const peerValue = normalizeAttributeValue(peer.value, insensitive);
  const alternativeValue = normalizeAttributeValue(alternative.value, insensitive);
  if (peer.operator === '=')
    return attributeOperatorMatches(alternative.operator, peerValue, alternativeValue);
  if (peer.operator === undefined) return false;
  if (alternative.operator === '^=')
    return (
      (peer.operator === '^=' || peer.operator === '|=') && peerValue.startsWith(alternativeValue)
    );
  if (alternative.operator === '$=')
    return peer.operator === '$=' && peerValue.endsWith(alternativeValue);
  if (alternative.operator === '*=')
    return (
      (peer.operator === '^=' ||
        peer.operator === '$=' ||
        peer.operator === '*=' ||
        peer.operator === '|=' ||
        peer.operator === '~=') &&
      peerValue.includes(alternativeValue)
    );
  if (alternative.operator === '|=')
    return (
      peer.operator === '|=' &&
      (peerValue === alternativeValue || peerValue.startsWith(`${alternativeValue}-`))
    );
  if (alternative.operator === '~=')
    return peer.operator === '~=' && peerValue === alternativeValue;
  return false;
}

function targetNecessarilyMatches(peer: SelectorTarget, alternative: SelectorTarget): boolean {
  const basicMatch =
    (alternative.tag === undefined || peer.tag === alternative.tag) &&
    (alternative.id === undefined || peer.id === alternative.id) &&
    [...alternative.classes].every((className) => peer.classes.has(className)) &&
    [...alternative.unknownPseudos].every((pseudo) => peer.unknownPseudos.has(pseudo)) &&
    [...alternative.attributeConstraints].every(([name, constraints]) =>
      constraints.every((constraint) =>
        attributeConstraintsFor(peer, name).some((peerConstraint) =>
          attributeConstraintNecessarilyMatches(peerConstraint, constraint),
        ),
      ),
    );
  if (!basicMatch) return false;
  return alternative.functionalConstraints.every(({ kind, alternatives }) =>
    kind === 'not'
      ? alternatives.every((nested) => targetsNecessarilyDisjoint(peer, nested))
      : alternatives.some((nested) => targetNecessarilyMatches(peer, nested)),
  );
}

function targetsNecessarilyDisjoint(left: SelectorTarget, right: SelectorTarget): boolean {
  if (left.impossible || right.impossible) return true;
  if (left.tag !== undefined && right.tag !== undefined && left.tag !== right.tag) return true;
  if (left.id !== undefined && right.id !== undefined && left.id !== right.id) return true;
  if (positionalPseudosConflict(left.unknownPseudos, right.unknownPseudos)) return true;
  if (
    [...left.attributeConstraints].some(([name, constraints]) =>
      constraints.some((leftConstraint) =>
        attributeConstraintsFor(right, name).some((rightConstraint) =>
          attributeConstraintsContradict(leftConstraint, rightConstraint),
        ),
      ),
    )
  )
    return true;
  for (const constraint of left.functionalConstraints) {
    if (
      constraint.kind === 'not' &&
      constraint.alternatives.some((alternative) => targetNecessarilyMatches(right, alternative))
    )
      return true;
    if (
      constraint.kind === 'any' &&
      constraint.alternatives.every((alternative) => targetsNecessarilyDisjoint(alternative, right))
    )
      return true;
  }
  for (const constraint of right.functionalConstraints) {
    if (
      constraint.kind === 'not' &&
      constraint.alternatives.some((alternative) => targetNecessarilyMatches(left, alternative))
    )
      return true;
    if (
      constraint.kind === 'any' &&
      constraint.alternatives.every((alternative) => targetsNecessarilyDisjoint(left, alternative))
    )
      return true;
  }
  return false;
}

function mediaType(query: string): { name: string; negated: boolean } | undefined {
  const match = query.match(/^\s*(not\s+|only\s+)?([a-z][\w-]*)\b/i);
  if (match?.[2] === undefined) return undefined;
  return { name: match[2].toLowerCase(), negated: match[1]?.trim() === 'not' };
}

function mergeSelectorTargets(outer: SelectorTarget, inner: SelectorTarget): SelectorTarget {
  const attributes = new Map(outer.attributes);
  const attributeConstraints = new Map<string, AttributeConstraint[]>(
    [...outer.attributeConstraints].map(([name, constraints]) => [name, [...constraints]]),
  );
  let contradictoryAttributes = false;
  for (const [name, constraints] of inner.attributeConstraints) {
    const constraint = constraints.at(-1);
    if (constraint === undefined) continue;
    const previousConstraints = attributeConstraints.get(name) ?? [];
    for (const current of constraints) {
      if (previousConstraints.some((previous) => attributeConstraintsContradict(previous, current)))
        contradictoryAttributes = true;
      previousConstraints.push(current);
    }
    attributeConstraints.set(name, previousConstraints);
    attributes.set(name, constraint);
  }
  const unknownPseudos = new Set([...outer.unknownPseudos, ...inner.unknownPseudos]);
  return {
    ...(outer.impossible ||
    inner.impossible ||
    contradictoryAttributes ||
    (outer.tag !== undefined && inner.tag !== undefined && outer.tag !== inner.tag) ||
    (outer.id !== undefined && inner.id !== undefined && outer.id !== inner.id) ||
    positionalPseudosConflict(unknownPseudos, unknownPseudos)
      ? { impossible: true }
      : {}),
    ...((outer.tag ?? inner.tag) ? { tag: outer.tag ?? inner.tag } : {}),
    ...((outer.id ?? inner.id) ? { id: outer.id ?? inner.id } : {}),
    classes: new Set([...outer.classes, ...inner.classes]),
    attributes,
    attributeConstraints,
    functionalConstraints: [...outer.functionalConstraints, ...inner.functionalConstraints],
    unknownPseudos,
  };
}

function attributeConstraintsContradict(
  left: AttributeConstraint,
  right: AttributeConstraint,
): boolean {
  if (left.value === undefined || right.value === undefined) return false;
  const insensitive = left.insensitive || right.insensitive;
  const leftValue = normalizeAttributeValue(left.value, insensitive);
  const rightValue = normalizeAttributeValue(right.value, insensitive);
  if (left.operator === '=' && right.operator === '=') return leftValue !== rightValue;
  if (left.operator === '=' && right.operator !== undefined)
    return !attributeOperatorMatches(right.operator, leftValue, rightValue);
  if (right.operator === '=' && left.operator !== undefined)
    return !attributeOperatorMatches(left.operator, rightValue, leftValue);
  if (left.operator === right.operator) {
    if (left.operator === '^=')
      return !leftValue.startsWith(rightValue) && !rightValue.startsWith(leftValue);
    if (left.operator === '$=')
      return !leftValue.endsWith(rightValue) && !rightValue.endsWith(leftValue);
    if (left.operator === '|=')
      return !(
        leftValue === rightValue ||
        leftValue.startsWith(`${rightValue}-`) ||
        rightValue.startsWith(`${leftValue}-`)
      );
  }
  return false;
}

function selectorTargetFromNodes(nodes: readonly selectorParser.Node[]): SelectorTarget {
  const target: SelectorTarget = {
    classes: new Set(),
    attributes: new Map(),
    attributeConstraints: new Map(),
    functionalConstraints: [],
    unknownPseudos: new Set(),
  };
  for (const node of nodes) {
    if (node.type === 'class') target.classes.add(node.value);
    if (node.type === 'id') {
      if (target.id !== undefined && target.id !== node.value) target.impossible = true;
      target.id = node.value;
    }
    if (node.type === 'tag') target.tag = node.value.toLowerCase();
    if (node.type === 'attribute') {
      const name = node.attribute.toLowerCase();
      const constraint = {
        operator: node.operator,
        value: node.value,
        insensitive: node.insensitive === true,
      } satisfies AttributeConstraint;
      const previousConstraints = target.attributeConstraints.get(name) ?? [];
      if (
        previousConstraints.some((previous) => attributeConstraintsContradict(previous, constraint))
      )
        target.impossible = true;
      target.attributeConstraints.set(name, [...previousConstraints, constraint]);
      target.attributes.set(name, constraint);
    }
  }
  for (const node of nodes) {
    const pseudoName = node.type === 'pseudo' ? node.value.toLowerCase() : undefined;
    if (
      node.type === 'pseudo' &&
      (pseudoName === ':not' || pseudoName === ':is' || pseudoName === ':where') &&
      Array.isArray(node.nodes)
    ) {
      const kind = pseudoName === ':not' ? 'not' : 'any';
      const nestedTargets = node.nodes.map((selectorNode) =>
        selectorTargetFromNodes(selectorNode.nodes),
      );
      const alternatives = nestedTargets.map((nestedTarget) =>
        mergeSelectorTargets(target, nestedTarget),
      );
      target.functionalConstraints.push({ kind, alternatives });
      if (
        kind === 'not' &&
        nestedTargets.some((nestedTarget) => targetNecessarilyMatches(target, nestedTarget))
      )
        target.impossible = true;
    } else if (node.type === 'pseudo' && !node.value.startsWith('::')) {
      const serialized = node.toString();
      const pseudo = `${node.value.toLowerCase()}${serialized.slice(node.value.length)}`;
      const position = exactPositionalPseudo(pseudo);
      target.unknownPseudos.add(
        position === undefined ? pseudo : `:${position.axis}(${position.position})`,
      );
      if (position !== undefined && position.position <= 0) target.impossible = true;
      if (positionalPseudosConflict(target.unknownPseudos, target.unknownPseudos))
        target.impossible = true;
    }
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
        if (ancestorSignature) {
          target.ancestorSignature = ancestorSignature;
          const combinator = selectorNode.nodes[lastCombinator];
          if (combinator?.type === 'combinator' && combinator.value.trim() === '>') {
            const parentCompound = ancestorSignature.split(/\s+/).at(-1) ?? '';
            const directParentTag = parentCompound.match(/^[a-z][\w-]*/i)?.[0].toLowerCase();
            if (directParentTag !== undefined) target.directParentTag = directParentTag;
            const directParentId = parentCompound.match(/#([\w-]+)/)?.[1];
            if (directParentId !== undefined) target.directParentId = directParentId;
          }
        }
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
    [...alternative.attributeConstraints].some(([name, constraints]) =>
      constraints.some((constraint) =>
        attributeConstraintsFor(target, name).every(
          (targetConstraint) =>
            targetConstraint.operator !== constraint.operator ||
            targetConstraint.value !== constraint.value ||
            targetConstraint.insensitive !== constraint.insensitive,
        ),
      ),
    )
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
  if (left.impossible || right.impossible) return false;
  if (negatesTag(left, right) || negatesTag(right, left)) return false;
  if (positionalPseudosConflict(left.unknownPseudos, right.unknownPseudos)) return false;
  if (
    left.directParentTag !== undefined &&
    right.directParentTag !== undefined &&
    left.directParentTag !== right.directParentTag
  )
    return false;
  if (
    left.directParentId !== undefined &&
    right.directParentId !== undefined &&
    left.directParentId !== right.directParentId
  )
    return false;
  const hasConflictingAttribute = [...left.attributes.keys()].some((attribute) => {
    return attributeConstraintsFor(left, attribute).some((leftAttributeConstraint) =>
      attributeConstraintsFor(right, attribute).some((rightAttributeConstraint) =>
        attributeConstraintsContradict(leftAttributeConstraint, rightAttributeConstraint),
      ),
    );
  });
  const shareAnchor =
    (left.id !== undefined && left.id === right.id) ||
    (left.tag !== undefined && left.tag === right.tag) ||
    (left.tag !== undefined &&
      (right.id !== undefined || right.classes.size > 0 || right.attributes.size > 0)) ||
    (right.tag !== undefined &&
      (left.id !== undefined || left.classes.size > 0 || left.attributes.size > 0)) ||
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

type WidthBound = {
  kind: 'minimum' | 'maximum';
  value: number;
  inclusive: boolean;
  unit: 'px' | 'root-em';
};

function widthBounds(parameters: string): WidthBound[] {
  const bounds: WidthBound[] = [];
  for (const match of parameters.matchAll(
    /(\bnot\s+)?\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)\s*(px|r?em)\s*\)/gi,
  )) {
    if (match[2] === undefined || match[3] === undefined || match[4] === undefined) continue;
    const negated = match[1] !== undefined;
    const kind = match[2].toLowerCase() === 'min' ? 'minimum' : 'maximum';
    bounds.push({
      kind: negated ? (kind === 'minimum' ? 'maximum' : 'minimum') : kind,
      value: Number(match[3]),
      inclusive: !negated,
      // Media-query em and rem units both resolve against the initial root font size.
      unit: match[4].toLowerCase() === 'px' ? 'px' : 'root-em',
    });
  }
  for (const match of parameters.matchAll(
    /(\bnot\s+)?\(\s*width\s*(<|<=|>|>=)\s*(\d+(?:\.\d+)?)\s*(px|r?em)\s*\)/gi,
  )) {
    if (match[2] === undefined || match[3] === undefined || match[4] === undefined) continue;
    const negated = match[1] !== undefined;
    const operator = negated
      ? ({ '<': '>=', '<=': '>', '>': '<=', '>=': '<' }[match[2]] ?? match[2])
      : match[2];
    bounds.push({
      kind: operator.startsWith('>') ? 'minimum' : 'maximum',
      value: Number(match[3]),
      inclusive: operator.includes('='),
      unit: match[4].toLowerCase() === 'px' ? 'px' : 'root-em',
    });
  }
  for (const match of parameters.matchAll(
    /(\bnot\s+)?\(\s*(\d+(?:\.\d+)?)\s*(px|r?em)\s*(<|<=|>|>=)\s*width\s*\)/gi,
  )) {
    if (match[2] === undefined || match[3] === undefined || match[4] === undefined) continue;
    const negated = match[1] !== undefined;
    const operator = negated
      ? ({ '<': '>=', '<=': '>', '>': '<=', '>=': '<' }[match[4]] ?? match[4])
      : match[4];
    bounds.push({
      kind: operator.startsWith('<') ? 'minimum' : 'maximum',
      value: Number(match[2]),
      inclusive: operator.includes('='),
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

export function conditionalQueryBranches(parameters: string): string[] {
  parameters = parameters.replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length));
  const branches: string[] = [];
  let parenthesisDepth = 0;
  let branchStart = 0;
  for (let index = 0; index < parameters.length; index++) {
    const character = parameters[index];
    if (character === '(') parenthesisDepth++;
    if (character === ')') parenthesisDepth--;
    if (parenthesisDepth !== 0) continue;
    const isComma = character === ',';
    const isOr =
      parameters.slice(index, index + 2).toLowerCase() === 'or' &&
      !/[\w-]/.test(parameters[index - 1] ?? '') &&
      !/[\w-]/.test(parameters[index + 2] ?? '');
    if (!isComma && !isOr) continue;
    branches.push(parameters.slice(branchStart, index).trim());
    branchStart = index + (isOr ? 2 : 1);
    if (isOr) index += 1;
  }
  branches.push(parameters.slice(branchStart).trim());
  return branches.filter(Boolean);
}

function conditionalQueryBranchesConflict(left: string, right: string): boolean {
  const leftType = mediaType(left);
  const rightType = mediaType(right);
  if (
    (leftType?.negated === true && leftType.name === 'all') ||
    (rightType?.negated === true && rightType.name === 'all')
  )
    return true;
  if (
    leftType !== undefined &&
    rightType !== undefined &&
    (leftType.negated !== rightType.negated
      ? leftType.name === rightType.name && leftType.name !== 'all'
      : !leftType.negated &&
        leftType.name !== 'all' &&
        rightType.name !== 'all' &&
        leftType.name !== rightType.name)
  )
    return true;
  const bounds = [...widthBounds(left), ...widthBounds(right)];
  for (const unit of ['px', 'root-em'] as const) {
    const comparableBounds = bounds.filter((bound) => bound.unit === unit);
    const minimumBounds = comparableBounds.filter((bound) => bound.kind === 'minimum');
    const maximumBounds = comparableBounds.filter((bound) => bound.kind === 'maximum');
    const minimum = Math.max(...minimumBounds.map((bound) => bound.value), -Infinity);
    const maximum = Math.min(...maximumBounds.map((bound) => bound.value), Infinity);
    if (minimum > maximum) return true;
    if (
      minimum === maximum &&
      (!minimumBounds
        .filter((bound) => bound.value === minimum)
        .every((bound) => bound.inclusive) ||
        !maximumBounds.filter((bound) => bound.value === maximum).every((bound) => bound.inclusive))
    )
      return true;
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
  const internallyContradictory = (scope: ConditionalScope[]): boolean =>
    scope.some((condition, index) =>
      scope.slice(index + 1).some((other) => conditionalScopesConflict(condition, other)),
    );
  if (internallyContradictory(leftScope) || internallyContradictory(rightScope)) return false;
  if (
    [...leftScope, ...rightScope].some(
      (condition) =>
        condition.name === 'media' &&
        conditionalQueryBranches(condition.parameters).every((branch) => {
          const type = mediaType(branch);
          return type?.negated === true && type.name === 'all';
        }),
    )
  )
    return false;
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
  if (left === right)
    return leftTargets
      .filter((target) => !target.impossible && functionalConstraintsCanOverlap(target, target))
      .map((target) => [target, target] as const);
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
    [...target.attributeConstraints].every(([name, constraints]) =>
      constraints.every((constraint) =>
        attributeConstraintMatches(sharedTarget.attributes.get(name), constraint),
      ),
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
