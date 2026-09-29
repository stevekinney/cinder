import type { ChatStreamEvent } from './stream-event-codec-types.ts';

type StreamEvent = Extract<ChatStreamEvent, { type: `stream:${string}` }>;
type ToolEvent = Extract<ChatStreamEvent, { type: `tool.${string}` }>;
type RunEvent = Extract<ChatStreamEvent, { type: `run.${string}` }>;
type AssistantStepEvent = Extract<ChatStreamEvent, { type: `assistant.step.${string}` }>;
type ElicitationEvent = Extract<ChatStreamEvent, { type: `elicitation.${string}` }>;

export function isAssistantStepEvent(event: ChatStreamEvent): event is AssistantStepEvent {
  return event.type === 'assistant.step.started' || event.type === 'assistant.step.completed';
}

export function isElicitationEvent(event: ChatStreamEvent): event is ElicitationEvent {
  return event.type === 'elicitation.requested' || event.type === 'elicitation.resolved';
}

export function isStreamEvent(event: ChatStreamEvent): event is StreamEvent {
  return (
    event.type === 'stream:block-start' ||
    event.type === 'stream:block-delta' ||
    event.type === 'stream:block-complete' ||
    event.type === 'stream:text-delta' ||
    event.type === 'stream:tool-call-start' ||
    event.type === 'stream:tool-call-delta' ||
    event.type === 'stream:tool-call-complete' ||
    event.type === 'stream:usage' ||
    event.type === 'stream:complete' ||
    event.type === 'stream:error'
  );
}

export function isToolEvent(event: ChatStreamEvent): event is ToolEvent {
  return (
    event.type === 'tool.started' ||
    event.type === 'tool.progress' ||
    event.type === 'tool.settled' ||
    event.type === 'tool.error' ||
    event.type === 'tool.policy-denied'
  );
}

export function isRunEvent(event: ChatStreamEvent): event is RunEvent {
  return (
    event.type === 'run.completed' ||
    event.type === 'run.error' ||
    event.type === 'run.tripwire' ||
    event.type === 'run.aborted'
  );
}

export function isBlockStreamEvent(
  event: StreamEvent,
): event is Extract<
  StreamEvent,
  { type: 'stream:block-start' | 'stream:block-delta' | 'stream:block-complete' }
> {
  return (
    event.type === 'stream:block-start' ||
    event.type === 'stream:block-delta' ||
    event.type === 'stream:block-complete'
  );
}

export function isTextStreamEvent(event: StreamEvent): event is Exclude<
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
> {
  return (
    event.type === 'stream:text-delta' ||
    event.type === 'stream:tool-call-start' ||
    event.type === 'stream:tool-call-delta' ||
    event.type === 'stream:tool-call-complete'
  );
}

export function isStateStreamEvent(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: 'stream:usage' | 'stream:complete' }> {
  return event.type === 'stream:usage' || event.type === 'stream:complete';
}
