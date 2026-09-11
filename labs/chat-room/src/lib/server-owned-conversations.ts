import { createAgentSession } from '@lostgradient/operative';
import type { AgentSession } from '@lostgradient/operative';
import { appendUserMessage, createConversationHistory, getMessages } from '@lostgradient/chat';

import { serverOwnedRuntime } from './server-owned-runtime.ts';

/** The agent identity every conversation in this variant is filed under. */
export const AGENT_NAME = 'chat-room-server-owned';

/**
 * What the conversation list renders. Deliberately narrower than
 * `SessionSummary`: the list needs a title and a size, and widening it later
 * is easier than discovering something downstream depends on a field the
 * store stopped providing.
 */
export type ConversationSummary = {
	id: string;
	title: string;
	messageCount: number;
	updatedAt: string;
};

function titleOf(metadata: AgentSession['metadata']): string {
	const title = metadata?.title;
	return typeof title === 'string' && title.length > 0 ? title : 'Untitled conversation';
}

/**
 * Creates an empty conversation and returns its list entry.
 *
 * The title lives in session `metadata`, which `createAgentSession` accepts
 * directly — no parallel title store, and nothing to keep in step with the
 * sessions themselves.
 */
export async function createConversation(title: string): Promise<ConversationSummary> {
	const { sessions } = serverOwnedRuntime();
	const session = createAgentSession({
		agentName: AGENT_NAME,
		conversationHistory: createConversationHistory({ id: crypto.randomUUID() }),
		metadata: { title }
	});
	await sessions.save(session);
	return {
		id: session.id,
		title,
		messageCount: 0,
		updatedAt: session.updatedAt
	};
}

/**
 * The conversation list, newest first.
 *
 * Driven by `SessionStore.list()` rather than a parallel index the host
 * maintains alongside it. That is AB-30's whole point: `list()` returns
 * conversation-list-shaped summaries with deterministic tie ordering, so a
 * second index would be a copy that can only drift from the store it copies.
 *
 * "Deterministic tie ordering" is not the same as "creation order", and the
 * difference is observable: two sessions saved inside one millisecond share
 * an `updatedAt`, and the tie falls back to key order, which is unrelated to
 * which was created first. Anything that needs creation order has to carry
 * it, not infer it from the list.
 */
export async function listConversations(): Promise<ConversationSummary[]> {
	const { sessions } = serverOwnedRuntime();
	const summaries = await sessions.list({
		agentName: AGENT_NAME,
		// Stated rather than inherited. The default IS newest-first by
		// `updatedAt`, but relying on a default the store does not document
		// as part of its contract means a change there becomes a silent
		// reordering here.
		//
		// Note the field is `sortOrder`, not `order` — passing `order` is
		// accepted and ignored, so a typo here degrades to the default
		// silently rather than failing.
		sortBy: 'updatedAt',
		sortOrder: 'desc'
	});
	return summaries.map((summary) => ({
		id: summary.id,
		title: titleOf(summary.metadata),
		messageCount: summary.messageCount,
		updatedAt: summary.updatedAt
	}));
}

/** Loads one conversation's full session, or `undefined` when it is gone. */
export async function loadConversation(id: string): Promise<AgentSession | undefined> {
	const { sessions } = serverOwnedRuntime();
	return sessions.load(id);
}

/**
 * Appends a user turn to a conversation.
 *
 * Through `update()` rather than load-then-`save()`, because `update()` is
 * the store's read-modify-write API and does not depend on merge semantics
 * being favourable.
 *
 * Worth stating precisely, because the obvious justification is wrong:
 * load-then-`save()` does NOT lose a concurrent turn here. `save()` merges on
 * optimistic-concurrency conflict, and that merge keeps both histories — the
 * sibling spec measures exactly that, having been written to demonstrate the
 * opposite and failed. So this is a choice about expressing intent directly,
 * not a correctness fix, and the spec records the measurement so nobody
 * re-derives a scarier story than the one the store actually tells.
 *
 * Returns `undefined` when the conversation does not exist, leaving the
 * caller to distinguish "gone" from "empty" — an absent session and one with
 * no messages are different states and the route renders them differently.
 */
export async function appendUserTurn(id: string, text: string): Promise<AgentSession | undefined> {
	const { sessions } = serverOwnedRuntime();
	return sessions.update(id, (session) => {
		if (session === undefined) return undefined;
		return {
			...session,
			conversationHistory: appendUserMessage(session.conversationHistory, text)
		};
	});
}

/** Message count for one conversation, for assertions and the list fallback. */
export function messageCountOf(session: AgentSession): number {
	return getMessages(session.conversationHistory).length;
}
