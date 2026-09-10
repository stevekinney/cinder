<script lang="ts">
	import { createAgent, createContextCompactor } from '@lostgradient/operative';
	import {
		appendAssistantMessage,
		appendSystemMessage,
		appendUserMessage,
		createConversationHistory,
		getMessages,
		type ConversationHistory,
		type Message
	} from 'conversationalist';
	import { createToolbox } from 'armorer';

	// Context compaction, and what it does NOT touch.
	//
	// Compaction rewrites the conversation the MODEL sees: older messages are
	// summarized into a single system message, a few recent ones are kept
	// verbatim, and anything the preserve policy protects is carried through
	// whole. This page seeds a transcript long enough to trigger that, pins
	// one fact inside the part that gets summarized away, and shows the
	// projection the first generate call actually received.
	//
	// The second half is the part worth internalizing: the page's own
	// transcript is untouched. `agent.run({ conversation })` SNAPSHOTS the
	// `ConversationHistory` it is handed — it clones it before wrapping it in
	// the run's internal `Conversation` — so compaction, and every other
	// mutation the loop makes, lands on the run's copy. A host that keeps
	// rendering its own history across turns never sees its transcript
	// silently rewritten underneath it.
	//
	// Everything is local: `summarize` is a function that counts messages.
	// The point of compaction is the reshaping, not the summary text, and a
	// deterministic stand-in makes the reshaping assertable.

	const PINNED_FACT = 'The deployment key rotates every 90 days.';
	const FIRST_FILLER_QUESTION = 'What did we decide about the staging bucket?';
	const FILLER_BODY =
		'Context that exists only to push this transcript past the token budget. '.repeat(4);

	function seedTranscript(): ConversationHistory {
		let conversation = createConversationHistory({ id: 'exercise-compaction' });
		conversation = appendSystemMessage(conversation, 'You are a release assistant.');
		// `pinned: true` is what the preserve policy reads. Without it this
		// message sits in the middle of the summarized range and would be
		// paraphrased away with the rest.
		conversation = appendUserMessage(conversation, PINNED_FACT, { pinned: true });
		conversation = appendUserMessage(conversation, FIRST_FILLER_QUESTION);
		conversation = appendAssistantMessage(conversation, `We kept it. ${FILLER_BODY}`);
		for (let index = 0; index < 5; index += 1) {
			conversation = appendUserMessage(conversation, `Follow-up ${index}. ${FILLER_BODY}`);
			conversation = appendAssistantMessage(conversation, `Answer ${index}. ${FILLER_BODY}`);
		}
		return conversation;
	}

	const seeded = seedTranscript();

	const contains = (messages: readonly Message[], needle: string): boolean =>
		messages.some((message) => JSON.stringify(message.content).includes(needle));

	type Observation = {
		seededLengthBefore: number;
		seededLengthAfter: number;
		seededIdentical: boolean;
		seededControlIdentical: boolean;
		projectionDiffers: boolean;
		seededHasPin: boolean;
		seededHasFirstFiller: boolean;
		projectionLength: number;
		projectionHasPin: boolean;
		projectionHasFirstFiller: boolean;
		projectionHasSummary: boolean;
		projectionRoles: string;
	};

	/**
	 * A complete serialization of every message, used to answer "was ANY of
	 * this rewritten?" rather than the narrower questions the individual
	 * fields answer. Counting messages and looking for two strings would stay
	 * green against a rewrite that preserved the length and those strings —
	 * stripped `pinned` metadata, reordered messages, edited a message this
	 * page never looks at.
	 */
	const snapshot = (messages: readonly Message[]): string => JSON.stringify(messages);

	async function observe(): Promise<Observation> {
		const before = getMessages(seeded);
		const beforeSnapshot = snapshot(before);
		// Positive control, taken before anything runs: two reads of an
		// untouched history must already agree. Without it, "identical after
		// the run" could just mean the serialization is insensitive to
		// everything.
		const controlSnapshot = snapshot(getMessages(seeded));

		let projection: readonly Message[] = [];
		const agent = createAgent({
			generate: async (context) => {
				// The model-visible projection, read at the only moment it
				// exists as such: inside the generate call, after the loop has
				// applied compaction for this step.
				projection = context.conversation.getMessages();
				return { content: 'Understood.', toolCalls: [] };
			},
			toolbox: createToolbox([]),
			contextManagement: {
				maxTokens: 400,
				onCompact: createContextCompactor({
					summarize: async (messages) => `[summary of ${messages.length} messages]`,
					retainRecentMessages: 2
				})
			}
		});
		await agent.run({ conversation: seeded }).result();

		// Compared by CONTENT, never by object identity: `getMessages` builds
		// a fresh array on every call, so `after === before` is false for a
		// transcript nothing touched. The count and the message text are what
		// actually answer "was this rewritten?".
		const after = getMessages(seeded);
		return {
			seededLengthBefore: before.length,
			seededLengthAfter: after.length,
			seededIdentical: snapshot(after) === beforeSnapshot,
			seededControlIdentical: controlSnapshot === beforeSnapshot,
			// Negative control: the projection IS a rewrite of the same
			// transcript, so the comparison above must call it different. A
			// comparison that returned "identical" for everything would pass
			// the line above and fail this one.
			projectionDiffers: snapshot(projection) !== beforeSnapshot,
			seededHasPin: contains(after, PINNED_FACT),
			seededHasFirstFiller: contains(after, FIRST_FILLER_QUESTION),
			projectionLength: projection.length,
			projectionHasPin: contains(projection, PINNED_FACT),
			projectionHasFirstFiller: contains(projection, FIRST_FILLER_QUESTION),
			projectionHasSummary: contains(projection, '[summary of'),
			projectionRoles: projection.map((message) => message.role).join(', ')
		};
	}

	const observation = observe();
</script>

<main>
	<h1>Context management — compaction</h1>
	<p>
		The model sees a summarized projection; the page keeps the whole transcript. The pinned fact
		crosses that boundary because the preserve policy carries it; the first follow-up does not.
	</p>

	<section data-testid="compaction" aria-live="polite">
		{#await observation}
			<p data-testid="compaction-pending">Running…</p>
		{:then result}
			<h2>What the model saw</h2>
			<dl>
				<dt>projection length</dt>
				<dd data-testid="compaction-projection-length">{result.projectionLength}</dd>
				<dt>projection roles</dt>
				<dd data-testid="compaction-projection-roles">{result.projectionRoles}</dd>
				<dt>summary injected</dt>
				<dd data-testid="compaction-projection-summary">{result.projectionHasSummary}</dd>
				<dt>pinned fact present</dt>
				<dd data-testid="compaction-projection-pin">{result.projectionHasPin}</dd>
				<dt>first follow-up present</dt>
				<dd data-testid="compaction-projection-filler">{result.projectionHasFirstFiller}</dd>
			</dl>

			<h2>What this page still holds</h2>
			<dl>
				<dt>length before the run</dt>
				<dd data-testid="compaction-seeded-length-before">{result.seededLengthBefore}</dd>
				<dt>length after the run</dt>
				<dd data-testid="compaction-seeded-length-after">{result.seededLengthAfter}</dd>
				<dt>every message byte-identical</dt>
				<dd data-testid="compaction-seeded-identical">{result.seededIdentical}</dd>
				<dt>control: two reads agree</dt>
				<dd data-testid="compaction-seeded-control">{result.seededControlIdentical}</dd>
				<dt>control: projection differs</dt>
				<dd data-testid="compaction-projection-differs">{result.projectionDiffers}</dd>
				<dt>pinned fact present</dt>
				<dd data-testid="compaction-seeded-pin">{result.seededHasPin}</dd>
				<dt>first follow-up present</dt>
				<dd data-testid="compaction-seeded-filler">{result.seededHasFirstFiller}</dd>
			</dl>
		{/await}
	</section>
</main>

<style>
	main {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 1rem;
		margin: 0;
	}

	dt {
		font-weight: 600;
	}

	dd {
		margin: 0;
		font-family: monospace;
	}
</style>
