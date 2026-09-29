import { isConversationHistory } from '../components/chat/builders.ts';
import {
  isAssistantStepEvent,
  isBlockStreamEvent,
  isElicitationEvent,
  isRunEvent,
  isStateStreamEvent,
  isStreamEvent,
  isTextStreamEvent,
  isToolEvent,
} from './stream-event-codec-encoding-dispatch.ts';
import {
  assertFiniteJSONValue,
  projectChatSerializedRunError,
  projectChatStreamBlock,
  projectChatStreamState,
  projectChatToolAction,
  projectChatToolResult,
  projectPlainJSON,
  projectTokenUsage,
  projectWireEnvelope,
  requireBoolean,
  requireString,
} from './stream-event-codec-encoding-projection.ts';
import type { ChatStreamEvent, WireEnvelope } from './stream-event-codec-types.ts';
import {
  isNonNegativeSafeInteger,
  isRecord,
  toChatToolAction,
} from './stream-event-codec-validation.ts';

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
export function projectChatStreamEvent(rawEvent: ChatStreamEvent): Record<string, unknown> {
  // Own enumerable fields only, the same rule the decoder applies: a caller
  // can hand over `Object.create({ type: 'text', text: 'secret' })`, whose
  // fields all live on its prototype, and reading through would put data the
  // object does not actually carry — polluted or merely unintended — onto the
  // wire, in a frame the decoder would then reject. The copy is shallow: each
  // field's own projection below is what validates its contents, and it is
  // also what reads any nested accessor exactly once.
  if (!isRecord(rawEvent) || !Object.hasOwn(rawEvent, 'type'))
    throw new Error('Invalid chat stream event');
  const event = { ...rawEvent } as ChatStreamEvent;
  if (typeof event.type !== 'string') throw new Error('Invalid chat stream event');
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

export function projectChatStreamEventBody(
  event: ChatStreamEvent,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  if (isStreamEvent(event)) return projectStreamEvent(event, envelope);
  if (isToolEvent(event)) return projectToolEvent(event, envelope);
  if (isRunEvent(event)) return projectRunEvent(event, envelope);
  if (isAssistantStepEvent(event)) return projectAssistantStepEvent(event, envelope);
  if (isElicitationEvent(event)) return projectElicitationEvent(event, envelope);
  if (event.type === 'text' || event.type === 'tool_call' || event.type === 'tool_result')
    return projectLegacyEvent(event, envelope);
  return throwUnsupportedType(event);
}

type LegacyEvent = Extract<ChatStreamEvent, { type: 'text' | 'tool_call' | 'tool_result' }>;
type StreamEvent = Extract<ChatStreamEvent, { type: `stream:${string}` }>;
type ToolEvent = Extract<ChatStreamEvent, { type: `tool.${string}` }>;
type RunEvent = Extract<ChatStreamEvent, { type: `run.${string}` }>;
type AssistantStepEvent = Extract<ChatStreamEvent, { type: `assistant.step.${string}` }>;
type ElicitationEvent = Extract<ChatStreamEvent, { type: `elicitation.${string}` }>;

/**
 * Projects one elicitation frame into exactly its declared fields.
 *
 * `toolCallId` and `action` are SPREAD ONLY WHEN PRESENT rather than written
 * as `undefined`. `JSON.stringify` drops an `undefined` value, so the two
 * would look the same on the wire — but not to the decoder's
 * `Object.hasOwn`-shaped reads, and not to a test asserting on the projected
 * object before it is serialized. Omission is the honest representation of
 * "the producer said nothing".
 *
 * The `action` descriptor goes through the same projection `tool_result`'s own
 * action does, so the two cannot describe the same shape differently.
 */
function projectElicitationEvent(
  event: ElicitationEvent,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  const correlation = {
    requestId: requireString(event.requestId, 'requestId'),
    ...(event.toolCallId === undefined
      ? {}
      : { toolCallId: requireString(event.toolCallId, 'toolCallId') }),
  };
  if (event.type === 'elicitation.resolved')
    return {
      type: event.type,
      ...correlation,
      accepted: requireBoolean(event.accepted, 'accepted'),
      ...envelope,
    };
  return {
    type: event.type,
    ...correlation,
    message: requireString(event.message, 'message'),
    ...(event.action === undefined ? {} : { action: projectElicitationAction(event.action) }),
    ...envelope,
  };
}

/**
 * The action descriptor, whitelisted and then checked against the SAME guard
 * the decoder will apply to it.
 *
 * Structural, and last — the mirror of what `projectChatToolResult` does with
 * `isToolResult` over its whole projection. Without it the encoder would
 * happily write `action: { type: 'nonsense' }` and the failure would surface
 * at the far end, after the payload had already crossed the wire, which is
 * the hazard every other member's encode-time guard exists to close.
 */
function projectElicitationAction(
  action: NonNullable<Extract<ElicitationEvent, { type: 'elicitation.requested' }>['action']>,
): Record<string, unknown> {
  const projected = projectChatToolAction(action);
  if (toChatToolAction(projected) === undefined)
    throw new Error('Invalid chat stream event: action is not a valid tool action');
  return projected;
}

function projectAssistantStepEvent(
  event: AssistantStepEvent,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  if (!isNonNegativeSafeInteger(event.step))
    throw new Error('Invalid chat stream event: step must be a non-negative safe integer');
  return {
    type: event.type,
    step: event.step,
    messageId: requireString(event.messageId, 'messageId'),
    ...envelope,
  };
}

function projectLegacyEvent(
  event: LegacyEvent,
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
  }
}
function projectStreamEvent(
  event: StreamEvent,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  if (isBlockStreamEvent(event)) return projectBlockStreamEvent(event, envelope);
  if (isTextStreamEvent(event)) return projectTextStreamEvent(event, envelope);
  if (isStateStreamEvent(event)) return projectStateStreamEvent(event, envelope);
  // The guards above leave only `stream:error`; this binding stops compiling if a new stream
  // type reaches here unhandled.
  const errorEvent: Extract<StreamEvent, { type: 'stream:error' }> = event;
  return {
    type: errorEvent.type,
    error: assertFiniteJSONValue(errorEvent.error, 'stream:error.error'),
    ...envelope,
  };
}
function projectBlockStreamEvent(
  event: Extract<
    StreamEvent,
    { type: 'stream:block-start' | 'stream:block-delta' | 'stream:block-complete' }
  >,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  const block = projectChatStreamBlock(event.block);
  if (event.type === 'stream:block-delta')
    return { type: event.type, block, delta: requireString(event.delta, 'delta'), ...envelope };
  return { type: event.type, block, ...envelope };
}
function projectTextStreamEvent(
  event: Exclude<
    StreamEvent,
    {
      type:
        | 'stream:block-start'
        | 'stream:block-delta'
        | 'stream:block-complete'
        | 'stream:usage'
        | 'stream:complete'
        | 'stream:error';
    }
  >,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  if (event.type === 'stream:text-delta')
    return {
      type: event.type,
      content: requireString(event.content, 'content'),
      accumulated: requireString(event.accumulated, 'accumulated'),
      ...envelope,
    };
  if (event.type === 'stream:tool-call-start')
    return {
      type: event.type,
      toolName: requireString(event.toolName, 'toolName'),
      blockId: requireString(event.blockId, 'blockId'),
      ...envelope,
    };
  if (event.type === 'stream:tool-call-delta')
    return {
      type: event.type,
      toolName: requireString(event.toolName, 'toolName'),
      blockId: requireString(event.blockId, 'blockId'),
      partialArguments: requireString(event.partialArguments, 'partialArguments'),
      ...envelope,
    };
  return {
    type: event.type,
    toolName: requireString(event.toolName, 'toolName'),
    blockId: requireString(event.blockId, 'blockId'),
    arguments: assertFiniteJSONValue(event.arguments, 'stream:tool-call-complete.arguments'),
    ...envelope,
  };
}
function projectStateStreamEvent(
  event: Extract<StreamEvent, { type: 'stream:usage' | 'stream:complete' }>,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  if (event.type === 'stream:usage')
    return { type: event.type, usage: projectTokenUsage(event.usage), ...envelope };
  return { type: event.type, state: projectChatStreamState(event.state), ...envelope };
}
function projectToolEvent(
  event: ToolEvent,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  if (event.type === 'tool.started')
    return {
      type: event.type,
      toolCallId: requireString(event.toolCallId, 'toolCallId'),
      toolName: requireString(event.toolName, 'toolName'),
      ...envelope,
    };
  if (event.type === 'tool.progress') return projectToolProgress(event, envelope);
  if (event.type === 'tool.settled') return projectToolSettled(event, envelope);
  if (event.type === 'tool.error')
    return {
      type: event.type,
      toolCallId: requireString(event.toolCallId, 'toolCallId'),
      toolName: requireString(event.toolName, 'toolName'),
      error: assertFiniteJSONValue(event.error, 'tool.error.error'),
      ...envelope,
    };
  // Only `tool.policy-denied` remains; this binding stops compiling if a new tool type does not.
  const policyDenied: Extract<ToolEvent, { type: 'tool.policy-denied' }> = event;
  return {
    type: policyDenied.type,
    toolCallId: requireString(policyDenied.toolCallId, 'toolCallId'),
    toolName: requireString(policyDenied.toolName, 'toolName'),
    ...(policyDenied.reason === undefined
      ? {}
      : { reason: requireString(policyDenied.reason, 'reason') }),
    ...envelope,
  };
}
function projectToolProgress(
  event: Extract<ToolEvent, { type: 'tool.progress' }>,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  const percent = event.percent;
  if (percent !== undefined && !Number.isFinite(percent))
    throw new Error('Invalid chat stream event: tool.progress percent must be finite');
  return {
    type: event.type,
    toolCallId: requireString(event.toolCallId, 'toolCallId'),
    toolName: requireString(event.toolName, 'toolName'),
    ...(percent === undefined ? {} : { percent }),
    ...(event.message === undefined ? {} : { message: requireString(event.message, 'message') }),
    ...envelope,
  };
}
function projectToolSettled(
  event: Extract<ToolEvent, { type: 'tool.settled' }>,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  const toolCallId = requireString(event.toolCallId, 'toolCallId');
  const result = projectChatToolResult(event.result);
  if (result['callId'] !== toolCallId)
    throw new Error('Invalid chat stream event: tool.settled result.callId must equal toolCallId');
  return {
    type: event.type,
    toolCallId,
    toolName: requireString(event.toolName, 'toolName'),
    result,
    ...envelope,
  };
}
function projectRunEvent(
  event: RunEvent,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  if (event.type === 'run.completed') return projectCompletedRun(event, envelope);
  if (event.type === 'run.error' || event.type === 'run.tripwire')
    return { type: event.type, error: projectChatSerializedRunError(event.error), ...envelope };
  // Only `run.aborted` remains; this binding stops compiling if a new run type does not.
  const aborted: Extract<RunEvent, { type: 'run.aborted' }> = event;
  return {
    type: aborted.type,
    ...(aborted.reason === undefined ? {} : { reason: requireString(aborted.reason, 'reason') }),
    ...envelope,
  };
}

function throwUnsupportedType(value: unknown): never {
  const type = isRecord(value) ? value['type'] : undefined;
  throw new Error(`Invalid chat stream event: unsupported type ${String(type)}`);
}
function projectCompletedRun(
  event: Extract<RunEvent, { type: 'run.completed' }>,
  envelope: Partial<WireEnvelope>,
): ProjectedChatStreamEvent {
  const conversation = projectPlainJSON(event.conversation, 'conversation');
  if (!isConversationHistory(conversation))
    throw new Error('Invalid chat stream event: conversation is not a valid ConversationHistory');
  return {
    type: event.type,
    conversation,
    content: requireString(event.content, 'content'),
    usage: projectTokenUsage(event.usage),
    finishReason: requireString(event.finishReason, 'finishReason'),
    ...envelope,
  };
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
