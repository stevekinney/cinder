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
	// summarized into a single system message, a few recent ones are kept, and
	// anything the preserve policy protects is carried through.
	//
	// "Carried through" is precise here rather than loose: role, content, and
	// metadata survive unchanged — including the `pinned` flag, without which
	// the next compaction would summarize the message away — but the IDS DO
	// NOT. Compaction rebuilds what it keeps, so the projection shares none of
	// the seeded conversation's message ids. Anything keyed to a message id
	// across a compaction boundary is keyed to something that no longer
	// exists. This page seeds a transcript long enough to trigger that, pins
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
		summarizedMessages: number;
		foreignMessages: number;
		carriedVerbatim: number;
		projectionOrder: string;
		inBothBuckets: number;
		inNeitherBucket: number;
		partitionExact: boolean;
		pinnedMetadataSurvives: boolean;
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

		// What actually reached the summarizer, counted by message id rather
		// than by call. Compaction chunks its input, and the chunk sizes are
		// conversationalist's business — asserting them would pin an internal.
		// Distinct ids are the chunking-agnostic measure: they stay the same
		// however the work is divided up.
		//
		// Plain arrays rather than a `Set`: `svelte/prefer-svelte-reactivity`
		// flags a mutable `Set` in a component, and the reactive `SvelteSet`
		// it points to would be the wrong instrument — nothing observes these,
		// they are local accumulators inside one async function. Fourteen
		// messages make the linear scans free.
		const seededIds = before.map((message) => message.id);
		const seenIds: string[] = [];

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
					summarize: async (messages) => {
						for (const message of messages) seenIds.push(message.id);
						return `[summary of ${messages.length} messages]`;
					},
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
		// Counted rather than assumed to be one: the accounting below divides
		// the projection into "injected by compaction" and "carried through
		// from the seed", and hard-coding the first half would make the
		// invariant agree with itself.
		const injectedSummaries = projection.filter((message) =>
			JSON.stringify(message.content).includes('[summary of')
		).length;
		const distinct = (ids: readonly string[]): string[] =>
			ids.filter((id, index) => ids.indexOf(id) === index);
		const summarizedIds = distinct(seenIds.filter((id) => seededIds.includes(id)));
		const foreignIds = distinct(seenIds.filter((id) => !seededIds.includes(id)));

		// The partition proper, sorted into buckets per message rather than
		// inferred from two totals. Adding cardinalities would call it a
		// partition without ever checking one: a compaction that both
		// summarized AND retained one message while dropping another still
		// sums to the seeded length.
		//
		// Matched on role, content, and metadata — which is the whole of what
		// survives. Not by id, and not as an omission for convenience:
		// compaction reassigns ids, so the projection shares none of the
		// seed's and an id comparison finds zero survivors for a projection
		// that carries four messages through. Including `metadata` is the part
		// that matters most: a carried-through message that arrived with
		// `pinned` stripped would look identical by content and then be
		// summarized away on the NEXT compaction.
		const shapeOf = (message: Message): string =>
			JSON.stringify({
				role: message.role,
				content: message.content,
				metadata: message.metadata
			});
		const projectionShapes = projection.map(shapeOf);
		const buckets = before.map((message) => ({
			carried: projectionShapes.includes(shapeOf(message)),
			summarized: summarizedIds.includes(message.id)
		}));
		const carriedVerbatim = buckets.filter((bucket) => bucket.carried).length;
		const inBothBuckets = buckets.filter((bucket) => bucket.carried && bucket.summarized).length;
		const inNeitherBucket = buckets.filter(
			(bucket) => !bucket.carried && !bucket.summarized
		).length;

		// Membership is not enough: swapping the pinned message with a retained
		// recent one leaves every count, shape, and role check identical while
		// handing the model recent context ahead of the older pinned fact.
		// This maps the projection back onto the seed positionally, so the
		// summary's placement and the carried messages' order are both pinned
		// in one readable string.
		const projectionOrder = projection
			.map((message) => {
				const shape = shapeOf(message);
				const seedPosition = before.findIndex((seededMessage) => shapeOf(seededMessage) === shape);
				return seedPosition === -1 ? 'summary' : String(seedPosition);
			})
			.join(', ');

		const pinnedInProjection = projection.find((message) =>
			JSON.stringify(message.content).includes(PINNED_FACT)
		);
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
			projectionHasSummary: injectedSummaries > 0,
			projectionRoles: projection.map((message) => message.role).join(', '),
			summarizedMessages: summarizedIds.length,
			// Anything the summarizer saw that this page did not seed — a
			// previous summary folded back in, say.
			foreignMessages: foreignIds.length,
			carriedVerbatim,
			projectionOrder,
			inBothBuckets,
			inNeitherBucket,
			// Every seeded message is in exactly one bucket, and the two
			// buckets plus the injected summary account for the whole
			// projection. That is the claim; the counts above are how a
			// failure gets read.
			partitionExact:
				inBothBuckets === 0 &&
				inNeitherBucket === 0 &&
				carriedVerbatim + summarizedIds.length === before.length &&
				carriedVerbatim + injectedSummaries === projection.length,
			// The reason `metadata` is in the shape above, stated on its own
			// so a failure names the cause rather than a shape mismatch.
			pinnedMetadataSurvives: pinnedInProjection?.metadata?.pinned === true
		};
	}

	const observation = observe();
</script>

<main>
	<h1>Context management — compaction</h1>
	<p>
		The model sees a summarized projection; the page keeps the whole transcript. The pinned fact
		crosses that boundary because the preserve policy carries it; the first follow-up does not. What
		crosses does so unchanged in role, content, and metadata — but not in identity: compaction
		reassigns message ids, so nothing keyed to one survives the boundary.
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
				<dt>messages handed to <code>summarize</code></dt>
				<dd data-testid="compaction-summarized-messages">{result.summarizedMessages}</dd>
				<dt>of those, not from the seed</dt>
				<dd data-testid="compaction-foreign-messages">{result.foreignMessages}</dd>
				<dt>carried through unchanged (role, content, metadata)</dt>
				<dd data-testid="compaction-carried-unchanged">{result.carriedVerbatim}</dd>
				<dt>projection, mapped back to seed positions</dt>
				<dd data-testid="compaction-projection-order">{result.projectionOrder}</dd>
				<dt>in both buckets / in neither</dt>
				<dd data-testid="compaction-bucket-overlap">
					{result.inBothBuckets} / {result.inNeitherBucket}
				</dd>
				<dt>exact partition</dt>
				<dd data-testid="compaction-partition">{result.partitionExact}</dd>
				<dt><code>pinned</code> metadata survives</dt>
				<dd data-testid="compaction-pinned-metadata">{result.pinnedMetadataSurvives}</dd>
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
