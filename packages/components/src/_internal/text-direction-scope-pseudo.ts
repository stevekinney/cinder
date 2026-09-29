import { advanceScopeScanner, type ScopeScannerState } from './text-direction-scope-scanner.ts';

export function replaceScopePseudoClass(selector: string, replacement: string): string {
  let result = '';
  const state: ScopeScannerState = { quote: null, escaped: false, parentheses: 0, brackets: 0 };
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector.charAt(index);
    const event = advanceScopeScanner(state, character);
    if (
      event === 'plain' &&
      state.brackets === 0 &&
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
export function findScopePseudoClassIndex(
  selector: string,
  options: { topLevelOnly?: boolean } = {},
): number | null {
  const state: ScopeScannerState = { quote: null, escaped: false, parentheses: 0, brackets: 0 };
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector.charAt(index);
    if (advanceScopeScanner(state, character) !== 'plain') continue;
    if (isScopeToken(selector, index, character, state, options.topLevelOnly)) return index;
  }
  return null;
}

function isScopeToken(
  selector: string,
  index: number,
  character: string,
  state: ScopeScannerState,
  topLevelOnly: boolean | undefined,
): boolean {
  return (
    state.brackets === 0 &&
    (!topLevelOnly || state.parentheses === 0) &&
    character === ':' &&
    selector.slice(index + 1, index + 6).toLowerCase() === 'scope' &&
    !/[\w-]/.test(selector[index + 6] ?? '')
  );
}

export function hasScopePseudoClass(selector: string): boolean {
  return findScopePseudoClassIndex(selector) !== null;
}
