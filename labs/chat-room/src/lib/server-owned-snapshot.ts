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

export const SERVER_OWNED_PERSISTENCE_FAILURE_MESSAGE = 'The turn outcome could not be saved.';

export type ServerOwnedPersistenceFailureHint = {
	source: 'server-owned-persistence';
	userMessageId: string;
	failure: {
		kind: 'generate';
		code: 'UNKNOWN';
		message: typeof SERVER_OWNED_PERSISTENCE_FAILURE_MESSAGE;
		retryable: false;
	};
};

/** Builds the browser-only hint for a failure that could not be persisted. */
export function serverOwnedPersistenceFailureHint(
	userMessageId: string
): ServerOwnedPersistenceFailureHint {
	if (userMessageId.length === 0) throw new Error('A failed user message id is required.');
	return {
		source: 'server-owned-persistence',
		userMessageId,
		failure: {
			kind: 'generate',
			code: 'UNKNOWN',
			message: SERVER_OWNED_PERSISTENCE_FAILURE_MESSAGE,
			retryable: false
		}
	};
}

/** Strictly validates a decoded persistence hint before local overlay use. */
export function parseServerOwnedPersistenceFailureHint(
	value: unknown
): ServerOwnedPersistenceFailureHint | undefined {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	if (Object.keys(record).length !== 3 || record.source !== 'server-owned-persistence')
		return undefined;
	if (typeof record.userMessageId !== 'string' || record.userMessageId.length === 0)
		return undefined;
	if (
		record.failure === null ||
		typeof record.failure !== 'object' ||
		Array.isArray(record.failure)
	)
		return undefined;
	const failure = record.failure as Record<string, unknown>;
	if (
		Object.keys(failure).length !== 4 ||
		failure.kind !== 'generate' ||
		failure.code !== 'UNKNOWN' ||
		failure.message !== SERVER_OWNED_PERSISTENCE_FAILURE_MESSAGE ||
		failure.retryable !== false
	)
		return undefined;
	return serverOwnedPersistenceFailureHint(record.userMessageId);
}
