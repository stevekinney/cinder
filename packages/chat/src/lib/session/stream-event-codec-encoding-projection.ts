import type { TokenUsage } from 'conversationalist';
import type { ChatToolResult } from '../components/chat/adapter/chat-adapter.ts';
import { isJSONValue, isTokenUsage, isToolResult } from '../components/chat/builders.ts';
import type { JSONValue, ToolAction } from '../components/chat/conversation-model.ts';
import {
  isSupportedWireVersion,
  type ChatSerializedRunError,
  type ChatStreamBlock,
  type ChatStreamEvent,
  type ChatStreamState,
  type WireEnvelope,
} from './stream-event-codec-types.ts';
import {
  isChatAgentRunErrorCode,
  isChatAgentRunErrorKind,
  isChatStreamBlockType,
  isNonNegativeSafeInteger,
  isRecord,
} from './stream-event-codec-validation.ts';

/**
 * Mirrors `readWireEnvelope`'s all-or-nothing validation on the encode
 * side. TypeScript's static type doesn't stop a caller from handing in a
 * partial or malformed envelope at runtime — silently dropping a
 * half-present envelope to "bare" here would downgrade a frame without
 * telling anyone, which makes a producer bug invisible until decode fails
 * downstream (or, worse, doesn't).
 */
export function projectWireEnvelope(event: ChatStreamEvent): Partial<WireEnvelope> {
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
    !isSupportedWireVersion(wireVersion) ||
    !isNonNegativeSafeInteger(sequence)
  ) {
    throw new Error('Invalid chat stream event: cannot encode a malformed wire envelope');
  }
  return { wireVersion, sequence };
}

/**
 * Whitelists exactly `ChatToolResult`'s declared fields. Used for both the
 * top-level `tool_result` member and `tool.settled`'s nested `result`, so an
 * object built by spreading a provider payload — which could carry extra
 * properties — can't ride along onto the wire unnoticed.
 */
/**
 * A record's own enumerable fields, copied once. Every projector starts here:
 * a producer can hand over `Object.create({ id: 'secret', … })`, whose fields
 * live on its prototype, and encoding those would put data the object does
 * not carry onto the wire — in a frame the decoder, which projects to own
 * keys before validating, would then reject. Copying also reads any accessor
 * exactly once, so a guard and the projection that follows it cannot see
 * different values.
 */
function ownFields<T>(value: T): T {
  return isRecord(value) ? { ...value } : value;
}

/**
 * Whitelists exactly `ToolAction`'s declared fields.
 *
 * Shared by `tool_result`'s own `action` and by `elicitation.requested`,
 * which carries the same descriptor: an approval prompt and an input prompt
 * are the distinction both members draw, and two projections of one shape
 * would be two places for it to drift.
 *
 * The STRUCTURAL check still happens where it always did — at the end of
 * `projectChatToolResult`, against `isToolResult` over the whole projection,
 * and for the elicitation member through the decoder's `toChatToolAction`,
 * which is that same guard. This function's job is the field whitelist and
 * the JSON assertion on `schema`.
 */
function projectApprovalOperation(
  operation: Extract<ToolAction, { type: 'approval' }>['operation'],
): Record<string, unknown> {
  const source = ownFields(operation);
  const filesTouched = source.filesTouched;
  const projected: Record<string, unknown> = { kind: source.kind };
  if (filesTouched !== undefined)
    projected['filesTouched'] = projectStringArray(filesTouched, 'action.operation.filesTouched');
  if (source.argsPreview !== undefined) {
    projected['argsPreview'] = assertFiniteJSONValue(
      source.argsPreview,
      'tool result action.operation.argsPreview',
    );
  }
  if (source.kind === 'command') projected['command'] = source.command;
  if (source.kind === 'patch') projected['diff'] = source.diff;
  return projected;
}

function projectStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value))
    throw new Error(`Invalid chat stream event: ${context} is not an array`);
  const projected: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item: unknown = value[index];
    if (item === undefined || !Object.hasOwn(value, index))
      throw new Error(`Invalid chat stream event: ${context}[${index}] is missing`);
    if (typeof item !== 'string')
      throw new Error(`Invalid chat stream event: ${context}[${index}] must be a string`);
    projected.push(item);
  }
  return projected;
}

function projectApprovalSandbox(
  sandbox: Extract<ToolAction, { type: 'approval' }>['sandbox'],
): Record<string, unknown> | undefined {
  if (sandbox === undefined) return undefined;
  const source = ownFields(sandbox);
  return {
    provider: source.provider,
    name: source.name,
    workingDir: source.workingDir,
  };
}

export function projectChatToolAction(
  rawAction: NonNullable<ChatToolResult['action']>,
): Record<string, unknown> {
  const action = ownFields(rawAction);
  const projected: Record<string, unknown> = { type: action.type };
  if (action.message !== undefined) projected['message'] = action.message;

  if (action.type === 'input') {
    if (action.schema !== undefined)
      projected['schema'] = assertFiniteJSONValue(action.schema, 'tool result action.schema');
    return projected;
  }

  projected['risk'] = action.risk;
  projected['operation'] = projectApprovalOperation(action.operation);
  const sandbox = projectApprovalSandbox(action.sandbox);
  if (sandbox !== undefined) projected['sandbox'] = sandbox;
  const env = action.env;
  if (env !== undefined) projected['env'] = projectStringArray(env, 'action.env');
  if (action.snapshotId !== undefined) projected['snapshotId'] = action.snapshotId;
  if (action.expiresAt !== undefined) projected['expiresAt'] = action.expiresAt;
  if (action.editableArgs !== undefined) projected['editableArgs'] = action.editableArgs;
  projected['policyVersion'] = action.policyVersion;
  projected['idempotencyKey'] = action.idempotencyKey;
  return projected;
}

export function projectChatToolResult(rawResult: ChatToolResult): Record<string, unknown> {
  const result = ownFields(rawResult);
  const projected: Record<string, unknown> = {
    callId: result.callId,
    outcome: result.outcome,
    content: assertFiniteJSONValue(result.content, 'tool result content'),
  };
  if (result.error !== undefined) {
    const error = ownFields(result.error);
    const projectedError: Record<string, unknown> = {
      code: error.code,
      category: error.category,
      retryable: error.retryable,
      message: error.message,
    };
    if (error.details !== undefined)
      projectedError['details'] = assertFiniteJSONValue(error.details, 'tool result error.details');
    projected['error'] = projectedError;
  }
  if (result.action !== undefined) projected['action'] = projectChatToolAction(result.action);
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
export function projectChatStreamBlock(rawBlock: ChatStreamBlock): Record<string, unknown> {
  const block = ownFields(rawBlock);
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
export function projectTokenUsage(rawUsage: TokenUsage): Record<string, unknown> {
  const usage = ownFields(rawUsage);
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
export function projectChatStreamBlockArray(
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
export function projectChatStreamState(rawState: ChatStreamState): Record<string, unknown> {
  const state = ownFields(rawState);
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
export function projectChatSerializedRunError(
  rawError: ChatSerializedRunError,
): ChatSerializedRunError {
  const error = ownFields(rawError);
  // This rebuild IS the whitelist: `{ name, message, kind, code }` plus an
  // optional `retryable`, and nothing else. `cause` is what it exists to
  // drop — untyped on the Operative side, and for a provider failure it can
  // be the raw HTTP response with credential headers on it. Adding a field
  // here puts it on the wire, so the list is deliberately short and every
  // addition is a decision.
  //
  // Rebuilding alone does not stop a runtime-cast producer supplying a
  // `kind`/`code` outside the published vocabulary, non-string
  // `name`/`message`, or a non-boolean `retryable`. The decoder validates all
  // five with these same guards, so without this the encoder could emit a
  // frame its own decoder rejects — after the bad payload had already crossed
  // the wire.
  //
  // Every field is read once up front, so an accessor cannot answer the
  // guards with one value and the returned frame with another.
  const { name, message, kind, code, retryable } = error;
  if (typeof name !== 'string' || typeof message !== 'string')
    throw new Error('Invalid chat stream event: run error name and message must be strings');
  if (!isChatAgentRunErrorKind(kind))
    throw new Error(`Invalid chat stream event: unsupported run error kind ${String(kind)}`);
  if (!isChatAgentRunErrorCode(code))
    throw new Error(`Invalid chat stream event: unsupported run error code ${String(code)}`);
  // Absent is a meaning ("not stated"), so only a present non-boolean is
  // wrong. Coercing here would invent a claim the host never made.
  if (retryable !== undefined && typeof retryable !== 'boolean')
    throw new Error('Invalid chat stream event: run error retryable must be a boolean');
  return { name, message, kind, code, ...(retryable === undefined ? {} : { retryable }) };
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
export function assertFiniteJSONValue(value: JSONValue, context: string): JSONValue {
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
export function projectPlainJSON(value: unknown, context: string): JSONValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error(`Invalid chat stream event: ${context} is not a valid JSON value`);
    return value;
  }
  if (typeof value !== 'object')
    throw new Error(`Invalid chat stream event: ${context} is not a valid JSON value`);
  if (typeof Reflect.get(value, 'toJSON') === 'function')
    throw new Error(`Invalid chat stream event: ${context} carries a toJSON serialization hook`);
  if (Array.isArray(value)) return projectJSONArray(value, context);
  return projectJSONObject(value, context);
}

function projectJSONArray(value: object[], context: string): JSONValue[] {
  // `undefined` follows JSON.stringify: dropped from objects, `null` in arrays.
  // The copy is built by index into an intrinsic array — never through the
  // input's own `map`, which a producer could override (or redirect via
  // `Symbol.species`) to hand back an array carrying a hook of its own.
  const items: JSONValue[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item: unknown = value[index];
    items.push(item === undefined ? null : projectPlainJSON(item, `${context}[${index}]`));
  }
  return items;
}

function projectJSONObject(value: object, context: string): JSONValue {
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
export function requireString(value: unknown, context: string): string {
  if (typeof value !== 'string')
    throw new Error(`Invalid chat stream event: ${context} must be a string`);
  return value;
}

export function requireBoolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean')
    throw new Error(`Invalid chat stream event: ${context} must be a boolean`);
  return value;
}
