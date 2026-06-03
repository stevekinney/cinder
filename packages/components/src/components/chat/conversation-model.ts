/**
 * Vendored conversation data model for the Chat component.
 *
 * Chat renders conversation transcripts but does not manage conversation state,
 * so it depends only on the *shape* of the data it displays — not on any runtime
 * library. This module is a faithful structural mirror of the message/content/tool
 * shapes produced by the `conversationalist` library (and the shared
 * `interoperability` tool types it builds on), so a `conversationalist` `Message`
 * or an `armorer` tool call/result satisfies these types with zero adaptation.
 *
 * This file is the single authority for the contract. Provenance: agent-bureau
 * commit `4ca94f7af6b06e0310b81c1706aebc092804879a`
 * (`packages/conversationalist/src/{types,multi-modal}.ts`,
 * `packages/interoperability/src/types.ts`). If provenance ever drifts from this
 * file, this file wins and the discrepancy is raised separately.
 *
 * @module
 */

/** A JSON-serializable primitive. */
export type JSONPrimitive = string | number | boolean | null;

/** Any JSON-serializable value. */
export type JSONValue = JSONPrimitive | ReadonlyArray<JSONValue> | { [key: string]: JSONValue };

/** A text segment of message content. */
export type TextContent = { type: 'text'; text: string };

/** An image segment of message content. */
export type ImageContent = { type: 'image'; url: string; mimeType?: string; text?: string };

/** A single segment of multi-modal message content. */
export type MultiModalContent = TextContent | ImageContent;

/** Classification of a tool execution failure. */
export type ToolErrorCategory =
  | 'validation'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'transient'
  | 'timeout'
  | 'cancelled'
  | 'internal';

/** Structured error metadata attached to a failed tool result. */
export type ToolError = {
  code: string;
  category: ToolErrorCategory;
  retryable: boolean;
  message: string;
  details?: JSONValue | undefined;
};

/** A follow-up action a tool result can request before it can complete. */
export type ToolAction = {
  type: 'approval' | 'input';
  message?: string | undefined;
  schema?: JSONValue | undefined;
};

/** A request to invoke a tool. */
export type ToolCall = { id: string; name: string; arguments: JSONValue };

/** The outcome of executing a tool call. */
export type ToolResult = {
  callId: string;
  outcome: 'success' | 'error' | 'action_required';
  content: JSONValue;
  error?: ToolError | undefined;
  action?: ToolAction | undefined;
};

/** A tool call paired with its result, if one exists yet. */
export type ToolCallPair = { call: ToolCall; result?: ToolResult | undefined };

/** The role a message plays in a conversation. */
export type MessageRole =
  | 'user'
  | 'assistant'
  | 'system'
  | 'developer'
  | 'tool-call'
  | 'tool-result'
  | 'snapshot';

/** Token accounting for a single message. */
export type TokenUsage = { prompt: number; completion: number; total: number };

/** The mutable input shape used to create a message. */
export type MessageInput = {
  role: MessageRole;
  content: string | MultiModalContent[];
  metadata?: Record<string, JSONValue> | undefined;
  hidden?: boolean | undefined;
  toolCall?: ToolCall | undefined;
  toolResult?: ToolResult | undefined;
  tokenUsage?: TokenUsage | undefined;
};

/** An immutable message in a conversation transcript. */
export type Message = {
  id: string;
  role: MessageRole;
  content: string | ReadonlyArray<MultiModalContent>;
  position: number;
  createdAt: string;
  metadata: Readonly<Record<string, JSONValue>>;
  hidden: boolean;
  toolCall?: Readonly<ToolCall> | undefined;
  toolResult?: Readonly<ToolResult> | undefined;
  tokenUsage?: Readonly<TokenUsage> | undefined;
};

/** Lifecycle status of a conversation. */
export type ConversationStatus = 'active' | 'archived' | 'deleted';

/**
 * An immutable conversation transcript snapshot.
 *
 * `ids` is the canonical message ordering; `messages` is a record keyed by id
 * (NOT an array). Resolve a message by walking `ids` and looking each up in
 * `messages` — see {@link getMessages} in `./utilities/conversation.ts`.
 */
export type ConversationHistory = {
  schemaVersion: number;
  id: string;
  title?: string | undefined;
  status: ConversationStatus;
  metadata: Readonly<Record<string, JSONValue>>;
  ids: ReadonlyArray<string>;
  messages: Readonly<Record<string, Message>>;
  createdAt: string;
  updatedAt: string;
};

/** Base options shared by all transcript export operations. */
export type ExportOptions = {
  /** When true, strips transient metadata (keys starting with '_'). @default false */
  stripTransient?: boolean;
  /** When false, hidden messages are omitted from export output. @default true */
  includeHidden?: boolean;
  /** When true, hidden message content is replaced with a redacted placeholder. @default false */
  redactHiddenContent?: boolean;
  /** Placeholder used when redacting tool or hidden content. @default "[REDACTED]" */
  redactedPlaceholder?: string;
  /** When true, redacts tool call arguments with '[REDACTED]'. @default false */
  redactToolArguments?: boolean;
  /** When true, redacts tool result content with '[REDACTED]'. @default false */
  redactToolResults?: boolean;
};

/** Options for exporting a transcript to markdown. */
export type ToMarkdownOptions = ExportOptions & {
  /** When true, includes YAML frontmatter with full metadata for lossless round-trip. @default false */
  includeMetadata?: boolean;
};
