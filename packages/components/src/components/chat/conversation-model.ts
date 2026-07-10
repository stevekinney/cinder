/**
 * Conversationalist data model types for the Chat component.
 *
 * Chat renders immutable transcript snapshots and keeps its public `conversation`
 * prop aligned with the published `conversationalist` package. This file is a
 * type-only bridge so Cinder does not maintain a stale structural mirror.
 *
 * @module
 */

import type { ToMarkdownOptions as ConversationalistToMarkdownOptions } from 'conversationalist/markdown';

export type {
  AssistantMessage,
  ContainerUploadContent,
  ConversationEnvironment,
  ConversationHistory,
  ConversationStatus,
  ImageContent,
  JSONValue,
  Message,
  MessageInput,
  MessageRole,
  MultiModalContent,
  RedactedThinkingContent,
  ServerToolResultContent,
  ServerToolResultType,
  ServerToolUseContent,
  TextContent,
  ThinkingContent,
  TokenUsage,
  ToolAction,
  ToolCall,
  ToolError,
  ToolErrorCategory,
  ToolResult,
  WebSearchToolResultContent,
} from 'conversationalist';
export type { ToolCallPair } from 'conversationalist/utilities';

/** Base options shared by all transcript export operations. */
export type ExportOptions = Omit<ConversationalistToMarkdownOptions, 'includeMetadata'>;

/** Options for exporting a transcript to markdown. */
export type ToMarkdownOptions = ConversationalistToMarkdownOptions;
