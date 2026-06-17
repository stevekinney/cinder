/**
 * Tests for chat-status-announcer.svelte.
 *
 * Covers the three screen-reader regions, with emphasis on the assertive region
 * (the primary a11y mechanism for tool-approval urgency): it must always be in
 * the DOM (so the browser registers the live region before text is injected) and
 * must render the empty string — not the literal "undefined" — when no urgent
 * message is present.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: ChatStatusAnnouncer } = await import('./chat-status-announcer.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('ChatStatusAnnouncer', () => {
  test('renders the message-count status region with the given id', () => {
    const { container } = render(ChatStatusAnnouncer, {
      props: { statusId: 'chat-status', messageCount: 5, announcerMessage: '' },
    });
    const status = container.querySelector('#chat-status');
    expect(status?.textContent).toContain('5 messages in conversation');
  });

  test('the polite region carries the announcer message', () => {
    const { container } = render(ChatStatusAnnouncer, {
      props: {
        statusId: 'chat-status',
        messageCount: 1,
        announcerMessage: 'New message from assistant',
      },
    });
    const polite = container.querySelector('[aria-live="polite"]');
    expect(polite?.textContent).toContain('New message from assistant');
  });

  test('the assertive region is ALWAYS present (registered before content is injected)', () => {
    const { container } = render(ChatStatusAnnouncer, {
      props: { statusId: 'chat-status', messageCount: 0, announcerMessage: '' },
    });
    const assertive = container.querySelector('[aria-live="assertive"]');
    expect(assertive).not.toBeNull();
    expect(assertive?.getAttribute('aria-atomic')).toBe('true');
  });

  test('the assertive region renders the empty string (not "undefined") when no message', () => {
    const { container } = render(ChatStatusAnnouncer, {
      props: { statusId: 'chat-status', messageCount: 0, announcerMessage: '' },
    });
    const assertive = container.querySelector('[aria-live="assertive"]');
    expect(assertive?.textContent).toBe('');
  });

  test('the assertive region surfaces an urgent action-required message', () => {
    const { container } = render(ChatStatusAnnouncer, {
      props: {
        statusId: 'chat-status',
        messageCount: 2,
        announcerMessage: '',
        assertiveMessage: 'Action required: deploy_to_production needs your approval.',
      },
    });
    const assertive = container.querySelector('[aria-live="assertive"]');
    expect(assertive?.textContent).toContain(
      'Action required: deploy_to_production needs your approval.',
    );
  });
});
