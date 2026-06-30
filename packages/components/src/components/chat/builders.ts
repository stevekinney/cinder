/**
 * Conversation builders for the Chat component.
 *
 * Chat renders a {@link ConversationHistory} snapshot. These are thin aliases
 * over the published `conversationalist` builders so examples, demos, tests, and
 * simple apps construct the same transcript shape Chat consumes.
 */

import {
  appendAssistantMessage as appendConversationalistAssistantMessage,
  appendMessages as appendConversationalistMessages,
  appendUserMessage as appendConversationalistUserMessage,
  createConversationHistory,
} from 'conversationalist';

import type { ConversationHistory, MessageInput } from './conversation-model.ts';

/** Creates a new empty conversation snapshot. */
const createConversation = createConversationHistory;

/** Appends one or more messages, preserving the previous no-op identity contract. */
function appendMessages(
  conversation: ConversationHistory,
  ...inputs: MessageInput[]
): ConversationHistory {
  if (inputs.length === 0) return conversation;
  return appendConversationalistMessages(conversation, ...inputs);
}

const appendUserMessage = appendConversationalistUserMessage;
const appendAssistantMessage = appendConversationalistAssistantMessage;

export { appendAssistantMessage, appendMessages, appendUserMessage, createConversation };
