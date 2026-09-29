import type { ApprovalResolution, ApprovalState } from '@lostgradient/cinder';
import type {
  ChatAdapter,
  ChatCommand,
  ChatToolApprovalResolution,
} from '../adapter/chat-adapter.ts';
import type { Message, MessageInput, ToolAction } from '../conversation-model.ts';
import type { ChatAttachment } from '../input/chat-attachment.ts';

type CommandCallback<T extends unknown[]> = (...args: T) => void | Promise<void>;
type ApprovalResolveCallback = (
  toolCallId: string,
  resolution: ApprovalResolution,
) => void | ChatToolApprovalResolution | Promise<void | ChatToolApprovalResolution>;

type ApprovalOwner = {
  conversationIdentity: string;
  adapter: ChatAdapter | undefined;
  actionFingerprint: string;
};

type CommandActionsOptions = {
  getAdapter: () => ChatAdapter | undefined;
  getMessages: () => Message[];
  getOnAdapterError: () => ((event: { command: ChatCommand; error: unknown }) => void) | undefined;
  getOnSubmit: () =>
    CommandCallback<[{ message: MessageInput; attachments: ChatAttachment[] }]> | undefined;
  getOnRetry: () => CommandCallback<[string]> | undefined;
  getOnEdit: () => CommandCallback<[{ messageId: string; content: string }]> | undefined;
  getOnApprovalResolve: () => ApprovalResolveCallback | undefined;
  getOnStop: () => CommandCallback<[{ messageId: string }]> | undefined;
  invalidateHistory: () => void;
  afterSubmit: (editing: boolean) => void;
  getConversationIdentity: () => string;
};

function removeFromSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

function setApprovalState(
  states: ReadonlyMap<string, ApprovalState>,
  toolCallId: string,
  state: ApprovalState,
): Map<string, ApprovalState> {
  return new Map(states).set(toolCallId, state);
}

function deleteApprovalState(
  states: ReadonlyMap<string, ApprovalState>,
  toolCallId: string,
): Map<string, ApprovalState> {
  const next = new Map(states);
  next.delete(toolCallId);
  return next;
}

function stateForResolution(resolution: ApprovalResolution): ApprovalState {
  if (resolution.decision === 'approve') return 'approved';
  if (resolution.decision === 'approve_with_edits') return 'approved_with_edits';
  if (resolution.decision === 'deny') return 'denied';
  return 'cancelled';
}

function isTerminalApprovalState(state: ApprovalState | undefined): boolean {
  return state !== undefined && state !== 'pending';
}

function findApprovalAction(
  messages: readonly Message[],
  toolCallId: string,
): ToolAction | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const result = messages[index]?.toolResult;
    if (result?.callId === toolCallId && result.outcome === 'action_required') {
      return result.action;
    }
  }
  return undefined;
}

function fingerprintApprovalAction(action: ToolAction | undefined): string | undefined {
  if (action?.type !== 'approval') return undefined;
  try {
    return JSON.stringify(action);
  } catch {
    return undefined;
  }
}

function sameApprovalOwner(a: ApprovalOwner | undefined, b: ApprovalOwner | undefined): boolean {
  return (
    a !== undefined &&
    b !== undefined &&
    a.conversationIdentity === b.conversationIdentity &&
    a.adapter === b.adapter &&
    a.actionFingerprint === b.actionFingerprint
  );
}

function approvalOwnerMapsEqual(
  a: ReadonlyMap<string, ApprovalOwner>,
  b: ReadonlyMap<string, ApprovalOwner>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [toolCallId, owner] of a) {
    if (!sameApprovalOwner(owner, b.get(toolCallId))) return false;
  }
  return true;
}

function approvalExpired(action: ToolAction | undefined): boolean {
  if (action?.type !== 'approval' || action.expiresAt === undefined) return false;
  const timestamp = Date.parse(action.expiresAt);
  return Number.isFinite(timestamp) && Date.now() >= timestamp;
}

/** Owns Chat command routing, retry flights, editing state, and approval rollback. */
export function useChatCommandActions(options: CommandActionsOptions) {
  let approvalStates = $state(new Map<string, ApprovalState>());
  let approvalResolutionInFlightIds = $state(new Set<string>());
  let approvalResolutionFlightTokens = $state(new Map<string, symbol>());
  let approvalOwners = $state(new Map<string, ApprovalOwner>());
  let editingMessageIds = $state(new Set<string>());
  let pendingRetryMessageTokens = $state(new Map<string, symbol>());

  $effect(() => {
    options.getConversationIdentity();
    approvalStates = new Map();
    approvalResolutionInFlightIds = new Set();
    approvalResolutionFlightTokens = new Map();
    approvalOwners = new Map();
    pendingRetryMessageTokens = new Map();
    editingMessageIds = new Set();
  });

  function dispatchCommand(
    command: ChatCommand,
    runAdapterMethod: (adapter: ChatAdapter) => Promise<void> | undefined,
    callback: (() => void | Promise<void>) | undefined,
  ): Promise<void> | void {
    const adapter = options.getAdapter();
    if (adapter) {
      try {
        const run = runAdapterMethod(adapter);
        if (run !== undefined) {
          return run.catch((error: unknown) => {
            options.getOnAdapterError()?.({ command, error });
          });
        }
      } catch (error) {
        options.getOnAdapterError()?.({ command, error });
        return;
      }
    }
    void callback?.();
  }

  $effect(() => {
    const conversationIdentity = options.getConversationIdentity();
    const adapter = options.getAdapter();
    const nextOwners = new Map<string, ApprovalOwner>();

    for (const message of options.getMessages()) {
      const result = message.toolResult;
      if (
        message.role !== 'tool-result' ||
        result?.outcome !== 'action_required' ||
        result.action?.type !== 'approval'
      ) {
        continue;
      }

      const actionFingerprint = fingerprintApprovalAction(result.action);
      if (actionFingerprint === undefined) continue;
      nextOwners.set(result.callId, { conversationIdentity, adapter, actionFingerprint });
    }

    let nextStates = approvalStates;
    let nextInFlightIds = approvalResolutionInFlightIds;
    let nextFlightTokens = approvalResolutionFlightTokens;
    let changed = false;

    for (const [toolCallId, owner] of approvalOwners) {
      if (sameApprovalOwner(owner, nextOwners.get(toolCallId))) continue;
      if (!changed) {
        nextStates = new Map(approvalStates);
        nextInFlightIds = new Set(approvalResolutionInFlightIds);
        nextFlightTokens = new Map(approvalResolutionFlightTokens);
        changed = true;
      }
      nextStates.delete(toolCallId);
      nextInFlightIds.delete(toolCallId);
      nextFlightTokens.delete(toolCallId);
    }

    if (!approvalOwnerMapsEqual(approvalOwners, nextOwners)) {
      approvalOwners = nextOwners;
    }
    if (changed) {
      approvalStates = nextStates;
      approvalResolutionInFlightIds = nextInFlightIds;
      approvalResolutionFlightTokens = nextFlightTokens;
    }
  });

  function handleSubmit(message: MessageInput, attachments: ChatAttachment[]): void {
    options.invalidateHistory();
    const editing = editingMessageIds.size > 0;
    void dispatchCommand(
      'sendMessage',
      (adapter) => Promise.resolve(adapter.sendMessage(message, attachments)),
      () => options.getOnSubmit()?.({ message, attachments }),
    );
    options.afterSubmit(editing);
  }

  function dispatchRetryMessage(messageId: string): void {
    if (pendingRetryMessageTokens.has(messageId)) return;
    const flightToken = Symbol(messageId);
    pendingRetryMessageTokens = new Map(pendingRetryMessageTokens).set(messageId, flightToken);
    const clearPending = (): void => {
      if (pendingRetryMessageTokens.get(messageId) !== flightToken) return;
      const next = new Map(pendingRetryMessageTokens);
      next.delete(messageId);
      pendingRetryMessageTokens = next;
    };
    try {
      let callbackRun: Promise<void> | undefined;
      const run = dispatchCommand(
        'retryMessage',
        (adapter) =>
          adapter.retryMessage ? Promise.resolve(adapter.retryMessage(messageId)) : undefined,
        () => {
          const result = options.getOnRetry()?.(messageId);
          if (result !== undefined) callbackRun = Promise.resolve(result);
        },
      );
      const flight = run ?? callbackRun;
      if (flight !== undefined) void flight.finally(clearPending);
      else clearPending();
    } catch (error) {
      clearPending();
      throw error;
    }
  }

  function handleEdit(event: { messageId: string; content: string }): void {
    void dispatchCommand(
      'editMessage',
      (adapter) => (adapter.editMessage ? Promise.resolve(adapter.editMessage(event)) : undefined),
      () => options.getOnEdit()?.(event),
    );
  }

  function resolveToolApproval(toolCallId: string, resolution: ApprovalResolution): void {
    const callback = options.getOnApprovalResolve();
    const adapter = options.getAdapter();
    const canResolve = callback !== undefined || adapter?.resolveToolApproval !== undefined;
    if (!canResolve) return;
    if (approvalResolutionInFlightIds.has(toolCallId)) return;
    if (isTerminalApprovalState(approvalStates.get(toolCallId))) return;

    const action = findApprovalAction(options.getMessages(), toolCallId);
    const actionFingerprint = fingerprintApprovalAction(action);
    if (actionFingerprint === undefined) return;
    if (approvalExpired(action)) {
      approvalStates = setApprovalState(approvalStates, toolCallId, 'expired');
      return;
    }

    const owner: ApprovalOwner = {
      conversationIdentity: options.getConversationIdentity(),
      adapter,
      actionFingerprint,
    };
    const flightToken = Symbol(toolCallId);
    approvalStates = setApprovalState(approvalStates, toolCallId, 'pending');
    approvalResolutionInFlightIds = new Set([...approvalResolutionInFlightIds, toolCallId]);
    approvalResolutionFlightTokens = new Map(approvalResolutionFlightTokens).set(
      toolCallId,
      flightToken,
    );

    const isCurrentFlight = (): boolean => {
      if (approvalResolutionFlightTokens.get(toolCallId) !== flightToken) return false;
      if (!approvalResolutionInFlightIds.has(toolCallId)) return false;
      const currentAction = findApprovalAction(options.getMessages(), toolCallId);
      const currentFingerprint = fingerprintApprovalAction(currentAction);
      return sameApprovalOwner(
        owner,
        currentFingerprint === undefined
          ? undefined
          : {
              conversationIdentity: options.getConversationIdentity(),
              adapter: options.getAdapter(),
              actionFingerprint: currentFingerprint,
            },
      );
    };

    const clearFlight = (): void => {
      if (!isCurrentFlight()) return;
      approvalResolutionInFlightIds = removeFromSet(approvalResolutionInFlightIds, toolCallId);
      const nextTokens = new Map(approvalResolutionFlightTokens);
      nextTokens.delete(toolCallId);
      approvalResolutionFlightTokens = nextTokens;
    };

    const rollback = (): void => {
      if (!isCurrentFlight()) return;
      approvalStates = deleteApprovalState(approvalStates, toolCallId);
      approvalResolutionInFlightIds = removeFromSet(approvalResolutionInFlightIds, toolCallId);
      const nextTokens = new Map(approvalResolutionFlightTokens);
      nextTokens.delete(toolCallId);
      approvalResolutionFlightTokens = nextTokens;
    };

    const acceptResolution = (acknowledgement: void | ChatToolApprovalResolution): void => {
      if (!isCurrentFlight()) return;
      if (acknowledgement === 'pending') {
        rollback();
        return;
      }
      approvalStates = setApprovalState(approvalStates, toolCallId, stateForResolution(resolution));
      clearFlight();
    };

    const failResolution = (error: unknown): void => {
      if (!isCurrentFlight()) return;
      rollback();
      options.getOnAdapterError()?.({ command: 'resolveToolApproval', error });
    };

    try {
      if (adapter?.resolveToolApproval) {
        void Promise.resolve(adapter.resolveToolApproval(toolCallId, resolution)).then(
          acceptResolution,
          failResolution,
        );
        return;
      }
      void Promise.resolve(callback?.(toolCallId, resolution)).then(
        acceptResolution,
        failResolution,
      );
    } catch (error) {
      failResolution(error);
    }
  }

  function handleStopGenerating(): void {
    const streamingMessage = options
      .getMessages()
      .slice()
      .reverse()
      .find((message) => message.role === 'assistant');
    if (!streamingMessage) return;
    void dispatchCommand(
      'stopGenerating',
      (adapter) =>
        adapter.stopGenerating
          ? Promise.resolve(adapter.stopGenerating(streamingMessage.id))
          : undefined,
      () => options.getOnStop()?.({ messageId: streamingMessage.id }),
    );
  }

  function handleEditingChange(messageId: string, editing: boolean): void {
    const next = new Set(editingMessageIds);
    if (editing) next.add(messageId);
    else next.delete(messageId);
    editingMessageIds = next;
  }

  const canResolveToolApproval = $derived(
    options.getOnApprovalResolve() !== undefined ||
      options.getAdapter()?.resolveToolApproval !== undefined,
  );

  return {
    handleSubmit,
    handleRetry: dispatchRetryMessage,
    handleEdit,
    resolveToolApproval,
    handleStopGenerating,
    handleEditingChange,
    retryMessage: dispatchRetryMessage,
    get canResolveToolApproval() {
      return canResolveToolApproval;
    },
    get isEditing() {
      return editingMessageIds.size > 0;
    },
    get approvalStates() {
      return approvalStates;
    },
    get approvalResolutionInFlightIds() {
      return approvalResolutionInFlightIds;
    },
  };
}
