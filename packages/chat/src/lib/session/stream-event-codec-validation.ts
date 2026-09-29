import type { TokenUsage, ToolAction } from 'conversationalist';
import { isTokenUsage, isToolResult } from '../components/chat/builders.ts';
import {
  isSupportedWireVersion,
  type ChatAgentRunErrorCode,
  type ChatAgentRunErrorKind,
  type ChatSerializedRunError,
  type ChatStreamBlock,
  type ChatStreamBlockType,
  type ChatStreamState,
  type OptionalWireEnvelope,
  type V2WireEnvelope,
  type WireEnvelope,
} from './stream-event-codec-types.ts';

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
export function readWireEnvelope(parsed: Record<string, unknown>): OptionalWireEnvelope {
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
  if (!isSupportedWireVersion(wireVersion)) throw new Error('Invalid chat stream event');
  if (!isNonNegativeSafeInteger(sequence)) throw new Error('Invalid chat stream event');
  // The version is CARRIED, not normalized: a frame that arrived as version 2
  // must re-encode as version 2, and a consumer reading the decoded event has
  // to be able to tell which vocabulary produced it.
  return { wireVersion, sequence };
}

/** A fully-present wire envelope, required on every new (CIN-507) member. */
export function requireWireEnvelope(envelope: OptionalWireEnvelope): WireEnvelope {
  if (envelope.wireVersion === undefined || envelope.sequence === undefined)
    throw new Error('Invalid chat stream event');
  return { wireVersion: envelope.wireVersion, sequence: envelope.sequence };
}

/**
 * A fully-present version 2 envelope, required on every member wire version 2
 * introduced. Separate from `requireWireEnvelope` because a version 1
 * producer must not be able to emit a version 2 member at all — accepting one
 * would make the version field decorative.
 */
export function requireV2Envelope(envelope: OptionalWireEnvelope): V2WireEnvelope {
  const required = requireWireEnvelope(envelope);
  if (required.wireVersion !== 2) throw new Error('Invalid chat stream event');
  return { wireVersion: 2, sequence: required.sequence };
}

/**
 * Validates a `ChatToolResult['action']`-shaped value THROUGH THE GUARD
 * `tool_result` ALREADY USES, by handing `isToolResult` a minimal carrier
 * whose only interesting field is the action.
 *
 * Reusing the guard rather than hand-rolling a second one is the point.
 * `isToolResult` is conversationalist's strict schema, which owns the
 * `'approval' | 'input'` list, the optional `message`, the `schema` JSON
 * check, and the rejection of unknown keys. A parallel guard here would be a
 * copy of that list to keep in step — and the first thing to drift would be
 * a new action type that `tool_result` accepts and `elicitation.requested`
 * silently refuses, for no reason a reader could find.
 *
 * `undefined` for a malformed descriptor, which every caller turns into a
 * rejection. A malformed action is NOT quietly dropped to "no action": the
 * producer said something about this question, and a client that renders an
 * approval prompt differently from an input prompt would be shown the wrong
 * one.
 */
export function toChatToolAction(value: unknown): ToolAction | undefined {
  if (!isRecord(value) || Array.isArray(value)) return undefined;
  const carrier = { callId: '', outcome: 'action_required', content: null, action: value };
  if (!isToolResult(carrier)) return undefined;
  return carrier.action;
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
  const required = readRequiredBlockFields(value);
  if (required === undefined) return undefined;
  const block: ChatStreamBlock = {
    ...required,
  };
  const optional = readOptionalBlockFields(value);
  if (optional.toolName !== undefined) block.toolName = optional.toolName;
  if (optional.partialArguments !== undefined) block.partialArguments = optional.partialArguments;
  return block;
}

function isValidBlockRecord(value: Record<string, unknown>): boolean {
  return (
    typeof value['id'] === 'string' &&
    isChatStreamBlockType(value['type']) &&
    isNonNegativeSafeInteger(value['index']) &&
    typeof value['content'] === 'string' &&
    typeof value['complete'] === 'boolean' &&
    (value['toolName'] === undefined || typeof value['toolName'] === 'string') &&
    (value['partialArguments'] === undefined || typeof value['partialArguments'] === 'string')
  );
}

function readRequiredBlockFields(
  value: Record<string, unknown>,
): Pick<ChatStreamBlock, 'id' | 'type' | 'index' | 'content' | 'complete'> | undefined {
  if (!isValidBlockRecord(value)) return undefined;
  const id = value['id'];
  const type = value['type'];
  const index = value['index'];
  const content = value['content'];
  const complete = value['complete'];
  if (
    typeof id !== 'string' ||
    !isChatStreamBlockType(type) ||
    !isNonNegativeSafeInteger(index) ||
    typeof content !== 'string' ||
    typeof complete !== 'boolean'
  )
    return undefined;
  return { id, type, index, content, complete };
}

function readOptionalBlockFields(value: Record<string, unknown>): {
  toolName?: string;
  partialArguments?: string;
} {
  const fields: { toolName?: string; partialArguments?: string } = {};
  if (typeof value['toolName'] === 'string') fields.toolName = value['toolName'];
  if (typeof value['partialArguments'] === 'string')
    fields.partialArguments = value['partialArguments'];
  return fields;
}

/** Rebuilds a `ChatStreamBlock[]` from an unknown array, or `undefined` if any entry is invalid. */
export function toChatStreamBlockArray(value: unknown): ChatStreamBlock[] | undefined {
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
  const fields = readStateFields(value);
  if (fields === undefined) return undefined;
  const state: ChatStreamState = {
    blocks: fields.blocks,
    textContent: fields.textContent,
    toolCalls: fields.toolCalls,
    complete: fields.complete,
  };
  if (fields.activeBlock !== undefined) state.activeBlock = fields.activeBlock;
  if (fields.usage !== undefined) state.usage = fields.usage;
  return state;
}

function readStateFields(value: Record<string, unknown>):
  | {
      blocks: ChatStreamBlock[];
      activeBlock?: ChatStreamBlock;
      textContent: string;
      toolCalls: ChatStreamBlock[];
      complete: boolean;
      usage?: TokenUsage;
    }
  | undefined {
  const blocks = toChatStreamBlockArray(value['blocks']);
  if (blocks === undefined) return undefined;
  const activeBlock = readActiveBlock(value);
  if (value['activeBlock'] !== undefined && activeBlock === undefined) return undefined;
  const toolCalls = toChatStreamBlockArray(value['toolCalls']);
  if (toolCalls === undefined) return undefined;
  const scalars = readStateScalars(value);
  if (scalars === undefined) return undefined;
  return {
    blocks,
    ...(activeBlock === undefined ? {} : { activeBlock }),
    textContent: scalars.textContent,
    toolCalls,
    complete: scalars.complete,
    ...(scalars.usage === undefined ? {} : { usage: scalars.usage }),
  };
}

function readStateScalars(
  value: Record<string, unknown>,
): { textContent: string; complete: boolean; usage?: TokenUsage } | undefined {
  const textContent = value['textContent'];
  if (typeof textContent !== 'string') return undefined;
  const complete = value['complete'];
  if (typeof complete !== 'boolean') return undefined;
  const usage = readOptionalUsage(value['usage']);
  if (value['usage'] !== undefined && usage === undefined) return undefined;
  return { textContent, complete, ...(usage === undefined ? {} : { usage }) };
}

function readActiveBlock(value: Record<string, unknown>): ChatStreamBlock | undefined {
  return value['activeBlock'] === undefined ? undefined : toChatStreamBlock(value['activeBlock']);
}

function readOptionalUsage(value: unknown): TokenUsage | undefined {
  return value === undefined || !isTokenUsage(value) ? undefined : value;
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
    value === 'INVALID_AGENT_HANDLE' ||
    value === 'INVALID_OUTPUT' ||
    value === 'MAXIMUM_STEPS' ||
    value === 'NON_JSON_OUTPUT' ||
    value === 'OUTPUT_SCHEMA_CONVERSION_FAILED' ||
    value === 'SELECTION_REVALIDATION_FAILED' ||
    value === 'SUBAGENT_RUN_FAILED' ||
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
