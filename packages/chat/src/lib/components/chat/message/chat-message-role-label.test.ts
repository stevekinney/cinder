/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import type { Message, MessageRole } from '../conversation-model.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { ChatMessage, getMessageRoleLabel } = await import('../index.ts');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const messageRoles = [
  ['user'],
  ['assistant'],
  ['system'],
  ['developer'],
  ['tool-call'],
  ['tool-result'],
  ['snapshot'],
] as const satisfies ReadonlyArray<readonly [MessageRole]>;

describe('ChatMessage role labels', () => {
  test.each(messageRoles)('matches the public helper for the %s role', (role) => {
    const message: Message = {
      id: `message-${role}`,
      role,
      content: 'Message content',
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      metadata: {},
      hidden: false,
    };
    const { container } = render(ChatMessage, { props: { message } });

    expect(container.querySelector('.chat-message-role')?.textContent).toBe(
      getMessageRoleLabel(message),
    );
  });
});
