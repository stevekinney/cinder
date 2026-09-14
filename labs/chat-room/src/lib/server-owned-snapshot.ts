import type { ChatSerializedRunError, ConversationHistory } from '@lostgradient/chat';

/** The browser-safe projection persisted by the server-owned conversation route. */
export type ServerOwnedConversationSnapshot = {
	id: string;
	title: string;
	conversation: ConversationHistory;
	turnFailures: Record<string, ServerOwnedTurnFailure>;
};

/** Redacted classified failure persisted by the server-owned session. */
export type ServerOwnedTurnFailure = Omit<ChatSerializedRunError, 'name'>;
