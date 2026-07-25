import { parse as parseCss, type Rule } from 'postcss';

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

function selectorTargetClasses(selector: string): Set<string>[] {
  return selector.split(',').flatMap((branch) => {
    const target =
      branch
        .trim()
        .split(/[\s>+~]+/)
        .at(-1) ?? '';
    if (target.includes('::')) return [];
    return [new Set([...target.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1] ?? ''))];
  });
}

function selectorsCanMatchSameElement(left: Rule, right: Rule): boolean {
  const leftTargets = selectorTargetClasses(left.selector);
  const rightTargets = selectorTargetClasses(right.selector);
  return leftTargets.some((leftClasses) =>
    rightTargets.some(
      (rightClasses) =>
        left === right || [...leftClasses].some((className) => rightClasses.has(className)),
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
    selectorTargetClasses(rule.selector).some((classes) => classes.has('cinder-_floating-surface'))
  )
    return true;
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
    if (!isInsideKeyframes(rule) && selectorTargetClasses(rule.selector).length > 0)
      rules.push({ rule, declarations: declarationMap(rule) });
  });

  const templateRules = rules.filter(
    ({ declarations }) =>
      declarations.has('grid-template') || declarations.has('grid-template-columns'),
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
