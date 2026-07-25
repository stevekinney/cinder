import { parse as parseCss, type Rule } from 'postcss';
import selectorParser from 'postcss-selector-parser';

export type CssPrimitiveCounts = {
  grid: number;
  floating: number;
};

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
  attributes: Set<string>;
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
        attributes: new Set(),
      };
      for (const node of targetNodes) {
        if (node.type === 'class') target.classes.add(node.value);
        if (node.type === 'id') target.id = node.value;
        if (node.type === 'tag') target.tag = node.value.toLowerCase();
        if (node.type === 'attribute') target.attributes.add(node.attribute.toLowerCase());
      }
      targets.push(target);
    });
  }).processSync(selector);
  return targets;
}

function targetsCanMatchSameElement(left: SelectorTarget, right: SelectorTarget): boolean {
  const shareAnchor =
    (left.id !== undefined && left.id === right.id) ||
    (left.tag !== undefined && left.tag === right.tag) ||
    [...left.classes].some((className) => right.classes.has(className)) ||
    [...left.attributes].some((attribute) => right.attributes.has(attribute));
  return (
    shareAnchor &&
    (left.id === undefined || right.id === undefined || left.id === right.id) &&
    (left.tag === undefined || right.tag === undefined || left.tag === right.tag)
  );
}

function selectorsCanMatchSameElement(left: Rule, right: Rule): boolean {
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
    parent = parent.parent;
  }
  return false;
}

function ruleUsesSharedFloatingSurface(
  rule: Rule,
  sharedClassSets: readonly ReadonlySet<string>[],
): boolean {
  if (
    selectorTargets(rule.selector).some((target) => target.classes.has('cinder-_floating-surface'))
  )
    return true;
  return selectorTargets(rule.selector).some((target) =>
    target.classes.size > 0
      ? sharedClassSets.some((sharedClasses) =>
          [...target.classes]
            .filter((className) => className !== 'cinder-_floating-surface')
            .every((className) => sharedClasses.has(className)),
        )
      : false,
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

  const gridDefinitionProperties = [
    'grid',
    'grid-template',
    'grid-template-areas',
    'grid-template-columns',
    'grid-template-rows',
    'grid-auto-columns',
    'grid-auto-rows',
  ];
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
