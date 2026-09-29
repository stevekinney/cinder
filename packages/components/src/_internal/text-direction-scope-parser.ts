import { matchesSelectorSafely } from './text-direction-css-primitives.ts';
import { advanceScopeScanner, type ScopeScannerState } from './text-direction-scope-scanner.ts';

export interface ScopePrelude {
  rootSelectors: string[];
  limitSelectors: string[] | null;
}
export function parseScopePrelude(cssText: string): ScopePrelude | null {
  const match = /^\s*@scope\b/i.exec(cssText);
  if (!match) return null;
  const start = match[0].length;
  const end = findScopePreludeEnd(cssText, start);
  if (end < 0) return null;
  return parseScopePreludeText(cssText.slice(start, end));
}

function parseScopePreludeText(value: string): ScopePrelude | null {
  const prelude = value.trim();
  const limitIndex = findScopeLimitKeyword(prelude);
  const rootText = (limitIndex === null ? prelude : prelude.slice(0, limitIndex)).trim();
  const limitText = limitIndex === null ? null : prelude.slice(limitIndex + 2).trim();
  const rootSelectors = parseScopeSelectorGroup(rootText);
  if (rootSelectors === null) return null;
  if (limitText === null) return { rootSelectors, limitSelectors: null };
  const limitSelectors = parseScopeSelectorGroup(limitText);
  return limitSelectors && limitSelectors.length > 0 ? { rootSelectors, limitSelectors } : null;
}

function parseScopeSelectorGroup(value: string): string[] | null {
  const selectorText = unwrapScopeGroup(value);
  if (selectorText === null) return null;
  const selectors = selectorText ? splitScopeSelectors(selectorText) : [];
  return selectorText && selectors.length === 0 ? null : selectors;
}

function findScopePreludeEnd(cssText: string, start: number): number {
  const state: ScopeScannerState = { quote: null, escaped: false, parentheses: 0, brackets: 0 };
  for (let index = start; index < cssText.length; index += 1) {
    const character = cssText.charAt(index);
    const event = advanceScopeScanner(state, character);
    if (event === 'ignored') continue;
    if (character === '{' && state.parentheses === 0 && state.brackets === 0) return index;
    if (state.parentheses < 0 || state.brackets < 0) return -1;
  }
  return -1;
}

function findScopeLimitKeyword(prelude: string): number | null {
  const state: ScopeScannerState = { quote: null, escaped: false, parentheses: 0, brackets: 0 };
  for (let index = 0; index < prelude.length; index += 1) {
    const character = prelude.charAt(index);
    if (advanceScopeScanner(state, character) === 'ignored') continue;
    if (state.parentheses < 0 || state.brackets < 0) return null;
    if (isScopeLimitAt(prelude, index, state)) return index;
  }
  return null;
}

function isScopeLimitAt(prelude: string, index: number, state: ScopeScannerState): boolean {
  if (state.parentheses !== 0 || state.brackets !== 0) return false;
  if (prelude.slice(index, index + 2).toLowerCase() !== 'to') return false;
  if (/[\w-]/.test(prelude[index - 1] ?? '') || /[\w-]/.test(prelude[index + 2] ?? ''))
    return false;
  const remainder = prelude.slice(index + 2);
  const opening = remainder.search(/\S/);
  return opening >= 0 && remainder[opening] === '(';
}

function unwrapScopeGroup(value: string): string | null {
  if (!value) return '';
  if (value[0] !== '(') return value;
  const end = findScopeGroupEnd(value);
  if (end < 0 || value.slice(end + 1).trim()) return null;
  return value.slice(1, end).trim();
}

function findScopeGroupEnd(value: string): number {
  const state: ScopeScannerState = { quote: null, escaped: false, parentheses: 0, brackets: 0 };
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    const event = advanceScopeScanner(state, character);
    if (event === 'ignored') continue;
    if (state.brackets < 0) return -1;
    if (event === 'open-parenthesis' && state.brackets === 0) continue;
    if (event === 'close-parenthesis' && state.brackets === 0 && state.parentheses === 0)
      return index;
  }
  return -1;
}

export function findScopeMatches(element: HTMLElement, selectors: string[]): Element[] {
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

export function splitScopeSelectors(value: string): string[] {
  const selectors: string[] = [];
  const state: ScopeScannerState = { quote: null, escaped: false, parentheses: 0, brackets: 0 };
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    const event = advanceScopeScanner(state, character);
    if (hasNegativeScopeState(state)) return [];
    const nextStart = appendScopeSelector(selectors, value, start, index, event, state);
    if (nextStart === undefined) continue;
    if (nextStart === null) return [];
    start = nextStart;
  }
  if (!isCompleteScopeState(state)) return [];
  const selector = value.slice(start).trim();
  if (!selector) return [];
  selectors.push(selector);
  return selectors;
}

function hasNegativeScopeState(state: ScopeScannerState): boolean {
  return state.parentheses < 0 || state.brackets < 0;
}

function isCompleteScopeState(state: ScopeScannerState): boolean {
  return (
    !hasNegativeScopeState(state) &&
    !state.escaped &&
    state.quote === null &&
    state.parentheses === 0 &&
    state.brackets === 0
  );
}

function isScopeSelectorDelimiter(character: string, state: ScopeScannerState): boolean {
  return character === ',' && state.parentheses === 0 && state.brackets === 0;
}

function appendScopeSelector(
  selectors: string[],
  value: string,
  start: number,
  index: number,
  event: string,
  state: ScopeScannerState,
): number | null | undefined {
  if (event !== 'plain' || !isScopeSelectorDelimiter(value.charAt(index), state)) return undefined;
  const selector = value.slice(start, index).trim();
  if (!selector) return null;
  selectors.push(selector);
  return index + 1;
}
