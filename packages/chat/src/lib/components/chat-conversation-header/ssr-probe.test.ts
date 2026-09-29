import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { prepareSvelteServerSource, renderSvelteOnServer } from '@lostgradient/testing';
import type { ConversationHistory } from '../chat/conversation-model.ts';

const sourcePath = resolve(import.meta.dir, 'chat-conversation-header.svelte');

await prepareSvelteServerSource(sourcePath);

function conversation(): ConversationHistory {
  const createdAt = '2026-06-01T00:00:00.000Z';
  return {
    schemaVersion: 4,
    id: 'conversation-header-ssr',
    title: 'Server-safe header',
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt,
    updatedAt: createdAt,
  };
}

describe('ChatConversationHeader SSR safety', () => {
  test('server compilation renders with no DOM globals', async () => {
    const html = await renderSvelteOnServer(sourcePath, {
      conversation: conversation(),
      exportActionsVisible: false,
    });

    expect(html).toContain('Server-safe header');
  });
});
