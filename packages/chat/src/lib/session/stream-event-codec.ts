import type { ConversationHistory, TokenUsage } from 'conversationalist';

import type { ChatToolResult } from '../components/chat/adapter/chat-adapter.ts';
import {
  isConversationHistory,
  isJSONValue,
  isTokenUsage,
  isToolResult,
} from '../components/chat/builders.ts';
import type { JSONValue } from '../components/chat/conversation-model.ts';

/**
 * Wire-envelope fields a frame carries per the reference architecture's
 * stream wire contract: `wireVersion: 1` plus a request-local monotonically
 * increasing `sequence`.
 *
 * These are REQUIRED on every member added by CIN-507 (`stream:*`, `tool.*`,
 * `run.*`) because that vocabulary is defined by the wire contract the
 * envelope belongs to. They stay OPTIONAL on the three original members
 * (`text`, `tool_call`, `tool_result`) because a published consumer may
 * already emit those as bare frames predating the envelope, and this change
 * must decode them unchanged rather than break a deployed producer.
 */
type WireEnvelope = {
  wireVersion: 1;
  sequence: number;
};

/** The one supported wire version. Any other value is rejected outright. */
const SUPPORTED_WIRE_VERSION = 1;

// ---------------------------------------------------------------------------
// Local, provider-neutral equivalents of Operative's `StreamEvent` vocabulary
// (@lostgradient/operative@0.7.0, src/streaming/types.ts). Chat does not
// depend on Operative — depending on it here would invert the provider-
// neutral layering — so these shapes are declared structurally rather than
// imported. Keep them in lockstep with Operative's published `StreamEvent`,
// `StreamBlock`, and `StreamState` types by hand.
// ---------------------------------------------------------------------------

/** Discriminator for blocks tracked by Operative's stream state machine. */
type ChatStreamBlockType = 'text' | 'tool-call' | 'thinking' | 'metadata';

/** Local equivalent of Operative's `StreamBlock`. */
type ChatStreamBlock = {
  id: string;
  type: ChatStreamBlockType;
  index: number;
  content: string;
  complete: boolean;
  toolName?: string;
  partialArguments?: string;
};

/**
 * Local equivalent of Operative's `StreamState`. `usage` reuses
 * Conversationalist's `TokenUsage` — the same type Operative itself imports
 * from Conversationalist for this field, so this is not a parallel
 * definition, just the type Chat already depends on directly.
 */
type ChatStreamState = {
  blocks: ChatStreamBlock[];
  activeBlock?: ChatStreamBlock;
  textContent: string;
  toolCalls: ChatStreamBlock[];
  complete: boolean;
  usage?: TokenUsage;
};

/**
 * Local equivalents of Operative's `AgentRunErrorKind` / `AgentRunErrorCode`
 * (@lostgradient/operative@0.7.0, src/errors.ts).
 */
type ChatAgentRunErrorKind =
  | 'load'
  | 'contract'
  | 'generate'
  | 'tool'
  | 'abort'
  | 'output'
  | 'policy';

type ChatAgentRunErrorCode =
  | 'INVALID_EXPORT'
  | 'LOAD_FAILED'
  | 'ABORTED'
  | 'BUDGET_EXCEEDED'
  | 'ELICITATION_DENIED'
  | 'INVALID_OUTPUT'
  | 'MAXIMUM_STEPS'
  | 'TRIPWIRE'
  | 'UNKNOWN';

/**
 * Local equivalent of Operative's `SerializedAgentRunError`, with `cause`
 * removed entirely. `cause` is untyped on the Operative side and may carry a
 * credential-bearing provider payload; the reference architecture's error
 * contract forbids forwarding it unfiltered. Do not add `cause` back to this
 * wire type — if a redacted, JSON-safe projection of it is ever needed, that
 * is a new, deliberately-named field, not this one made permissive again.
 */
type ChatSerializedRunError = {
  name: string;
  message: string;
  kind: ChatAgentRunErrorKind;
  code: ChatAgentRunErrorCode;
};

/** Provider-neutral events emitted by a chat response stream. */
export type ChatStreamEvent =
  | ({ type: 'text'; text: string } & Partial<WireEnvelope>)
  | ({ type: 'tool_call'; id: string; name: string; arguments: JSONValue } & Partial<WireEnvelope>)
  | ({ type: 'tool_result' } & ChatToolResult & Partial<WireEnvelope>)
  // Operative's raw stream event vocabulary, mirrored field-for-field.
  | ({ type: 'stream:block-start'; block: ChatStreamBlock } & WireEnvelope)
  | ({ type: 'stream:block-delta'; block: ChatStreamBlock; delta: string } & WireEnvelope)
  | ({ type: 'stream:block-complete'; block: ChatStreamBlock } & WireEnvelope)
  | ({ type: 'stream:text-delta'; content: string; accumulated: string } & WireEnvelope)
  | ({ type: 'stream:tool-call-start'; toolName: string; blockId: string } & WireEnvelope)
  | ({
      type: 'stream:tool-call-delta';
      toolName: string;
      blockId: string;
      partialArguments: string;
    } & WireEnvelope)
  | ({
      type: 'stream:tool-call-complete';
      toolName: string;
      blockId: string;
      /** Narrowed from Operative's `unknown` — honest here because this value
       *  has already round-tripped through JSON on the wire. */
      arguments: JSONValue;
    } & WireEnvelope)
  | ({ type: 'stream:usage'; usage: TokenUsage } & WireEnvelope)
  | ({ type: 'stream:complete'; state: ChatStreamState } & WireEnvelope)
  | ({
      type: 'stream:error';
      /** Narrowed from Operative's `unknown` — honest here for the same
       *  reason as `stream:tool-call-complete.arguments` above. */
      error: JSONValue;
    } & WireEnvelope)
  // Curated `tool.*` run events, keyed by `toolCallId` per the reference
  // architecture's stream wire contract table.
  | ({ type: 'tool.started'; toolCallId: string; toolName: string } & WireEnvelope)
  | ({
      type: 'tool.progress';
      toolCallId: string;
      toolName: string;
      percent?: number;
      message?: string;
    } & WireEnvelope)
  // `result` reuses `ChatToolResult` — the same type the legacy `tool_result`
  // member already validates — because a paused result's descriptor is
  // exactly `ChatToolResult`'s existing `action` field (outcome:
  // 'action_required'). This is the "paused result may carry a descriptor"
  // case the reference architecture's table calls out.
  | ({
      type: 'tool.settled';
      toolCallId: string;
      toolName: string;
      result: ChatToolResult;
    } & WireEnvelope)
  | ({
      type: 'tool.error';
      toolCallId: string;
      toolName: string;
      /** Narrowed from Operative's `unknown` for the same reason as the
       *  `stream:*` fields above. */
      error: JSONValue;
    } & WireEnvelope)
  | ({
      type: 'tool.policy-denied';
      toolCallId: string;
      toolName: string;
      reason?: string;
    } & WireEnvelope)
  // Terminal `run.*` frames.
  | ({
      type: 'run.completed';
      /** The authoritative final conversation — the only successful
       *  terminal frame per the reference architecture's table. */
      conversation: ConversationHistory;
      content: string;
      usage: TokenUsage;
      finishReason: string;
    } & WireEnvelope)
  | ({ type: 'run.error'; error: ChatSerializedRunError } & WireEnvelope)
  | ({ type: 'run.tripwire'; error: ChatSerializedRunError } & WireEnvelope)
  | ({ type: 'run.aborted'; reason?: string } & WireEnvelope);

/** Encodes one event as a newline-delimited JSON frame. */
export function encodeChatStreamEvent(event: ChatStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Validates the optional wire envelope shared by every member. Applies to
 * all members — including the three legacy ones — because an unsupported
 * `wireVersion` or malformed `sequence` must be rejected wherever it
 * appears, not just on the new vocabulary that requires the envelope.
 */
function readWireEnvelope(parsed: Record<string, unknown>): Partial<WireEnvelope> {
  const envelope: Partial<WireEnvelope> = {};
  if ('wireVersion' in parsed) {
    if (parsed['wireVersion'] !== SUPPORTED_WIRE_VERSION)
      throw new Error('Invalid chat stream event');
    envelope.wireVersion = SUPPORTED_WIRE_VERSION;
  }
  if ('sequence' in parsed) {
    if (!isNonNegativeInteger(parsed['sequence'])) throw new Error('Invalid chat stream event');
    envelope.sequence = parsed['sequence'];
  }
  return envelope;
}

/** A fully-present wire envelope, required on every new (CIN-507) member. */
function requireWireEnvelope(envelope: Partial<WireEnvelope>): WireEnvelope {
  if (envelope.wireVersion === undefined || envelope.sequence === undefined)
    throw new Error('Invalid chat stream event');
  return { wireVersion: envelope.wireVersion, sequence: envelope.sequence };
}

function isChatStreamBlockType(value: unknown): value is ChatStreamBlockType {
  return value === 'text' || value === 'tool-call' || value === 'thinking' || value === 'metadata';
}

function isChatStreamBlock(value: unknown): value is ChatStreamBlock {
  if (!isRecord(value)) return false;
  if (typeof value['id'] !== 'string') return false;
  if (!isChatStreamBlockType(value['type'])) return false;
  if (typeof value['index'] !== 'number' || !Number.isInteger(value['index'])) return false;
  if (typeof value['content'] !== 'string') return false;
  if (typeof value['complete'] !== 'boolean') return false;
  if (value['toolName'] !== undefined && typeof value['toolName'] !== 'string') return false;
  if (value['partialArguments'] !== undefined && typeof value['partialArguments'] !== 'string')
    return false;
  return true;
}

function isChatStreamState(value: unknown): value is ChatStreamState {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value['blocks']) || !value['blocks'].every(isChatStreamBlock)) return false;
  if (value['activeBlock'] !== undefined && !isChatStreamBlock(value['activeBlock'])) return false;
  if (typeof value['textContent'] !== 'string') return false;
  if (!Array.isArray(value['toolCalls']) || !value['toolCalls'].every(isChatStreamBlock))
    return false;
  if (typeof value['complete'] !== 'boolean') return false;
  if (value['usage'] !== undefined && !isTokenUsage(value['usage'])) return false;
  return true;
}

function isChatAgentRunErrorKind(value: unknown): value is ChatAgentRunErrorKind {
  return (
    value === 'load' ||
    value === 'contract' ||
    value === 'generate' ||
    value === 'tool' ||
    value === 'abort' ||
    value === 'output' ||
    value === 'policy'
  );
}

function isChatAgentRunErrorCode(value: unknown): value is ChatAgentRunErrorCode {
  return (
    value === 'INVALID_EXPORT' ||
    value === 'LOAD_FAILED' ||
    value === 'ABORTED' ||
    value === 'BUDGET_EXCEEDED' ||
    value === 'ELICITATION_DENIED' ||
    value === 'INVALID_OUTPUT' ||
    value === 'MAXIMUM_STEPS' ||
    value === 'TRIPWIRE' ||
    value === 'UNKNOWN'
  );
}

/**
 * Validates and rebuilds a `SerializedAgentRunError`-shaped value into
 * exactly `{ name, message, kind, code }`. Rebuilding — rather than
 * validating and returning the parsed value as-is — is what actually drops
 * an incoming `cause`: nothing here re-attaches it, by construction rather
 * than by convention.
 */
function toChatSerializedRunError(value: unknown): ChatSerializedRunError | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value['name'] !== 'string') return undefined;
  if (typeof value['message'] !== 'string') return undefined;
  if (!isChatAgentRunErrorKind(value['kind'])) return undefined;
  if (!isChatAgentRunErrorCode(value['code'])) return undefined;
  return {
    name: value['name'],
    message: value['message'],
    kind: value['kind'],
    code: value['code'],
  };
}

/** Decodes and validates one provider-neutral stream event. */
export function decodeChatStreamEvent(value: unknown): ChatStreamEvent {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (!isRecord(parsed) || typeof parsed['type'] !== 'string')
    throw new Error('Invalid chat stream event');
  const eventType = parsed['type'];
  const envelope = readWireEnvelope(parsed);

  if (eventType === 'text' && typeof parsed['text'] === 'string')
    return { type: 'text', text: parsed['text'], ...envelope };
  if (
    eventType === 'tool_call' &&
    typeof parsed['id'] === 'string' &&
    typeof parsed['name'] === 'string' &&
    isJSONValue(parsed['arguments'])
  ) {
    return {
      type: 'tool_call',
      id: parsed['id'],
      name: parsed['name'],
      arguments: parsed['arguments'],
      ...envelope,
    };
  }
  if (eventType === 'tool_result') {
    const { type: _type, pendingApproval, wireVersion: _wv, sequence: _seq, ...candidate } = parsed;
    if (
      isToolResult(candidate) &&
      (pendingApproval === undefined || isJSONValue(pendingApproval))
    ) {
      return {
        type: 'tool_result',
        ...candidate,
        ...(pendingApproval === undefined ? {} : { pendingApproval }),
        ...envelope,
      };
    }
    throw new Error('Invalid chat stream event');
  }

  // Every member from here down is part of the CIN-507 vocabulary and
  // requires a fully-present wire envelope.
  const required = requireWireEnvelope(envelope);

  if (eventType === 'stream:block-start' && isChatStreamBlock(parsed['block']))
    return { type: 'stream:block-start', block: parsed['block'], ...required };
  if (
    eventType === 'stream:block-delta' &&
    isChatStreamBlock(parsed['block']) &&
    typeof parsed['delta'] === 'string'
  ) {
    return {
      type: 'stream:block-delta',
      block: parsed['block'],
      delta: parsed['delta'],
      ...required,
    };
  }
  if (eventType === 'stream:block-complete' && isChatStreamBlock(parsed['block']))
    return { type: 'stream:block-complete', block: parsed['block'], ...required };
  if (
    eventType === 'stream:text-delta' &&
    typeof parsed['content'] === 'string' &&
    typeof parsed['accumulated'] === 'string'
  ) {
    return {
      type: 'stream:text-delta',
      content: parsed['content'],
      accumulated: parsed['accumulated'],
      ...required,
    };
  }
  if (
    eventType === 'stream:tool-call-start' &&
    typeof parsed['toolName'] === 'string' &&
    typeof parsed['blockId'] === 'string'
  ) {
    return {
      type: 'stream:tool-call-start',
      toolName: parsed['toolName'],
      blockId: parsed['blockId'],
      ...required,
    };
  }
  if (
    eventType === 'stream:tool-call-delta' &&
    typeof parsed['toolName'] === 'string' &&
    typeof parsed['blockId'] === 'string' &&
    typeof parsed['partialArguments'] === 'string'
  ) {
    return {
      type: 'stream:tool-call-delta',
      toolName: parsed['toolName'],
      blockId: parsed['blockId'],
      partialArguments: parsed['partialArguments'],
      ...required,
    };
  }
  if (
    eventType === 'stream:tool-call-complete' &&
    typeof parsed['toolName'] === 'string' &&
    typeof parsed['blockId'] === 'string' &&
    isJSONValue(parsed['arguments'])
  ) {
    return {
      type: 'stream:tool-call-complete',
      toolName: parsed['toolName'],
      blockId: parsed['blockId'],
      arguments: parsed['arguments'],
      ...required,
    };
  }
  if (eventType === 'stream:usage' && isTokenUsage(parsed['usage']))
    return { type: 'stream:usage', usage: parsed['usage'], ...required };
  if (eventType === 'stream:complete' && isChatStreamState(parsed['state']))
    return { type: 'stream:complete', state: parsed['state'], ...required };
  if (eventType === 'stream:error' && isJSONValue(parsed['error']))
    return { type: 'stream:error', error: parsed['error'], ...required };

  if (
    eventType === 'tool.started' &&
    typeof parsed['toolCallId'] === 'string' &&
    typeof parsed['toolName'] === 'string'
  ) {
    return {
      type: 'tool.started',
      toolCallId: parsed['toolCallId'],
      toolName: parsed['toolName'],
      ...required,
    };
  }
  if (
    eventType === 'tool.progress' &&
    typeof parsed['toolCallId'] === 'string' &&
    typeof parsed['toolName'] === 'string' &&
    (parsed['percent'] === undefined || typeof parsed['percent'] === 'number') &&
    (parsed['message'] === undefined || typeof parsed['message'] === 'string')
  ) {
    return {
      type: 'tool.progress',
      toolCallId: parsed['toolCallId'],
      toolName: parsed['toolName'],
      ...(parsed['percent'] === undefined ? {} : { percent: parsed['percent'] }),
      ...(parsed['message'] === undefined ? {} : { message: parsed['message'] }),
      ...required,
    };
  }
  if (
    eventType === 'tool.settled' &&
    typeof parsed['toolCallId'] === 'string' &&
    typeof parsed['toolName'] === 'string' &&
    isRecord(parsed['result'])
  ) {
    const { pendingApproval, ...resultCandidate } = parsed['result'];
    if (
      isToolResult(resultCandidate) &&
      (pendingApproval === undefined || isJSONValue(pendingApproval))
    ) {
      return {
        type: 'tool.settled',
        toolCallId: parsed['toolCallId'],
        toolName: parsed['toolName'],
        result: {
          ...resultCandidate,
          ...(pendingApproval === undefined ? {} : { pendingApproval }),
        },
        ...required,
      };
    }
  }
  if (
    eventType === 'tool.error' &&
    typeof parsed['toolCallId'] === 'string' &&
    typeof parsed['toolName'] === 'string' &&
    isJSONValue(parsed['error'])
  ) {
    return {
      type: 'tool.error',
      toolCallId: parsed['toolCallId'],
      toolName: parsed['toolName'],
      error: parsed['error'],
      ...required,
    };
  }
  if (
    eventType === 'tool.policy-denied' &&
    typeof parsed['toolCallId'] === 'string' &&
    typeof parsed['toolName'] === 'string' &&
    (parsed['reason'] === undefined || typeof parsed['reason'] === 'string')
  ) {
    return {
      type: 'tool.policy-denied',
      toolCallId: parsed['toolCallId'],
      toolName: parsed['toolName'],
      ...(parsed['reason'] === undefined ? {} : { reason: parsed['reason'] }),
      ...required,
    };
  }

  if (
    eventType === 'run.completed' &&
    isConversationHistory(parsed['conversation']) &&
    typeof parsed['content'] === 'string' &&
    isTokenUsage(parsed['usage']) &&
    typeof parsed['finishReason'] === 'string'
  ) {
    return {
      type: 'run.completed',
      conversation: parsed['conversation'],
      content: parsed['content'],
      usage: parsed['usage'],
      finishReason: parsed['finishReason'],
      ...required,
    };
  }
  if (eventType === 'run.error') {
    const error = toChatSerializedRunError(parsed['error']);
    if (error) return { type: 'run.error', error, ...required };
  }
  if (eventType === 'run.tripwire') {
    const error = toChatSerializedRunError(parsed['error']);
    if (error) return { type: 'run.tripwire', error, ...required };
  }
  if (
    eventType === 'run.aborted' &&
    (parsed['reason'] === undefined || typeof parsed['reason'] === 'string')
  ) {
    return {
      type: 'run.aborted',
      ...(parsed['reason'] === undefined ? {} : { reason: parsed['reason'] }),
      ...required,
    };
  }

  throw new Error('Invalid chat stream event');
}

/** Decodes newline-delimited events from a string or an async byte stream. */
export async function* decodeChatStreamEvents(
  source: string | AsyncIterable<string | Uint8Array> | ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  if (typeof source === 'string') {
    for (const line of source
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean))
      yield decodeChatStreamEvent(line);
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  const appendChunk = function* (chunk: string | Uint8Array): Generator<ChatStreamEvent> {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines.map((item) => item.trim()).filter(Boolean))
      yield decodeChatStreamEvent(line);
  };
  if (source instanceof ReadableStream) {
    const reader = source.getReader();
    let completed = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield* appendChunk(value);
      }
      if (buffer.trim()) yield decodeChatStreamEvent(buffer.trim());
      completed = true;
    } finally {
      try {
        if (!completed) await reader.cancel();
      } catch {
        // Cancellation is cleanup. Never replace the primary read/decode
        // failure with a provider-specific cancellation error.
      } finally {
        reader.releaseLock();
      }
    }
    return;
  } else {
    for await (const chunk of source) yield* appendChunk(chunk);
  }
  if (buffer.trim()) yield decodeChatStreamEvent(buffer.trim());
}

/** Short aliases for applications that already call their wire format `StreamEvent`. */
export const encodeStreamEvent = encodeChatStreamEvent;
export const decodeStreamEvent = decodeChatStreamEvent;
export const decodeStreamEvents = decodeChatStreamEvents;
