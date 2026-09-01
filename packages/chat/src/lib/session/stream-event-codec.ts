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

/**
 * Mirrors `readWireEnvelope`'s all-or-nothing validation on the encode
 * side. TypeScript's static type doesn't stop a caller from handing in a
 * partial or malformed envelope at runtime — silently dropping a
 * half-present envelope to "bare" here would downgrade a frame without
 * telling anyone, which makes a producer bug invisible until decode fails
 * downstream (or, worse, doesn't).
 */
function projectWireEnvelope(event: Partial<WireEnvelope>): Partial<WireEnvelope> {
  const hasWireVersion = event.wireVersion !== undefined;
  const hasSequence = event.sequence !== undefined;
  if (!hasWireVersion && !hasSequence) return {};
  if (
    hasWireVersion !== hasSequence ||
    event.wireVersion !== SUPPORTED_WIRE_VERSION ||
    !isNonNegativeSafeInteger(event.sequence)
  ) {
    throw new Error('Invalid chat stream event: cannot encode a malformed wire envelope');
  }
  return { wireVersion: SUPPORTED_WIRE_VERSION, sequence: event.sequence };
}

/**
 * Whitelists exactly `ChatToolResult`'s declared fields. Used for both the
 * top-level `tool_result` member and `tool.settled`'s nested `result`, so an
 * object built by spreading a provider payload — which could carry extra
 * properties — can't ride along onto the wire unnoticed.
 */
function projectChatToolResult(result: ChatToolResult): Record<string, unknown> {
  const projected: Record<string, unknown> = {
    callId: result.callId,
    outcome: result.outcome,
    content: result.content,
  };
  if (result.error !== undefined) projected['error'] = result.error;
  if (result.action !== undefined) projected['action'] = result.action;
  if (result.inputDigest !== undefined) projected['inputDigest'] = result.inputDigest;
  if (result.outputDigest !== undefined) projected['outputDigest'] = result.outputDigest;
  if (result.pendingApproval !== undefined) projected['pendingApproval'] = result.pendingApproval;
  return projected;
}

/**
 * Whitelists exactly `ChatStreamBlock`'s declared fields. A `block` handed
 * in through a variable is only structurally checked by TypeScript, so an
 * Operative-derived object carrying provider-only metadata could otherwise
 * ride along unnoticed — the same risk `projectChatToolResult` closes for
 * tool results.
 */
function projectChatStreamBlock(block: ChatStreamBlock): Record<string, unknown> {
  const projected: Record<string, unknown> = {
    id: block.id,
    type: block.type,
    index: block.index,
    content: block.content,
    complete: block.complete,
  };
  if (block.toolName !== undefined) projected['toolName'] = block.toolName;
  if (block.partialArguments !== undefined) projected['partialArguments'] = block.partialArguments;
  return projected;
}

/** Whitelists exactly `ChatStreamState`'s declared fields, including its nested block arrays. */
function projectChatStreamState(state: ChatStreamState): Record<string, unknown> {
  const projected: Record<string, unknown> = {
    blocks: state.blocks.map(projectChatStreamBlock),
    textContent: state.textContent,
    toolCalls: state.toolCalls.map(projectChatStreamBlock),
    complete: state.complete,
  };
  if (state.activeBlock !== undefined)
    projected['activeBlock'] = projectChatStreamBlock(state.activeBlock);
  if (state.usage !== undefined) projected['usage'] = state.usage;
  return projected;
}

/**
 * Rebuilds a `ChatSerializedRunError` into exactly `{ name, message, kind,
 * code }`. This is the encode-side half of the `cause` redaction: TypeScript
 * types don't exist at runtime, so a host that builds a `run.error` frame by
 * spreading Operative's `agentRunErrorToJSON()` output — which *does*
 * include `cause` — would otherwise carry it straight onto the wire via a
 * bare `JSON.stringify`. Rebuilding here, not just at decode, is what
 * actually stops that: nothing re-attaches `cause` by construction.
 */
function projectChatSerializedRunError(error: ChatSerializedRunError): ChatSerializedRunError {
  return { name: error.name, message: error.message, kind: error.kind, code: error.code };
}

/**
 * Recursively checks a `JSONValue` for a non-finite number (`NaN`,
 * `Infinity`, `-Infinity`). `JSONValue`'s `number` member admits these —
 * TypeScript can't express "finite number" — but `JSON.stringify` silently
 * rewrites each one to `null`, which corrupts the value it's attached to
 * (most importantly, tool call arguments: a corrupted argument means the
 * tool executes with different input than the caller intended).
 */
function isFiniteJSONValue(value: JSONValue): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isFiniteJSONValue);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).every((entry) => isFiniteJSONValue(entry));
  }
  return true;
}

/** Throws if `value` (identified by `context` for the error message) contains a non-finite number anywhere. */
function assertFiniteJSONValue(value: JSONValue, context: string): JSONValue {
  if (!isFiniteJSONValue(value))
    throw new Error(`Invalid chat stream event: ${context} contains a non-finite number`);
  return value;
}

function isLegacyChatStreamEventType(
  type: ChatStreamEvent['type'],
): type is 'text' | 'tool_call' | 'tool_result' {
  return type === 'text' || type === 'tool_call' || type === 'tool_result';
}

/**
 * Projects one event into a plain JSON-safe object listing exactly its
 * declared fields, per the reference architecture's stream wire contract:
 * "The route projects event data into JSON-safe values explicitly rather
 * than calling `JSON.stringify()` on an `Event` instance and hoping its
 * fields are enumerable." A bare `JSON.stringify(event)` would forward
 * whatever extra properties happen to be riding on the object a caller
 * handed in — this makes the encoder symmetric with the field-by-field
 * decoder above instead of trusting the static type at runtime.
 */
function projectChatStreamEvent(event: ChatStreamEvent): Record<string, unknown> {
  const envelope = projectWireEnvelope(event);
  // The decoder requires a complete envelope on every CIN-507 member (only
  // the three legacy members tolerate a bare frame) — the encoder must
  // refuse to produce a frame its own decoder would then reject.
  if (!isLegacyChatStreamEventType(event.type) && envelope.wireVersion === undefined) {
    throw new Error(`Invalid chat stream event: ${event.type} requires a wire envelope`);
  }
  switch (event.type) {
    case 'text':
      return { type: 'text', text: event.text, ...envelope };
    case 'tool_call':
      return {
        type: 'tool_call',
        id: event.id,
        name: event.name,
        arguments: assertFiniteJSONValue(event.arguments, 'tool_call.arguments'),
        ...envelope,
      };
    case 'tool_result':
      return { type: 'tool_result', ...projectChatToolResult(event), ...envelope };
    case 'stream:block-start':
      return {
        type: 'stream:block-start',
        block: projectChatStreamBlock(event.block),
        ...envelope,
      };
    case 'stream:block-delta':
      return {
        type: 'stream:block-delta',
        block: projectChatStreamBlock(event.block),
        delta: event.delta,
        ...envelope,
      };
    case 'stream:block-complete':
      return {
        type: 'stream:block-complete',
        block: projectChatStreamBlock(event.block),
        ...envelope,
      };
    case 'stream:text-delta':
      return {
        type: 'stream:text-delta',
        content: event.content,
        accumulated: event.accumulated,
        ...envelope,
      };
    case 'stream:tool-call-start':
      return {
        type: 'stream:tool-call-start',
        toolName: event.toolName,
        blockId: event.blockId,
        ...envelope,
      };
    case 'stream:tool-call-delta':
      return {
        type: 'stream:tool-call-delta',
        toolName: event.toolName,
        blockId: event.blockId,
        partialArguments: event.partialArguments,
        ...envelope,
      };
    case 'stream:tool-call-complete':
      return {
        type: 'stream:tool-call-complete',
        toolName: event.toolName,
        blockId: event.blockId,
        arguments: assertFiniteJSONValue(event.arguments, 'stream:tool-call-complete.arguments'),
        ...envelope,
      };
    case 'stream:usage':
      return { type: 'stream:usage', usage: event.usage, ...envelope };
    case 'stream:complete':
      return { type: 'stream:complete', state: projectChatStreamState(event.state), ...envelope };
    case 'stream:error':
      return { type: 'stream:error', error: event.error, ...envelope };
    case 'tool.started':
      return {
        type: 'tool.started',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        ...envelope,
      };
    case 'tool.progress': {
      const projected: Record<string, unknown> = {
        type: 'tool.progress',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      };
      if (event.percent !== undefined) {
        // JSON.stringify serializes a non-finite number (NaN, Infinity) as
        // `null`, which the decoder's own `percent` predicate then rejects
        // — silently turning a valid-looking ChatStreamEvent into malformed
        // wire data. Reject it here instead, before it ever reaches the wire.
        if (!Number.isFinite(event.percent))
          throw new Error('Invalid chat stream event: tool.progress percent must be finite');
        projected['percent'] = event.percent;
      }
      if (event.message !== undefined) projected['message'] = event.message;
      return { ...projected, ...envelope };
    }
    case 'tool.settled':
      // Mirrors the decoder's callId/toolCallId agreement check — a
      // mismatch here would encode a frame the decoder then rejects,
      // turning a producer bug into a downstream protocol failure instead
      // of catching it at the source.
      if (event.result.callId !== event.toolCallId) {
        throw new Error(
          'Invalid chat stream event: tool.settled result.callId must equal toolCallId',
        );
      }
      return {
        type: 'tool.settled',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: projectChatToolResult(event.result),
        ...envelope,
      };
    case 'tool.error':
      return {
        type: 'tool.error',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        error: event.error,
        ...envelope,
      };
    case 'tool.policy-denied': {
      const projected: Record<string, unknown> = {
        type: 'tool.policy-denied',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      };
      if (event.reason !== undefined) projected['reason'] = event.reason;
      return { ...projected, ...envelope };
    }
    case 'run.completed':
      return {
        type: 'run.completed',
        conversation: event.conversation,
        content: event.content,
        usage: event.usage,
        finishReason: event.finishReason,
        ...envelope,
      };
    case 'run.error':
      return { type: 'run.error', error: projectChatSerializedRunError(event.error), ...envelope };
    case 'run.tripwire':
      return {
        type: 'run.tripwire',
        error: projectChatSerializedRunError(event.error),
        ...envelope,
      };
    case 'run.aborted': {
      const projected: Record<string, unknown> = { type: 'run.aborted' };
      if (event.reason !== undefined) projected['reason'] = event.reason;
      return { ...projected, ...envelope };
    }
  }
}

/** Encodes one event as a newline-delimited JSON frame. */
export function encodeChatStreamEvent(event: ChatStreamEvent): string {
  return `${JSON.stringify(projectChatStreamEvent(event))}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * `sequence` is a wire field, so it must round-trip through JSON precisely.
 * A plain `Number.isInteger` check accepts values above
 * `Number.MAX_SAFE_INTEGER`, which can silently lose precision going through
 * JSON — require a *safe* integer instead.
 */
function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validates the optional wire envelope shared by every member. Applies to
 * all members — including the three legacy ones — because an unsupported
 * `wireVersion` or malformed `sequence` must be rejected wherever it
 * appears, not just on the new vocabulary that requires the envelope.
 *
 * The envelope is all-or-nothing: `wireVersion` and `sequence` must appear
 * together or not at all. A frame carrying only one half is neither the
 * bare legacy format nor a valid versioned frame, and a sequence-only frame
 * could otherwise bypass `wireVersion` validation entirely.
 */
function readWireEnvelope(parsed: Record<string, unknown>): Partial<WireEnvelope> {
  const hasWireVersion = 'wireVersion' in parsed;
  const hasSequence = 'sequence' in parsed;
  if (!hasWireVersion && !hasSequence) return {};
  if (hasWireVersion !== hasSequence) throw new Error('Invalid chat stream event');
  if (parsed['wireVersion'] !== SUPPORTED_WIRE_VERSION)
    throw new Error('Invalid chat stream event');
  if (!isNonNegativeSafeInteger(parsed['sequence'])) throw new Error('Invalid chat stream event');
  return { wireVersion: SUPPORTED_WIRE_VERSION, sequence: parsed['sequence'] };
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
  if (!isNonNegativeSafeInteger(value['index'])) return false;
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
    (parsed['percent'] === undefined ||
      (typeof parsed['percent'] === 'number' && Number.isFinite(parsed['percent']))) &&
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
      // The browser contract keys the atomic staged-call/result update by
      // `toolCallId`, while transcript helpers associate the result by its
      // own `callId`. A mismatch here could commit a result to the wrong
      // call, so the two must agree.
      resultCandidate.callId === parsed['toolCallId'] &&
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

type StreamGuardState = {
  /**
   * Which envelope shape this request-local stream committed to on its
   * first frame. A stream may be wholly bare (legacy) or wholly versioned —
   * never both. Accepting a bare frame after a versioned one (or vice
   * versa) would mean losing the ordering guarantee the envelope exists to
   * provide partway through the response.
   */
  mode: 'bare' | 'versioned' | undefined;
  sawTerminal: boolean;
  lastSequence: number | undefined;
};

function isTerminalChatStreamEvent(event: ChatStreamEvent): boolean {
  return (
    event.type === 'run.completed' ||
    event.type === 'run.error' ||
    event.type === 'run.tripwire' ||
    event.type === 'run.aborted'
  );
}

/**
 * Applies the stream-level invariants a single frame's own decode can't
 * check on its own: a request-local monotonically increasing `sequence`
 * (reference architecture, "Stream wire contract"), and one consistent
 * envelope mode for the whole stream.
 */
function noteDecodedStreamEvent(event: ChatStreamEvent, guard: StreamGuardState): void {
  const frameMode: 'bare' | 'versioned' = event.wireVersion === undefined ? 'bare' : 'versioned';
  if (guard.mode === undefined) guard.mode = frameMode;
  else if (guard.mode !== frameMode)
    throw new Error('Invalid chat stream event: envelope mode changed mid-stream');

  if (frameMode === 'versioned') {
    const sequence = event.sequence;
    if (sequence === undefined) throw new Error('Invalid chat stream event: missing sequence');
    if (guard.lastSequence !== undefined && sequence <= guard.lastSequence)
      throw new Error('Invalid chat stream event: sequence did not increase');
    guard.lastSequence = sequence;
  }

  if (isTerminalChatStreamEvent(event)) guard.sawTerminal = true;
}

/**
 * A versioned stream that reaches EOF without ever emitting one of the
 * `run.*` terminal frames is a truncated response, not success (reference
 * architecture, "Stream wire contract" and "Cancellation contract"). This
 * only runs when the generator's body resumes normally past its last
 * `yield` — a consumer that stops iterating early instead calls the
 * generator's `return()`, which unwinds through any enclosing `finally`
 * blocks but never reaches this code, so a deliberate client cancellation
 * is correctly exempt without any extra bookkeeping.
 */
function assertStreamTerminated(guard: StreamGuardState): void {
  if (guard.mode === 'versioned' && !guard.sawTerminal)
    throw new Error('Invalid chat stream event: stream ended without a terminal frame');
}

/** Decodes newline-delimited events from a string or an async byte stream. */
export async function* decodeChatStreamEvents(
  source: string | AsyncIterable<string | Uint8Array> | ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const guard: StreamGuardState = { mode: undefined, sawTerminal: false, lastSequence: undefined };
  const decodeAndTrack = (line: string): ChatStreamEvent => {
    const event = decodeChatStreamEvent(line);
    noteDecodedStreamEvent(event, guard);
    return event;
  };
  if (typeof source === 'string') {
    for (const line of source
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean))
      yield decodeAndTrack(line);
    assertStreamTerminated(guard);
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  const appendChunk = function* (chunk: string | Uint8Array): Generator<ChatStreamEvent> {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines.map((item) => item.trim()).filter(Boolean)) yield decodeAndTrack(line);
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
      if (buffer.trim()) yield decodeAndTrack(buffer.trim());
      assertStreamTerminated(guard);
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
  if (buffer.trim()) yield decodeAndTrack(buffer.trim());
  assertStreamTerminated(guard);
}

/** Short aliases for applications that already call their wire format `StreamEvent`. */
export const encodeStreamEvent = encodeChatStreamEvent;
export const decodeStreamEvent = decodeChatStreamEvent;
export const decodeStreamEvents = decodeChatStreamEvents;
