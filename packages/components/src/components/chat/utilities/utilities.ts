/**
 * Utility functions for chat message operations.
 *
 * These helpers work with the vendored {@link Message} type to extract
 * content for copy/export operations.
 */

import type { Message, MultiModalContent } from '../conversation-model.ts';

/**
 * Normalizes content to a multi-modal array.
 *
 * Strings are wrapped in a single text part; a single content item is wrapped
 * in an array; an array is returned as-is. The `ReadonlyArray` in/out signature
 * matches {@link Message.content} so callers pass `message.content` with zero casts.
 *
 * @param input - String, single content item, or readonly content array
 * @returns The content as a readonly multi-modal array
 */
export function toMultiModalArray(
  input: string | MultiModalContent | ReadonlyArray<MultiModalContent>,
): ReadonlyArray<MultiModalContent> {
  if (typeof input === 'string') return [{ type: 'text', text: input }];
  // A single MultiModalContent has a `type` discriminant; an array does not.
  // (`Array.isArray` doesn't narrow a `ReadonlyArray` out of the union, so key
  // off the discriminant instead — no cast needed.)
  return 'type' in input ? [input] : input;
}

/**
 * Type predicate for text content parts.
 */
function isTextPart(part: MultiModalContent): part is TextPart {
  return part.type === 'text';
}

type TextPart = MultiModalContent & { type: 'text'; text: string };

/**
 * Extracts all content parts from a message as a multi-modal array.
 * String content is converted to a single text part; empty/missing content
 * yields an empty text part.
 *
 * @param message - The message to extract parts from
 * @returns A readonly array of content parts
 */
export function getMessageParts(message: Message): ReadonlyArray<MultiModalContent> {
  // `content` is `string | ReadonlyArray<MultiModalContent>` (never nullish);
  // toMultiModalArray handles the empty-string and empty-array cases.
  return toMultiModalArray(message.content);
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
    'tool-call': 'Tool Call',
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
 * This is a browser-compatible markdown serialization for chat transcripts,
 * avoiding the Node.js APIs (createRequire) used by server-side exporters.
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
