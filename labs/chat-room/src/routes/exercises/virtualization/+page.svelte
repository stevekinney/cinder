<script lang="ts">
	import {
		Chat,
		appendMessages,
		appendStreamingMessage,
		createConversationHistory,
		finalizeStreamingMessage,
		prependMessages,
		updateStreamingMessage,
		type ConversationHistory,
		type MessageInput
	} from '@lostgradient/chat';

	// Large enough that a naive full render would put 500+ rows in the DOM at
	// once; the assertion in the e2e test is that virtualization keeps the
	// live DOM row count far below this number while every message — first,
	// last, and everything between — stays reachable via the imperative
	// scroll API.
	const SEED_COUNT = 500;

	// Planted well outside the initial bottom-anchored render window (which
	// sits near index 499) so the search e2e test proves the virtualizer
	// scrolls an unmounted row into the DOM rather than merely finding text
	// that was already rendered. Kept as a suffix on the normal "Message N"
	// content so index-adjacency assertions elsewhere still match it.
	const SEARCH_NEEDLE_INDEX = 50;
	const SEARCH_NEEDLE_TERM = 'gronkle-marker-50';

	const STREAM_TOKENS = ['Streamed ', 'reply ', 'into ', 'the ', 'virtualized ', 'transcript.'];

	function seedConversation(): ConversationHistory {
		const seedInputs: MessageInput[] = [];
		for (let index = 0; index < SEED_COUNT; index += 1) {
			seedInputs.push({
				role: index % 2 === 0 ? 'user' : 'assistant',
				content:
					index === SEARCH_NEEDLE_INDEX
						? `Message ${index} ${SEARCH_NEEDLE_TERM}`
						: `Message ${index}`
			});
		}
		return appendMessages(createConversationHistory({ id: 'virtualization-demo' }), ...seedInputs);
	}

	// Plain `let`: only read via `chat?.method()` calls, never reactively.
	let chat: ReturnType<typeof Chat> | undefined;

	let conversation = $state<ConversationHistory>(seedConversation());
	let streaming = $state(false);

	// Not `$state`: this exercise always runs virtualized — only the tuning
	// knobs below are reactive.
	const virtualized = true;
	let virtualizationEstimatedRowHeight = $state(88);
	let virtualizationOverscan = $state(3);
	let virtualizationInitialHeight = $state(640);

	// The streaming builders need a plain object, not a Svelte proxy — passing
	// the proxy through breaks their internal structuredClone.
	function snapshot(): ConversationHistory {
		return $state.snapshot(conversation);
	}

	/**
	 * Streams a new assistant message, token by token, into the already-seeded
	 * 500-message transcript — exercising that the virtualized render path
	 * keeps working (new row appears, autoscrolls, finalizes) once the
	 * transcript is windowed rather than fully mounted.
	 */
	async function streamNewMessage(): Promise<void> {
		streaming = true;
		try {
			const { conversation: withPlaceholder, messageId } = appendStreamingMessage(
				snapshot(),
				'assistant'
			);
			conversation = withPlaceholder;
			chat?.beginStreaming(messageId);

			let buffer = '';
			for (const token of STREAM_TOKENS) {
				await new Promise((resolve) => setTimeout(resolve, 10));
				buffer += token;
				conversation = updateStreamingMessage(snapshot(), messageId, buffer);
				chat?.pushToken(token);
			}

			conversation = finalizeStreamingMessage(snapshot(), messageId);
		} finally {
			chat?.endStreaming();
			streaming = false;
		}
	}

	// Batch counters for the prepend/append interleaving exercise. Each
	// batch/append gets its own monotonically increasing label so the e2e
	// test can spot-check ordering ("Older batch 0-4" is immediately older
	// than the original "Message 0", "Live append 1" immediately newer than
	// the original last message) without depending on exact indices.
	const PREPEND_BATCH_SIZE = 5;
	let prependBatchCount = $state(0);
	let appendCount = $state(0);

	function prependOlderBatch(): void {
		const batch: MessageInput[] = [];
		for (let index = 0; index < PREPEND_BATCH_SIZE; index += 1) {
			batch.push({
				role: index % 2 === 0 ? 'user' : 'assistant',
				content: `Older batch ${prependBatchCount}-${index}`
			});
		}
		conversation = prependMessages(conversation, ...batch);
		prependBatchCount += 1;
	}

	function appendLiveMessage(): void {
		appendCount += 1;
		conversation = appendMessages(conversation, {
			role: 'assistant',
			content: `Live append ${appendCount}`
		});
	}
</script>

<div style="height: 100dvh; display: flex; flex-direction: column; gap: 0.5rem;">
	<div
		style="padding: 0.5rem 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; border-bottom: 1px solid var(--cinder-border);"
	>
		<label>
			virtualizationEstimatedRowHeight
			<input
				type="number"
				bind:value={virtualizationEstimatedRowHeight}
				data-testid="virtualization-row-height"
			/>
		</label>
		<label>
			virtualizationOverscan
			<input
				type="number"
				bind:value={virtualizationOverscan}
				data-testid="virtualization-overscan"
			/>
		</label>
		<label>
			virtualizationInitialHeight
			<input
				type="number"
				bind:value={virtualizationInitialHeight}
				data-testid="virtualization-initial-height"
			/>
		</label>

		<button
			type="button"
			onclick={() => chat?.scrollToTop()}
			data-testid="virtualization-scroll-top"
		>
			Scroll to top
		</button>
		<button
			type="button"
			onclick={() => chat?.scrollToBottom()}
			data-testid="virtualization-scroll-bottom"
		>
			Scroll to bottom
		</button>
		<button
			type="button"
			onclick={streamNewMessage}
			disabled={streaming}
			data-testid="virtualization-stream-message"
		>
			Stream new message
		</button>
		<button type="button" onclick={prependOlderBatch} data-testid="virtualization-prepend-older">
			Prepend older batch
		</button>
		<button type="button" onclick={appendLiveMessage} data-testid="virtualization-append-live">
			Append live message
		</button>
	</div>

	<dl
		style="display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; padding: 0 1rem; margin: 0;"
		data-testid="virtualization-status"
	>
		<div>
			<dt style="display:inline;">messageCount:</dt>
			<dd style="display:inline; margin:0;" data-testid="virtualization-message-count">
				{conversation.ids.length}
			</dd>
		</div>
	</dl>

	<div style="flex: 1; min-height: 0;">
		<Chat
			bind:this={chat}
			id="virtualization-demo-chat"
			{conversation}
			{streaming}
			{virtualized}
			{virtualizationEstimatedRowHeight}
			{virtualizationOverscan}
			{virtualizationInitialHeight}
		/>
	</div>
</div>
