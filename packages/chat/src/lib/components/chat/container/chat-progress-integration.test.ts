import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(import.meta.dir, 'chat.svelte'), 'utf8');

describe('Chat progress affordance integration contract', () => {
  test('routes global, reasoning, and tool activity through one selector', () => {
    expect(source).toContain(
      "import { selectChatProgressState } from './select-chat-progress-state.ts'",
    );
    expect(source).toContain(
      'selectChatProgressState({ streaming, reasoningStreaming, toolActivity })',
    );
    expect(source).toContain("progressState === 'streaming'");
    expect(source).toContain('pairToolCallsWithResults(messages.slice(turnStartIndex))');
    expect(source).toContain('if (!streaming) return false');
  });

  test('keeps nested motion affordances available while global typing is suppressed', () => {
    expect(source).toContain('reasoningStreaming');
    expect(source).toContain(
      'selectChatProgressState({ streaming, reasoningStreaming, toolActivity })',
    );
    expect(source).toContain('renderTypingIndicator');
  });
});
