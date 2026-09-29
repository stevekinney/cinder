import { isContainerQueryActive, isContainerRule } from './text-direction-container-runtime.ts';
import {
  collectDirectionStyleSheets,
  isCssRuleCollection,
  isCssStyleRule,
  isMediaRule,
  readNestedCssRules,
  type ScopeRoot,
} from './text-direction-css-primitives.ts';
import {
  createActiveScope,
  isScopeRule,
  matchesScopedSelector,
  type ActiveScope,
} from './text-direction-scope.ts';
import { resolveNestedSelector } from './text-direction-selectors.ts';
import { styleSheetDeclaresDirection } from './text-direction-sheet-index.ts';
export type { ScopeRoot } from './text-direction-css-primitives.ts';
export { hasScopePseudoClass, replaceScopePseudoClass } from './text-direction-scope-pseudo.ts';

export type ParentElementResolver = (element: HTMLElement) => HTMLElement | null;
export function matchesDirectionStyleRule(
  element: HTMLElement,
  getParentElement: ParentElementResolver,
): boolean {
  const styleSheets = collectDirectionStyleSheets(element);
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

function getImplicitScopeRoot(
  sheet: CSSStyleSheet,
  fallbackRoot: ScopeRoot | null,
  documentRoot: Element,
): ScopeRoot | null {
  const ownerNode = sheet.ownerNode;
  if (!(ownerNode instanceof Element) || ownerNode.localName.toLowerCase() !== 'style') {
    return asShadowRoot(fallbackRoot) ?? documentRoot;
  }
  if (ownerNode.parentElement) return ownerNode.parentElement;
  return asShadowRoot(ownerNode.getRootNode()) ?? asShadowRoot(fallbackRoot);
}
function asShadowRoot(root: Node | null): ShadowRoot | null {
  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : null;
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

interface DirectionRuleContext {
  element: HTMLElement;
  getParentElement: ParentElementResolver;
  scopes: readonly ActiveScope[];
  implicitScopeRoot: ScopeRoot | null;
}

function matchesDirectionStyleRuleList(
  element: HTMLElement,
  rules: CSSRuleList | Iterable<CSSRule>,
  getParentElement: ParentElementResolver,
  scopes: readonly ActiveScope[] = [],
  implicitScopeRoot: ScopeRoot | null = null,
): boolean {
  const context = { element, getParentElement, scopes, implicitScopeRoot };
  return Array.from(rules).some((rule) => matchesDirectionRule(rule, context));
}

function matchesNestedRules(
  rules: CSSRuleList | Iterable<CSSRule> | undefined,
  context: DirectionRuleContext,
): boolean {
  if (!rules) return false;
  return matchesDirectionStyleRuleList(
    context.element,
    rules,
    context.getParentElement,
    context.scopes,
    context.implicitScopeRoot,
  );
}

function matchesDirectionRule(rule: CSSRule, context: DirectionRuleContext): boolean {
  if (rule.type === 3) return matchesImportedRule(rule, context);
  if (isCssStyleRule(rule)) return matchesStyleRule(rule, context);
  const nestedRules = readNestedCssRules(rule);
  if (isScopeRule(rule)) {
    const scope = createActiveScope(
      rule,
      context.element,
      context.scopes,
      context.implicitScopeRoot,
    );
    return scope
      ? matchesNestedRules(nestedRules, { ...context, scopes: [...context.scopes, scope] })
      : false;
  }
  return (
    Boolean(nestedRules) &&
    isConditionalRuleActive(rule, context.element, context.getParentElement) &&
    matchesNestedRules(nestedRules, context)
  );
}

function matchesImportedRule(rule: CSSRule, context: DirectionRuleContext): boolean {
  const imported: unknown = Reflect.get(rule, 'styleSheet');
  if (typeof imported !== 'object' || imported === null) return false;
  try {
    const rules: unknown = Reflect.get(imported, 'cssRules');
    return isCssRuleCollection(rules) && matchesNestedRules(rules, context);
  } catch {
    // Cross-origin imports may deny CSSOM access.
    return false;
  }
}

function matchesStyleRule(rule: CSSStyleRule, context: DirectionRuleContext): boolean {
  if (rule.style.direction) {
    try {
      const selector = resolveNestedSelector(rule);
      if (selector && matchesScopedSelector(context.element, selector, context.scopes)) return true;
    } catch {
      return false;
    }
  }
  return matchesNestedRules(readNestedCssRules(rule), context);
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

function isSupportsRule(rule: CSSRule): boolean {
  return rule.constructor.name === 'CSSSupportsRule' || Reflect.get(rule, 'type') === 12;
}
