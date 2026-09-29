import { matchesSelectorSafely } from './text-direction-css-primitives.ts';
import { matchesRemainderAgainstScopeRoot } from './text-direction-scope-match.ts';
import { findScopeMatches, parseScopePrelude } from './text-direction-scope-parser.ts';
import { findScopePseudoClassIndex, hasScopePseudoClass } from './text-direction-scope-pseudo.ts';
import { replaceNestingReferences, splitSelectorList } from './text-direction-selectors.ts';
export type ScopeRoot = Element | ShadowRoot;
export interface ActiveScope {
  roots: ScopeRoot[];
}
export function isScopeRule(rule: CSSRule): boolean {
  if (rule.constructor.name === 'CSSScopeRule') return true;
  const cssText = Reflect.get(rule, 'cssText');
  return typeof cssText === 'string' && /^\s*@scope\b/i.test(cssText);
}
interface ScopePrelude {
  rootSelectors: string[];
  limitSelectors: string[] | null;
}
export function createActiveScope(
  rule: CSSRule,
  element: HTMLElement,
  parentScopes: readonly ActiveScope[],
  implicitScopeRoot: ScopeRoot | null,
): ActiveScope | null {
  const cssText = Reflect.get(rule, 'cssText');
  if (typeof cssText !== 'string') return null;
  const prelude = parseScopePrelude(cssText);
  if (!prelude) return null;
  const roots = findActiveScopeRoots(element, prelude, parentScopes, implicitScopeRoot);
  return roots === null ? null : { roots };
}
function scopePseudoRootCandidates(
  parentScopes: readonly ActiveScope[],
  implicitScopeRoot: ScopeRoot | null,
): ScopeRoot[] {
  if (parentScopes.length > 0) return parentScopes.at(-1)!.roots;
  return implicitScopeRoot ? [implicitScopeRoot] : [];
}
function findActiveScopeRoots(
  element: HTMLElement,
  prelude: ScopePrelude,
  parentScopes: readonly ActiveScope[],
  implicitScopeRoot: ScopeRoot | null,
): ScopeRoot[] | null {
  if (!selectorsAreValid(element, prelude.rootSelectors)) return null;
  if (prelude.limitSelectors && !selectorsAreValid(element, prelude.limitSelectors)) return null;
  if (prelude.rootSelectors.length === 0) {
    const candidates = scopePseudoRootCandidates(parentScopes, implicitScopeRoot);
    const roots =
      candidates.length > 0
        ? candidates
        : [implicitScopeRoot ?? element.ownerDocument.documentElement];
    return finalizeActiveScopeRoots(
      roots.filter((root) => root.contains(element)),
      element,
      prelude,
      parentScopes,
    );
  }
  const scopeRootSelectors = prelude.rootSelectors.filter(hasScopePseudoClass);
  const ordinaryRootSelectors = prelude.rootSelectors.filter(
    (selector) => !hasScopePseudoClass(selector),
  );
  const scopeRootCandidates = scopePseudoRootCandidates(parentScopes, implicitScopeRoot);
  const roots: ScopeRoot[] = [
    ...findRelativeScopeRootMatches(element, scopeRootSelectors, scopeRootCandidates),
    ...findScopeMatches(element, ordinaryRootSelectors),
  ];
  return finalizeActiveScopeRoots(roots, element, prelude, parentScopes);
}
function findRelativeScopeRootMatches(
  element: HTMLElement,
  selectors: readonly string[],
  scopeRootCandidates: readonly ScopeRoot[],
): ScopeRoot[] {
  if (selectors.length === 0 || scopeRootCandidates.length === 0) return [];
  const parentScope: ActiveScope = { roots: [...scopeRootCandidates] };
  const hasExactScopeSelector = selectors.some(isExactScopeSelector);
  const matches: ScopeRoot[] = [];
  let current: Element | null = element;
  while (current) {
    const currentElement: Element = current;
    if (
      selectors.some((selector) => matchesScopedSelector(currentElement, selector, [parentScope]))
    )
      matches.push(currentElement);
    const parent = currentElement.parentElement;
    if (parent) {
      current = parent;
      continue;
    }
    const root = currentElement.getRootNode();
    if (
      typeof ShadowRoot !== 'undefined' &&
      root instanceof ShadowRoot &&
      hasExactScopeSelector &&
      scopeRootCandidates.includes(root)
    )
      matches.push(root);
    current = null;
  }
  return matches;
}
function isExactScopeSelector(selector: string): boolean {
  return selector.trim().toLowerCase() === ':scope';
}
function finalizeActiveScopeRoots(
  roots: readonly ScopeRoot[],
  element: HTMLElement,
  prelude: ScopePrelude,
  parentScopes: readonly ActiveScope[],
): ScopeRoot[] | null {
  const activeRoots: ScopeRoot[] = [];
  for (const root of roots) {
    if (!isWithinParentScopes(root, parentScopes)) continue;
    if (prelude.limitSelectors && isWithinScopeLimit(element, root, prelude.limitSelectors)) {
      continue;
    }
    activeRoots.push(root);
  }
  return activeRoots.length === 0 ? null : activeRoots;
}
function selectorsAreValid(element: Element, selectors: readonly string[]): boolean {
  try {
    for (const selector of selectors) element.matches(selector);
    return true;
  } catch {
    return false;
  }
}
function isWithinParentScopes(root: ScopeRoot, parentScopes: readonly ActiveScope[]): boolean {
  return parentScopes.every((scope) => scope.roots.some((parentRoot) => parentRoot.contains(root)));
}
function isWithinScopeLimit(
  element: HTMLElement,
  root: ScopeRoot,
  limitSelectors: string[],
): boolean {
  let current: Element | null = element;
  while (current) {
    if (current === root) break;
    if (
      limitSelectors.some((selector) =>
        hasScopePseudoClass(selector)
          ? matchesScopedSelector(current!, selector, [{ roots: [root] }])
          : matchesSelectorSafely(current!, selector),
      )
    )
      return true;
    current = current.parentElement;
  }
  return false;
}
function normalizeScopeRelativeSelector(selector: string): string {
  return splitSelectorList(selector)
    .map((part) => {
      if (!part.includes('&') && !/^\s*[>+~]/.test(part)) return part;
      const withScopeAlias = replaceNestingReferences(part, ':scope').selector;
      return /^\s*[>+~]/.test(withScopeAlias) ? `:scope ${withScopeAlias}` : withScopeAlias;
    })
    .join(', ');
}
export function matchesScopedSelector(
  element: Element,
  selector: string,
  scopes: readonly ActiveScope[],
): boolean {
  const normalizedSelector =
    scopes.length > 0 ? normalizeScopeRelativeSelector(selector) : selector;
  return splitSelectorList(normalizedSelector).some((item) =>
    matchesScopedSelectorItem(element, item, scopes),
  );
}
function matchesScopedSelectorItem(
  element: Element,
  selector: string,
  scopes: readonly ActiveScope[],
): boolean {
  if (!hasScopePseudoClass(selector)) return matchesSelectorSafely(element, selector);
  if (scopes.length === 0) return false;
  const scope = scopes.at(-1);
  if (!scope) return false;
  const outsideContext = splitScopeOutsideContext(selector);
  const remainder = outsideContext ? outsideContext.remainder : selector;
  return scope.roots.some((root) => matchesScopedRoot(element, remainder, root, outsideContext));
}

function matchesScopedRoot(
  element: Element,
  selector: string,
  root: ScopeRoot,
  outside: ScopeOutsideContext | null,
): boolean {
  try {
    if (
      outside &&
      (!(root instanceof Element) ||
        !matchesOutsideScopeContext(root, outside.before, outside.combinator))
    )
      return false;
    return matchesRemainderAgainstScopeRoot(element, selector, root);
  } catch {
    return false;
  }
}

interface ScopeOutsideContext {
  before: string;
  combinator: '>' | '+' | '~' | ' ';
  remainder: string;
}
function splitScopeOutsideContext(selector: string): ScopeOutsideContext | null {
  const scopeIndex = findScopePseudoClassIndex(selector, { topLevelOnly: true });
  if (scopeIndex === null) return null;
  const beforeRaw = selector.slice(0, scopeIndex);
  if (!beforeRaw.trim()) return null;
  const trimmedEnd = beforeRaw.replace(/\s+$/, '');
  const lastCharacter = trimmedEnd.at(-1);
  if (lastCharacter === '>' || lastCharacter === '+' || lastCharacter === '~') {
    const before = trimmedEnd.slice(0, -1).trim();
    if (!before) {
      return null; // cinder-coverage-unreachable:
    }
    return { before, combinator: lastCharacter, remainder: selector.slice(scopeIndex) };
  }
  if (!/\s$/.test(beforeRaw)) return null;
  const before = trimmedEnd.trim();
  return before ? { before, combinator: ' ', remainder: selector.slice(scopeIndex) } : null;
}
function matchesOutsideScopeContext(
  root: Element,
  before: string,
  combinator: ScopeOutsideContext['combinator'],
): boolean {
  if (combinator === ' ') return root.parentElement?.closest(before) != null;
  if (combinator === '>')
    return root.parentElement !== null && matchesSelectorSafely(root.parentElement, before);
  if (combinator === '+') {
    const sibling = root.previousElementSibling;
    return sibling !== null && matchesSelectorSafely(sibling, before);
  }
  let sibling = root.previousElementSibling;
  while (sibling) {
    if (matchesSelectorSafely(sibling, before)) return true;
    sibling = sibling.previousElementSibling;
  }
  return false;
}
