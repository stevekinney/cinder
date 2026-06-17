import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: ChatHistoryTrigger } = await import('./chat-history-trigger.svelte');

type ChatHistoryTriggerInstance = {
  focus: () => void;
};

afterEach(() => {
  cleanup();
});

describe('ChatHistoryTrigger', () => {
  test('loads history on click and exposes imperative focus', async () => {
    let loadCount = 0;
    const { component, container, unmount } = render(ChatHistoryTrigger, {
      label: 'Show older messages',
      onload: () => {
        loadCount += 1;
      },
    });

    const button = container.querySelector<HTMLButtonElement>('.chat-history-trigger-button');
    expect(button?.textContent).toContain('Show older messages');

    await fireEvent.click(button!);
    expect(loadCount).toBe(1);

    (component as unknown as ChatHistoryTriggerInstance).focus();
    expect(document.activeElement).toBe(button);

    unmount();
    expect(() => (component as unknown as ChatHistoryTriggerInstance).focus()).not.toThrow();
  });

  test('announces and disables the trigger while history is loading', () => {
    const { container } = render(ChatHistoryTrigger, {
      loading: true,
      loadingLabel: 'Fetching older messages',
    });

    const button = container.querySelector<HTMLButtonElement>('.chat-history-trigger-button');
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(button?.textContent).toContain('Fetching older messages');
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Fetching older messages',
    );
  });
});
