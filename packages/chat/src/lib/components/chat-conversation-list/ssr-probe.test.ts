import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { prepareSvelteServerSource, renderSvelteOnServer } from '@lostgradient/testing';

const sourcePath = resolve(import.meta.dir, 'chat-conversation-list.svelte');
await prepareSvelteServerSource(sourcePath);

describe('ChatConversationList SSR safety', () => {
  test('server compilation renders with no DOM globals', async () => {
    const html = await renderSvelteOnServer(sourcePath, {
      conversations: [],
    });

    expect(html).toContain('No conversations');
  });
});
