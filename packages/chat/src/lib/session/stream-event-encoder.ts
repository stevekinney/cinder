import { isConversationHistory } from '../components/chat/builders.ts';
import type { ChatStreamEvent, WireEnvelope } from './stream-event-contract.ts';
import { isRecord } from './stream-event-contract.ts';
import {
  assertFiniteJSONValue,
  isLegacyChatStreamEventType,
  projectChatSerializedRunError,
  projectChatStreamBlock,
  projectChatStreamState,
  projectChatToolResult,
  projectPlainJSON,
  projectTokenUsage,
  projectWireEnvelope,
  requireString,
} from './stream-event-projection.ts';

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
function projectChatStreamEvent(rawEvent: ChatStreamEvent): Record<string, unknown> {
  // Own enumerable fields only, the same rule the decoder applies: a caller
  // can hand over `Object.create({ type: 'text', text: 'secret' })`, whose
  // fields all live on its prototype, and reading through would put data the
  // object does not actually carry — polluted or merely unintended — onto the
  // wire, in a frame the decoder would then reject. The copy is shallow: each
  // field's own projection below is what validates its contents, and it is
  // also what reads any nested accessor exactly once.
  if (!isRecord(rawEvent)) throw new Error('Invalid chat stream event');
  const event = { ...rawEvent } as ChatStreamEvent;
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
      // Project FIRST, then validate what was projected. Reading once is not
      // enough on its own: the projection walks the whole graph, so a nested
      // accessor could answer the schema with a string and the projection
      // with a number, and the encoder would emit a frame its own decoder
      // rejects. Validating the projected data means the schema and the wire
      // see the same bytes.
      const conversation = projectPlainJSON(event.conversation, 'conversation');
      if (!isConversationHistory(conversation)) {
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
        conversation,
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

export const encodeStreamEvent = encodeChatStreamEvent;
