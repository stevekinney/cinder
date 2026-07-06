/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: ChatInput } = await import('./chat-input.svelte');

describe('ChatInput', () => {
  test('uses a non-empty default accessible label for blank composer labels', () => {
    const { container } = render(ChatInput, {
      id: 'blank-composer-label',
      composerLabel: '   ',
    });

    const composer = container.querySelector('textarea.chat-input-editor');
    expect(composer?.getAttribute('aria-label')).toBe('Message');
  });
});
