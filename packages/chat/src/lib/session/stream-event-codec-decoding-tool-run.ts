import {
  isConversationHistory,
  isJSONValue,
  isTokenUsage,
  isToolResult,
} from '../components/chat/builders.ts';
import type { ChatStreamEvent, WireEnvelope } from './stream-event-codec-types.ts';
import { isRecord, toChatSerializedRunError } from './stream-event-codec-validation.ts';

export function decodeToolEvent(
  type: string,
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  switch (type) {
    case 'tool.settled':
      return decodeSettledToolEvent(parsed, required);
    case 'tool.started':
      return decodeStartedToolEvent(parsed, required);
    case 'tool.progress':
      return decodeToolProgress(parsed, required);
    case 'tool.error':
      return decodeToolError(parsed, required);
    case 'tool.policy-denied':
      return decodePolicyDenied(parsed, required);
    default:
      throw new Error('Invalid chat stream event');
  }
}
function decodeStartedToolEvent(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (typeof parsed['toolCallId'] !== 'string' || typeof parsed['toolName'] !== 'string')
    throw new Error('Invalid chat stream event');
  return {
    type: 'tool.started',
    toolCallId: parsed['toolCallId'],
    toolName: parsed['toolName'],
    ...required,
  };
}
function decodeToolError(parsed: Record<string, unknown>, required: WireEnvelope): ChatStreamEvent {
  if (
    typeof parsed['toolCallId'] !== 'string' ||
    typeof parsed['toolName'] !== 'string' ||
    !isJSONValue(parsed['error'])
  )
    throw new Error('Invalid chat stream event');
  return {
    type: 'tool.error',
    toolCallId: parsed['toolCallId'],
    toolName: parsed['toolName'],
    error: parsed['error'],
    ...required,
  };
}
function decodePolicyDenied(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (
    typeof parsed['toolCallId'] !== 'string' ||
    typeof parsed['toolName'] !== 'string' ||
    (parsed['reason'] !== undefined && typeof parsed['reason'] !== 'string')
  )
    throw new Error('Invalid chat stream event');
  return {
    type: 'tool.policy-denied',
    toolCallId: parsed['toolCallId'],
    toolName: parsed['toolName'],
    ...(parsed['reason'] === undefined ? {} : { reason: parsed['reason'] }),
    ...required,
  };
}
function decodeToolProgress(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (typeof parsed['toolCallId'] !== 'string' || typeof parsed['toolName'] !== 'string')
    throw new Error('Invalid chat stream event');
  if (
    parsed['percent'] !== undefined &&
    (typeof parsed['percent'] !== 'number' || !Number.isFinite(parsed['percent']))
  )
    throw new Error('Invalid chat stream event');
  if (parsed['message'] !== undefined && typeof parsed['message'] !== 'string')
    throw new Error('Invalid chat stream event');
  return {
    type: 'tool.progress',
    toolCallId: parsed['toolCallId'],
    toolName: parsed['toolName'],
    ...(parsed['percent'] === undefined ? {} : { percent: parsed['percent'] }),
    ...(parsed['message'] === undefined ? {} : { message: parsed['message'] }),
    ...required,
  };
}

function decodeSettledToolEvent(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  const resultRecord = parsed['result'];
  if (!isRecord(resultRecord)) throw new Error('Invalid chat stream event');
  const { pendingApproval, ...resultCandidate } = resultRecord;
  const toolCallId = parsed['toolCallId'];
  const toolName = parsed['toolName'];
  if (
    typeof toolCallId !== 'string' ||
    typeof toolName !== 'string' ||
    !isToolResult(resultCandidate) ||
    resultCandidate.callId !== toolCallId ||
    (pendingApproval !== undefined && !isJSONValue(pendingApproval))
  )
    throw new Error('Invalid chat stream event');
  return {
    type: 'tool.settled',
    toolCallId,
    toolName,
    result: { ...resultCandidate, ...(pendingApproval === undefined ? {} : { pendingApproval }) },
    ...required,
  };
}

export function decodeRunEvent(
  type: string,
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (type === 'run.completed') return decodeCompletedRun(parsed, required);
  if (type === 'run.error' || type === 'run.tripwire')
    return decodeRunError(type, parsed, required);
  if (type === 'run.aborted') return decodeAbortedRun(parsed, required);
  throw new Error('Invalid chat stream event');
}
function decodeCompletedRun(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (
    !isConversationHistory(parsed['conversation']) ||
    typeof parsed['content'] !== 'string' ||
    !isTokenUsage(parsed['usage']) ||
    typeof parsed['finishReason'] !== 'string'
  )
    throw new Error('Invalid chat stream event');
  return {
    type: 'run.completed',
    conversation: parsed['conversation'],
    content: parsed['content'],
    usage: parsed['usage'],
    finishReason: parsed['finishReason'],
    ...required,
  };
}
function decodeRunError(
  type: 'run.error' | 'run.tripwire',
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  const error = toChatSerializedRunError(parsed['error']);
  if (!error) throw new Error('Invalid chat stream event');
  return { type, error, ...required };
}
function decodeAbortedRun(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (parsed['reason'] !== undefined && typeof parsed['reason'] !== 'string')
    throw new Error('Invalid chat stream event');
  return {
    type: 'run.aborted',
    ...(parsed['reason'] === undefined ? {} : { reason: parsed['reason'] }),
    ...required,
  };
}
