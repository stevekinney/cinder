import { expect, test } from 'bun:test';
import { appendUserMessage, createConversationHistory, getMessages } from '@lostgradient/chat';

import { withUnsavedFailures } from './server-owned-failure-overlay';
import { serverOwnedPersistenceFailureHint } from './server-owned-snapshot';

test('unsaved failures follow canonical IDs without duplicating a later completed transcript', () => {
	const local = appendUserMessage(createConversationHistory(), 'The same text');
	const message = getMessages(local)[0]!;
	const canonical = appendUserMessage(createConversationHistory(), 'The same text');
	const authoritativeId = canonical.ids[0]!;
	const overlays = {
		[authoritativeId]: {
			clientId: message.id,
			message,
			failure: serverOwnedPersistenceFailureHint(authoritativeId).failure
		}
	};
	const later = appendUserMessage(canonical, 'The same text');
	const reconciled = withUnsavedFailures(later, overlays);
	expect(reconciled.ids).toEqual(later.ids);
	expect(reconciled.messages[message.id]).toBeUndefined();
	expect(reconciled.messages[authoritativeId]?.metadata?._deliveryStatus).toBe('failed');
	expect(reconciled.messages[later.ids[1]!]!.metadata?._deliveryStatus).not.toBe('failed');

	// A subsequent snapshot without either ID still has the captured row.
	const retained = withUnsavedFailures(createConversationHistory(), overlays);
	expect(retained.ids).toEqual([message.id]);
	expect(retained.messages[message.id]?.content).toBe('The same text');
	expect(retained.messages[message.id]?.metadata?._deliveryStatus).toBe('failed');
	expect(withUnsavedFailures(retained, overlays).ids).toEqual([message.id]);
});
