/**
 * Test fixtures and factory functions for ChatMessage Storybook stories.
 *
 * These fixtures provide realistic, deterministic test data for:
 * - Different message roles (user, assistant, system, tool-use, tool-result)
 * - Various content types (markdown, images, tool calls)
 * - Timestamp formatting tests
 */

import type { Message, MessageRole, ToolCall, ToolCallPair, ToolResult } from 'conversationalist';

// ============================================================================
// Message Counter for Deterministic IDs
// ============================================================================

let messageCounter = 0;
let toolCallCounter = 0;

/**
 * Reset the message counter for deterministic story rendering.
 * Call this in story setup to ensure consistent IDs across renders.
 */
export function resetMessageCounter(): void {
  messageCounter = 0;
  toolCallCounter = 0;
}

// ============================================================================
// Message Factory
// ============================================================================

type MessageOverrides = Partial<Omit<Message, 'role'>> & { role?: MessageRole };

/**
 * Create a story Message with deterministic IDs.
 * Uses an incrementing counter to ensure unique, predictable IDs.
 */
export function createStoryMessage(overrides?: MessageOverrides): Message {
  const currentCount = ++messageCounter;
  const id = overrides?.id ?? `msg-${currentCount}`;
  const now = new Date().toISOString();

  return {
    id,
    role: 'user',
    content: 'This is a sample message.',
    position: currentCount,
    createdAt: overrides?.createdAt ?? now,
    metadata: {},
    hidden: false,
    ...overrides,
  };
}

// ============================================================================
// Role-Specific Factories
// ============================================================================

/**
 * Create a user message with default content.
 */
export function createUserMessage(overrides?: Partial<Message>): Message {
  return createStoryMessage({
    role: 'user',
    content: 'How do I implement authentication in SvelteKit?',
    ...overrides,
  });
}

/**
 * Create an assistant message with markdown content.
 */
export function createAssistantMessage(overrides?: Partial<Message>): Message {
  return createStoryMessage({
    role: 'assistant',
    content: ASSISTANT_MARKDOWN_CONTENT,
    ...overrides,
  });
}

/**
 * Create a system message.
 */
export function createSystemMessage(overrides?: Partial<Message>): Message {
  return createStoryMessage({
    role: 'system',
    content: 'You are a helpful assistant specializing in web development.',
    ...overrides,
  });
}

/**
 * Create a developer message.
 */
export function createDeveloperMessage(overrides?: Partial<Message>): Message {
  return createStoryMessage({
    role: 'developer',
    content: 'Debug mode enabled. Verbose logging active.',
    ...overrides,
  });
}

/**
 * Create a tool-use message with a tool call.
 */
export function createToolUseMessage(overrides?: Partial<Message>, toolCall?: ToolCall): Message {
  return createStoryMessage({
    role: 'tool-use',
    content: '',
    toolCall: toolCall ?? SAMPLE_TOOL_CALL,
    ...overrides,
  });
}

/**
 * Create a tool-result message with a result.
 */
export function createToolResultMessage(
  overrides?: Partial<Message>,
  toolResult?: ToolResult,
): Message {
  return createStoryMessage({
    role: 'tool-result',
    content: '',
    toolResult: toolResult ?? SAMPLE_TOOL_RESULT,
    ...overrides,
  });
}

// ============================================================================
// Markdown Content Fixtures
// ============================================================================

export const ASSISTANT_MARKDOWN_CONTENT = `Here's how to implement authentication in SvelteKit:

## Using Lucia Auth

Lucia is a popular authentication library for SvelteKit.

### Installation

\`\`\`bash
bun add lucia @lucia-auth/adapter-drizzle
\`\`\`

### Configuration

\`\`\`typescript
import { Lucia } from 'lucia';
import { DrizzleAdapter } from '@lucia-auth/adapter-drizzle';

const adapter = new DrizzleAdapter(db, sessionTable, userTable);
export const lucia = new Lucia(adapter);
\`\`\`

| Feature | Lucia | Auth.js |
|---------|-------|---------|
| Session-based | Yes | Yes |
| Database adapters | Yes | Yes |
| Type safety | Yes | Partial |

See the [official documentation](https://lucia-auth.com) for more details.`;

export const TABLE_HEAVY_MARKDOWN = `## API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| \`/api/users\` | GET | List all users | Yes |
| \`/api/users/:id\` | GET | Get user by ID | Yes |
| \`/api/users\` | POST | Create user | Admin |
| \`/api/users/:id\` | PUT | Update user | Owner |
| \`/api/users/:id\` | DELETE | Delete user | Admin |

### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |`;

export const CODE_HEAVY_MARKDOWN = `## Implementation

### TypeScript Types

\`\`\`typescript
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}
\`\`\`

### Database Schema

\`\`\`sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL
);
\`\`\`

### Server Hook

\`\`\`typescript
export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get('session');

  if (!sessionId) {
    event.locals.user = null;
    return resolve(event);
  }

  const { session, user } = await lucia.validateSession(sessionId);
  event.locals.user = user;

  return resolve(event);
};
\`\`\``;

export const LONG_CONTENT = `This is a very long message that should be truncated when the expanded prop is false. It contains a lot of text to demonstrate the truncation behavior of the ChatMessage component.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.`;

// ============================================================================
// Tool Call/Result Fixtures
// ============================================================================

export const SAMPLE_TOOL_CALL: ToolCall = {
  id: 'call-123',
  name: 'searchDocumentation',
  arguments: {
    query: 'SvelteKit authentication',
    limit: 5,
  },
};

export const SAMPLE_TOOL_RESULT: ToolResult = {
  callId: 'call-123',
  outcome: 'success',
  content: {
    results: [
      { title: 'Auth Guide', url: 'https://kit.svelte.dev/docs/auth' },
      { title: 'Hooks', url: 'https://kit.svelte.dev/docs/hooks' },
    ],
  },
};

export const TOOL_ERROR_RESULT: ToolResult = {
  callId: 'call-456',
  outcome: 'error',
  content: null,
  error: 'Rate limit exceeded. Please try again in 60 seconds.',
};

export const FILE_READ_TOOL_CALL: ToolCall = {
  id: 'call-789',
  name: 'readFile',
  arguments: {
    path: '/src/lib/components/button.svelte',
  },
};

export const FILE_READ_TOOL_RESULT: ToolResult = {
  callId: 'call-789',
  outcome: 'success',
  content:
    '<script lang="ts">\n  export let variant = "primary";\n</script>\n\n<button class={variant}>\n  <slot />\n</button>',
};

/**
 * Create a tool call pair for stories.
 * Uses a deterministic counter for IDs to ensure test stability.
 */
export function createToolCallPair(
  call?: Partial<ToolCall>,
  result?: Partial<ToolResult> | null,
): ToolCallPair {
  const currentCallCount = ++toolCallCounter;
  const toolCall: ToolCall = {
    id: call?.id ?? `call-${currentCallCount}`,
    name: call?.name ?? 'sampleTool',
    arguments: call?.arguments ?? { param: 'value' },
  };

  return {
    call: toolCall,
    result:
      result === null
        ? undefined
        : {
            callId: toolCall.id,
            outcome: 'success',
            content: { status: 'ok' },
            ...result,
          },
  };
}

// ============================================================================
// Multimodal Content (Attachments) Fixtures
// ============================================================================

export const SINGLE_IMAGE_CONTENT = [
  { type: 'text' as const, text: 'Here is the screenshot you requested:' },
  {
    type: 'image' as const,
    url: 'https://picsum.photos/seed/chat1/800/600',
    text: 'Screenshot of the application dashboard',
  },
];

export const MULTIPLE_IMAGES_CONTENT = [
  { type: 'text' as const, text: 'Comparing the before and after states:' },
  {
    type: 'image' as const,
    url: 'https://picsum.photos/seed/before/400/300',
    text: 'Before: Original design with navigation issues',
  },
  {
    type: 'image' as const,
    url: 'https://picsum.photos/seed/after/400/300',
    text: 'After: Improved design with clearer navigation',
  },
];

export const THREE_IMAGES_CONTENT = [
  { type: 'text' as const, text: 'Here are the different color variations:' },
  {
    type: 'image' as const,
    url: 'https://picsum.photos/seed/red/300/300',
    text: 'Red variation',
  },
  {
    type: 'image' as const,
    url: 'https://picsum.photos/seed/blue/300/300',
    text: 'Blue variation',
  },
  {
    type: 'image' as const,
    url: 'https://picsum.photos/seed/green/300/300',
    text: 'Green variation',
  },
];

// ============================================================================
// Timestamp Fixtures
// ============================================================================

/**
 * Deterministic timestamp formatter for story tests.
 * Always returns the same format regardless of system locale.
 */
export const DETERMINISTIC_TIMESTAMP_FORMATTER = (date: Date): string => {
  return date.toISOString().slice(0, 16).replace('T', ' ');
};

/**
 * Create a locale-specific formatter factory for testing different locales.
 */
export function createLocaleFormatter(locale: string): (date: Date) => string {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (date: Date) => formatter.format(date);
}

/**
 * Create a date for a specific time ago using DST-safe arithmetic.
 *
 * For days: Uses Date constructor with date subtraction (handles DST transitions).
 * For hours/minutes: Uses millisecond subtraction (acceptable for sub-day units).
 */
export function createDateAgo(amount: number, unit: 'minutes' | 'hours' | 'days'): string {
  const now = new Date();

  if (unit === 'days') {
    // DST-safe: Date constructor handles day boundaries correctly
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - amount);
    return date.toISOString();
  }

  // For sub-day units, millisecond subtraction is fine
  const multipliers = {
    minutes: 60000,
    hours: 3600000,
  };
  const date = new Date(now.getTime() - amount * multipliers[unit]);
  return date.toISOString();
}

/**
 * Create a Date object for a specific number of days ago using DST-safe arithmetic.
 */
export function createDaysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}

// ============================================================================
// Conversation Fixtures
// ============================================================================

/**
 * Create a sample conversation with multiple message types.
 */
export function createSampleConversation(): Message[] {
  resetMessageCounter();

  return [
    createSystemMessage({
      createdAt: createDateAgo(2, 'days'),
    }),
    createUserMessage({
      content: 'Can you help me set up authentication?',
      createdAt: createDateAgo(1, 'days'),
    }),
    createAssistantMessage({
      createdAt: createDateAgo(1, 'days'),
    }),
    createUserMessage({
      content: 'That looks great! Can you show me the code?',
      createdAt: createDateAgo(30, 'minutes'),
    }),
    createToolUseMessage({
      createdAt: createDateAgo(29, 'minutes'),
    }),
    createToolResultMessage({
      createdAt: createDateAgo(29, 'minutes'),
    }),
    createAssistantMessage({
      content: CODE_HEAVY_MARKDOWN,
      createdAt: createDateAgo(28, 'minutes'),
    }),
  ];
}

// ============================================================================
// XSS Test Content
// ============================================================================

export const XSS_TEST_CONTENT = `Safe content here.

<script>alert('XSS')</script>

[Legitimate link](https://example.com)
[Bad link](javascript:alert('XSS'))

<img src="x" onerror="alert('XSS')">

<div onclick="alert('XSS')">Click me</div>`;
