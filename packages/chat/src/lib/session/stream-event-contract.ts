import type { ConversationHistory, TokenUsage } from 'conversationalist';
import type { ChatToolResult } from '../components/chat/adapter/chat-adapter.ts';
import { isTokenUsage } from '../components/chat/builders.ts';
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
export type WireEnvelope = {
  wireVersion: 1;
  sequence: number;
};

/**
 * A legacy member either carries no envelope at all, or the complete one —
 * never half of it. `Partial<WireEnvelope>` would let a TypeScript consumer
 * legally construct `{ type: 'text', text: 'x', wireVersion: 1 }` (no
 * `sequence`) with no cast required, even though `encodeChatStreamEvent`
 * throws on it and the decoder rejects it — this union keeps the public
 * type honest about the runtime contract.
 *
 * The `?: never` keys on the bare branch are load-bearing. A plain `T` there
 * is not enough: excess-property checking does not reject `wireVersion`,
 * because the property IS known to another member of the same union, so
 * `{ type: 'text', text: 'x', wireVersion: 1 }` would typecheck against the
 * bare branch even under `exactOptionalPropertyTypes`. Declaring the keys as
 * optional-`never` makes that half-envelope match neither branch.
 */
type WithOptionalEnvelope<T> = (T & { wireVersion?: never; sequence?: never }) | (T & WireEnvelope);

/** The one supported wire version. Any other value is rejected outright. */
export const SUPPORTED_WIRE_VERSION = 1;

// ---------------------------------------------------------------------------
// Local, provider-neutral equivalents of Operative's `StreamEvent` vocabulary
// (@lostgradient/operative@0.7.0, src/streaming/types.ts). Chat does not
// depend on Operative — depending on it here would invert the provider-
// neutral layering — so these shapes are declared structurally rather than
// imported. Keep them in lockstep with Operative's published `StreamEvent`,
// `StreamBlock`, and `StreamState` types by hand.
// ---------------------------------------------------------------------------

/** Discriminator for blocks tracked by Operative's stream state machine. */
export type ChatStreamBlockType = 'text' | 'tool-call' | 'thinking' | 'metadata';

/** Local equivalent of Operative's `StreamBlock`. */
export type ChatStreamBlock = {
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
export type ChatStreamState = {
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
export type ChatAgentRunErrorKind =
  | 'load'
  | 'contract'
  | 'generate'
  | 'tool'
  | 'abort'
  | 'output'
  | 'policy';

export type ChatAgentRunErrorCode =
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
export type ChatSerializedRunError = {
  name: string;
  message: string;
  kind: ChatAgentRunErrorKind;
  code: ChatAgentRunErrorCode;
  /**
   * Whether the failure is worth retrying, as the host classified it.
   *
   * `kind` cannot answer this. A rate-limited provider and a rejected API key
   * are both `kind: 'generate'`, and one is worth a retry button while the
   * other never is — so a client deriving retryability from `kind` alone would
   * offer the wrong affordance for a whole category of failure.
   *
   * Optional because a host that does not classify its failures should not be
   * forced to guess: absent means "not stated", which a client must render as
   * neither retryable nor terminal rather than defaulting to either. Every
   * producer written before this field existed keeps working unchanged.
   */
  retryable?: boolean;
};

/** Provider-neutral events emitted by a chat response stream. */
export type ChatStreamEvent =
  | WithOptionalEnvelope<{ type: 'text'; text: string }>
  | WithOptionalEnvelope<{ type: 'tool_call'; id: string; name: string; arguments: JSONValue }>
  | WithOptionalEnvelope<{ type: 'tool_result' } & ChatToolResult>
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * `sequence` is a wire field, so it must round-trip through JSON precisely.
 * A plain `Number.isInteger` check accepts values above
 * `Number.MAX_SAFE_INTEGER`, which can silently lose precision going through
 * JSON — require a *safe* integer instead.
 */
export function isNonNegativeSafeInteger(value: unknown): value is number {
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
export function readWireEnvelope(parsed: Record<string, unknown>): Partial<WireEnvelope> {
  // Own keys only: an inherited `wireVersion` (a polluted prototype, a
  // non-plain object) is not part of the frame.
  const hasWireVersion = Object.hasOwn(parsed, 'wireVersion');
  const hasSequence = Object.hasOwn(parsed, 'sequence');
  if (!hasWireVersion && !hasSequence) return {};
  if (hasWireVersion !== hasSequence) throw new Error('Invalid chat stream event');
  // Read each field once: a typed transport can hand over an object whose
  // accessors answer differently per read, and the value returned here must
  // be the one that was validated.
  const wireVersion = parsed['wireVersion'];
  const sequence = parsed['sequence'];
  if (wireVersion !== SUPPORTED_WIRE_VERSION) throw new Error('Invalid chat stream event');
  if (!isNonNegativeSafeInteger(sequence)) throw new Error('Invalid chat stream event');
  return { wireVersion: SUPPORTED_WIRE_VERSION, sequence };
}

/** A fully-present wire envelope, required on every new (CIN-507) member. */
export function requireWireEnvelope(envelope: Partial<WireEnvelope>): WireEnvelope {
  if (envelope.wireVersion === undefined || envelope.sequence === undefined)
    throw new Error('Invalid chat stream event');
  return { wireVersion: envelope.wireVersion, sequence: envelope.sequence };
}

export function isChatStreamBlockType(value: unknown): value is ChatStreamBlockType {
  return value === 'text' || value === 'tool-call' || value === 'thinking' || value === 'metadata';
}

/**
 * Validates and rebuilds a `ChatStreamBlock`-shaped value into exactly its
 * declared fields. Rebuilding rather than returning the parsed value as-is
 * is what stops an untrusted producer's extra enumerable properties from
 * surviving decode — the guard below validates the fields it cares about,
 * but a hand-rolled guard (unlike the `.strict()` Zod schemas Conversationalist
 * uses for `tool_result`/`run.completed`) doesn't reject unknown keys on
 * its own.
 */
export function toChatStreamBlock(value: unknown): ChatStreamBlock | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value['id'] !== 'string') return undefined;
  if (!isChatStreamBlockType(value['type'])) return undefined;
  if (!isNonNegativeSafeInteger(value['index'])) return undefined;
  if (typeof value['content'] !== 'string') return undefined;
  if (typeof value['complete'] !== 'boolean') return undefined;
  if (value['toolName'] !== undefined && typeof value['toolName'] !== 'string') return undefined;
  if (value['partialArguments'] !== undefined && typeof value['partialArguments'] !== 'string')
    return undefined;
  const block: ChatStreamBlock = {
    id: value['id'],
    type: value['type'],
    index: value['index'],
    content: value['content'],
    complete: value['complete'],
  };
  if (typeof value['toolName'] === 'string') block.toolName = value['toolName'];
  if (typeof value['partialArguments'] === 'string')
    block.partialArguments = value['partialArguments'];
  return block;
}

/** Rebuilds a `ChatStreamBlock[]` from an unknown array, or `undefined` if any entry is invalid. */
function toChatStreamBlockArray(value: unknown): ChatStreamBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const blocks: ChatStreamBlock[] = [];
  for (const entry of value) {
    const block = toChatStreamBlock(entry);
    if (block === undefined) return undefined;
    blocks.push(block);
  }
  return blocks;
}

/** Validates and rebuilds a `ChatStreamState`-shaped value the same way {@link toChatStreamBlock} does for blocks, including its nested block arrays. */
export function toChatStreamState(value: unknown): ChatStreamState | undefined {
  if (!isRecord(value)) return undefined;
  const blocks = toChatStreamBlockArray(value['blocks']);
  if (blocks === undefined) return undefined;
  let activeBlock: ChatStreamBlock | undefined;
  if (value['activeBlock'] !== undefined) {
    activeBlock = toChatStreamBlock(value['activeBlock']);
    if (activeBlock === undefined) return undefined;
  }
  if (typeof value['textContent'] !== 'string') return undefined;
  const toolCalls = toChatStreamBlockArray(value['toolCalls']);
  if (toolCalls === undefined) return undefined;
  if (typeof value['complete'] !== 'boolean') return undefined;
  const usage = value['usage'];
  if (usage !== undefined && !isTokenUsage(usage)) return undefined;
  const state: ChatStreamState = {
    blocks,
    textContent: value['textContent'],
    toolCalls,
    complete: value['complete'],
  };
  if (activeBlock !== undefined) state.activeBlock = activeBlock;
  if (usage !== undefined && isTokenUsage(usage)) state.usage = usage;
  return state;
}

export function isChatAgentRunErrorKind(value: unknown): value is ChatAgentRunErrorKind {
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

export function isChatAgentRunErrorCode(value: unknown): value is ChatAgentRunErrorCode {
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
 * exactly `{ name, message, kind, code }`, plus `retryable` when the producer
 * stated one. Rebuilding — rather than validating and returning the parsed
 * value as-is — is what actually drops an incoming `cause`: nothing here
 * re-attaches it, by construction rather than by convention.
 *
 * `retryable` is the only field ever added to that list, and it is carried
 * because a client cannot derive it: `kind` is `'generate'` for both a rate
 * limit and a rejected credential. An absent value means the producer said
 * nothing, and stays absent rather than defaulting to either answer.
 */
export function toChatSerializedRunError(value: unknown): ChatSerializedRunError | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value['name'] !== 'string') return undefined;
  if (typeof value['message'] !== 'string') return undefined;
  if (!isChatAgentRunErrorKind(value['kind'])) return undefined;
  if (!isChatAgentRunErrorCode(value['code'])) return undefined;
  const retryable = value['retryable'];
  if (retryable !== undefined && typeof retryable !== 'boolean') return undefined;
  return {
    name: value['name'],
    message: value['message'],
    kind: value['kind'],
    code: value['code'],
    ...(retryable === undefined ? {} : { retryable }),
  };
}

/** Decodes and validates one provider-neutral stream event. */
