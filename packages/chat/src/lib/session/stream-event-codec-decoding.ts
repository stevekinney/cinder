import { isJSONValue, isToolResult } from '../components/chat/builders.ts';
import { decodeStreamEvent } from './stream-event-codec-decoding-stream.ts';
import { decodeRunEvent, decodeToolEvent } from './stream-event-codec-decoding-tool-run.ts';
import { projectPlainJSON } from './stream-event-codec-encoding-projection.ts';
import type {
  ChatStreamEvent,
  OptionalWireEnvelope,
  V2WireEnvelope,
  WireEnvelope,
} from './stream-event-codec-types.ts';
import {
  isNonNegativeSafeInteger,
  isRecord,
  readWireEnvelope,
  requireV2Envelope,
  requireWireEnvelope,
  toChatToolAction,
} from './stream-event-codec-validation.ts';

/** Decodes and validates one provider-neutral stream event. */
export function decodeChatStreamEvent(value: unknown): ChatStreamEvent {
  const { parsed, envelope } = prepareFrame(value);
  const eventType = parsed['type'];
  if (eventType === 'text') return decodeTextEvent(parsed, envelope);
  if (eventType === 'tool_call') return decodeToolCallEvent(parsed, envelope);
  if (eventType === 'tool_result') return decodeLegacyToolResult(parsed, envelope);
  return decodeVersionedEvent(eventType, parsed, requireWireEnvelope(envelope));
}

function decodeVersionedEvent(
  eventType: string,
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (assistantStepEventTypes.includes(eventType))
    return decodeAssistantStepEvent(eventType, parsed, requireV2Envelope(required));
  if (elicitationEventTypes.includes(eventType))
    return decodeElicitationEvent(eventType, parsed, requireV2Envelope(required));
  if (streamEventTypes.includes(eventType)) return decodeStreamEvent(eventType, parsed, required);
  if (toolEventTypes.includes(eventType)) return decodeToolEvent(eventType, parsed, required);
  if (runEventTypes.includes(eventType)) return decodeRunEvent(eventType, parsed, required);
  throw new Error('Invalid chat stream event');
}

const streamEventTypes = [
  'stream:block-start',
  'stream:block-delta',
  'stream:block-complete',
  'stream:text-delta',
  'stream:tool-call-start',
  'stream:tool-call-delta',
  'stream:tool-call-complete',
  'stream:usage',
  'stream:complete',
  'stream:error',
];
const toolEventTypes = [
  'tool.started',
  'tool.progress',
  'tool.settled',
  'tool.error',
  'tool.policy-denied',
];
const runEventTypes = ['run.completed', 'run.error', 'run.tripwire', 'run.aborted'];
const assistantStepEventTypes = ['assistant.step.started', 'assistant.step.completed'];
const elicitationEventTypes = ['elicitation.requested', 'elicitation.resolved'];

/**
 * Decodes one elicitation frame, field by field.
 *
 * `requestId` is required on BOTH members and validated identically, because
 * it is the only thing correlating an answer to the question a client showed.
 * `toolCallId` is optional but, when present, must be a string — a `null` or a
 * number there is a producer bug, not an absence, and reading it as "no call"
 * would attribute the question to nothing.
 */
function decodeElicitationEvent(
  eventType: string,
  parsed: Record<string, unknown>,
  envelope: V2WireEnvelope,
): ChatStreamEvent {
  const requestId = parsed['requestId'];
  const toolCallId = parsed['toolCallId'];
  if (typeof requestId !== 'string') throw new Error('Invalid chat stream event');
  if (toolCallId !== undefined && typeof toolCallId !== 'string')
    throw new Error('Invalid chat stream event');
  const correlation = {
    requestId,
    ...(toolCallId === undefined ? {} : { toolCallId }),
  };
  if (eventType === 'elicitation.resolved') {
    const accepted = parsed['accepted'];
    if (typeof accepted !== 'boolean') throw new Error('Invalid chat stream event');
    return { type: 'elicitation.resolved', ...correlation, accepted, ...envelope };
  }
  const message = parsed['message'];
  if (typeof message !== 'string') throw new Error('Invalid chat stream event');
  const action = parsed['action'];
  // A PRESENT but malformed descriptor is a rejection, not an absence — see
  // `toChatToolAction`. `undefined` alone means the producer said nothing.
  const decodedAction = action === undefined ? undefined : toChatToolAction(action);
  if (action !== undefined && decodedAction === undefined)
    throw new Error('Invalid chat stream event');
  return {
    type: 'elicitation.requested',
    ...correlation,
    message,
    ...(decodedAction === undefined ? {} : { action: decodedAction }),
    ...envelope,
  };
}

function decodeAssistantStepEvent(
  eventType: string,
  parsed: Record<string, unknown>,
  envelope: V2WireEnvelope,
): ChatStreamEvent {
  const step = parsed['step'];
  const messageId = parsed['messageId'];
  if (!isNonNegativeSafeInteger(step) || typeof messageId !== 'string')
    throw new Error('Invalid chat stream event');
  return eventType === 'assistant.step.started'
    ? { type: 'assistant.step.started', step, messageId, ...envelope }
    : { type: 'assistant.step.completed', step, messageId, ...envelope };
}

function decodeTextEvent(
  parsed: Record<string, unknown>,
  envelope: OptionalWireEnvelope,
): ChatStreamEvent {
  if (typeof parsed['text'] !== 'string') throw new Error('Invalid chat stream event');
  return { type: 'text', text: parsed['text'], ...envelope };
}

function decodeToolCallEvent(
  parsed: Record<string, unknown>,
  envelope: OptionalWireEnvelope,
): ChatStreamEvent {
  if (
    typeof parsed['id'] !== 'string' ||
    typeof parsed['name'] !== 'string' ||
    !isJSONValue(parsed['arguments'])
  )
    throw new Error('Invalid chat stream event');
  return {
    type: 'tool_call',
    id: parsed['id'],
    name: parsed['name'],
    arguments: parsed['arguments'],
    ...envelope,
  };
}

function prepareFrame(value: unknown): {
  parsed: Record<string, unknown> & { type: string };
  envelope: OptionalWireEnvelope;
} {
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  // Own key only, like the envelope: an inherited `type` would let an object
  // that serializes without a discriminator decode as a (terminal) frame.
  // An array is `typeof 'object'` too, and one carrying named properties
  // (`Object.assign([], { type: 'run.aborted' })`) would spread into a
  // perfectly ordinary frame here — while serializing to `[]`, which the
  // NDJSON path rejects. The two paths have to agree, so it is rejected.
  if (!isRecord(raw) || Array.isArray(raw) || !Object.hasOwn(raw, 'type'))
    throw new Error('Invalid chat stream event');
  // Rebuild the whole frame as plain data before any guard runs — exactly
  // "what this value would be if it had crossed the wire". An already-decoded
  // transport hands the guard the producer's own object, whose fields at
  // every depth can be accessors that answer differently per read or carry a
  // `toJSON` that would rewrite them on the way back out; every read below
  // sees one frozen snapshot instead, a hook anywhere in the graph is
  // refused, and an array smuggled in as a nested object arrives as the `[]`
  // it would serialize to.
  //
  // A `JSON.parse` result gets the same treatment, cost notwithstanding: it
  // is a plain object, but it still INHERITS from `Object.prototype`, so a
  // polluted prototype could supply a `text` or an `id` that the field checks
  // below would read straight through `parsed['text']`. The copy takes own
  // enumerable keys only, onto a null prototype, which is the same own-key
  // rule already applied to `type` and the envelope.
  const projected = projectPlainJSON(raw, 'frame');
  if (!isRecord(projected) || !hasStringType(projected))
    throw new Error('Invalid chat stream event');
  return { parsed: projected, envelope: readWireEnvelope(projected) };
}

function hasStringType(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { type: string } {
  return typeof value['type'] === 'string';
}

function decodeLegacyToolResult(
  parsed: Record<string, unknown>,
  envelope: OptionalWireEnvelope,
): ChatStreamEvent {
  const { type: _type, pendingApproval, wireVersion: _wv, sequence: _seq, ...candidate } = parsed;
  if (!isToolResult(candidate) || (pendingApproval !== undefined && !isJSONValue(pendingApproval)))
    throw new Error('Invalid chat stream event');
  return {
    type: 'tool_result',
    ...candidate,
    ...(pendingApproval === undefined ? {} : { pendingApproval }),
    ...envelope,
  };
}
