/**
 * Test fixtures for ChatContainer component.
 *
 * These fixtures build mock conversations as the vendored {@link ConversationHistory}
 * shape for use in Storybook stories and tests, using small local builders that
 * mimic the message structure (position, metadata, createdAt as ISO strings, etc.)
 * produced by conversation-state libraries.
 */

import type { ConversationHistory, MessageRole } from '../conversation-model.ts';

let fixtureMessageCounter = 0;

/** Creates an empty conversation history. */
function createConversation(): ConversationHistory {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    id: `fixture-conversation-${++fixtureMessageCounter}`,
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Appends a message of the given role, returning a new conversation snapshot. */
function appendMessage(
  conversation: ConversationHistory,
  role: MessageRole,
  content: string,
): ConversationHistory {
  const id = `fixture-message-${++fixtureMessageCounter}`;
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

const appendUserMessage = (conversation: ConversationHistory, content: string) =>
  appendMessage(conversation, 'user', content);
const appendAssistantMessage = (conversation: ConversationHistory, content: string) =>
  appendMessage(conversation, 'assistant', content);

/**
 * Creates a conversation with the specified number of alternating user/assistant messages.
 */
export function createMockConversation(messageCount: number = 10): ConversationHistory {
  let conversation = createConversation();

  for (let i = 0; i < messageCount; i++) {
    if (i % 2 === 0) {
      const content = `User message ${Math.floor(i / 2) + 1}. This is a sample message to test the chat container component.`;
      conversation = appendUserMessage(conversation, content);
    } else {
      const content = `Assistant response ${Math.floor(i / 2) + 1}. Here's a helpful reply to your question. The chat container should handle various message lengths gracefully.`;
      conversation = appendAssistantMessage(conversation, content);
    }
  }

  return conversation;
}

/**
 * Creates a conversation with messages containing images.
 * Note: uses text-only content as a stand-in for image attachments.
 */
export function createConversationWithImages(count: number = 10): ConversationHistory {
  let conversation = createConversation();

  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      // User messages - using text content for compatibility
      const content = `User message ${Math.floor(i / 2) + 1}. [Image placeholder for testing scroll anchoring with variable content heights.]`;
      conversation = appendUserMessage(conversation, content);
    } else {
      conversation = appendAssistantMessage(
        conversation,
        `Assistant response ${Math.floor(i / 2) + 1}. The scroll anchoring should handle content of varying heights gracefully.`,
      );
    }
  }

  return conversation;
}

/**
 * Creates an empty conversation.
 */
export function createEmptyConversation(): ConversationHistory {
  return createConversation();
}

/**
 * Creates a short conversation (3 messages that fit in viewport).
 */
export function createShortConversation(): ConversationHistory {
  return createMockConversation(3);
}

/**
 * Creates a long conversation for scroll testing.
 */
export function createLongConversation(): ConversationHistory {
  return createMockConversation(50);
}

/**
 * Creates a very long conversation for content-visibility performance testing.
 * This tests the CSS content-visibility optimization with 500+ messages.
 */
export function createVeryLongConversation(): ConversationHistory {
  return createMockConversation(500);
}

/**
 * Creates a conversation with a mix of short and long messages.
 */
export function createMixedLengthConversation(): ConversationHistory {
  let conversation = createConversation();

  const messages = [
    'Hi there!',
    'Hello! How can I help you today?',
    'Can you explain how scroll anchoring works in this component?',
    `Absolutely! Scroll anchoring is a technique to prevent "scroll jank" when content above the viewport changes.

Here's how it works in this component:

1. **CSS overflow-anchor**: The browser's native scroll anchoring keeps the viewport stable when content above changes size.

2. **$effect.pre for scroll position**: Before DOM updates, we capture whether the user is at the bottom. If they are, we schedule a scroll-to-bottom after the DOM updates.

3. **IntersectionObserver**: A sentinel element at the bottom is observed to detect when the user scrolls to the bottom, even with smooth scrolling.

4. **Threshold tolerance**: We use a 150px threshold to account for:
   - Fractional pixels on high-DPI displays
   - Imprecise touch scrolling
   - Small layout shifts

This combination ensures a smooth experience whether you're reading history or following new messages.`,
    'That makes sense, thanks!',
    "You're welcome! Is there anything else you'd like to know about the implementation?",
  ];

  messages.forEach((content, i) => {
    if (i % 2 === 0) {
      conversation = appendUserMessage(conversation, content);
    } else {
      conversation = appendAssistantMessage(conversation, content);
    }
  });

  return conversation;
}

/**
 * Creates a conversation with code blocks for testing rendering.
 */
export function createConversationWithCode(): ConversationHistory {
  let conversation = createConversation();

  conversation = appendUserMessage(
    conversation,
    'Can you show me how to use the scroll utilities?',
  );

  conversation = appendAssistantMessage(
    conversation,
    `Here's how to use the scroll utilities:

\`\`\`typescript
import {
  isAtBottom,
  shouldShowJumpToLatest,
  DEFAULT_SCROLL_CONFIGURATION
} from './scroll-utilities';

// Check if scrolled to bottom
const state = {
  scrollTop: container.scrollTop,
  scrollHeight: container.scrollHeight,
  clientHeight: container.clientHeight
};

const atBottom = isAtBottom(state, DEFAULT_SCROLL_CONFIGURATION.bottomThreshold);
const showJump = shouldShowJumpToLatest(state, DEFAULT_SCROLL_CONFIGURATION.jumpThreshold);
\`\`\`

The \`isAtBottom\` function uses a generous threshold (150px by default) to handle edge cases like high-DPI displays and touch scrolling.`,
  );

  conversation = appendUserMessage(conversation, 'And how do I track unread messages?');

  conversation = appendAssistantMessage(
    conversation,
    `For unread tracking, use these utilities:

\`\`\`typescript
import {
  calculateUnreadCount,
  findUnreadBoundaryIndex,
  formatUnreadCount
} from './scroll-utilities';

// Calculate unread count based on timestamp
const unreadCount = calculateUnreadCount(messages, lastReadTimestamp);

// Find where to insert the "New" divider
const boundaryIndex = findUnreadBoundaryIndex(messages, lastReadTimestamp);

// Format for display (caps at 99+)
const display = formatUnreadCount(unreadCount); // "1", "50", "99+"
\`\`\`

The component automatically tracks this when new messages arrive while the user is scrolled up.`,
  );

  return conversation;
}

/**
 * Simulates adding a new message to a conversation (for testing new message indicators).
 */
export function addMessageToConversation(
  conversation: ConversationHistory,
  isUserMessage: boolean = false,
): ConversationHistory {
  if (isUserMessage) {
    return appendUserMessage(
      conversation,
      `New user message at ${new Date().toLocaleTimeString()}`,
    );
  }
  return appendAssistantMessage(
    conversation,
    `New assistant response at ${new Date().toLocaleTimeString()}. This message was added dynamically.`,
  );
}
