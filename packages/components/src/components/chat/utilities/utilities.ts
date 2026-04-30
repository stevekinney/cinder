/**
 * Utility functions for chat message operations.
 *
 * These helpers work with conversationalist's Message type to extract
 * content for copy/export operations.
 */

import type { Message, MultiModalContent } from 'conversationalist';
import { toMultiModalArray } from 'conversationalist';

/**
 * Type predicate for text content parts.
 */
function isTextPart(
  part: MultiModalContent,
): part is MultiModalContent & { type: 'text'; text: string } {
  return part.type === 'text';
}

/**
 * Normalizes message content to a form accepted by toMultiModalArray().
 * Handles null/undefined, plain strings, and readonly arrays uniformly.
 *
 * @param message - The message whose content to normalize
 * @returns A mutable string or array suitable for toMultiModalArray()
 */
function toMutableContent(message: Message): string | MultiModalContent[] {
  const { content } = message;
  if (content == null) return '';
  return typeof content === 'string' ? content : [...content];
}

/**
 * Extracts all content parts from a message as a multi-modal array.
 * String content is converted to a single text part.
 *
 * @param message - The message to extract parts from
 * @returns An array of content parts
 */
export function getMessageParts(message: Message): MultiModalContent[] {
  return toMultiModalArray(toMutableContent(message));
}

/**
 * Extracts all text content from a message, joined by newlines.
 * Non-text parts (images, etc.) are excluded from the result.
 *
 * This is useful for copying a message's text content to clipboard
 * without including non-text attachments.
 *
 * @param message - The message to extract text from
 * @returns The concatenated text content
 *
 * @example
 * ```typescript
 * const text = getMessageText(message);
 * await copyToClipboard(text);
 * ```
 */
export function getMessageText(message: Message): string {
  return getMessageParts(message)
    .filter(isTextPart)
    .map((part) => part.text)
    .join('\n');
}

/**
 * Gets the role label for a message.
 * Maps internal role values to human-readable labels.
 *
 * @param message - The message to get the role label for
 * @returns A human-readable role label
 */
export function getMessageRoleLabel(message: Message): string {
  const labels: Record<Message['role'], string> = {
    user: 'User',
    assistant: 'Assistant',
    system: 'System',
    developer: 'Developer',
    'tool-use': 'Tool Call',
    'tool-result': 'Tool Result',
    snapshot: 'Snapshot',
  };
  return labels[message.role] ?? message.role;
}

/**
 * Formats a single message as Markdown for copy operations.
 *
 * Currently returns just the text content without role labels,
 * since the UI context makes the source obvious. The separate function
 * exists for API clarity and future extensibility (e.g., adding code
 * fences for tool results).
 *
 * @param message - The message to format
 * @returns Markdown-formatted message content
 */
export function formatMessageAsMarkdown(message: Message): string {
  return getMessageText(message);
}

/**
 * Formats a message with role label for conversation export.
 *
 * @param message - The message to format
 * @returns Markdown-formatted message with role header
 */
function formatMessageWithRole(message: Message): string {
  const roleLabel = getMessageRoleLabel(message);
  const text = getMessageText(message);
  return `**${roleLabel}:**\n\n${text}`;
}

/**
 * Converts a list of messages to Markdown format.
 *
 * This is a browser-compatible alternative to conversationalist/markdown's
 * toMarkdown function, which uses Node.js APIs (createRequire).
 *
 * @param messages - The messages to convert
 * @returns Markdown-formatted conversation
 */
export function messagesToMarkdown(messages: Message[]): string {
  return messages
    .filter((msg) => msg.role !== 'system' && msg.role !== 'developer')
    .map(formatMessageWithRole)
    .join('\n\n---\n\n');
}
