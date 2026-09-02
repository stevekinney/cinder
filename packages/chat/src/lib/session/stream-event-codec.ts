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

/**
 * Mirrors `readWireEnvelope`'s all-or-nothing validation on the encode
 * side. TypeScript's static type doesn't stop a caller from handing in a
 * partial or malformed envelope at runtime — silently dropping a
 * half-present envelope to "bare" here would downgrade a frame without
 * telling anyone, which makes a producer bug invisible until decode fails
 * downstream (or, worse, doesn't).
 */
function projectWireEnvelope(event: ChatStreamEvent): Partial<WireEnvelope> {
  // Presence, not value, decides whether an envelope was attempted — the
  // same rule `readWireEnvelope` applies on decode. A legacy member has no
  // envelope keys at all; a key that is present but `undefined` is a
  // producer bug (a runtime cast, a spread of a partial object), and
  // treating it as "bare" would silently drop the sequence and terminal
  // enforcement that the versioned mode exists to provide.
  const hasWireVersion = Object.hasOwn(event, 'wireVersion');
  const hasSequence = Object.hasOwn(event, 'sequence');
  if (!hasWireVersion && !hasSequence) return {};
  const wireVersion = hasWireVersion ? event.wireVersion : undefined;
  const sequence = hasSequence ? event.sequence : undefined;
  if (
    hasWireVersion !== hasSequence ||
    wireVersion !== SUPPORTED_WIRE_VERSION ||
    !isNonNegativeSafeInteger(sequence)
  ) {
    throw new Error('Invalid chat stream event: cannot encode a malformed wire envelope');
  }
  return { wireVersion: SUPPORTED_WIRE_VERSION, sequence };
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
    content: assertFiniteJSONValue(result.content, 'tool result content'),
  };
  if (result.error !== undefined) {
    const projectedError: Record<string, unknown> = {
      code: result.error.code,
      category: result.error.category,
      retryable: result.error.retryable,
      message: result.error.message,
    };
    if (result.error.details !== undefined)
      projectedError['details'] = assertFiniteJSONValue(
        result.error.details,
        'tool result error.details',
      );
    projected['error'] = projectedError;
  }
  if (result.action !== undefined) {
    const projectedAction: Record<string, unknown> = { type: result.action.type };
    if (result.action.message !== undefined) projectedAction['message'] = result.action.message;
    if (result.action.schema !== undefined)
      projectedAction['schema'] = assertFiniteJSONValue(
        result.action.schema,
        'tool result action.schema',
      );
    projected['action'] = projectedAction;
  }
  if (result.inputDigest !== undefined) projected['inputDigest'] = result.inputDigest;
  if (result.outputDigest !== undefined) projected['outputDigest'] = result.outputDigest;
  if (result.pendingApproval !== undefined)
    projected['pendingApproval'] = assertFiniteJSONValue(
      result.pendingApproval,
      'tool result pendingApproval',
    );

  // Structural check LAST, against the projected object rather than the input.
  // The decoder admits a tool result only if `isToolResult` accepts it, so the
  // encoder applies the same guard instead of trusting the static type — a
  // runtime-cast producer could otherwise ship a malformed `callId`,
  // `outcome`, `error`, or `action` and only find out at the far end.
  //
  // Last, not first, so the per-field JSON assertions above report their own
  // specific failure (`tool result action.schema`, say) rather than being
  // masked by a generic shape error. And on the PROJECTION, so the guard sees
  // exactly the fields that will be written to the wire.
  //
  // `pendingApproval` is excluded exactly as the decoder excludes it: it is a
  // Chat extension rather than part of conversationalist's `ToolResult`, so
  // that guard rejects any result carrying one. It is validated on its own
  // above.
  const { pendingApproval: _pendingApproval, ...toolResultCandidate } = projected;
  if (!isToolResult(toolResultCandidate))
    throw new Error('Invalid chat stream event: tool result is not a valid ChatToolResult');
  return projected;
}

/**
 * Whitelists exactly `ChatStreamBlock`'s declared fields. A `block` handed
 * in through a variable is only structurally checked by TypeScript, so an
 * Operative-derived object carrying provider-only metadata could otherwise
 * ride along unnoticed — the same risk `projectChatToolResult` closes for
 * tool results. Also validates `index` the same way the decoder does
 * (non-negative safe integer), so a caller-constructed block can't produce
 * a frame the decoder would then reject or that `JSON.stringify` would
 * silently corrupt (a non-finite `index` serializes to `null`).
 */
function projectChatStreamBlock(block: ChatStreamBlock): Record<string, unknown> {
  // Mirrors `toChatStreamBlock`'s checks field-for-field. Validating only
  // `index` left every other field free to be whatever a runtime-cast
  // producer supplied, so the encoder could still emit a block its own
  // decoder rejects — the exact failure this projection layer exists to stop.
  // Read each field once: a stateful accessor could otherwise answer the
  // guard with one value and the projection with another.
  const index = block.index;
  const type = block.type;
  if (!isNonNegativeSafeInteger(index))
    throw new Error('Invalid chat stream event: block index must be a non-negative safe integer');
  if (!isChatStreamBlockType(type))
    throw new Error(`Invalid chat stream event: unsupported block type ${String(type)}`);
  const projected: Record<string, unknown> = {
    id: requireString(block.id, 'block.id'),
    type,
    index,
    content: requireString(block.content, 'block.content'),
    complete: requireBoolean(block.complete, 'block.complete'),
  };
  if (block.toolName !== undefined)
    projected['toolName'] = requireString(block.toolName, 'block.toolName');
  if (block.partialArguments !== undefined)
    projected['partialArguments'] = requireString(block.partialArguments, 'block.partialArguments');
  return projected;
}

/**
 * Whitelists exactly `TokenUsage`'s declared fields, validated the same way
 * the decoder's `isTokenUsage` guard does — which, since it checks
 * `Number.isInteger` on every field, already rejects `NaN`/`Infinity`
 * (`Number.isInteger` is false for both). Reusing that guard here means a
 * non-finite usage value throws before encoding rather than silently
 * becoming `null` and failing the decoder's own check downstream.
 */
function projectTokenUsage(usage: TokenUsage): Record<string, unknown> {
  // Read each field once and validate the snapshot, so a stateful accessor
  // cannot pass the guard and then hand the projection a different value.
  const snapshot: Record<string, unknown> = {
    prompt: usage.prompt,
    completion: usage.completion,
    total: usage.total,
  };
  if (usage.cacheCreationTokens !== undefined)
    snapshot['cacheCreationTokens'] = usage.cacheCreationTokens;
  if (usage.cacheReadTokens !== undefined) snapshot['cacheReadTokens'] = usage.cacheReadTokens;
  if (!isTokenUsage(snapshot))
    throw new Error('Invalid chat stream event: usage is not a valid TokenUsage');
  return snapshot;
}

/**
 * Projects every element of a block array, visiting holes too. `.map` skips
 * the holes of a sparse array (`new Array(1)` is assignable to
 * `ChatStreamBlock[]`), `JSON.stringify` then writes each hole as `null`, and
 * the decoder rejects the frame — so the encoder has to refuse it first.
 *
 * The array check comes first for the same reason: a JavaScript caller can
 * hand over `{}` where the type says array, and iterating its undefined
 * `length` would silently project that to `[]` — a frame the decoder accepts
 * with a different meaning than the caller sent.
 */
function projectChatStreamBlockArray(
  blocks: readonly ChatStreamBlock[],
  label: string,
): Array<Record<string, unknown>> {
  if (!Array.isArray(blocks))
    throw new Error(`Invalid chat stream event: ${label} is not an array`);
  const projected: Array<Record<string, unknown>> = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block === undefined || !Object.hasOwn(blocks, index))
      throw new Error(`Invalid chat stream event: ${label}[${index}] is missing`);
    projected.push(projectChatStreamBlock(block));
  }
  return projected;
}

/** Whitelists exactly `ChatStreamState`'s declared fields, including its nested block arrays. */
function projectChatStreamState(state: ChatStreamState): Record<string, unknown> {
  const projected: Record<string, unknown> = {
    blocks: projectChatStreamBlockArray(state.blocks, 'state.blocks'),
    textContent: requireString(state.textContent, 'state.textContent'),
    toolCalls: projectChatStreamBlockArray(state.toolCalls, 'state.toolCalls'),
    complete: requireBoolean(state.complete, 'state.complete'),
  };
  if (state.activeBlock !== undefined)
    projected['activeBlock'] = projectChatStreamBlock(state.activeBlock);
  if (state.usage !== undefined) projected['usage'] = projectTokenUsage(state.usage);
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
  // Rebuilding alone only drops `cause`; it does not stop a runtime-cast
  // producer supplying a `kind`/`code` outside the published vocabulary, or
  // non-string `name`/`message`. The decoder validates all four with these
  // same guards, so without this the encoder could emit a frame its own
  // decoder rejects — after the bad payload had already crossed the wire.
  //
  // Every field is read once up front, so an accessor cannot answer the
  // guards with one value and the returned frame with another.
  const { name, message, kind, code } = error;
  if (typeof name !== 'string' || typeof message !== 'string')
    throw new Error('Invalid chat stream event: run error name and message must be strings');
  if (!isChatAgentRunErrorKind(kind))
    throw new Error(`Invalid chat stream event: unsupported run error kind ${String(kind)}`);
  if (!isChatAgentRunErrorCode(code))
    throw new Error(`Invalid chat stream event: unsupported run error code ${String(code)}`);
  return { name, message, kind, code };
}

/**
 * Throws if `value` (identified by `context` for the error message) isn't a
 * genuinely valid `JSONValue`. `value`'s static type is already `JSONValue`,
 * but that's only a compile-time guarantee — a caller routing a non-JSON
 * value (`undefined`, a function, a class instance, or a non-finite number)
 * through an `unknown` cast bypasses it, and `JSON.stringify` would then
 * silently drop or rewrite the offending value instead of failing loudly.
 * Conversationalist's `isJSONValue` guard already rejects `NaN`/`Infinity`
 * (its number branch requires `Number.isFinite`), so this single check
 * covers both "not JSON-shaped at all" and "contains a non-finite number" —
 * the two ways `JSON.stringify` can silently corrupt a value here.
 */
function assertFiniteJSONValue(value: JSONValue, context: string): JSONValue {
  if (!isJSONValue(value))
    throw new Error(`Invalid chat stream event: ${context} is not a valid JSON value`);
  // The guard only proves the shape. What `JSON.stringify` actually consults
  // is any reachable `toJSON`, so the value is rebuilt as plain data too.
  return projectPlainJSON(value, context);
}

/**
 * Rebuilds an already schema-validated value as plain JSON data: own
 * enumerable string keys copied onto null-prototype objects, arrays by
 * index, primitives as they are. Anything with a `toJSON` in reach
 * — own, non-enumerable, or inherited — is rejected rather than neutralized
 * silently, because a producer that attached one intended the wire to carry
 * something other than what the schema validated.
 */
function projectPlainJSON(value: unknown, context: string): JSONValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error(`Invalid chat stream event: ${context} is not a valid JSON value`);
    return value;
  }
  if (typeof value !== 'object')
    throw new Error(`Invalid chat stream event: ${context} is not a valid JSON value`);
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function')
    throw new Error(`Invalid chat stream event: ${context} carries a toJSON serialization hook`);
  // `undefined` follows JSON.stringify: dropped from objects, `null` in arrays.
  // The copy is built by index into an intrinsic array — never through the
  // input's own `map`, which a producer could override (or redirect via
  // `Symbol.species`) to hand back an array carrying a hook of its own.
  if (Array.isArray(value)) {
    const items: JSONValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const item: unknown = value[index];
      items.push(item === undefined ? null : projectPlainJSON(item, `${context}[${index}]`));
    }
    return items;
  }
  // Null-prototype so the result inherits nothing — not a `toJSON`, not a
  // polluted `Object.prototype` key; only the copied own keys reach the wire.
  const projected: Record<string, JSONValue> = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    // Defined as an own data property rather than assigned: a `__proto__`
    // key would otherwise hit the prototype setter and vanish from the wire.
    Object.defineProperty(projected, key, {
      value: projectPlainJSON(item, `${context}.${key}`),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return projected;
}

/**
 * Throws unless `value` is genuinely a string. The declared types already say
 * so, but a JavaScript caller or a runtime-cast value can supply anything,
 * and the decoder checks these fields — so without this the encoder could
 * emit a frame its own decoder rejects, which is the one thing the projection
 * layer exists to prevent.
 */
function requireString(value: unknown, context: string): string {
  if (typeof value !== 'string')
    throw new Error(`Invalid chat stream event: ${context} must be a string`);
  return value;
}

function requireBoolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean')
    throw new Error(`Invalid chat stream event: ${context} must be a boolean`);
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
  const projected = projectChatStreamEventBody(event, envelope);
  // The decoder requires a complete envelope on every CIN-507 member (only
  // the three legacy members tolerate a bare frame) — the encoder must
  // refuse to produce a frame its own decoder would then reject. The check
  // runs against the `type` the switch below actually wrote, not a second
  // read of `event.type`: an accessor-backed discriminator could otherwise
  // answer a legacy name here and a new-vocabulary name to the switch,
  // slipping a bare frame past this guard.
  if (!isLegacyChatStreamEventType(projected.type) && envelope.wireVersion === undefined) {
    throw new Error(`Invalid chat stream event: ${projected.type} requires a wire envelope`);
  }
  return projected;
}

/** A projected frame whose `type` is the literal the encoder itself wrote. */
type ProjectedChatStreamEvent = Record<string, unknown> & { type: ChatStreamEvent['type'] };

function projectChatStreamEventBody(
  event: ChatStreamEvent,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  switch (event.type) {
    case 'text':
      return { type: 'text', text: requireString(event.text, 'text'), ...envelope };
    case 'tool_call':
      return {
        type: 'tool_call',
        id: requireString(event.id, 'id'),
        name: requireString(event.name, 'name'),
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
        delta: requireString(event.delta, 'delta'),
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
        content: requireString(event.content, 'content'),
        accumulated: requireString(event.accumulated, 'accumulated'),
        ...envelope,
      };
    case 'stream:tool-call-start':
      return {
        type: 'stream:tool-call-start',
        toolName: requireString(event.toolName, 'toolName'),
        blockId: requireString(event.blockId, 'blockId'),
        ...envelope,
      };
    case 'stream:tool-call-delta':
      return {
        type: 'stream:tool-call-delta',
        toolName: requireString(event.toolName, 'toolName'),
        blockId: requireString(event.blockId, 'blockId'),
        partialArguments: requireString(event.partialArguments, 'partialArguments'),
        ...envelope,
      };
    case 'stream:tool-call-complete':
      return {
        type: 'stream:tool-call-complete',
        toolName: requireString(event.toolName, 'toolName'),
        blockId: requireString(event.blockId, 'blockId'),
        arguments: assertFiniteJSONValue(event.arguments, 'stream:tool-call-complete.arguments'),
        ...envelope,
      };
    case 'stream:usage':
      return { type: 'stream:usage', usage: projectTokenUsage(event.usage), ...envelope };
    case 'stream:complete':
      return { type: 'stream:complete', state: projectChatStreamState(event.state), ...envelope };
    case 'stream:error':
      return {
        type: 'stream:error',
        error: assertFiniteJSONValue(event.error, 'stream:error.error'),
        ...envelope,
      };
    case 'tool.started':
      return {
        type: 'tool.started',
        toolCallId: requireString(event.toolCallId, 'toolCallId'),
        toolName: requireString(event.toolName, 'toolName'),
        ...envelope,
      };
    case 'tool.progress': {
      const projected: Record<string, unknown> = {
        toolCallId: requireString(event.toolCallId, 'toolCallId'),
        toolName: requireString(event.toolName, 'toolName'),
      };
      // Read `percent` once: JSON.stringify serializes a non-finite number
      // (NaN, Infinity) as `null`, which the decoder's own `percent` predicate
      // then rejects — silently turning a valid-looking ChatStreamEvent into
      // malformed wire data. Reject it here instead, before it ever reaches
      // the wire, and encode the very value that passed the check.
      const percent = event.percent;
      if (percent !== undefined) {
        if (!Number.isFinite(percent))
          throw new Error('Invalid chat stream event: tool.progress percent must be finite');
        projected['percent'] = percent;
      }
      if (event.message !== undefined)
        projected['message'] = requireString(event.message, 'message');
      return { type: 'tool.progress', ...projected, ...envelope };
    }
    case 'tool.settled': {
      // Mirrors the decoder's callId/toolCallId agreement check — a
      // mismatch here would encode a frame the decoder then rejects,
      // turning a producer bug into a downstream protocol failure instead
      // of catching it at the source. The check and the projection read the
      // same snapshots, so a stateful accessor cannot pass one and feed the
      // other.
      const toolCallId = requireString(event.toolCallId, 'toolCallId');
      const result = projectChatToolResult(event.result);
      if (result['callId'] !== toolCallId) {
        throw new Error(
          'Invalid chat stream event: tool.settled result.callId must equal toolCallId',
        );
      }
      return {
        type: 'tool.settled',
        toolCallId,
        toolName: requireString(event.toolName, 'toolName'),
        result,
        ...envelope,
      };
    }
    case 'tool.error':
      return {
        type: 'tool.error',
        toolCallId: requireString(event.toolCallId, 'toolCallId'),
        toolName: requireString(event.toolName, 'toolName'),
        error: assertFiniteJSONValue(event.error, 'tool.error.error'),
        ...envelope,
      };
    case 'tool.policy-denied': {
      const projected: Record<string, unknown> = {
        toolCallId: requireString(event.toolCallId, 'toolCallId'),
        toolName: requireString(event.toolName, 'toolName'),
      };
      if (event.reason !== undefined) projected['reason'] = requireString(event.reason, 'reason');
      return { type: 'tool.policy-denied', ...projected, ...envelope };
    }
    case 'run.completed':
      // `isConversationHistory` uses Conversationalist's `.strict()` Zod
      // schemas at every nested level (message, tool result, etc.), so
      // reusing it here doesn't just validate the shape — it rejects
      // outright anything carrying extra enumerable properties, the same
      // protection `projectTokenUsage`/`projectChatToolResult` give their
      // fields. A hand-rolled field-by-field rebuild of `ConversationHistory`
      // would have to reimplement that entire schema (messages, multimodal
      // content, tool calls/results, ...); reusing the guard is the
      // maintainable way to get the same guarantee.
      if (!isConversationHistory(event.conversation)) {
        throw new Error(
          'Invalid chat stream event: conversation is not a valid ConversationHistory',
        );
      }
      return {
        type: 'run.completed',
        // The guard proves the SHAPE, and `isConversationHistory` rejects a
        // value carrying extra enumerable keys at every level — but a
        // serialization hook is neither: a non-enumerable or inherited
        // `toJSON` passes the strict schema and is still what
        // `JSON.stringify` would call, replacing the validated history with
        // whatever the hook returns. Project to plain JSON data (own
        // enumerable keys only, no prototype) and refuse any hook outright.
        conversation: projectPlainJSON(event.conversation, 'conversation'),
        content: requireString(event.content, 'content'),
        usage: projectTokenUsage(event.usage),
        finishReason: requireString(event.finishReason, 'finishReason'),
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
      const projected: Record<string, unknown> = {};
      if (event.reason !== undefined) projected['reason'] = requireString(event.reason, 'reason');
      return { type: 'run.aborted', ...projected, ...envelope };
    }
    default: {
      // TypeScript proves this switch exhaustive, so `unsupported` is `never`
      // — but a JavaScript caller or a runtime-cast value can still arrive
      // with an unknown `type`. Falling through returned `undefined`, and
      // `JSON.stringify(undefined)` is `undefined`, so the encoder emitted
      // the literal frame `undefined\n`: malformed NDJSON, produced silently,
      // and diagnosed far from the producer that caused it.
      const unsupported: never = event;
      throw new Error(
        `Invalid chat stream event: unsupported type ${String((unsupported as { type?: unknown }).type)}`,
      );
    }
  }
}

/**
 * Encodes one event as a newline-delimited JSON frame.
 *
 * The projected frame is rebuilt as plain data before serialization: what
 * `JSON.stringify` actually consults is any reachable `toJSON`, and the
 * frame's own object literals inherit whatever `Object.prototype` carries.
 * A hook there would replace the field-by-field projection wholesale, so
 * `projectPlainJSON` rejects it — and returns null-prototype objects, which
 * cannot pick one up again.
 */
export function encodeChatStreamEvent(event: ChatStreamEvent): string {
  return `${JSON.stringify(projectPlainJSON(projectChatStreamEvent(event), 'frame'))}\n`;
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
function requireWireEnvelope(envelope: Partial<WireEnvelope>): WireEnvelope {
  if (envelope.wireVersion === undefined || envelope.sequence === undefined)
    throw new Error('Invalid chat stream event');
  return { wireVersion: envelope.wireVersion, sequence: envelope.sequence };
}

function isChatStreamBlockType(value: unknown): value is ChatStreamBlockType {
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
function toChatStreamBlock(value: unknown): ChatStreamBlock | undefined {
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
function toChatStreamState(value: unknown): ChatStreamState | undefined {
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
  const raw = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  // Own key only, like the envelope: an inherited `type` would let an object
  // that serializes without a discriminator decode as a (terminal) frame.
  // An array is `typeof 'object'` too, and one carrying named properties
  // (`Object.assign([], { type: 'run.aborted' })`) would spread into a
  // perfectly ordinary frame here — while serializing to `[]`, which the
  // NDJSON path rejects. The two paths have to agree, so it is rejected.
  if (!isRecord(raw) || Array.isArray(raw) || !Object.hasOwn(raw, 'type'))
    throw new Error('Invalid chat stream event');
  // An already-decoded transport hands the guard the producer's own object,
  // not a JSON.parse result, so its fields can be accessors that answer
  // differently per read — passing a guard with one value and reaching the
  // returned event with another. Copying the own enumerable fields once
  // freezes what every check below validates. (A non-enumerable own field is
  // dropped, which is correct: nothing on the wire can produce one.)
  const parsed: Record<string, unknown> = { ...raw };
  if (typeof parsed['type'] !== 'string') throw new Error('Invalid chat stream event');
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

  if (eventType === 'stream:block-start') {
    const block = toChatStreamBlock(parsed['block']);
    if (block) return { type: 'stream:block-start', block, ...required };
  }
  if (eventType === 'stream:block-delta') {
    const block = toChatStreamBlock(parsed['block']);
    if (block && typeof parsed['delta'] === 'string') {
      return { type: 'stream:block-delta', block, delta: parsed['delta'], ...required };
    }
  }
  if (eventType === 'stream:block-complete') {
    const block = toChatStreamBlock(parsed['block']);
    if (block) return { type: 'stream:block-complete', block, ...required };
  }
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
  if (eventType === 'stream:complete') {
    const state = toChatStreamState(parsed['state']);
    if (state) return { type: 'stream:complete', state, ...required };
  }
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
  // Exactly one terminal frame is written when the connection remains
  // available, and the server closes the stream immediately after it
  // (reference architecture, "Stream wire contract"). A frame arriving
  // after a terminal one already did is a protocol violation, not just a
  // late-arriving no-op — reject it rather than silently accepting it.
  if (guard.sawTerminal)
    throw new Error('Invalid chat stream event: frame arrived after the terminal frame');

  const wireVersion = Object.hasOwn(event, 'wireVersion') ? event.wireVersion : undefined;
  const frameMode: 'bare' | 'versioned' = wireVersion === undefined ? 'bare' : 'versioned';
  if (guard.mode === undefined) guard.mode = frameMode;
  else if (guard.mode !== frameMode)
    throw new Error('Invalid chat stream event: envelope mode changed mid-stream');

  if (frameMode === 'versioned') {
    const sequence = Object.hasOwn(event, 'sequence') ? event.sequence : undefined;
    if (sequence === undefined) throw new Error('Invalid chat stream event: missing sequence');
    if (guard.lastSequence !== undefined && sequence <= guard.lastSequence)
      throw new Error('Invalid chat stream event: sequence did not increase');
    guard.lastSequence = sequence;
  }

  if (isTerminalChatStreamEvent(event)) guard.sawTerminal = true;
}

/**
 * Every versioned frame ends with a newline (reference architecture, "Stream
 * wire contract"), so a non-empty buffer left over at EOF means the response
 * was cut mid-frame. The leftover may still PARSE — a stream truncated
 * immediately after a terminal frame's closing brace decodes cleanly — which
 * is exactly why the terminal-frame check alone is not enough to tell a
 * complete response from a severed one.
 *
 * Bare (legacy) streams are exempt: they predate the newline requirement and
 * a trailing frame without one has always been accepted.
 */
function assertStreamFramed(buffer: string, guard: StreamGuardState): void {
  if (guard.mode === 'versioned' && buffer.trim())
    throw new Error('Invalid chat stream event: stream ended mid-frame without a newline');
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

/**
 * Applies the stream-level guard to events that arrive already decoded — a
 * `ChatSessionTransport` returning `AsyncIterable<ChatStreamEvent>` rather
 * than bytes. Without this, a typed iterable that ends without a terminal
 * frame, runs its sequence backwards, or switches envelope mode mid-stream
 * is accepted while the identical NDJSON response is rejected, so the
 * contract's validity would depend on the transport's representation.
 */
export async function* guardChatStreamEvents(
  events: AsyncIterable<ChatStreamEvent>,
): AsyncGenerator<ChatStreamEvent> {
  const guard: StreamGuardState = { mode: undefined, sawTerminal: false, lastSequence: undefined };
  for await (const event of events) {
    // Per-frame validation first: the static type says `ChatStreamEvent`, but
    // a transport built in JavaScript (or through a cast) can yield a frame
    // the wire decoder would refuse — `sequence: NaN`, a non-string `text` —
    // and the stream guard below assumes each frame is already well-formed.
    const decoded = decodeChatStreamEvent(event);
    noteDecodedStreamEvent(decoded, guard);
    yield decoded;
  }
  assertStreamTerminated(guard);
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
  // Decodes one batch of complete lines lazily, EXCEPT once a terminal frame
  // is reached: everything already buffered after it is validated before the
  // terminal is yielded. A consumer that stops iterating on the terminal
  // frame calls the generator's `return()`, which skips every later line —
  // so a terminal followed by a higher-sequence mutation that arrived in the
  // same chunk (or the same string) would otherwise be accepted rather than
  // rejected as a frame after the terminal. `afterTerminal` lets each source
  // path check its own residue (the string's final fragment, a chunk's
  // partial buffer) at the same moment.
  const decodeBatch = function* (
    lines: string[],
    afterTerminal: () => void,
  ): Generator<ChatStreamEvent> {
    for (let index = 0; index < lines.length; index++) {
      const event = decodeAndTrack(lines[index] ?? '');
      if (guard.sawTerminal) {
        for (const trailing of lines.slice(index + 1)) decodeAndTrack(trailing);
        afterTerminal();
      }
      yield event;
    }
  };
  // Decode-then-validate-then-yield for whatever is left after the final
  // newline. An unterminated frame is not a valid frame; yielding it before
  // `assertStreamFramed` runs would hand the consumer data the contract calls
  // truncated — and a consumer that stops iterating on a terminal frame
  // returns the generator before any assertion placed after the yield.
  const finishStream = function* (leftover: string): Generator<ChatStreamEvent> {
    if (leftover.trim()) {
      const event = decodeAndTrack(leftover.trim());
      assertStreamFramed(leftover, guard);
      yield event;
    } else {
      assertStreamFramed(leftover, guard);
    }
    assertStreamTerminated(guard);
  };
  if (typeof source === 'string') {
    // Same framing rule as the byte paths below. A versioned stream that is
    // accepted as a string but rejected when streamed would make the format's
    // validity depend on how the caller happened to deliver it.
    const lines = source.split('\n');
    const leftover = lines.pop() ?? '';
    yield* decodeBatch(lines.map((item) => item.trim()).filter(Boolean), () => {
      // The whole string is already buffered, so the final fragment is
      // checked before the terminal frame is handed over, too.
      assertStreamFramed(leftover, guard);
      if (leftover.trim()) decodeAndTrack(leftover.trim());
    });
    yield* finishStream(leftover);
    return;
  }
  // `fatal` so an invalid byte sequence rejects the stream instead of being
  // replaced with U+FFFD: a replaced byte inside a quoted payload field still
  // parses as JSON, so without this the stream would complete "successfully"
  // with silently corrupted text, tool arguments, or history.
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const decodeBytes = (chunk?: Uint8Array): string => {
    try {
      return chunk === undefined ? decoder.decode() : decoder.decode(chunk, { stream: true });
    } catch {
      throw new Error('Invalid chat stream event: response bytes are not valid UTF-8');
    }
  };
  let buffer = '';
  const appendChunk = function* (chunk: string | Uint8Array): Generator<ChatStreamEvent> {
    // A source that mixes chunk types must not hand over a string while the
    // decoder still holds the start of a multibyte sequence: a later byte
    // chunk would complete that character *after* the intervening string,
    // silently reordering text inside an otherwise valid frame. Flushing the
    // fatal decoder rejects the pending partial sequence instead.
    if (typeof chunk === 'string') decodeBytes();
    buffer += typeof chunk === 'string' ? chunk : decodeBytes(chunk);
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    yield* decodeBatch(lines.map((item) => item.trim()).filter(Boolean), () => {
      // The server closes the stream immediately after the terminal frame,
      // so bytes already buffered past it are a violation even before they
      // form a complete line. Bytes still inside the decoder count too: the
      // start of a multibyte sequence never reaches `buffer`, so the decoder
      // is flushed here — a partial sequence fails the fatal decode, and a
      // consumer that stops on the terminal would otherwise never learn of
      // it because EOF handling is skipped.
      if (buffer.trim() || decodeBytes().length > 0)
        throw new Error('Invalid chat stream event: frame arrived after the terminal frame');
    });
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
      // Flush any bytes the decoder retained. A stream ending mid-multibyte
      // sequence leaves them inside `TextDecoder`, not in `buffer`, so
      // without this final `decode()` the truncation is invisible: the
      // buffer looks empty and a genuinely truncated stream is accepted.
      buffer += decodeBytes();
      yield* finishStream(buffer);
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
  // Same flush as the ReadableStream branch above: bytes retained mid
  // multibyte sequence live inside TextDecoder, not in `buffer`, so skipping
  // this makes a truncated stream look like a clean one.
  buffer += decodeBytes();
  yield* finishStream(buffer);
}

/** Short aliases for applications that already call their wire format `StreamEvent`. */
export const encodeStreamEvent = encodeChatStreamEvent;
export const decodeStreamEvent = decodeChatStreamEvent;
export const decodeStreamEvents = decodeChatStreamEvents;
