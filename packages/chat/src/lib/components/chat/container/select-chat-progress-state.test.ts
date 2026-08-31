import { describe, expect, test } from 'bun:test';
import {
  selectChatProgressState,
  type ChatProgressStateInputs,
} from './select-chat-progress-state.ts';

describe('selectChatProgressState', () => {
  test.each([
    [false, false, false, 'idle'],
    [true, false, false, 'streaming'],
    [false, true, false, 'reasoning'],
    [false, false, true, 'tool'],
    [true, true, false, 'reasoning'],
    [true, false, true, 'tool'],
    [false, true, true, 'reasoning'],
    [true, true, true, 'reasoning'],
  ] as const)(
    'selects [%s, %s, %s] as %s',
    (streaming, reasoningStreaming, toolActivity, expected) => {
      const inputs: ChatProgressStateInputs = { streaming, reasoningStreaming, toolActivity };
      expect(selectChatProgressState(inputs)).toBe(expected);
    },
  );
});
