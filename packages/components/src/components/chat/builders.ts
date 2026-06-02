/**
 * Conversation builders for the Chat component.
 *
 * Chat renders a {@link ConversationHistory} snapshot. Apps with their own
 * conversation state map it into this shape; these builders give everyone else
 * (examples, demos, tests, simple apps) an ergonomic, immutable way to construct
 * one without pulling in a conversation-state library. Each `append*` call
 * returns a NEW snapshot with the message added in order — the immutable-update
 * pattern Svelte reactivity expects.
 */

import type {
  ConversationHistory,
  ConversationStatus,
  Message,
  MessageInput,
  MultiModalContent,
} from './conversation-model.ts';

const SCHEMA_VERSION = 4;

let idCounter = 0;

/** Generates a stable-enough unique id for builder-created entities. */
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Creates a new empty conversation snapshot. */
export function createConversation(options?: {
  id?: string;
  title?: string;
  status?: ConversationStatus;
}): ConversationHistory {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: options?.id ?? nextId('conversation'),
    title: options?.title,
    status: options?.status ?? 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Materializes a {@link MessageInput} into an immutable {@link Message} at the given position. */
function materializeMessage(input: MessageInput, position: number): Message {
  const content: string | ReadonlyArray<MultiModalContent> =
    typeof input.content === 'string' ? input.content : [...input.content];
  return {
    id: nextId('message'),
    role: input.role,
    content,
    position,
    createdAt: new Date().toISOString(),
    metadata: input.metadata ?? {},
    hidden: input.hidden ?? false,
    ...(input.toolCall !== undefined ? { toolCall: input.toolCall } : {}),
    ...(input.toolResult !== undefined ? { toolResult: input.toolResult } : {}),
    ...(input.tokenUsage !== undefined ? { tokenUsage: input.tokenUsage } : {}),
  };
}

/** Appends one or more messages, returning a new conversation snapshot. */
export function appendMessages(
  conversation: ConversationHistory,
  ...inputs: MessageInput[]
): ConversationHistory {
  if (inputs.length === 0) return conversation;

  const ids = [...conversation.ids];
  const messages: Record<string, Message> = { ...conversation.messages };
  for (const input of inputs) {
    const message = materializeMessage(input, ids.length);
    ids.push(message.id);
    messages[message.id] = message;
  }

  return {
    ...conversation,
    ids,
    messages,
    updatedAt: new Date().toISOString(),
  };
}

/** Appends a single user message. */
export function appendUserMessage(
  conversation: ConversationHistory,
  content: string | MultiModalContent[],
): ConversationHistory {
  return appendMessages(conversation, { role: 'user', content });
}

/** Appends a single assistant message. */
export function appendAssistantMessage(
  conversation: ConversationHistory,
  content: string | MultiModalContent[],
): ConversationHistory {
  return appendMessages(conversation, { role: 'assistant', content });
}
