import { markMessageDeliveryFailed, type ConversationHistory } from '@lostgradient/chat';

import type { ServerOwnedConversationSnapshot } from './server-owned-snapshot';

export type UnsavedFailure = {
	clientId: string;
	message: NonNullable<ConversationHistory['messages'][string]>;
	failure: ServerOwnedConversationSnapshot['turnFailures'][string];
};

/** Reapplies local persistence failures when the controller replaces its mirror. */
export function withUnsavedFailures(
	history: ConversationHistory,
	unsavedFailures: Record<string, UnsavedFailure>
): ConversationHistory {
	let next = history;
	for (const [authoritativeId, unsaved] of Object.entries(unsavedFailures)) {
		if (
			next.messages[unsaved.clientId] === undefined &&
			next.messages[authoritativeId] === undefined
		) {
			next = {
				...next,
				ids: [...next.ids, unsaved.clientId],
				messages: { ...next.messages, [unsaved.clientId]: unsaved.message }
			};
		}
		next = markMessageDeliveryFailed(
			next,
			next.messages[authoritativeId] === undefined ? unsaved.clientId : authoritativeId
		);
	}
	return next;
}
