/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import type { MessageRole } from '../conversation-model.ts';
import { createStoryMessage } from './chat-message-fixtures.ts';

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
    const message = createStoryMessage({ role });
    const { container } = render(ChatMessage, { props: { message } });

    expect(container.querySelector('.chat-message-role')?.textContent).toBe(
      getMessageRoleLabel(message),
    );
  });
});
