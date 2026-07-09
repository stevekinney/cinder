/**
 * Conversation builders for the Chat component.
 *
 * Chat renders a {@link ConversationHistory} snapshot. These helpers construct
 * the published Conversationalist shape without importing the package runtime
 * into Cinder's browser graph.
 */

import type {
  ConversationHistory,
  ConversationStatus,
  JSONValue,
  Message,
  MessageInput,
} from './conversation-model.ts';

type CreateConversationOptions = {
  id?: string;
  title?: string;
  status?: ConversationStatus;
  metadata?: Record<string, JSONValue>;
};

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}-${Math.random()}`;
}

/** Creates a new empty conversation snapshot. */
function createConversation(options: CreateConversationOptions = {}): ConversationHistory {
  const createdAt = new Date().toISOString();
  return {
    schemaVersion: 4,
    id: options.id ?? createId(),
    ...(options.title !== undefined ? { title: options.title } : {}),
    status: options.status ?? 'active',
    metadata: { ...options.metadata },
    ids: [],
    messages: {},
    createdAt,
    updatedAt: createdAt,
  };
}

function materializeMessage(input: MessageInput, position: number, createdAt: string): Message {
  return {
    id: createId(),
    role: input.role,
    content: Array.isArray(input.content) ? [...input.content] : input.content,
    position,
    createdAt,
    metadata: { ...input.metadata },
    hidden: input.hidden ?? false,
    ...(input.toolCall !== undefined ? { toolCall: input.toolCall } : {}),
    ...(input.toolResult !== undefined ? { toolResult: input.toolResult } : {}),
    ...(input.tokenUsage !== undefined ? { tokenUsage: input.tokenUsage } : {}),
    ...(input.goalCompleted !== undefined ? { goalCompleted: input.goalCompleted } : {}),
  };
}

/** Appends one or more messages, preserving the previous no-op identity contract. */
function appendMessages(
  conversation: ConversationHistory,
  ...inputs: MessageInput[]
): ConversationHistory {
  if (inputs.length === 0) return conversation;
  const updatedAt = new Date().toISOString();
  const nextIds = [...conversation.ids];
  const nextMessages = { ...conversation.messages };

  inputs.forEach((input, index) => {
    const message = materializeMessage(input, conversation.ids.length + index, updatedAt);
    nextIds.push(message.id);
    nextMessages[message.id] = message;
  });

  return {
    ...conversation,
    ids: nextIds,
    messages: nextMessages,
    updatedAt,
  };
}

function appendUserMessage(
  conversation: ConversationHistory,
  content: MessageInput['content'],
  metadata?: Record<string, JSONValue>,
): ConversationHistory {
  return appendMessages(conversation, { role: 'user', content, metadata });
}

function appendAssistantMessage(
  conversation: ConversationHistory,
  content: MessageInput['content'],
  metadata?: Record<string, JSONValue>,
): ConversationHistory {
  return appendMessages(conversation, { role: 'assistant', content, metadata });
}

export { appendAssistantMessage, appendMessages, appendUserMessage, createConversation };
