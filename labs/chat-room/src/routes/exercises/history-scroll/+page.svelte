<script lang="ts">
	import {
		Chat,
		DEFAULT_SCROLL_CONFIGURATION,
		appendMessages,
		createConversationHistory,
		prependMessages,
		type ChatAdapter,
		type ChatAdapterErrorEvent,
		type ChatScrollStateChangeEvent,
		type ChatUnreadIndicatorChangeEvent,
		type ConversationHistory,
		type MessageRole
	} from '@lostgradient/chat';

	// Minimal local stand-in for `MessageInput` — the exercise only ever
	// prepends plain text messages, so there is no need to pull in the wider
	// (multi-modal) content union just to satisfy a type.
	type ArchivedMessageInput = { role: MessageRole; content: string };

	// Deliberately large and verbose: the scroll-state assertions depend on
	// the transcript overflowing the viewport (`isAtBottom` treats a
	// non-overflowing transcript as always "at bottom", regardless of
	// scrollTop), so a short seed would make `scrollToTop` a no-op.
	const SEED_COUNT = 60;
	const PAGE_SIZE = 4;
	const TOTAL_PAGES = 3;

	type HistoryMode = 'adapter' | 'callback';

	/**
	 * Builds `TOTAL_PAGES` batches of older messages, oldest page last. Each
	 * page's messages are already in oldest-to-newest order, so prepending a
	 * page's array directly onto the front of `conversation.ids` preserves
	 * chronological order.
	 */
	function buildHistoryPages(label: string): ArchivedMessageInput[][] {
		const pages: ArchivedMessageInput[][] = [];
		for (let page = 0; page < TOTAL_PAGES; page += 1) {
			const messages: ArchivedMessageInput[] = [];
			for (let index = 0; index < PAGE_SIZE; index += 1) {
				const globalIndex = page * PAGE_SIZE + index;
				messages.push({
					role: globalIndex % 2 === 0 ? 'user' : 'assistant',
					content: `${label} archived message ${globalIndex + 1}`
				});
			}
			pages.push(messages);
		}
		return pages;
	}

	function seedConversation(): ConversationHistory {
		const seedInputs: ArchivedMessageInput[] = [];
		for (let index = 0; index < SEED_COUNT; index += 1) {
			seedInputs.push({
				role: index % 2 === 0 ? 'user' : 'assistant',
				content: `Live message ${index + 1} — enough padding text to give each row real height so the transcript reliably overflows the viewport and scrolling has somewhere to go.`
			});
		}
		return appendMessages(createConversationHistory({ id: 'history-scroll-demo' }), ...seedInputs);
	}

	let chat: ReturnType<typeof Chat> | undefined;

	let mode = $state<HistoryMode>('adapter');
	let pagesQueue = $state<ArchivedMessageInput[][]>(buildHistoryPages('Adapter'));
	let moreHistoryAvailable = $state(true);
	let conversation = $state<ConversationHistory>(seedConversation());
	let eventLog = $state<string[]>([]);

	let atBottom = $state(true);
	let unreadCount = $state(0);
	let newMessageIndicatorVisible = $state(false);

	let bottomThreshold = $state(DEFAULT_SCROLL_CONFIGURATION.bottomThreshold);
	let jumpThreshold = $state(DEFAULT_SCROLL_CONFIGURATION.jumpThreshold);

	// Only consulted by `adapter.loadOlderMessages` — callback mode
	// (`onLoadHistory`) never sees these, since the adapter's method takes
	// precedence and callback mode omits it entirely (see the conditional
	// spread on `adapter` below).
	let failMode = $state(false);
	let slowLoad = $state(false);
	let loadInvocationCount = $state(0);
	let lastAdapterErrorCommand = $state<string | null>(null);

	function pushLog(entry: string): void {
		eventLog = [...eventLog, entry].slice(-6);
	}

	function resetMode(next: HistoryMode): void {
		mode = next;
		pagesQueue = buildHistoryPages(next === 'adapter' ? 'Adapter' : 'Callback');
		moreHistoryAvailable = true;
		conversation = seedConversation();
		atBottom = true;
		lastLoggedAtBottom = true;
		unreadCount = 0;
		newMessageIndicatorVisible = false;
		eventLog = [];
		failMode = false;
		slowLoad = false;
		loadInvocationCount = 0;
		lastAdapterErrorCommand = null;
	}

	function simulateIncomingMessage(): void {
		conversation = appendMessages(conversation, {
			role: 'assistant',
			content: `Incoming update #${conversation.ids.length + 1}`
		});
	}

	async function loadNextPage(source: 'adapter' | 'callback'): Promise<{ hasMore: boolean }> {
		const nextPage = pagesQueue.at(0);
		if (!nextPage) {
			pushLog(`${source}: no pages remain`);
			return { hasMore: false };
		}

		conversation = prependMessages(conversation, ...nextPage);
		pagesQueue = pagesQueue.slice(1);
		const hasMore = pagesQueue.length > 0;
		moreHistoryAvailable = hasMore;
		pushLog(`${source}: loaded a page, hasMore=${hasMore}`);
		return { hasMore };
	}

	// Only consulted by Chat when `mode === 'adapter'` — see the conditional
	// spread below, which omits `loadOlderMessages` entirely in callback mode
	// so `onLoadHistory` (not the adapter) drives the history trigger.
	const adapter = $derived<ChatAdapter>({
		sendMessage: async (message) => {
			conversation = appendMessages(conversation, message);
			const text = typeof message.content === 'string' ? message.content : 'attachment received';
			conversation = appendMessages(conversation, { role: 'assistant', content: `Echo: ${text}` });
		},
		...(mode === 'adapter'
			? {
					loadOlderMessages: async () => {
						loadInvocationCount += 1;

						// Slow mode holds the promise open long enough for a
						// double-click to land while the first invocation is
						// still in flight — the assertion is that Chat's own
						// `isLoadingHistory` guard keeps this a single-flight
						// call, not that `loadInvocationCount` never moves.
						if (slowLoad) {
							await new Promise((resolve) => setTimeout(resolve, 400));
						}

						if (failMode) {
							throw new Error('Simulated loadOlderMessages failure');
						}

						return loadNextPage('adapter');
					}
				}
			: {})
	});

	async function handleLoadHistory(): Promise<void> {
		await loadNextPage('callback');
	}

	function handleAdapterError(event: ChatAdapterErrorEvent): void {
		lastAdapterErrorCommand = event.command;
		pushLog(`adaptererror: command=${event.command}`);
	}

	// `atBottom`/`unreadCount`/`newMessageIndicatorVisible` flow through
	// `bind:`; the event handlers below only feed the visible event log.
	//
	// `onscrollstatechange` fires once per native `scroll` tick, not once per
	// meaningful transition — a single smooth scroll across this exercise's
	// long transcript produces well over a hundred events, nearly all
	// reporting the same unchanged `atBottom` value. Logging every one of
	// them would blow the event log's fixed window out with duplicates
	// before anything else gets a chance to show up in it, so only log on an
	// actual value change (the live `atBottom` status above still reflects
	// every event, unconditionally).
	// Matches `atBottom`'s own initial value above rather than reading
	// `atBottom` directly here — both are plain non-reactive bookkeeping, so
	// this avoids Svelte's "state referenced locally" warning for what would
	// otherwise look like a one-time capture of reactive state.
	let lastLoggedAtBottom = true;

	function handleScrollStateChange(event: ChatScrollStateChangeEvent): void {
		if (event.atBottom === lastLoggedAtBottom) return;

		lastLoggedAtBottom = event.atBottom;
		pushLog(`scrollstatechange: atBottom=${event.atBottom}`);
	}

	function handleUnreadIndicatorChange(event: ChatUnreadIndicatorChangeEvent): void {
		pushLog(
			`unreadindicatorchange: unreadCount=${event.unreadCount} visible=${event.newMessageIndicatorVisible}`
		);
	}

	function handleJumpToLatest(): void {
		pushLog('jumptolatest');
	}
</script>

<div style="height: 100dvh; display: flex; flex-direction: column; gap: 0.5rem;">
	<div
		style="padding: 0.5rem 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; border-bottom: 1px solid var(--cinder-border);"
	>
		<fieldset style="display: flex; gap: 0.5rem; align-items: center;">
			<legend>History loading mode</legend>
			<label>
				<input
					type="radio"
					name="history-mode"
					checked={mode === 'adapter'}
					onchange={() => resetMode('adapter')}
					data-testid="history-scroll-mode-adapter"
				/>
				adapter.loadOlderMessages
			</label>
			<label>
				<input
					type="radio"
					name="history-mode"
					checked={mode === 'callback'}
					onchange={() => resetMode('callback')}
					data-testid="history-scroll-mode-callback"
				/>
				onLoadHistory
			</label>
		</fieldset>

		<label>
			bottomThreshold
			<input
				type="number"
				bind:value={bottomThreshold}
				data-testid="history-scroll-bottom-threshold"
			/>
		</label>
		<label>
			jumpThreshold
			<input type="number" bind:value={jumpThreshold} data-testid="history-scroll-jump-threshold" />
		</label>

		<button
			type="button"
			onclick={() => chat?.scrollToTop()}
			data-testid="history-scroll-scroll-top"
		>
			Scroll to top
		</button>
		<button
			type="button"
			onclick={() => chat?.scrollToBottom()}
			data-testid="history-scroll-scroll-bottom"
		>
			Scroll to bottom
		</button>
		<button
			type="button"
			onclick={simulateIncomingMessage}
			data-testid="history-scroll-simulate-incoming"
		>
			Simulate incoming message
		</button>

		<label>
			<input type="checkbox" bind:checked={failMode} data-testid="history-scroll-fail-mode" />
			Fail next load
		</label>
		<label>
			<input type="checkbox" bind:checked={slowLoad} data-testid="history-scroll-slow-load" />
			Slow load
		</label>
	</div>

	<dl
		style="display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; padding: 0 1rem; margin: 0;"
		data-testid="history-scroll-status"
	>
		<div>
			<dt style="display:inline;">atBottom:</dt>
			<dd style="display:inline; margin:0;" data-testid="history-scroll-at-bottom">{atBottom}</dd>
		</div>
		<div>
			<dt style="display:inline;">unreadCount:</dt>
			<dd style="display:inline; margin:0;" data-testid="history-scroll-unread-count">
				{unreadCount}
			</dd>
		</div>
		<div>
			<dt style="display:inline;">newMessageIndicatorVisible:</dt>
			<dd style="display:inline; margin:0;" data-testid="history-scroll-indicator-visible">
				{newMessageIndicatorVisible}
			</dd>
		</div>
		<div>
			<dt style="display:inline;">moreHistoryAvailable:</dt>
			<dd style="display:inline; margin:0;" data-testid="history-scroll-more-history">
				{moreHistoryAvailable}
			</dd>
		</div>
		<div>
			<dt style="display:inline;">pagesRemaining:</dt>
			<dd style="display:inline; margin:0;" data-testid="history-scroll-pages-remaining">
				{pagesQueue.length}
			</dd>
		</div>
		<div>
			<dt style="display:inline;">messageCount:</dt>
			<dd style="display:inline; margin:0;" data-testid="history-scroll-message-count">
				{conversation.ids.length}
			</dd>
		</div>
		<div>
			<dt style="display:inline;">loadInvocationCount:</dt>
			<dd style="display:inline; margin:0;" data-testid="history-scroll-load-invocation-count">
				{loadInvocationCount}
			</dd>
		</div>
		<div>
			<dt style="display:inline;">lastAdapterErrorCommand:</dt>
			<dd style="display:inline; margin:0;" data-testid="history-scroll-adapter-error-command">
				{lastAdapterErrorCommand ?? 'none'}
			</dd>
		</div>
	</dl>

	<ul
		style="margin: 0; padding: 0 1rem; list-style: none; font-size: 0.8rem; color: var(--cinder-text-muted, gray);"
		data-testid="history-scroll-event-log"
	>
		{#each eventLog as entry, index (index)}
			<li data-testid="history-scroll-event-log-item">{entry}</li>
		{/each}
	</ul>

	<div style="flex: 1; min-height: 0;">
		<Chat
			bind:this={chat}
			id="history-scroll-chat"
			{conversation}
			{adapter}
			bind:atBottom
			bind:unreadCount
			bind:newMessageIndicatorVisible
			{bottomThreshold}
			{jumpThreshold}
			{moreHistoryAvailable}
			loadEarlierLabel="Load earlier messages (custom)"
			loadingEarlierLabel="Loading earlier messages (custom)"
			onLoadHistory={handleLoadHistory}
			onadaptererror={handleAdapterError}
			onscrollstatechange={handleScrollStateChange}
			onunreadindicatorchange={handleUnreadIndicatorChange}
			onjumptolatest={handleJumpToLatest}
		/>
	</div>
</div>
