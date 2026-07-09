/**
 * Conversation builders for the Chat component.
 *
 * Chat renders a {@link ConversationHistory} snapshot. These helpers construct
 * the published Conversationalist shape without importing the package runtime
 * into Cinder's browser graph.
 */

import type {
  ConversationEnvironment,
  ConversationHistory,
  ConversationStatus,
  JSONValue,
  Message,
  MessageInput,
  MultiModalContent,
  TokenUsage,
  ToolCall,
  ToolResult,
} from './conversation-model.ts';

type CreateConversationOptions = {
  id?: string;
  title?: string;
  status?: ConversationStatus;
  metadata?: Record<string, JSONValue>;
};

type ConversationEnvironmentInput = Partial<ConversationEnvironment>;
type MessageContentInput = MessageInput['content'] | MultiModalContent;
type LooseMessageInput = Omit<MessageInput, 'content'> & { content: MessageContentInput };

const MESSAGE_ROLES = new Set([
  'user',
  'assistant',
  'system',
  'developer',
  'tool-call',
  'tool-result',
  'snapshot',
]);

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}-${Math.random()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJsonObject(value: unknown): value is Record<string, JSONValue> {
  if (!isRecord(value) || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown): value is JSONValue {
  if (value === null) return true;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      if (Array.isArray(value)) return value.every(isJsonValue);
      return isJsonObject(value) && Object.values(value).every(isJsonValue);
    default:
      return false;
  }
}

function assertJsonObject(
  value: unknown,
  label: string,
): asserts value is Record<string, JSONValue> {
  if (!isJsonObject(value) || !Object.values(value).every(isJsonValue)) {
    throw new Error(`${label} must be a JSON-compatible object`);
  }
}

function isConversationEnvironmentParameter(value: unknown): value is ConversationEnvironmentInput {
  if (!isRecord(value) || 'role' in value) return false;
  return (
    typeof value['now'] === 'function' ||
    typeof value['randomId'] === 'function' ||
    typeof value['estimateTokens'] === 'function' ||
    (Array.isArray(value['plugins']) &&
      value['plugins'].every((plugin) => typeof plugin === 'function'))
  );
}

function isMultiModalContentPart(value: unknown): value is MultiModalContent {
  if (!isJsonObject(value) || typeof value['type'] !== 'string') return false;
  if (!Object.values(value).every(isJsonValue)) return false;
  switch (value['type']) {
    case 'text':
      return typeof value['text'] === 'string';
    case 'image':
      return typeof value['url'] === 'string';
    case 'thinking':
      return typeof value['thinking'] === 'string';
    case 'redacted_thinking':
      return typeof value['data'] === 'string';
    case 'server_tool_use':
      return typeof value['id'] === 'string' && typeof value['name'] === 'string';
    case 'web_search_tool_result':
      return typeof value['tool_use_id'] === 'string' && 'content' in value;
    case 'container_upload':
      return typeof value['file_id'] === 'string';
    default:
      return false;
  }
}

function isMessageContentInput(value: unknown): value is MessageContentInput {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every(isMultiModalContentPart)) ||
    isMultiModalContentPart(value)
  );
}

function isLooseMessageInput(value: unknown): value is LooseMessageInput {
  return (
    isRecord(value) &&
    typeof value['role'] === 'string' &&
    MESSAGE_ROLES.has(value['role']) &&
    isMessageContentInput(value['content']) &&
    (value['hidden'] === undefined || typeof value['hidden'] === 'boolean')
  );
}

function isMetadataRecord(value: unknown): value is Record<string, JSONValue> {
  return isJsonObject(value);
}

function resolveEnvironment(environment?: ConversationEnvironmentInput): {
  now: () => string;
  randomId: () => string;
  plugins: NonNullable<ConversationEnvironmentInput['plugins']>;
} {
  const plugins = environment?.plugins ?? [];
  if (!Array.isArray(plugins) || plugins.some((plugin) => typeof plugin !== 'function')) {
    throw new Error('conversation environment plugins must be functions');
  }
  return {
    now: environment?.now ?? (() => new Date().toISOString()),
    randomId: environment?.randomId ?? createId,
    plugins: [...plugins],
  };
}

function cloneStructuredValue<T>(value: T): T {
  return structuredClone(value);
}

function cloneMetadata(metadata: Record<string, JSONValue> | undefined): Record<string, JSONValue> {
  if (metadata === undefined) return {};
  assertJsonObject(metadata, 'metadata');
  return cloneStructuredValue(metadata);
}

function normalizeContent(content: MessageContentInput): MessageInput['content'] {
  if (typeof content === 'string') return content;
  if (!isMessageContentInput(content)) {
    throw new Error('message content must be a known multi-modal content part');
  }
  return Array.isArray(content) ? cloneStructuredValue(content) : [cloneStructuredValue(content)];
}

function cloneTokenUsage(tokenUsage: TokenUsage): TokenUsage {
  assertJsonObject(tokenUsage, 'tokenUsage');
  if (Object.values(tokenUsage).some((value) => typeof value !== 'number')) {
    throw new Error('tokenUsage values must be numbers');
  }
  return cloneStructuredValue(tokenUsage);
}

function cloneToolCall(toolCall: ToolCall): ToolCall {
  assertJsonObject(toolCall, 'toolCall');
  if (
    typeof toolCall.id !== 'string' ||
    typeof toolCall.name !== 'string' ||
    !('arguments' in toolCall) ||
    !isJsonValue(toolCall.arguments)
  ) {
    throw new Error('toolCall must include string id, string name, and JSON arguments');
  }
  return cloneStructuredValue(toolCall);
}

function cloneToolResult(toolResult: ToolResult): ToolResult {
  assertJsonObject(toolResult, 'toolResult');
  if (
    typeof toolResult.callId !== 'string' ||
    !['success', 'error', 'action_required'].includes(String(toolResult.outcome)) ||
    !('content' in toolResult) ||
    !isJsonValue(toolResult.content)
  ) {
    throw new Error('toolResult must include string callId, valid outcome, and JSON content');
  }
  return cloneStructuredValue(toolResult);
}

function getOrderedMessages(conversation: ConversationHistory): Message[] {
  return conversation.ids
    .map((id) => conversation.messages[id])
    .filter((message): message is Message => message !== undefined);
}

function buildToolCallIds(messages: ReadonlyArray<Message>): Set<string> {
  const toolCallIds = new Set<string>();
  for (const message of messages) {
    if (message.role === 'tool-call' && message.toolCall !== undefined) {
      if (toolCallIds.has(message.toolCall.id)) {
        throw new Error(`duplicate toolCall.id in conversation: ${message.toolCall.id}`);
      }
      toolCallIds.add(message.toolCall.id);
    }
  }
  return toolCallIds;
}

function assertValidToolMessage(input: LooseMessageInput, toolCallIds: Set<string>): void {
  if (input.role === 'tool-result' && input.toolResult !== undefined) {
    if (!toolCallIds.has(input.toolResult.callId)) {
      throw new Error(`tool result references non-existent tool-call: ${input.toolResult.callId}`);
    }
  }
  if (input.role === 'tool-call' && input.toolCall !== undefined) {
    if (toolCallIds.has(input.toolCall.id)) {
      throw new Error(`duplicate toolCall.id in conversation: ${input.toolCall.id}`);
    }
    toolCallIds.add(input.toolCall.id);
  }
}

/** Creates a new empty conversation snapshot. */
function createConversation(
  options: CreateConversationOptions = {},
  environment?: ConversationEnvironmentInput,
): ConversationHistory {
  const resolvedEnvironment = resolveEnvironment(environment);
  const createdAt = resolvedEnvironment.now();
  return {
    schemaVersion: 4,
    id: options.id ?? resolvedEnvironment.randomId(),
    ...(options.title !== undefined ? { title: options.title } : {}),
    status: options.status ?? 'active',
    metadata: cloneMetadata(options.metadata),
    ids: [],
    messages: {},
    createdAt,
    updatedAt: createdAt,
  };
}

function materializeMessage(
  input: LooseMessageInput,
  position: number,
  createdAt: string,
  id: string,
): Message {
  return {
    id,
    role: input.role,
    content: normalizeContent(input.content),
    position,
    createdAt,
    metadata: cloneMetadata(input.metadata),
    hidden: input.hidden ?? false,
    ...(input.toolCall !== undefined ? { toolCall: cloneToolCall(input.toolCall) } : {}),
    ...(input.toolResult !== undefined ? { toolResult: cloneToolResult(input.toolResult) } : {}),
    ...(input.tokenUsage !== undefined ? { tokenUsage: cloneTokenUsage(input.tokenUsage) } : {}),
    ...(input.role === 'assistant' && input.goalCompleted !== undefined
      ? { goalCompleted: input.goalCompleted }
      : {}),
  };
}

function partitionAppendArguments(args: unknown[]): {
  inputs: LooseMessageInput[];
  environment?: ConversationEnvironmentInput;
} {
  const filteredArguments = args.at(-1) === undefined ? args.slice(0, -1) : args;
  if (filteredArguments.some((argument) => argument === undefined)) {
    throw new Error(
      'appendMessages expected MessageInput arguments before the optional environment',
    );
  }
  const lastArgument = filteredArguments.at(-1);
  const inputArguments = isConversationEnvironmentParameter(lastArgument)
    ? filteredArguments.slice(0, -1)
    : filteredArguments;
  const inputs: LooseMessageInput[] = [];
  for (const argument of inputArguments) {
    if (!isLooseMessageInput(argument)) {
      throw new Error(
        'appendMessages expected MessageInput arguments before the optional environment',
      );
    }
    inputs.push(argument);
  }
  if (isConversationEnvironmentParameter(lastArgument)) {
    return { inputs, environment: lastArgument };
  }
  return { inputs };
}

/** Appends one or more messages, preserving the previous no-op identity contract. */
function appendMessages(
  conversation: ConversationHistory,
  ...inputs: MessageInput[]
): ConversationHistory;
function appendMessages(
  conversation: ConversationHistory,
  ...inputsAndEnvironment: [...MessageInput[], ConversationEnvironmentInput | undefined]
): ConversationHistory;
function appendMessages(
  conversation: ConversationHistory,
  ...args: unknown[]
): ConversationHistory {
  const { inputs, environment } = partitionAppendArguments(args);
  if (inputs.length === 0) return conversation;
  const resolvedEnvironment = resolveEnvironment(environment);
  const updatedAt = resolvedEnvironment.now();
  const nextIds = [...conversation.ids];
  const nextMessages = { ...conversation.messages };
  const toolCallIds = buildToolCallIds(getOrderedMessages(conversation));

  inputs.forEach((input, index) => {
    const normalizedInput: MessageInput = { ...input, content: normalizeContent(input.content) };
    const processedInput = resolvedEnvironment.plugins.reduce(
      (current, plugin) => plugin(current),
      normalizedInput,
    );
    if (!isLooseMessageInput(processedInput)) {
      throw new Error('conversation plugin returned an invalid MessageInput');
    }
    assertValidToolMessage(processedInput, toolCallIds);
    const messageId = resolvedEnvironment.randomId();
    if (typeof messageId !== 'string') {
      throw new Error('generated message id must be a string');
    }
    if (nextMessages[messageId] !== undefined || nextIds.includes(messageId)) {
      throw new Error(`duplicate message id in conversation: ${messageId}`);
    }
    const message = materializeMessage(
      processedInput,
      conversation.ids.length + index,
      updatedAt,
      messageId,
    );
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
  environment?: ConversationEnvironmentInput,
): ConversationHistory;
function appendUserMessage(
  conversation: ConversationHistory,
  content: MessageInput['content'],
  environment?: ConversationEnvironmentInput,
): ConversationHistory;
function appendUserMessage(
  conversation: ConversationHistory,
  content: MessageInput['content'],
  metadataOrEnvironment?: Record<string, JSONValue> | ConversationEnvironmentInput,
  environment?: ConversationEnvironmentInput,
): ConversationHistory {
  const metadata = resolveRoleHelperMetadata(metadataOrEnvironment, environment);
  const resolvedEnvironment =
    environment ??
    (isConversationEnvironmentParameter(metadataOrEnvironment) ? metadataOrEnvironment : undefined);
  return appendMessages(conversation, { role: 'user', content, metadata }, resolvedEnvironment);
}

function appendAssistantMessage(
  conversation: ConversationHistory,
  content: MessageInput['content'],
  metadata?: Record<string, JSONValue>,
  environment?: ConversationEnvironmentInput,
): ConversationHistory;
function appendAssistantMessage(
  conversation: ConversationHistory,
  content: MessageInput['content'],
  environment?: ConversationEnvironmentInput,
): ConversationHistory;
function appendAssistantMessage(
  conversation: ConversationHistory,
  content: MessageInput['content'],
  metadataOrEnvironment?: Record<string, JSONValue> | ConversationEnvironmentInput,
  environment?: ConversationEnvironmentInput,
): ConversationHistory {
  const metadata = resolveRoleHelperMetadata(metadataOrEnvironment, environment);
  const resolvedEnvironment =
    environment ??
    (isConversationEnvironmentParameter(metadataOrEnvironment) ? metadataOrEnvironment : undefined);
  return appendMessages(
    conversation,
    { role: 'assistant', content, metadata },
    resolvedEnvironment,
  );
}

function resolveRoleHelperMetadata(
  metadataOrEnvironment: Record<string, JSONValue> | ConversationEnvironmentInput | undefined,
  environment: ConversationEnvironmentInput | undefined,
): Record<string, JSONValue> | undefined {
  if (metadataOrEnvironment === undefined) return undefined;
  if (environment === undefined && isConversationEnvironmentParameter(metadataOrEnvironment)) {
    return undefined;
  }
  if (isMetadataRecord(metadataOrEnvironment)) return metadataOrEnvironment;
  throw new Error('metadata must be a JSON-compatible object');
}

export { appendAssistantMessage, appendMessages, appendUserMessage, createConversation };
