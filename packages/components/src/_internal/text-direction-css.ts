import {
  evaluateLogicalContainerCondition,
  hasUnsupportedContainerSizeQuery,
  parseStyleQuery,
} from './text-direction-container.ts';
import { styleSheetDeclaresDirection } from './text-direction-sheet-index.ts';

export type ParentElementResolver = (element: HTMLElement) => HTMLElement | null;

export function matchesDirectionStyleRule(
  element: HTMLElement,
  getParentElement: ParentElementResolver,
): boolean {
  const styleSheets = new Map<CSSStyleSheet, ScopeRoot | null>();
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) styleSheets.set(sheet, null);
  for (const sheet of Array.from(element.ownerDocument.adoptedStyleSheets ?? []))
    styleSheets.set(sheet, null);
  const root = element.getRootNode();
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
    for (const sheet of root.adoptedStyleSheets) styleSheets.set(sheet, root);
    for (const styleElement of root.querySelectorAll('style')) {
      if (styleElement.sheet) styleSheets.set(styleElement.sheet, root);
    }
    for (const linkElement of root.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')) {
      if (linkElement.sheet) styleSheets.set(linkElement.sheet, root);
    }
  }
  for (const [sheet, fallbackRoot] of styleSheets) {
    if (!isActiveStyleSheet(sheet)) continue;
    // A sheet that declares `direction` nowhere in its rule tree cannot produce
    // a match — the only `true` below requires `rule.style.direction` — so skip
    // it before resolving nested selectors, `@scope` roots, or container
    // conditions. Cached per sheet; see text-direction-sheet-index.ts.
    if (!styleSheetDeclaresDirection(sheet)) continue;
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (
      matchesDirectionStyleRuleList(
        element,
        rules,
        getParentElement,
        [],
        getImplicitScopeRoot(sheet, fallbackRoot, element.ownerDocument.documentElement),
      )
    )
      return true;
  }
  return false;
}

// A disabled stylesheet, or one whose sheet-level `media` doesn't currently
// match, contributes no active styling — its rules must not be used as
// direction-styling hints even though they're still present in the CSSOM.
function isActiveStyleSheet(sheet: CSSStyleSheet): boolean {
  if (sheet.disabled) return false;
  const mediaText = sheet.media?.mediaText;
  if (!mediaText) return true;
  if (typeof matchMedia !== 'function') return true;
  return matchMedia(mediaText).matches;
}

type ScopeRoot = Element | ShadowRoot;

function getImplicitScopeRoot(
  sheet: CSSStyleSheet,
  fallbackRoot: ScopeRoot | null,
  documentRoot: Element,
): ScopeRoot | null {
  const ownerNode = Reflect.get(sheet, 'ownerNode');
  if (!(ownerNode instanceof Element) || ownerNode.localName?.toLowerCase() !== 'style') {
    return typeof ShadowRoot !== 'undefined' && fallbackRoot instanceof ShadowRoot
      ? fallbackRoot
      : documentRoot;
  }
  if (ownerNode.parentElement) return ownerNode.parentElement;
  const root = ownerNode.getRootNode();
  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot
    ? root
    : typeof ShadowRoot !== 'undefined' && fallbackRoot instanceof ShadowRoot
      ? fallbackRoot
      : null;
}

export function matchesDirectionStyleRuleCached(
  element: HTMLElement,
  cache?: WeakMap<HTMLElement, boolean>,
  getParentElement?: ParentElementResolver,
): boolean {
  if (!getParentElement) return false;
  if (!cache) return matchesDirectionStyleRule(element, getParentElement);
  const cached = cache.get(element);
  if (cached !== undefined) return cached;
  const matched = matchesDirectionStyleRule(element, getParentElement);
  cache.set(element, matched);
  return matched;
}

function matchesDirectionStyleRuleList(
  element: HTMLElement,
  rules: CSSRuleList | Iterable<CSSRule>,
  getParentElement: ParentElementResolver,
  scopes: readonly ActiveScope[] = [],
  implicitScopeRoot: ScopeRoot | null = null,
): boolean {
  for (const rule of Array.from(rules)) {
    if (Reflect.get(rule, 'type') === 3) {
      const imported = Reflect.get(rule, 'styleSheet');
      if (imported) {
        try {
          const importedRules = Reflect.get(imported, 'cssRules');
          if (
            isCssRuleCollection(importedRules) &&
            matchesDirectionStyleRuleList(
              element,
              importedRules,
              getParentElement,
              scopes,
              implicitScopeRoot,
            )
          )
            return true;
        } catch {
          // Cross-origin imports may deny CSSOM access.
        }
      }
      continue;
    }
    if (isCssStyleRule(rule)) {
      if (!rule.style.direction) {
        const nestedRules = readNestedCssRules(rule);
        if (
          nestedRules &&
          matchesDirectionStyleRuleList(
            element,
            nestedRules,
            getParentElement,
            scopes,
            implicitScopeRoot,
          )
        )
          return true;
        continue;
      }
      try {
        const selectorText = resolveNestedSelector(rule);
        if (selectorText && matchesScopedSelector(element, selectorText, scopes)) return true;
      } catch {
        continue;
      }
    }

    const nestedRules = readNestedCssRules(rule);
    if (isScopeRule(rule)) {
      const scope = createActiveScope(rule, element, scopes, implicitScopeRoot);
      if (scope && nestedRules) {
        if (
          matchesDirectionStyleRuleList(
            element,
            nestedRules,
            getParentElement,
            [...scopes, scope],
            implicitScopeRoot,
          )
        )
          return true;
      }
      continue;
    }
    if (
      nestedRules &&
      isConditionalRuleActive(rule, element, getParentElement) &&
      matchesDirectionStyleRuleList(
        element,
        nestedRules,
        getParentElement,
        scopes,
        implicitScopeRoot,
      )
    ) {
      return true;
    }
  }
  return false;
}

function readNestedCssRules(rule: CSSRule): CSSRuleList | Iterable<CSSRule> | undefined {
  if (!('cssRules' in rule)) return undefined;
  try {
    const nestedRules: unknown = Reflect.get(rule, 'cssRules');
    return isCssRuleCollection(nestedRules) ? nestedRules : undefined;
  } catch {
    return undefined;
  }
}

function isCssRuleCollection(value: unknown): value is CSSRuleList | Iterable<CSSRule> {
  if (typeof CSSRuleList !== 'undefined' && value instanceof CSSRuleList) return true;
  if (Array.isArray(value)) return value.every(isCssRule);
  if (typeof value !== 'object' || value === null) return false;
  const iterator = Reflect.get(value, Symbol.iterator);
  return typeof iterator === 'function';
}

function isCssRule(value: unknown): value is CSSRule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'cssText') === 'string' &&
    typeof Reflect.get(value, 'type') === 'number'
  );
}

function isCssStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return (
    typeof Reflect.get(rule, 'selectorText') === 'string' &&
    typeof Reflect.get(rule, 'style') === 'object' &&
    Reflect.get(rule, 'style') !== null
  );
}

function resolveNestedSelector(rule: CSSStyleRule): string | undefined {
  let selector = rule.selectorText.trim();
  let parentRule = Reflect.get(rule, 'parentRule');
  while (parentRule) {
    if (isCssStyleRule(parentRule)) {
      const parentSelector = parentRule.selectorText.trim();
      if (!parentSelector) return undefined;
      selector = combineNestedSelectors(parentSelector, selector);
      if (!selector) return undefined;
    }
    parentRule = Reflect.get(parentRule, 'parentRule');
  }
  return selector;
}

function combineNestedSelectors(parentSelector: string, nestedSelector: string): string {
  const parentContext =
    splitSelectorList(parentSelector).length > 1 ? `:is(${parentSelector})` : parentSelector;
  return splitSelectorList(nestedSelector)
    .map((selector) => {
      const resolved = replaceNestingReferences(selector, parentContext);
      return resolved.replaced ? resolved.selector : `${parentContext} ${selector}`;
    })
    .join(', ');
}

function replaceNestingReferences(
  selector: string,
  parentContext: string,
): { selector: string; replaced: boolean } {
  let quote: '"' | "'" | undefined;
  let replaced = false;
  let resolved = '';
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index]!;
    if (character === '\\') {
      resolved += character;
      if (index + 1 < selector.length) resolved += selector[++index];
      continue;
    }
    if (quote !== undefined) {
      resolved += character;
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      resolved += character;
      continue;
    }
    if (character === '&') {
      resolved += parentContext;
      replaced = true;
      continue;
    }
    resolved += character;
  }
  return { selector: resolved, replaced };
}

function splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = [];
  let parenthesesDepth = 0;
  let bracketDepth = 0;
  let quote: '"' | "'" | undefined;
  let start = 0;
  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') parenthesesDepth += 1;
    if (character === ')') parenthesesDepth = Math.max(0, parenthesesDepth - 1);
    if (character === '[') bracketDepth += 1;
    if (character === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (character === ',' && parenthesesDepth === 0 && bracketDepth === 0) {
      const selector = selectorText.slice(start, index).trim();
      if (selector) selectors.push(selector);
      start = index + 1;
    }
  }
  const selector = selectorText.slice(start).trim();
  if (selector) selectors.push(selector);
  return selectors;
}

function isConditionalRuleActive(
  rule: CSSRule,
  element: HTMLElement,
  getParentElement: ParentElementResolver,
): boolean {
  const conditionText = Reflect.get(rule, 'conditionText');
  if (typeof conditionText !== 'string' || !conditionText.trim()) return true;

  if (isContainerRule(rule))
    return isContainerQueryActive(conditionText, element, rule, getParentElement);

  if (isMediaRule(rule) && typeof matchMedia === 'function') {
    return matchMedia(conditionText).matches;
  }

  if (isSupportsRule(rule) && typeof CSS !== 'undefined' && typeof CSS.supports === 'function')
    return CSS.supports(conditionText);

  return true;
}

function isScopeRule(rule: CSSRule): boolean {
  if (rule.constructor.name === 'CSSScopeRule') return true;
  const cssText = Reflect.get(rule, 'cssText');
  return typeof cssText === 'string' && /^\s*@scope\b/i.test(cssText);
}

interface ScopePrelude {
  rootSelectors: string[];
  limitSelectors: string[] | null;
}

interface ActiveScope {
  roots: ScopeRoot[];
}

function createActiveScope(
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

// The root candidates a `:scope` token in a scope-start selector resolves
// against: the nearest enclosing `@scope`'s active root(s) when nested,
// falling back to the stylesheet's implicit scope root only at top level.
// An enclosing scope always takes precedence — nesting is what `:scope`
// means here, per the CSS Scoping spec's "parent's scoping root" default.
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
    // An unrooted `@scope` defaults to the nearest enclosing scope's root
    // when nested, not the stylesheet's implicit root — which can be far
    // broader than (and even disjoint from) the enclosing scope.
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

// Resolves every `:scope`-containing root selector — the exact token
// (`:scope`) as well as any compound or combinator form built on it
// (`:scope > .child`) — by walking candidate ancestors of the target (like
// `findScopeMatches` does for ordinary root selectors) and testing each one
// via `matchesScopedSelector` against the enclosing scope's candidate
// root(s). Exact `:scope` is just the degenerate case of this same walk (an
// ancestor "matches" only when it IS one of the candidate roots), so a
// mixed list like `:scope, :scope > .theme` naturally preserves the
// supported exact alternative even when a sibling relative alternative
// can't be resolved for a given candidate — each selector is tried
// independently and OR'd together, same as `findScopeMatches`.
//
// A candidate root can itself be a `ShadowRoot` — the implicit root of a
// shadow-owned or adopted stylesheet (see `getImplicitScopeRoot`) — which
// is never in `element`'s `parentElement` chain. Once that chain runs out,
// the walk checks whether `element`'s own `getRootNode()` is a `ShadowRoot`
// among the candidates. A `ShadowRoot` has no attributes, classes, or tag
// name for a relative selector like `:scope > .child` to match against, so
// it can only ever satisfy the exact `:scope` degenerate case, and is
// tested by direct candidate membership rather than run through
// `matchesScopedSelector` (which requires an `Element`). The walk stops at
// that boundary instead of crossing into `.host`: every root this function
// returns must DOM-contain `element` — the same invariant the
// empty-root-selector branch above enforces via `root.contains(element)` —
// and an ancestor found by crossing into the light DOM would violate it.
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

// A selector counts as the exact `:scope` degenerate case (see
// `findRelativeScopeRootMatches`) only when it's nothing but the bare
// token — no compounding, no combinator.
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
    // The scoping root itself is never past its own limit — CSS scope
    // limits exclude descendants of the root, not the root. Without this,
    // the canonical `@scope (.card) to (.card)` idiom would never activate
    // for anything, since walking up from any target reaches `.card` and
    // matches the limit before the loop would otherwise stop.
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

function matchesSelectorSafely(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

// Rewrites the two relative-selector shorthands `@scope` defines into an
// explicit `:scope`, so both reuse the scope-aware matching in
// `matchesScopedSelector` instead of an ordinary (and, for the
// leading-combinator form, invalid) `element.matches()` call:
//  - `&`, when it wasn't already resolved by `resolveNestedSelector` against
//    a wrapping style rule, is CSS's own alias for the scope root.
//  - A selector that leads with a combinator (`> .foo`, `+ .foo`, `~ .foo`)
//    is shorthand for that combinator applied to the scope root.
//
// Both shorthands are per-selector-list-item, not per-list: `.unused, >
// .shell` only needs the second alternative rewritten. Splitting on
// top-level commas and normalizing each item independently (rather than
// checking whether the *whole* list starts with `&`/a combinator) is what
// makes that second alternative resolve instead of silently passing the
// leading-combinator form through to an ordinary, invalid `element.matches()`
// call.
function normalizeScopeRelativeSelector(selector: string): string {
  return splitSelectorList(selector)
    .map((part) => {
      if (!part.includes('&') && !/^\s*[>+~]/.test(part)) return part;
      const withScopeAlias = replaceNestingReferences(part, ':scope').selector;
      return /^\s*[>+~]/.test(withScopeAlias) ? `:scope ${withScopeAlias}` : withScopeAlias;
    })
    .join(', ');
}

function matchesScopedSelector(
  element: Element,
  selector: string,
  scopes: readonly ActiveScope[],
): boolean {
  // Within an active scope, `&` (unresolved by nesting — i.e. not already
  // combined with a wrapping style rule's selector) is CSS's own alias for
  // the scope root, and a selector may lead with a bare combinator as
  // shorthand for "relative to the scope root". Both forms only make sense
  // once a scope is active; normalizing them into an explicit `:scope`
  // reuses the scope-aware matching below instead of falling through to a
  // plain (and, for the combinator form, invalid) `element.matches()` call.
  const normalizedSelector =
    scopes.length > 0 ? normalizeScopeRelativeSelector(selector) : selector;
  // Selector-list alternatives are independent per the CSS grammar's
  // comma-list semantics — splitting on top-level commas before matching
  // (same discipline `combineNestedSelectors` and
  // `normalizeScopeRelativeSelector` already use) is what keeps an item
  // with no scope-root context of its own from being gated by a SIBLING
  // alternative's context. `.shell, main :scope .other` is the case that
  // breaks without this: `.shell` must match on its own merit — the `main`
  // outside-ancestor requirement belongs only to the second alternative.
  return splitSelectorList(normalizedSelector).some((item) =>
    matchesScopedSelectorItem(element, item, scopes),
  );
}

// Matches a single selector-list ITEM (no top-level commas) against
// `element`, resolving `:scope` (if present) against the active scope's
// root candidates.
function matchesScopedSelectorItem(
  element: Element,
  selector: string,
  scopes: readonly ActiveScope[],
): boolean {
  if (!hasScopePseudoClass(selector)) return matchesSelectorSafely(element, selector);
  if (scopes.length === 0) return false;
  const scope = scopes.at(-1);
  if (!scope) return false;
  // A selector may combine `:scope` with real context OUTSIDE the scope
  // root itself (`main :scope .shell` — `main` must be an ancestor of the
  // root, not of anything inside it). The clone-based matching below only
  // ever sees the root's own subtree, so that outside context is split off
  // and verified separately, against the root's REAL (unmutated, uncloned)
  // ancestor chain — see `matchesOutsideScopeContext`. Only the remainder
  // (`:scope` onward) goes through the clone-based matcher, which already
  // correctly handles everything relative to the root itself.
  const outsideContext = splitScopeOutsideContext(selector);
  const remainderSelector = outsideContext ? outsideContext.remainder : selector;
  for (const root of scope.roots) {
    try {
      if (outsideContext) {
        // Outside-ancestor context only has real meaning for an element
        // with real DOM ancestors. A shadow root has none in this sense —
        // and CSS itself can't reach light-DOM ancestors from inside a
        // shadow-scoped stylesheet anyway — so this is a genuine envelope,
        // not a shortcut: fail this root rather than guess.
        if (!(root instanceof Element)) continue;
        if (!matchesOutsideScopeContext(root, outsideContext.before, outsideContext.combinator))
          continue;
      }
      if (matchesRemainderAgainstScopeRoot(element, remainderSelector, root)) return true;
    } catch {
      // Unsupported relative selectors are not safe direction hints.
    }
  }
  return false;
}

interface ScopeOutsideContext {
  before: string;
  combinator: '>' | '+' | '~' | ' ';
  remainder: string;
}

// Splits real "outside-ancestor" selector text off from the `:scope`
// token(s) onward — e.g. `main :scope .shell` splits into `before: 'main'`,
// `combinator: ' '`, `remainder: ':scope .shell'`. Returns `null` when
// `:scope` is the first meaningful token (nothing precedes it) or is
// compounded directly onto the preceding simple selector (`a:scope`, no
// combinator between them) — neither references anything outside the root.
//
// Looks up `:scope` with `topLevelOnly: true`: a `:scope` nested inside a
// functional pseudo-class's arguments (`:is(main :scope .shell,
// .fallback)`) has no ancestor context this text-slicing split can extract
// on its own — the text before it (`:is(main`) isn't a real selector at
// all. Treating that as "no `:scope` here to split around" leaves the
// selector whole, so it goes to `matchesRemainderAgainstScopeRoot` intact
// (resolving `:scope` natively, scoped to the root, via `querySelectorAll`)
// instead of being misread as literal outside-ancestor text feeding a
// `closest()` call that would throw on the unbalanced fragment.
function splitScopeOutsideContext(selector: string): ScopeOutsideContext | null {
  const scopeIndex = findScopePseudoClassIndex(selector, { topLevelOnly: true });
  if (scopeIndex === null) return null;
  const beforeRaw = selector.slice(0, scopeIndex);
  if (!beforeRaw.trim()) return null;
  const trimmedEnd = beforeRaw.replace(/\s+$/, '');
  const lastCharacter = trimmedEnd.at(-1);
  if (lastCharacter === '>' || lastCharacter === '+' || lastCharacter === '~') {
    const before = trimmedEnd.slice(0, -1).trim();
    return before
      ? { before, combinator: lastCharacter, remainder: selector.slice(scopeIndex) }
      : null;
  }
  if (!/\s$/.test(beforeRaw)) return null;
  const before = trimmedEnd.trim();
  return before ? { before, combinator: ' ', remainder: selector.slice(scopeIndex) } : null;
}

// Verifies outside-ancestor context (`before`, connected to `:scope` via
// `combinator`) against the scope root's REAL ancestor/sibling chain —
// exact DOM-reference-based traversal (`closest`/`matches`/sibling
// pointers), not pattern matching, so it can't coincidentally match an
// unrelated element that merely has a similar shape elsewhere in the
// document.
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
  // '~': any preceding sibling.
  let sibling = root.previousElementSibling;
  while (sibling) {
    if (matchesSelectorSafely(sibling, before)) return true;
    sibling = sibling.previousElementSibling;
  }
  return false;
}

// Matches `element` against `selector` (already stripped of any real
// outside-ancestor context — see `splitScopeOutsideContext`) with `:scope`
// bound to `root`. Uses the browser's native `:scope` support when
// available, falling back to a marker-attribute match against a clone of
// the root's own subtree in environments that don't support querying
// `:scope` at all.
function matchesRemainderAgainstScopeRoot(
  element: Element,
  selector: string,
  root: ScopeRoot,
): boolean {
  if (root.querySelector(':scope') === root) {
    return Array.from(root.querySelectorAll(selector)).includes(element);
  }
  const clone =
    typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? null : root.cloneNode(true);
  const cloneElement =
    clone instanceof Element
      ? clone
      : typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot
        ? (() => {
            const wrapper = root.ownerDocument.createElement('div');
            wrapper.append(...Array.from(root.children, (child) => child.cloneNode(true)));
            return wrapper;
          })()
        : null;
  if (!cloneElement) return false;
  const marker = 'data-cinder-scope-root';
  const replacedSelector = replaceScopePseudoClass(selector, `[${marker}]`);
  if (
    typeof ShadowRoot !== 'undefined' &&
    root instanceof ShadowRoot &&
    /^\[[^\]]+\][^\s>+~]/.test(replacedSelector)
  )
    return false;
  cloneElement.setAttribute(marker, 'true');
  const path: number[] = [];
  let current: Element | null = element;
  while (current && current !== root) {
    const parent: Element | null = current.parentElement;
    if (!parent) {
      if (
        typeof ShadowRoot !== 'undefined' &&
        root instanceof ShadowRoot &&
        current.getRootNode() === root
      )
        path.unshift(Array.prototype.indexOf.call(root.children, current));
      break;
    }
    path.unshift(Array.prototype.indexOf.call(parent.children, current));
    current = parent;
  }
  if (
    current !== root &&
    !(
      typeof ShadowRoot !== 'undefined' &&
      root instanceof ShadowRoot &&
      current?.getRootNode() === root
    )
  )
    return false;
  let matchedCloneElement: Element = cloneElement;
  for (const index of path) {
    const child = matchedCloneElement.children[index];
    if (!child) break;
    matchedCloneElement = child;
  }
  return (
    (matchedCloneElement === cloneElement && cloneElement.matches(replacedSelector)) ||
    Array.from(cloneElement.querySelectorAll(replacedSelector)).includes(matchedCloneElement)
  );
}

export function replaceScopePseudoClass(selector: string, replacement: string): string {
  let result = '';
  let quote: string | null = null;
  let escaped = false;
  let brackets = 0;
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      result += character;
      escaped = true;
      continue;
    }
    if (quote) {
      result += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      result += character;
      quote = character;
      continue;
    }
    if (character === '[') {
      brackets += 1;
      result += character;
      continue;
    }
    if (character === ']') {
      brackets = Math.max(0, brackets - 1);
      result += character;
      continue;
    }
    if (
      brackets === 0 &&
      character === ':' &&
      selector.slice(index + 1, index + 6).toLowerCase() === 'scope' &&
      !/[\w-]/.test(selector[index + 6] ?? '')
    ) {
      result += replacement;
      index += 5;
      continue;
    }
    result += character;
  }
  return result;
}

// Locates the start index of the first actual `:scope` pseudo-class token
// (not `:scopeX`/`:scoped`, and not inside a quoted string or an attribute
// selector's brackets), or `null` when the selector has none. Shared by
// `hasScopePseudoClass` (any depth — it only asks "does this text mention
// `:scope` at all") and `splitScopeOutsideContext` (`topLevelOnly: true` —
// a `:scope` nested inside a functional pseudo-class's arguments, like
// `:is(main :scope .shell, .fallback)`, isn't one that split can extract
// real outside-ancestor context around).
function findScopePseudoClassIndex(
  selector: string,
  options: { topLevelOnly?: boolean } = {},
): number | null {
  let quote: string | null = null;
  let brackets = 0;
  let parentheses = 0;
  let escaped = false;
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[') {
      brackets += 1;
      continue;
    }
    if (character === ']') {
      brackets = Math.max(0, brackets - 1);
      continue;
    }
    if (character === '(') {
      parentheses += 1;
      continue;
    }
    if (character === ')') {
      parentheses = Math.max(0, parentheses - 1);
      continue;
    }
    if (
      brackets === 0 &&
      (!options.topLevelOnly || parentheses === 0) &&
      character === ':' &&
      selector.slice(index + 1, index + 6).toLowerCase() === 'scope' &&
      !/[\w-]/.test(selector[index + 6] ?? '')
    )
      return index;
  }
  return null;
}

export function hasScopePseudoClass(selector: string): boolean {
  return findScopePseudoClassIndex(selector) !== null;
}

function parseScopePrelude(cssText: string): ScopePrelude | null {
  const match = /^\s*@scope\b/i.exec(cssText);
  if (!match) return null;
  const start = match[0].length;
  let quote: string | null = null;
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;
  let end = -1;
  for (let index = start; index < cssText.length; index += 1) {
    const character = cssText[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses -= 1;
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets -= 1;
    else if (character === '{' && parentheses === 0 && brackets === 0) {
      end = index;
      break;
    }
    if (parentheses < 0 || brackets < 0) return null;
  }
  if (end < 0 || quote || escaped || parentheses !== 0 || brackets !== 0) return null;
  const prelude = cssText.slice(start, end).trim();
  const limitIndex = findScopeLimitKeyword(prelude);
  const rootText = (limitIndex === null ? prelude : prelude.slice(0, limitIndex)).trim();
  const limitText = limitIndex === null ? null : prelude.slice(limitIndex + 2).trim();
  const rootSelectorText = unwrapScopeGroup(rootText);
  if (rootSelectorText === null) return null;
  const rootSelectors = rootSelectorText ? splitScopeSelectors(rootSelectorText) : [];
  if (rootSelectorText && rootSelectors.length === 0) return null;
  if (limitText === null) return { rootSelectors, limitSelectors: null };
  const limitSelectorText = unwrapScopeGroup(limitText);
  if (limitSelectorText === null || !limitSelectorText) return null;
  const limitSelectors = splitScopeSelectors(limitSelectorText);
  return limitSelectors.length > 0 ? { rootSelectors, limitSelectors } : null;
}

function findScopeLimitKeyword(prelude: string): number | null {
  let quote: string | null = null;
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;
  for (let index = 0; index < prelude.length; index += 1) {
    const character = prelude[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses -= 1;
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets -= 1;
    if (parentheses < 0 || brackets < 0) return null;
    if (
      parentheses === 0 &&
      brackets === 0 &&
      prelude.slice(index, index + 2).toLowerCase() === 'to' &&
      !/[\w-]/.test(prelude[index - 1] ?? '') &&
      !/[\w-]/.test(prelude[index + 2] ?? '')
    ) {
      const remainder = prelude.slice(index + 2);
      const opening = remainder.search(/\S/);
      if (opening >= 0 && remainder[opening] === '(') return index;
    }
  }
  return null;
}

function unwrapScopeGroup(value: string): string | null {
  if (!value) return '';
  if (value[0] !== '(') return value;
  const end = findScopeGroupEnd(value);
  if (end < 0 || value.slice(end + 1).trim()) return null;
  return value.slice(1, end).trim();
}

function findScopeGroupEnd(value: string): number {
  let depth = 0;
  let brackets = 0;
  let quote: string | null = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets -= 1;
    else if (character === '(' && brackets === 0) depth += 1;
    else if (character === ')' && brackets === 0) {
      depth -= 1;
      if (depth === 0) return index;
    }
    if (brackets < 0) return -1;
  }
  return -1;
}

function findScopeMatches(element: HTMLElement, selectors: string[]): Element[] {
  if (selectors.length === 0) return [];
  const matches: Element[] = [];
  let current: Element | null = element;
  while (current) {
    const currentElement: Element = current;
    if (selectors.some((selector) => matchesSelectorSafely(currentElement, selector)))
      matches.push(currentElement);
    current = currentElement.parentElement;
  }
  return matches;
}

function splitScopeSelectors(value: string): string[] {
  const selectors: string[] = [];
  let parentheses = 0;
  let brackets = 0;
  let quote: string | null = null;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses -= 1;
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets -= 1;
    else if (character === ',' && parentheses === 0 && brackets === 0) {
      const selector = value.slice(start, index).trim();
      if (!selector) return [];
      selectors.push(selector);
      start = index + 1;
    }
    if (parentheses < 0 || brackets < 0) return [];
  }
  if (escaped || quote || parentheses !== 0 || brackets !== 0) return [];
  const selector = value.slice(start).trim();
  if (!selector) return [];
  selectors.push(selector);
  return selectors;
}

// `CSSContainerRule.conditionText` serializes the container name ahead of
// the query for a named rule — e.g. `@container sidebar (min-width: 20rem)`
// reads back as `"sidebar (min-width: 20rem)"`, not just the query. The
// grammar this module validates only understands the query itself, so the
// name prefix must be removed before parsing: prefer the standard
// `containerQuery` accessor (already name-free), falling back to stripping
// the known container name token when that accessor is unavailable.
//
// A name-only rule — `@container sidebar {}` — is valid CSS (verified
// against real browser behavior: Chromium parses it into a CSSContainerRule
// and matches it whenever a same-named queryable container exists) and its
// `containerQuery` legitimately reads back as `''`, not "unsupported".
// Checking `typeof containerQuery === 'string'` (not truthiness) trusts
// that empty string instead of falling through to the name-stripping
// fallback, which would otherwise hand the bare container name to the
// query grammar below as if it were a condition.
function resolveContainerQueryText(
  conditionText: string,
  rule: CSSRule,
  containerName: unknown,
): string {
  const containerQuery = Reflect.get(rule, 'containerQuery');
  if (typeof containerQuery === 'string') return containerQuery;
  if (typeof containerName !== 'string' || !containerName) return conditionText;
  if (!conditionText.startsWith(containerName)) return conditionText;
  const rest = conditionText.slice(containerName.length);
  if (!/^\s/.test(rest)) return conditionText;
  return rest.trimStart();
}

interface ContainerConditionEntry {
  name: string;
  query: string;
}

// `CSSContainerRule.conditions` exposes each entry of a comma-separated
// `@container` condition list (`@container sidebar (min-width: 20rem),
// (min-width: 40rem)`) as an independent `{ name, query }` pair. Browsers
// blank the legacy singular `containerName`/`containerQuery` accessors to
// `''` once a rule uses this form (verified against real Chromium), so an
// empty legacy `containerQuery` must not be read as "no condition" when
// `.conditions` actually holds the real ones — this guard is checked before
// the legacy accessors specifically so that case is caught. Environments
// where `.conditions` is absent, not an array, empty, or holds anything
// that isn't a `{ name: string, query: string }` pair fall through to the
// legacy single-condition path unchanged (which itself fails closed on an
// empty `containerQuery`) — this is an enhancement layered on top of that
// path, not a replacement for it.
function isContainerConditionList(value: unknown): value is ContainerConditionEntry[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof Reflect.get(entry, 'name') === 'string' &&
      typeof Reflect.get(entry, 'query') === 'string',
  );
}

function isContainerQueryActive(
  conditionText: string,
  element: HTMLElement,
  rule: CSSRule,
  getParentElement: ParentElementResolver,
): boolean {
  if (typeof getComputedStyle !== 'function') return false;
  const conditions = Reflect.get(rule, 'conditions');
  // A comma-separated condition list is active if ANY entry matches — each
  // entry gets its own independent named-container ancestor resolution and
  // condition evaluation, OR'd together, matching the
  // `<container-condition-list>` comma-separated grammar.
  if (isContainerConditionList(conditions))
    return conditions.some((condition) =>
      isSingleContainerConditionActive(condition.query, condition.name, element, getParentElement),
    );
  const containerName = Reflect.get(rule, 'containerName');
  const queryText = resolveContainerQueryText(conditionText, rule, containerName);
  return isSingleContainerConditionActive(queryText, containerName, element, getParentElement);
}

function isSingleContainerConditionActive(
  queryText: string,
  containerName: unknown,
  element: HTMLElement,
  getParentElement: ParentElementResolver,
): boolean {
  // A container rule with no condition at all — a name-only rule, or (in
  // legacy environments lacking `containerQuery`) a conditionText that was
  // nothing but the name — has nothing here to evaluate. Real browsers
  // treat a name-only rule as trivially matching once a same-named
  // queryable container exists, but honoring that would mean treating
  // container *existence alone*, with no actual condition, as an
  // activation signal. This module deliberately requires a parsed
  // condition before treating a rule as active; fail closed instead,
  // same as every other unparsed or unsupported condition below.
  if (!queryText.trim()) return false;
  const styleQuery = parseStyleQuery(queryText);
  if (styleQuery) {
    const remainder = (queryText.slice(0, styleQuery.index) + queryText.slice(styleQuery.end))
      .replace(/^\s*(?:and|or|not)\b/i, '')
      .replace(/^\(|\)$/g, '')
      .trim();
    // A compound condition — e.g. `style(--x: y) and (min-width: 40rem)` —
    // is not fully evaluated below: only the style() clause is checked
    // against ancestors. Fail closed rather than deciding solely from the
    // style() term, which would wrongly treat an inactive compound rule as
    // an active styling hint.
    if (remainder) return false;
    let ancestor = getParentElement(element);
    while (ancestor) {
      if (typeof containerName === 'string' && containerName) {
        const computedStyle = getComputedStyle(ancestor);
        const name =
          computedStyle.containerName ||
          computedStyle.getPropertyValue('container-name') ||
          ancestor.style.containerName ||
          ancestor.style.getPropertyValue('container-name');
        if (!name.split(/\s+/).includes(containerName)) {
          ancestor = getParentElement(ancestor);
          continue;
        }
      }
      const value =
        getComputedStyle(ancestor).getPropertyValue(styleQuery.name).trim() ||
        ancestor.style.getPropertyValue(styleQuery.name).trim();
      return /^\s*not\b/i.test(queryText)
        ? value !== styleQuery.value.trim()
        : value === styleQuery.value.trim();
    }
    return false;
  }
  const queriesPhysicalWidth =
    /(?:^|[\s(])(?:width|min-width|max-width)\s*[:<>=]/i.test(queryText) ||
    /[\d.]+(?:px|rem)\s*(?:<=|<|>=|>)\s*width\b/i.test(queryText);
  let container = getParentElement(element);
  while (container) {
    const computedStyle = getComputedStyle(container);
    const type =
      computedStyle.containerType ||
      computedStyle.getPropertyValue('container-type') ||
      container.style.containerType ||
      container.style.getPropertyValue('container-type');
    const name =
      computedStyle.containerName ||
      computedStyle.getPropertyValue('container-name') ||
      container.style.containerName ||
      container.style.getPropertyValue('container-name');
    const writingMode =
      computedStyle.writingMode ||
      computedStyle.getPropertyValue('writing-mode') ||
      container.style.writingMode ||
      container.style.getPropertyValue('writing-mode');
    if (
      (typeof containerName !== 'string' ||
        !containerName ||
        name.split(/\s+/).includes(containerName)) &&
      type &&
      type !== 'normal' &&
      !(
        queriesPhysicalWidth &&
        /^(?:vertical|sideways)-/i.test(writingMode) &&
        type === 'inline-size'
      )
    ) {
      break;
    }
    container = getParentElement(container);
  }
  if (!container) return false;
  const computedContainerStyle = getComputedStyle(container);
  const readInset = (property: string, fallbackProperty: string): number => {
    const camel = property.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
    const fallbackCamel = fallbackProperty.replace(/-([a-z])/g, (_, character: string) =>
      character.toUpperCase(),
    );
    const value =
      Reflect.get(computedContainerStyle, camel) ||
      Reflect.get(container.style, camel) ||
      computedContainerStyle.getPropertyValue(property).trim() ||
      container.style.getPropertyValue(property).trim() ||
      Reflect.get(computedContainerStyle, fallbackCamel) ||
      Reflect.get(container.style, fallbackCamel) ||
      computedContainerStyle.getPropertyValue(fallbackProperty).trim() ||
      container.style.getPropertyValue(fallbackProperty).trim();
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const writingMode =
    computedContainerStyle.writingMode ||
    computedContainerStyle.getPropertyValue('writing-mode') ||
    container.style.writingMode ||
    container.style.getPropertyValue('writing-mode');
  const usesInlineSize = /(?:inline-size|min-inline-size|max-inline-size)/i.test(queryText);
  const isVerticalWritingMode = /^(?:vertical|sideways)-/i.test(writingMode);
  const verticalInlineAxis = usesInlineSize && isVerticalWritingMode;
  // `offsetWidth`/`offsetHeight` report the border-box size from layout,
  // unaffected by a CSS `transform` on the container. `getBoundingClientRect()`
  // reports the post-transform box, which container size queries never use —
  // a `scale(2)` container would otherwise look twice as large as the layout
  // engine (and any real `@container` query) considers it to be.
  // A physical `width` query is always a horizontal measurement. Under a
  // vertical writing mode the logical inline insets resolve to top/bottom,
  // not left/right, so a physical query must subtract physical left/right
  // insets instead — falling back to the logical inline name only under a
  // horizontal writing mode, where the two resolve to the same value (some
  // environments only resolve the property name that was actually set).
  const physicalInsets =
    readInset('padding-left', 'padding-inline-start') +
    readInset('padding-right', 'padding-inline-end');
  const physicalBorders =
    readInset('border-left-width', 'border-inline-start-width') +
    readInset('border-right-width', 'border-inline-end-width');
  const inlineInsets = verticalInlineAxis
    ? readInset('padding-inline-start', 'padding-top') +
      readInset('padding-inline-end', 'padding-bottom')
    : physicalInsets;
  const inlineBorders = verticalInlineAxis
    ? readInset('border-inline-start-width', 'border-top-width') +
      readInset('border-inline-end-width', 'border-bottom-width')
    : physicalBorders;
  const readUsedContentSize = (
    axis: 'width' | 'height',
    fallback: number,
    insets: number,
    borders: number,
  ) => {
    const parsed = Number.parseFloat(computedContainerStyle[axis]);
    if (!Number.isFinite(parsed)) return fallback;
    const boxSizing = computedContainerStyle.boxSizing || container.style.boxSizing;
    return boxSizing === 'border-box' ? Math.max(0, parsed - insets - borders) : parsed;
  };
  const physicalClientSize = container.clientWidth;
  const inlineClientSize = verticalInlineAxis ? container.clientHeight : physicalClientSize;
  const width = Math.max(
    0,
    readUsedContentSize(
      'width',
      physicalClientSize > 0
        ? physicalClientSize - physicalInsets
        : container.offsetWidth - physicalBorders - physicalInsets,
      physicalInsets,
      physicalBorders,
    ),
  );
  const inlineSize = Math.max(
    0,
    readUsedContentSize(
      verticalInlineAxis ? 'height' : 'width',
      inlineClientSize > 0
        ? inlineClientSize - inlineInsets
        : (verticalInlineAxis ? container.offsetHeight : container.offsetWidth) -
            inlineBorders -
            inlineInsets,
      inlineInsets,
      inlineBorders,
    ),
  );
  const rootFontSize = Number.parseFloat(
    getComputedStyle(element.ownerDocument.documentElement).fontSize,
  );
  const remSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
  // This evaluator only understands `px`/`rem` length units and the
  // width/inline-size features. A condition using any other CSS length unit
  // (`em`, `vw`, `%`, ...), or a size feature it doesn't implement (`height`,
  // `block-size`, `aspect-ratio`, `orientation`, ...), cannot be decided here
  // — fail closed instead of silently defaulting to "matches" (an inactive
  // rule at the current size would otherwise be treated as an active
  // styling hint).
  if (hasUnsupportedContainerSizeQuery(queryText)) return false;
  return evaluateLogicalContainerCondition(queryText, width, remSize, inlineSize);
}

export function isContainerRule(rule: CSSRule): boolean {
  if (rule.constructor.name === 'CSSContainerRule') return true;
  if (Reflect.get(rule, 'type') !== 0) return false;
  const cssText = Reflect.get(rule, 'cssText');
  return typeof cssText === 'string' && /^\s*@container\b/i.test(cssText);
}

function isMediaRule(rule: CSSRule): boolean {
  return typeof Reflect.get(rule, 'media') === 'object' && Reflect.get(rule, 'media') !== null;
}

function isSupportsRule(rule: CSSRule): boolean {
  return rule.constructor.name === 'CSSSupportsRule' || Reflect.get(rule, 'type') === 12;
}

export function observeTextDirectionMediaQueries(
  element: HTMLElement | null | undefined,
  onChange: () => void,
): (() => void) | undefined {
  if (!element || typeof matchMedia !== 'function') return undefined;
  const sheets = new Set<CSSStyleSheet>(Array.from(element.ownerDocument.styleSheets));
  for (const sheet of element.ownerDocument.adoptedStyleSheets ?? []) sheets.add(sheet);
  const root = element.getRootNode();
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
    for (const sheet of root.adoptedStyleSheets) sheets.add(sheet);
    for (const style of root.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
      'style,link[rel~="stylesheet"]',
    )) {
      const sheet = style.sheet;
      if (sheet) sheets.add(sheet);
    }
  }
  const queries = new Set<string>();
  const visitedSheets = new Set<CSSStyleSheet>();
  const visit = (rules: CSSRuleList | Iterable<CSSRule>) => {
    for (const rule of Array.from(rules)) {
      if (Reflect.get(rule, 'type') === 3) {
        try {
          const media = Reflect.get(rule, 'media');
          const condition = media && Reflect.get(media, 'mediaText');
          if (typeof condition === 'string' && condition) queries.add(condition);
        } catch {
          // Ignore inaccessible import media conditions.
        }
        let imported: CSSStyleSheet | undefined;
        try {
          imported = Reflect.get(rule, 'styleSheet');
        } catch {
          // Ignore inaccessible cross-origin imported stylesheets.
          continue;
        }
        if (imported && !visitedSheets.has(imported)) {
          visitedSheets.add(imported);
          try {
            const importedRules = Reflect.get(imported, 'cssRules');
            if (isCssRuleCollection(importedRules)) visit(importedRules);
          } catch {
            // Ignore inaccessible cross-origin imported stylesheets.
          }
        }
        continue;
      }
      if (isMediaRule(rule)) {
        const condition = Reflect.get(rule, 'conditionText');
        if (typeof condition === 'string' && condition) queries.add(condition);
      }
      const nested = readNestedCssRules(rule);
      if (nested) visit(nested);
    }
  };
  for (const sheet of sheets) {
    if (visitedSheets.has(sheet)) continue;
    visitedSheets.add(sheet);
    try {
      visit(sheet.cssRules);
    } catch {
      // Ignore inaccessible cross-origin stylesheets.
    }
  }
  const mediaQueries = [...queries].map((query) => matchMedia(query));
  const handler = () => onChange();
  for (const mediaQuery of mediaQueries) mediaQuery.addEventListener?.('change', handler);
  return () => {
    for (const mediaQuery of mediaQueries) mediaQuery.removeEventListener?.('change', handler);
  };
}
