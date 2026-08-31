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
    expect(source).toContain('pairToolCallsWithResults(');
    expect(source).toContain('messages.filter((message) => activeTurnIds.has(message.id))');
    expect(source).toContain('if (!streaming) return false');
  });

  test('keeps nested motion affordances available while global typing is suppressed', () => {
    expect(source).toContain('reasoningStreaming');
    expect(source).toContain(
      'selectChatProgressState({ streaming, reasoningStreaming, toolActivity })',
    );
    expect(source).toContain('renderTypingIndicator');
    expect(source).toContain(
      "toolActivityActive={progressState === 'tool' && activeTurnMessageIds.has(message.id)}",
    );
    expect(source).toContain(
      "activityActive={progressState === 'tool' &&\n          renderRow.messages.some((message) => activeTurnMessageIds.has(message.id))}",
    );
    expect(source).toContain('const activeTurnMessageIds = $derived.by(() => {');
  });

  test('does not treat completed content-driven reasoning as active', () => {
    expect(source).toContain("activeMessage.metadata['streaming'] !== true");
    expect(source).toContain('streamingMessageId === null');
  });
});
