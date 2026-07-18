/**
 * C7 tests — Chat density + variant props (presentation-only).
 *
 * Asserts:
 *   1. density=compact sets data-cinder-density=compact on the container.
 *   2. The default density (comfortable) is reflected as data-cinder-density=comfortable.
 *   3. The density attribute updates reactively when the prop changes.
 *   4. Density changes do NOT alter the ARIA structure (role=log, role=region,
 *      message roles) — only presentational data attributes and CSS tokens change.
 *   5. variant=flat sets data-cinder-variant=flat; default is bubble.
 *   6. The variant attribute updates reactively.
 *   7. A plain conversationalist-shaped transcript (no Cinder-only fields) renders
 *      correctly under both densities and both variants.
 *   8. density change does NOT remount the message list (same DOM nodes, keyed #each
 *      identity stable).
 *
 * These are unit-level happy-dom tests. Visual regression (pixel-diff) is a
 * follow-up Playwright test — noted as a known gap, not silently omitted.
 */

/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any @testing-library/svelte import.
setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
const originalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

class TestIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.IntersectionObserver =
  TestIntersectionObserver as unknown as typeof IntersectionObserver;

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const { render, cleanup, fireEvent } = await import('@testing-library/svelte');
const { flushSync } = await import('svelte');
const { default: Chat } = await import('./chat.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

// ---------------------------------------------------------------------------
// Plain conversationalist-shaped transcript fixture (no Cinder-only fields).
// Mirrors the shape produced by agent-bureau's conversationalist library.
// ---------------------------------------------------------------------------
type TestConversation = import('./conversation-model.ts').ConversationHistory;
type TestRole = import('./conversation-model.ts').MessageRole;

let counter = 0;

function createConversation(id?: string): TestConversation {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    id: id ?? `density-test-${++counter}`,
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

function appendMessage(
  conversation: TestConversation,
  role: TestRole,
  content: string,
): TestConversation {
  const id = `density-msg-${++counter}`;
  const now = new Date().toISOString();
  return {
    ...conversation,
    ids: [...conversation.ids, id],
    messages: {
      ...conversation.messages,
      [id]: {
        id,
        role,
        content,
        position: conversation.ids.length,
        createdAt: now,
        metadata: {},
        hidden: false,
      },
    },
    updatedAt: now,
  };
}

function twoMessageConversation(): TestConversation {
  let conv = createConversation();
  conv = appendMessage(conv, 'user', 'Hello, how are you?');
  conv = appendMessage(conv, 'assistant', 'I am doing well, thank you!');
  return conv;
}

// ---------------------------------------------------------------------------
// Density data-attribute tests
// ---------------------------------------------------------------------------

describe('Chat — density prop', () => {
  test('defaults to comfortable: data-cinder-density=comfortable', () => {
    const conversation = createConversation();
    const { container } = render(Chat, {
      props: { id: 'chat-density-default', conversation },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-density')).toBe('comfortable');
  });

  test('compact: data-cinder-density=compact when density="compact"', () => {
    const conversation = createConversation();
    const { container } = render(Chat, {
      props: { id: 'chat-density-compact', conversation, density: 'compact' },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-density')).toBe('compact');
  });

  test('comfortable: data-cinder-density=comfortable when density="comfortable"', () => {
    const conversation = createConversation();
    const { container } = render(Chat, {
      props: { id: 'chat-density-comfortable', conversation, density: 'comfortable' },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-density')).toBe('comfortable');
  });

  test('density prop updates reactively', async () => {
    const { default: DensityFixture } = await import('./chat-density-fixture.svelte');
    const { container } = render(DensityFixture);

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-density')).toBe('comfortable');

    // Toggle to compact
    const button = container.querySelector<HTMLButtonElement>('[data-testid="toggle-density"]');
    button?.click();
    await Promise.resolve();

    expect(root?.getAttribute('data-cinder-density')).toBe('compact');

    // Toggle back to comfortable
    button?.click();
    await Promise.resolve();

    expect(root?.getAttribute('data-cinder-density')).toBe('comfortable');
  });

  test('density change preserves message list ARIA structure and node identity (no remount)', async () => {
    const { default: DensityFixture } = await import('./chat-density-fixture.svelte');
    const { container } = render(DensityFixture);

    // The fixture starts at comfortable with one user message.
    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-density')).toBe('comfortable');

    // Verify ARIA structure before the toggle.
    expect(root?.getAttribute('role')).toBe('region');
    const timeline = container.querySelector('.chat-timeline');
    expect(timeline?.getAttribute('role')).toBe('log');

    // Capture element references BEFORE the density change.
    const messagesBefore = Array.from(container.querySelectorAll('.chat-message'));
    expect(messagesBefore.length).toBeGreaterThanOrEqual(1);

    // Toggle density: comfortable → compact.
    const button = container.querySelector<HTMLButtonElement>('[data-testid="toggle-density"]');
    await fireEvent.click(button!);
    flushSync();

    // Density attribute updated.
    expect(root?.getAttribute('data-cinder-density')).toBe('compact');

    // Collect the same message nodes AFTER the change.
    const messagesAfter = Array.from(container.querySelectorAll('.chat-message'));
    expect(messagesAfter).toHaveLength(messagesBefore.length);

    // Node identity preserved — keyed #each must NOT remount the message elements.
    expect(messagesBefore[0]!.isSameNode(messagesAfter[0]!)).toBe(true);

    // ARIA structure is unchanged after the toggle.
    expect(root?.getAttribute('role')).toBe('region');
    expect(timeline?.getAttribute('role')).toBe('log');
  });

  test('density change does not alter message role structure', () => {
    const conversation = twoMessageConversation();

    // Render compact
    const { container } = render(Chat, {
      props: { id: 'chat-density-roles', conversation, density: 'compact' },
    });

    // Same ARIA roles as comfortable (structural identity)
    const region = container.querySelector('.chat-container');
    expect(region?.getAttribute('role')).toBe('region');
    expect(region?.getAttribute('aria-label')).toBe('Chat conversation');

    const roles = Array.from(container.querySelectorAll('[data-role]')).map((element) =>
      element.getAttribute('data-role'),
    );
    expect(roles).toEqual(['user', 'assistant']);

    // The text content is preserved
    expect(container.textContent).toContain('Hello, how are you?');
    expect(container.textContent).toContain('I am doing well, thank you!');
  });

  test('plain conversationalist transcript renders correctly with density=compact', () => {
    // Transcript has NO Cinder-only fields — only the fields conversationalist produces.
    const conversation = twoMessageConversation();
    const { container } = render(Chat, {
      props: { id: 'chat-density-conversationalist', conversation, density: 'compact' },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-density')).toBe('compact');

    const messages = container.querySelectorAll('.chat-message');
    expect(messages).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Variant data-attribute tests
// ---------------------------------------------------------------------------

describe('Chat — variant prop', () => {
  test('defaults to bubble: data-cinder-variant=bubble', () => {
    const conversation = createConversation();
    const { container } = render(Chat, {
      props: { id: 'chat-variant-default', conversation },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-variant')).toBe('bubble');
  });

  test('flat: data-cinder-variant=flat when variant="flat"', () => {
    const conversation = createConversation();
    const { container } = render(Chat, {
      props: { id: 'chat-variant-flat', conversation, variant: 'flat' },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-variant')).toBe('flat');
  });

  test('bubble: data-cinder-variant=bubble when variant="bubble"', () => {
    const conversation = createConversation();
    const { container } = render(Chat, {
      props: { id: 'chat-variant-bubble', conversation, variant: 'bubble' },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-variant')).toBe('bubble');
  });

  test('variant updates reactively', async () => {
    const { default: VariantFixture } = await import('./chat-variant-fixture.svelte');
    const { container } = render(VariantFixture);

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-variant')).toBe('bubble');

    const button = container.querySelector<HTMLButtonElement>('[data-testid="toggle-variant"]');
    button?.click();
    await Promise.resolve();

    expect(root?.getAttribute('data-cinder-variant')).toBe('flat');

    button?.click();
    await Promise.resolve();

    expect(root?.getAttribute('data-cinder-variant')).toBe('bubble');
  });

  test('variant change preserves message ARIA structure and node identity (no remount)', async () => {
    const { default: VariantFixture } = await import('./chat-variant-fixture.svelte');
    const { container } = render(VariantFixture);

    // The fixture starts at bubble with one user message.
    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-variant')).toBe('bubble');

    // Verify ARIA structure before the toggle.
    expect(root?.getAttribute('role')).toBe('region');
    const timeline = container.querySelector('.chat-timeline');
    expect(timeline?.getAttribute('role')).toBe('log');

    // Capture element references BEFORE the variant change.
    const messagesBefore = Array.from(container.querySelectorAll('.chat-message'));
    expect(messagesBefore.length).toBeGreaterThanOrEqual(1);

    // Toggle variant: bubble → flat.
    const button = container.querySelector<HTMLButtonElement>('[data-testid="toggle-variant"]');
    await fireEvent.click(button!);
    flushSync();

    // Variant attribute updated.
    expect(root?.getAttribute('data-cinder-variant')).toBe('flat');

    // Collect the same message nodes AFTER the change.
    const messagesAfter = Array.from(container.querySelectorAll('.chat-message'));
    expect(messagesAfter).toHaveLength(messagesBefore.length);

    // Node identity preserved — keyed #each must NOT remount the message elements.
    expect(messagesBefore[0]!.isSameNode(messagesAfter[0]!)).toBe(true);

    // ARIA structure is unchanged after the toggle.
    expect(root?.getAttribute('role')).toBe('region');
    expect(timeline?.getAttribute('role')).toBe('log');
  });

  test('plain conversationalist transcript renders correctly with variant=flat', () => {
    const conversation = twoMessageConversation();
    const { container } = render(Chat, {
      props: { id: 'chat-variant-conversationalist', conversation, variant: 'flat' },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-variant')).toBe('flat');

    const messages = container.querySelectorAll('.chat-message');
    expect(messages).toHaveLength(2);

    expect(container.textContent).toContain('Hello, how are you?');
    expect(container.textContent).toContain('I am doing well, thank you!');
  });

  test('density and variant can be combined independently', () => {
    const conversation = twoMessageConversation();
    const { container } = render(Chat, {
      props: {
        id: 'chat-density-variant-combined',
        conversation,
        density: 'compact',
        variant: 'flat',
      },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-density')).toBe('compact');
    expect(root?.getAttribute('data-cinder-variant')).toBe('flat');

    // Still renders messages correctly
    const messages = container.querySelectorAll('.chat-message');
    expect(messages).toHaveLength(2);
  });

  test('compact density: action buttons have no inline min-height override (CSS-level 44px guard by inspection)', () => {
    // happy-dom cannot compute CSS custom property values, so we cannot assert the
    // resolved pixel size of --cinder-touch-target-min here. What we CAN assert:
    //   1. The action buttons exist in the DOM (the footer renders with a user message).
    //   2. No inline style attribute overrides min-height to a smaller value — the
    //      44px touch-target floor is applied via the CSS class, not removed by compact.
    // A Playwright follow-up should pixel-diff the rendered touch targets.
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello compact');

    const { container } = render(Chat, {
      props: { id: 'chat-compact-touch', conversation, density: 'compact' },
    });

    const root = container.querySelector('.chat-container');
    expect(root?.getAttribute('data-cinder-density')).toBe('compact');

    // The action buttons must exist — a user message always shows the copy button
    // (showDefaultActions defaults to true and the message has non-empty text).
    const actionButtons = container.querySelectorAll('.chat-message-action-button');
    expect(actionButtons.length).toBeGreaterThanOrEqual(1);

    // No inline min-height that could shrink the touch target below the CSS value.
    for (const button of Array.from(actionButtons)) {
      const inlineMinHeight = (button as HTMLElement).style.minHeight;
      expect(inlineMinHeight).toBe('');
    }
  });
});
