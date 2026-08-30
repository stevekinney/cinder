import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { appendAssistantMessage, appendUserMessage, createConversation } from './builders.ts';
import { getMessages } from './utilities/index.ts';

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
    expect(source).toContain('--cinder-chat-font-size: 0.8125rem');
    expect(source).toContain('max-block-size: 7.75rem');
    expect(source).toContain('mask-image');
    expect(source).toContain('class:chat-sub-session-live={live}');
    expect(source).toContain('.chat-sub-session-live :global(.chat-message)');
    expect(source).toContain('prefers-reduced-motion');
    expect(source).toContain('role="log"');
  });
});
