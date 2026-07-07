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

  test('uses native disabled only for the disabled prop', () => {
    const { container } = render(ChatInput, {
      id: 'disabled-composer',
      disabled: true,
    });

    const composer = container.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor');
    expect(composer?.disabled).toBe(true);
    expect(composer?.readOnly).toBe(false);
  });

  test('keeps the composer read-only but focusable while sending', () => {
    const { container } = render(ChatInput, {
      id: 'sending-composer',
      sending: true,
    });

    const composer = container.querySelector<HTMLTextAreaElement>('textarea.chat-input-editor');
    expect(composer?.disabled).toBe(false);
    expect(composer?.readOnly).toBe(true);
  });
});
