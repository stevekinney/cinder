import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { appendAssistantMessage, appendUserMessage, createConversation } from '../chat/builders.ts';
import { getMessages } from '../chat/utilities/index.ts';

describe('chat sub-session data contract', () => {
  test('uses the existing ConversationHistory snapshot without metadata mutation', () => {
    const conversation = appendAssistantMessage(
      appendUserMessage(createConversation({ id: 'child' }), 'Investigate this branch'),
      'The child session is still running.',
    );
    expect(getMessages(conversation)).toHaveLength(2);
    expect(conversation.id).toBe('child');
  });

  test('keeps the nested transcript reduced, bounded, and live-only animated', async () => {
    const source = await readFile(new URL('./chat-sub-session.svelte', import.meta.url), 'utf8');
    const stylesheet = await readFile(new URL('./chat-sub-session.css', import.meta.url), 'utf8');
    expect(stylesheet).toContain('--cinder-chat-font-size: 0.8125rem');
    expect(stylesheet).toContain('max-block-size: 7.75rem');
    expect(stylesheet).not.toContain('mask-image');
    expect(stylesheet).not.toContain('.chat-sub-session::after');
    expect(source).toContain('class:chat-sub-session-live={live}');
    expect(stylesheet).toContain('.chat-sub-session-live .chat-message');
    expect(stylesheet).toContain('prefers-reduced-motion');
    expect(source).toContain('role="region"');
    expect(source).toContain('class="chat-sub-session-viewport"');
    expect(source).toContain('the labelled overflow region must be keyboard-scrollable');
    expect(source).toContain('tabindex="0"');
    expect(source).not.toContain('tabindex={0}');
    expect(source).toContain('idPrefix={`${instanceId}-${message.id}`}');
  });

  test('pairs tool calls with their results in the default nested transcript', async () => {
    const source = await readFile(new URL('./chat-sub-session.svelte', import.meta.url), 'utf8');
    expect(source).toContain('pairToolCallsWithResults(messages)');
    expect(source).toContain('toolCallPairsByCallId.get(message.toolCall.id)');
    expect(source).toContain('pairedToolResults.has(message.toolResult)');
  });
});
