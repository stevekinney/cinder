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
type MessageInputOrEnvironment = LooseMessageInput | ConversationEnvironmentInput | undefined;

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}-${Math.random()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isConversationEnvironmentParameter(value: unknown): value is ConversationEnvironmentInput {
  if (!isRecord(value) || 'role' in value) return false;
  return (
    typeof value['now'] === 'function' ||
    typeof value['randomId'] === 'function' ||
    typeof value['estimateTokens'] === 'function' ||
    (Array.isArray(value['plugins']) && value['plugins'].length > 0) ||
    isRecord(value['persistence'])
  );
}

function isLooseMessageInput(value: unknown): value is LooseMessageInput {
  return isRecord(value) && typeof value['role'] === 'string' && 'content' in value;
}

function resolveEnvironment(environment?: ConversationEnvironmentInput): {
  now: () => string;
  randomId: () => string;
  plugins: NonNullable<ConversationEnvironmentInput['plugins']>;
} {
  return {
    now: environment?.now ?? (() => new Date().toISOString()),
    randomId: environment?.randomId ?? createId,
    plugins: [...(environment?.plugins ?? [])],
  };
}

function cloneStructuredValue<T>(value: T): T {
  return structuredClone(value);
}

function normalizeContent(content: MessageContentInput): MessageInput['content'] {
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? cloneStructuredValue(content) : [cloneStructuredValue(content)];
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
    metadata: { ...options.metadata },
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
    metadata: { ...input.metadata },
    hidden: input.hidden ?? false,
    ...(input.toolCall !== undefined ? { toolCall: cloneStructuredValue(input.toolCall) } : {}),
    ...(input.toolResult !== undefined
      ? { toolResult: cloneStructuredValue(input.toolResult) }
      : {}),
    ...(input.tokenUsage !== undefined ? { tokenUsage: { ...input.tokenUsage } } : {}),
    ...(input.goalCompleted !== undefined ? { goalCompleted: input.goalCompleted } : {}),
  };
}

function partitionAppendArguments(args: MessageInputOrEnvironment[]): {
  inputs: LooseMessageInput[];
  environment?: ConversationEnvironmentInput;
} {
  const filteredArguments = args.filter((argument) => argument !== undefined);
  const lastArgument = filteredArguments.at(-1);
  const inputArguments = isConversationEnvironmentParameter(lastArgument)
    ? filteredArguments.slice(0, -1)
    : filteredArguments;
  const inputs: LooseMessageInput[] = [];
  for (const argument of inputArguments) {
    if (isLooseMessageInput(argument)) inputs.push(argument);
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
  ...args: MessageInputOrEnvironment[]
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
    assertValidToolMessage(processedInput, toolCallIds);
    const message = materializeMessage(
      processedInput,
      conversation.ids.length + index,
      updatedAt,
      resolvedEnvironment.randomId(),
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
  const metadata = isConversationEnvironmentParameter(metadataOrEnvironment)
    ? undefined
    : metadataOrEnvironment;
  const resolvedEnvironment = isConversationEnvironmentParameter(metadataOrEnvironment)
    ? metadataOrEnvironment
    : environment;
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
  const metadata = isConversationEnvironmentParameter(metadataOrEnvironment)
    ? undefined
    : metadataOrEnvironment;
  const resolvedEnvironment = isConversationEnvironmentParameter(metadataOrEnvironment)
    ? metadataOrEnvironment
    : environment;
  return appendMessages(
    conversation,
    { role: 'assistant', content, metadata },
    resolvedEnvironment,
  );
}

export { appendAssistantMessage, appendMessages, appendUserMessage, createConversation };
