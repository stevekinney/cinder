export interface ScopeScannerState {
  quote: string | null;
  escaped: boolean;
  parentheses: number;
  brackets: number;
}

export type ScopeScannerEvent =
  'ignored' | 'open-parenthesis' | 'close-parenthesis' | 'open-bracket' | 'close-bracket' | 'plain';

export function advanceScopeScanner(
  state: ScopeScannerState,
  character: string,
): ScopeScannerEvent {
  if (state.escaped) {
    state.escaped = false;
    return 'ignored';
  }
  if (character === '\\') {
    state.escaped = true;
    return 'ignored';
  }
  if (state.quote !== null) return consumeQuotedCharacter(state, character);
  if (character === '"' || character === "'") {
    state.quote = character;
    return 'ignored';
  }
  switch (character) {
    case '(':
      state.parentheses += 1;
      return 'open-parenthesis';
    case ')':
      state.parentheses -= 1;
      return 'close-parenthesis';
    case '[':
      state.brackets += 1;
      return 'open-bracket';
    case ']':
      state.brackets -= 1;
      return 'close-bracket';
    default:
      return 'plain';
  }
}

function consumeQuotedCharacter(state: ScopeScannerState, character: string): ScopeScannerEvent {
  state.quote = character === state.quote ? null : state.quote;
  return 'ignored';
}
