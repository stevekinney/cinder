/**
 * Utility functions for chat message operations.
 *
 * These helpers work with the published {@link Message} type to extract
 * content for copy/export operations.
 */

import type { ChatArtifact } from '../artifact/artifact-viewer.types.ts';
import type { Message, MultiModalContent, ToolResult } from '../conversation-model.ts';
import type {
  ChatMessagePart,
  ImageMessagePart,
  MessagePartDerivationContext,
  StepInfo,
  StepStatus,
  ToolApprovalMessagePart,
} from './types.ts';

/** Namespaced metadata keys the overlay parts read (ignorable by plain rendering). */
export const CINDER_REASONING_METADATA_KEY = 'cinder:reasoning';
export const CINDER_STEPS_METADATA_KEY = 'cinder:steps';
export const CINDER_SUGGESTIONS_METADATA_KEY = 'cinder:suggestions';
export const CINDER_ARTIFACT_METADATA_KEY = 'cinder:artifact';

const ARTIFACT_CONTENT_TYPES: ReadonlySet<string> = new Set<ChatArtifact['type']>([
  'html',
  'svg',
  'code',
  'mermaid',
]);

const STEP_STATUSES: ReadonlySet<string> = new Set<StepStatus>([
  'pending',
  'running',
  'done',
  'error',
]);

/**
 * Narrows an unknown value to a valid {@link StepInfo}. Uses `in`-operator
 * narrowing (no `as` assertion) so each accessed field is type-safe.
 */
function isStepInfo(value: unknown): value is StepInfo {
  if (value === null || typeof value !== 'object') return false;
  if (!('title' in value) || !('content' in value) || !('status' in value)) return false;
  return (
    typeof value.title === 'string' &&
    typeof value.content === 'string' &&
    typeof value.status === 'string' &&
    STEP_STATUSES.has(value.status)
  );
}

function isChatArtifact(value: unknown): value is ChatArtifact {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!('type' in value) || !('content' in value)) return false;
  if (typeof value.type !== 'string' || !ARTIFACT_CONTENT_TYPES.has(value.type)) return false;
  if (typeof value.content !== 'string') return false;
  if ('language' in value && typeof value.language !== 'string') return false;
  if ('title' in value && typeof value.title !== 'string') return false;
  return true;
}

/** Resolves a validated artifact descriptor from `cinder:artifact` metadata. */
export function resolveMessageArtifact(message: Message): ChatArtifact | undefined {
  const candidate: unknown = message.metadata[CINDER_ARTIFACT_METADATA_KEY];
  return isChatArtifact(candidate) ? candidate : undefined;
}

/**
 * Runs a per-message overlay callback, guarding a consumer throw (a buggy
 * callback can never break the chat render). Returns the sentinel `undefined`
 * for "no opinion — fall back to metadata", distinguished from a callback that
 * returns a real (possibly empty) value meaning "this is authoritative".
 */
function runOverlayCallback<T>(
  message: Message,
  fromProp: ((message: Message) => T | undefined) | undefined,
): { handled: boolean; value: T | undefined } {
  if (fromProp === undefined) return { handled: false, value: undefined };
  try {
    const value = fromProp(message);
    // `undefined` means "fall back to metadata"; any other return (incl. an
    // empty string/array, which suppresses the overlay) is authoritative.
    return value === undefined ? { handled: false, value: undefined } : { handled: true, value };
  } catch {
    // A throwing callback is treated as "no opinion" — fall back to metadata
    // rather than letting the error escape and break the render.
    return { handled: false, value: undefined };
  }
}

/**
 * Resolves the reasoning overlay for a message. An explicit per-message callback
 * is consulted first; when it returns `undefined` (or throws) the resolution
 * falls back to `cinder:reasoning` namespaced metadata. An empty string from the
 * callback is authoritative and suppresses the overlay. That suppression is
 * returned as `''` so downstream part derivation can also skip transcript-native
 * `thinking` content. Returns `undefined` when no reasoning source applies.
 */
export function resolveMessageReasoning(
  message: Message,
  fromProp?: (message: Message) => string | undefined,
): string | undefined {
  const fromCallback = runOverlayCallback(message, fromProp);
  if (fromCallback.handled && fromCallback.value === '') return '';
  const candidate: unknown = fromCallback.handled
    ? fromCallback.value
    : message.metadata[CINDER_REASONING_METADATA_KEY];
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}

/**
 * Resolves the step overlay for a message. An explicit per-message callback is
 * consulted first; when it returns `undefined` (or throws) the resolution falls
 * back to `cinder:steps` namespaced metadata. An empty array from the callback is
 * authoritative and suppresses the overlay. Invalid entries are dropped. Returns
 * `undefined` when no valid steps apply.
 */
export function resolveMessageSteps(
  message: Message,
  fromProp?: (message: Message) => StepInfo[] | undefined,
): StepInfo[] | undefined {
  const fromCallback = runOverlayCallback(message, fromProp);
  const candidate: unknown = fromCallback.handled
    ? fromCallback.value
    : message.metadata[CINDER_STEPS_METADATA_KEY];
  if (!Array.isArray(candidate)) return undefined;
  const steps = candidate.filter(isStepInfo);
  return steps.length > 0 ? steps : undefined;
}

/**
 * Resolves the suggestion overlay for a message. An explicit per-message callback
 * is consulted first; when it returns `undefined` (or throws) the resolution
 * falls back to `cinder:suggestions` namespaced metadata. An empty array from the
 * callback is authoritative and suppresses the overlay. Non-string entries are
 * dropped. Returns `undefined` when no valid suggestions apply.
 */
export function resolveMessageSuggestions(
  message: Message,
  fromProp?: (message: Message) => string[] | undefined,
): string[] | undefined {
  const fromCallback = runOverlayCallback(message, fromProp);
  const candidate: unknown = fromCallback.handled
    ? fromCallback.value
    : message.metadata[CINDER_SUGGESTIONS_METADATA_KEY];
  if (!Array.isArray(candidate)) return undefined;
  const suggestions = candidate.filter((entry): entry is string => typeof entry === 'string');
  return suggestions.length > 0 ? suggestions : undefined;
}

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

function formatJSONValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function getServerContentText(part: MultiModalContent): string | undefined {
  switch (part.type) {
    case 'text':
      return part.text;
    case 'server_tool_use':
      return [`Server tool use: ${part.name}`, formatJSONValue(part.input)].join('\n');
    case 'web_search_tool_result':
      return [`Web search result: ${part.tool_use_id}`, formatJSONValue(part.content)].join('\n');
    case 'code_execution_tool_result':
    case 'bash_code_execution_tool_result':
    case 'text_editor_code_execution_tool_result':
    case 'web_fetch_tool_result':
      return [`Server tool result: ${part.tool_use_id}`, formatJSONValue(part.content)].join('\n');
    case 'container_upload':
      return `Container upload: ${part.file_id}`;
    default:
      return undefined;
  }
}

/**
 * Extracts all content parts from a message as a multi-modal array.
 * `content` is `string | ReadonlyArray<MultiModalContent>` and never nullish.
 * A string yields a single text part (an empty string yields one empty text
 * part); an array is returned as-is, so an empty array yields an empty array.
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
    .map(getServerContentText)
    .filter((text): text is string => typeof text === 'string' && text.length > 0)
    .join('\n');
}

/**
 * Derives image render parts from a message's content array.
 *
 * One {@link ImageMessagePart} per image segment, keyed by the image's index in
 * the original content array so identity is stable as a streaming text body
 * grows alongside it. A string body has no images and yields an empty array.
 */
function deriveImageParts(message: Message): ImageMessagePart[] {
  if (typeof message.content === 'string') return [];

  const parts: ImageMessagePart[] = [];
  message.content.forEach((segment, index) => {
    if (segment.type === 'image') {
      parts.push({
        type: 'image',
        key: `${message.id}:image:${index}`,
        image: segment,
      });
    }
  });
  return parts;
}

function deriveReasoningContent(
  message: Message,
  explicitReasoning: string | undefined,
): string | undefined {
  if (explicitReasoning === '') return undefined;
  const reasoningSegments =
    explicitReasoning && explicitReasoning.length > 0 ? [explicitReasoning] : [];
  if (typeof message.content !== 'string') {
    let hasRedactedThinking = false;
    for (const segment of message.content) {
      if (segment.type === 'thinking' && segment.thinking.length > 0) {
        reasoningSegments.push(segment.thinking);
      }
      if (segment.type === 'redacted_thinking') {
        hasRedactedThinking = true;
      }
    }
    if (hasRedactedThinking) {
      reasoningSegments.push(
        'Redacted reasoning is preserved in this transcript but cannot be displayed.',
      );
    }
  }

  return reasoningSegments.length > 0 ? reasoningSegments.join('\n\n') : undefined;
}

/**
 * Builds a {@link ToolApprovalMessagePart} from an `action_required` tool result.
 *
 * Shared by both the standalone `tool-result` branch and the paired `tool-call`
 * branch of {@link deriveMessageParts} so the approval prompt renders for either
 * transcript shape. The human-readable tool name resolves from the paired
 * tool-call when available (else the call id); the approval state comes from the
 * container's approved/denied id sets. Caller guarantees `result.action` exists.
 */
function deriveToolApprovalPart(
  messageId: string,
  result: ToolResult,
  context: MessagePartDerivationContext,
): ToolApprovalMessagePart {
  const approved = context.approvedToolCallIds?.has(result.callId)
    ? true
    : context.deniedToolCallIds?.has(result.callId)
      ? false
      : undefined;
  return {
    type: 'tool-approval',
    key: `${messageId}:tool-approval:${result.callId}`,
    toolCallId: result.callId,
    toolName: context.toolCallPair?.call.name ?? result.callId,
    action: result.action!,
    approved,
  };
}

/**
 * Derives the ordered render parts for a single message.
 *
 * This is the cinder-OWNED bridge from the compatible {@link Message} mirror to
 * the {@link ChatMessagePart} render layer. It is pure: every part is computed
 * from the message plus the per-message {@link MessagePartDerivationContext}
 * (the resolved tool-call pair and the live streaming buffer), never from
 * conversation-global state or any runtime library. UI-only parts are never
 * written back to the transcript.
 *
 * Body derivation mirrors the historical role-branch rendering exactly:
 * - `tool-call` messages emit a single `tool-call` part ONLY when the container
 *   resolved a pair for them (`context.toolCallPair`). This matches the original
 *   `isToolCall && toolPair` guard: the real container always supplies a pair
 *   for a tool-call message (with `result: undefined` while the result is still
 *   pending), so a pending call still renders as a card; a standalone
 *   `<ChatMessage>` given no pair falls through to the text body, exactly as
 *   before.
 * - `tool-result` messages with a `toolResult` emit a single `tool-result`
 *   part (the container hides results already folded into a paired card).
 * - every other role emits a `markdown` body part carrying the effective text
 *   (streaming `overrideContent` resolved in).
 *
 * Every branch then appends one `image` part per image segment in the content,
 * so attachments render below the body for all roles — exactly as the historical
 * unconditional `MessageAttachments` did.
 *
 * A `tool-call` message with no resolved pair, or a `tool-result` message with
 * no `toolResult`, falls back to the markdown path rather than producing nothing.
 *
 * @param message - The message to derive parts for
 * @param context - Per-message pairing + streaming context (optional)
 * @returns The ordered render parts (stable `key` on each for keyed iteration)
 */
export function deriveMessageParts(
  message: Message,
  context: MessagePartDerivationContext = {},
): ChatMessagePart[] {
  // Images render below the body for every role (the historical attachment view
  // was unconditional), so each branch appends them after its body part.
  const imageParts = deriveImageParts(message);

  // Tool-call body: emit a tool-call part only when the container resolved a
  // pair for this message (mirrors the original `isToolCall && toolPair`
  // guard). With no pair, fall through to the markdown body below — the same
  // text rendering the original showed for an unpaired tool-call message.
  //
  // When that pair's result is `action_required` with an action, ALSO emit a
  // tool-approval part after the call card. In the common paired transcript the
  // standalone `tool-result` row is folded into this card (the container hides
  // paired results), so without this the approval prompt would never render for
  // the call-plus-result shape — only for a rare standalone action_required
  // result. The card shows what is being called; the approval gates consent.
  if (message.role === 'tool-call' && message.toolCall && context.toolCallPair) {
    const result = context.toolCallPair.result;
    const approvalPart =
      result && result.outcome === 'action_required' && result.action
        ? deriveToolApprovalPart(message.id, result, context)
        : undefined;
    return [
      {
        type: 'tool-call',
        key: `${message.id}:tool-call:${message.toolCall.id}`,
        pair: context.toolCallPair,
      },
      ...(approvalPart ? [approvalPart] : []),
      ...imageParts,
    ];
  }

  // Tool-result body: when the outcome is `action_required` and an action is
  // present, emit a `tool-approval` part instead of the plain `tool-result`
  // part. The approval part carries the action, the tool call id (used to
  // look up the tool name from the paired tool-call), and the resolved
  // approval state from the container's approved/denied id sets. A plain
  // `success` or `error` result falls through to the standard `tool-result`
  // part, so this branch is a strict superset that adds zero visual change
  // for non-approval results.
  if (message.role === 'tool-result' && message.toolResult) {
    const result = message.toolResult;
    if (result.outcome === 'action_required' && result.action) {
      return [deriveToolApprovalPart(message.id, result, context), ...imageParts];
    }
    return [
      {
        type: 'tool-result',
        key: `${message.id}:tool-result:${result.callId}`,
        result,
      },
      ...imageParts,
    ];
  }

  // Default body: markdown text (streaming override resolved in) followed by
  // images. `body` is a representation-independent key, so a streaming body
  // never remounts as its text grows, and an attachment landing after it keeps
  // its own index-based key.
  //
  // C4: Composition order is steps → reasoning → markdown → images.
  // Steps surface the plan, reasoning surfaces extended thinking, markdown is
  // the final answer. When neither is present the branch is identical to today.
  const content = context.overrideContent ?? getMessageText(message);

  const bodyParts: ChatMessagePart[] = [];

  // C4: Step parts — one per entry in context.steps[], in order.
  if (context.steps && context.steps.length > 0) {
    for (let index = 0; index < context.steps.length; index++) {
      const step = context.steps[index]!;
      bodyParts.push({
        type: 'step',
        key: `${message.id}:step:${index}`,
        index,
        title: step.title,
        content: step.content,
        status: step.status,
      });
    }
  }

  // C4: Reasoning part — emitted before the markdown body when present.
  const reasoningContent = deriveReasoningContent(message, context.reasoning);
  if (reasoningContent) {
    bodyParts.push({
      type: 'reasoning',
      key: `${message.id}:reasoning`,
      content: reasoningContent,
      streaming: context.streaming ?? false,
    });
  }

  bodyParts.push({
    type: 'markdown',
    key: `${message.id}:body`,
    content,
    streaming: context.streaming ?? false,
    expanded: context.expanded ?? true,
  });

  // C5: Suggestion parts — one per entry in context.suggestions[], after the
  // markdown body but before images. An empty or absent array adds nothing,
  // keeping the plain-transcript path identical to before.
  if (context.suggestions && context.suggestions.length > 0) {
    for (let index = 0; index < context.suggestions.length; index++) {
      const label = context.suggestions[index]!;
      bodyParts.push({
        type: 'suggestion',
        key: `${message.id}:suggestion:${index}`,
        index,
        label,
      });
    }
  }

  return [...bodyParts, ...imageParts];
}

const messageRoleLabels: Record<Message['role'], string> = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
  developer: 'Developer',
  'tool-call': 'Tool Call',
  'tool-result': 'Tool Result',
  snapshot: 'Snapshot',
};

/**
 * Gets the role label for a message.
 * Maps internal role values to human-readable labels.
 *
 * @param message - The message to get the role label for
 * @returns A human-readable role label
 */
export function getMessageRoleLabel(message: Message): string {
  return messageRoleLabels[message.role] ?? message.role;
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
