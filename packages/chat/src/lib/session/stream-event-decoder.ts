import {
  isConversationHistory,
  isJSONValue,
  isTokenUsage,
  isToolResult,
} from '../components/chat/builders.ts';
import type { ChatStreamEvent } from './stream-event-contract.ts';
import {
  isRecord,
  readWireEnvelope,
  requireWireEnvelope,
  toChatSerializedRunError,
  toChatStreamBlock,
  toChatStreamState,
} from './stream-event-contract.ts';
import { projectPlainJSON } from './stream-event-projection.ts';

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
  if (!isRecord(projected)) throw new Error('Invalid chat stream event');
  const parsed: Record<string, unknown> = projected;
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

export const decodeStreamEvent = decodeChatStreamEvent;
