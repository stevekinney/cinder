import { isCssStyleRule } from './text-direction-css-primitives.ts';

export function resolveNestedSelector(rule: CSSStyleRule): string | undefined {
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

export function combineNestedSelectors(parentSelector: string, nestedSelector: string): string {
  const parentContext =
    splitSelectorList(parentSelector).length > 1 ? `:is(${parentSelector})` : parentSelector;
  return splitSelectorList(nestedSelector)
    .map((selector) => {
      const resolved = replaceNestingReferences(selector, parentContext);
      return resolved.replaced ? resolved.selector : `${parentContext} ${selector}`;
    })
    .join(', ');
}

export function replaceNestingReferences(
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

export function splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = [];
  const state = { parenthesesDepth: 0, bracketDepth: 0, quote: undefined as '"' | "'" | undefined };
  let start = 0;
  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText.charAt(index);
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (advanceSelectorState(state, character)) continue;
    if (character === ',' && state.parenthesesDepth === 0 && state.bracketDepth === 0) {
      const selector = selectorText.slice(start, index).trim();
      if (selector) selectors.push(selector);
      start = index + 1;
    }
  }
  const selector = selectorText.slice(start).trim();
  if (selector) selectors.push(selector);
  return selectors;
}

function advanceSelectorState(
  state: { parenthesesDepth: number; bracketDepth: number; quote: '"' | "'" | undefined },
  character: string,
): boolean {
  if (state.quote !== undefined) {
    if (character === state.quote) state.quote = undefined;
    return true;
  }
  if (character === '"' || character === "'") {
    state.quote = character;
    return true;
  }
  if (character === '(') state.parenthesesDepth += 1;
  if (character === ')') state.parenthesesDepth = Math.max(0, state.parenthesesDepth - 1);
  if (character === '[') state.bracketDepth += 1;
  if (character === ']') state.bracketDepth = Math.max(0, state.bracketDepth - 1);
  return character === '"' || character === "'";
}
