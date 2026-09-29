import type { ApprovalState } from '@lostgradient/cinder';
import type { ChatAnnounceLevel } from '../chat.types.ts';
import type { Message } from '../conversation-model.ts';
import type { ChatRenderRow } from './use-chat-message-groups.svelte.ts';

type AnnouncementOptions = {
  getMessages: () => Message[];
  getRenderRows: () => ChatRenderRow[];
  getConversationId: () => string;
  getApprovalStates: () => ReadonlyMap<string, ApprovalState>;
  getHistoryAnnouncement: () => string;
  getUnreadAnnouncement: () => string;
};

export interface UseChatAnnouncementsReturn {
  readonly assertiveAnnouncement: string;
  readonly politeAnnouncement: string;
  announce(message: string, level?: ChatAnnounceLevel): void;
  clearAnnouncements(): void;
}

type ToolStatus = { name: string; status: string };
const CONSUMER_ANNOUNCEMENT_CLEAR_DELAY_MS = 1000;

function visibleToolCallIds(renderRows: readonly ChatRenderRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of renderRows) {
    if (row.type === 'tool-call-group') {
      for (const message of row.messages) ids.add(message.id);
    } else if (row.type === 'message' && row.message.role === 'tool-call') {
      ids.add(row.message.id);
    }
  }
  return ids;
}

function recordToolCall(
  message: Message,
  visibleIds: ReadonlySet<string>,
  statuses: Map<string, ToolStatus>,
  callOccurrences: Map<string, string[]>,
): void {
  if (message.role !== 'tool-call' || !message.toolCall || !visibleIds.has(message.id)) return;
  const occurrences = callOccurrences.get(message.toolCall.id) ?? [];
  occurrences.push(message.id);
  callOccurrences.set(message.toolCall.id, occurrences);
  statuses.set(message.id, { name: message.toolCall.name, status: 'pending' });
}

function recordToolResult(
  message: Message,
  statuses: Map<string, ToolStatus>,
  callOccurrences: ReadonlyMap<string, string[]>,
): void {
  if (message.role !== 'tool-result' || !message.toolResult) return;
  const occurrenceId = callOccurrences.get(message.toolResult.callId)?.at(-1);
  if (!occurrenceId) return;
  const previous = statuses.get(occurrenceId);
  statuses.set(occurrenceId, {
    name: previous?.name ?? 'Tool call',
    status: message.toolResult.outcome,
  });
}

function collectToolStatuses(
  messages: readonly Message[],
  visibleIds: ReadonlySet<string>,
): Map<string, ToolStatus> {
  const statuses = new Map<string, ToolStatus>();
  const callOccurrences = new Map<string, string[]>();
  for (const message of messages) {
    recordToolCall(message, visibleIds, statuses, callOccurrences);
    recordToolResult(message, statuses, callOccurrences);
  }
  return statuses;
}

function describeStatusTransition(previous: ToolStatus | undefined, current: ToolStatus): string {
  if (!previous || previous.status === current.status || current.status === 'action_required') {
    return '';
  }
  const statusLabel =
    current.status === 'success'
      ? 'complete'
      : current.status === 'error'
        ? 'failed'
        : current.status;
  return `${current.name} ${statusLabel}`;
}

function statusAnnouncement(
  previous: ReadonlyMap<string, ToolStatus>,
  current: ReadonlyMap<string, ToolStatus>,
): string {
  const announcements: string[] = [];
  for (const [callId, status] of current) {
    const transition = describeStatusTransition(previous.get(callId), status);
    if (transition) announcements.push(transition);
  }
  return announcements.join('. ');
}

export function useChatAnnouncements(options: AnnouncementOptions): UseChatAnnouncementsReturn {
  let consumerPoliteAnnouncement = $state('');
  let consumerAssertiveAnnouncement = $state('');
  let consumerPoliteAnnouncementTimeout: ReturnType<typeof setTimeout> | undefined;
  let consumerAssertiveAnnouncementTimeout: ReturnType<typeof setTimeout> | undefined;
  let observedConversationId: string | undefined;
  let hasObservedToolStatuses = false;
  let previousToolStatuses = new Map<string, ToolStatus>();

  const clearConsumerPoliteAnnouncement = (): void => {
    clearTimeout(consumerPoliteAnnouncementTimeout);
    consumerPoliteAnnouncementTimeout = undefined;
    consumerPoliteAnnouncement = '';
  };
  const clearConsumerAssertiveAnnouncement = (): void => {
    clearTimeout(consumerAssertiveAnnouncementTimeout);
    consumerAssertiveAnnouncementTimeout = undefined;
    consumerAssertiveAnnouncement = '';
  };
  const clearAnnouncements = (): void => {
    clearConsumerPoliteAnnouncement();
    clearConsumerAssertiveAnnouncement();
  };
  const setConsumerPoliteAnnouncement = (message: string): void => {
    clearTimeout(consumerPoliteAnnouncementTimeout);
    consumerPoliteAnnouncement = message;
    consumerPoliteAnnouncementTimeout = setTimeout(() => {
      if (consumerPoliteAnnouncement === message) consumerPoliteAnnouncement = '';
      consumerPoliteAnnouncementTimeout = undefined;
    }, CONSUMER_ANNOUNCEMENT_CLEAR_DELAY_MS);
  };
  const setConsumerAssertiveAnnouncement = (message: string): void => {
    clearTimeout(consumerAssertiveAnnouncementTimeout);
    consumerAssertiveAnnouncement = message;
    consumerAssertiveAnnouncementTimeout = setTimeout(() => {
      if (consumerAssertiveAnnouncement === message) consumerAssertiveAnnouncement = '';
      consumerAssertiveAnnouncementTimeout = undefined;
    }, CONSUMER_ANNOUNCEMENT_CLEAR_DELAY_MS);
  };

  const toolApprovalAssertiveMessage = $derived.by(() => {
    for (const message of options.getMessages()) {
      if (
        message.role === 'tool-result' &&
        message.toolResult?.outcome === 'action_required' &&
        message.toolResult.action
      ) {
        const approvalState = options.getApprovalStates().get(message.toolResult.callId);
        if (approvalState !== undefined && approvalState !== 'pending') continue;
        if (message.toolResult.action.type !== 'approval') continue;
        const actionMessage =
          message.toolResult.action.message ??
          'This tool call requires your approval before it can continue.';
        return `Action required: ${actionMessage}`;
      }
    }
    return '';
  });

  $effect(() => {
    const conversationId = options.getConversationId();
    const visibleIds = visibleToolCallIds(options.getRenderRows());
    const currentStatuses = collectToolStatuses(options.getMessages(), visibleIds);
    if (conversationId !== observedConversationId) {
      hasObservedToolStatuses = false;
      observedConversationId = conversationId;
    }
    if (hasObservedToolStatuses) {
      const announcement = statusAnnouncement(previousToolStatuses, currentStatuses);
      if (announcement) setConsumerPoliteAnnouncement(announcement);
    }
    previousToolStatuses = currentStatuses;
    hasObservedToolStatuses = true;
  });

  const assertiveAnnouncement = $derived(
    toolApprovalAssertiveMessage || consumerAssertiveAnnouncement,
  );
  const politeAnnouncement = $derived(
    consumerPoliteAnnouncement ||
      options.getHistoryAnnouncement() ||
      options.getUnreadAnnouncement(),
  );

  $effect(() => {
    if (toolApprovalAssertiveMessage && consumerAssertiveAnnouncement) {
      clearConsumerAssertiveAnnouncement();
    }
  });

  const announce = (message: string, level: ChatAnnounceLevel = 'polite'): void => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    if (level === 'assertive') {
      if (toolApprovalAssertiveMessage) return;
      setConsumerAssertiveAnnouncement(trimmedMessage);
      return;
    }
    setConsumerPoliteAnnouncement(trimmedMessage);
  };

  return {
    get assertiveAnnouncement() {
      return assertiveAnnouncement;
    },
    get politeAnnouncement() {
      return politeAnnouncement;
    },
    announce,
    clearAnnouncements,
  };
}
