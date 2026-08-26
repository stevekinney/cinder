<script lang="ts">
	import {
		appendMessages,
		Chat,
		createConversationHistory,
		type ChatAdapter,
		type ChatPushHandlers,
		type ConversationHistory
	} from '@lostgradient/chat';

	/**
	 * An isolated `<Chat>` instance (its own conversation, its own pair of
	 * adapters) so subscription unmount/swap teardown can be exercised without
	 * touching the main adapter-push demo. Two adapters — `adapterA` and
	 * `adapterB` — each track their own subscribe/unsubscribe counts and
	 * capture their own push-handler reference, cleared to `undefined` on
	 * that adapter's own teardown. A stale handler reference calling through
	 * `?.` after its adapter has been unsubscribed is therefore a guaranteed
	 * no-op, which is how "no pushes from the OLD subscription still mutate
	 * UI" is proven rather than merely asserted.
	 */

	let mounted = $state(false);
	let useAdapterB = $state(false);
	let subscribeCountA = $state(0);
	let unsubscribeCountA = $state(0);
	let subscribeCountB = $state(0);
	let unsubscribeCountB = $state(0);

	let conversation = $state<ConversationHistory>(
		createConversationHistory({ id: 'adapter-push-lifecycle-demo' })
	);

	let handlersA: ChatPushHandlers | undefined;
	let handlersB: ChatPushHandlers | undefined;

	function createAdapter(label: 'a' | 'b'): ChatAdapter {
		return {
			sendMessage: async (message) => {
				conversation = appendMessages(conversation, message);
			},
			// Deferred via `queueMicrotask`: Chat calls `subscribe` synchronously
			// from inside its own mount `$effect`, so a synchronous `$state` write
			// here would re-enter Svelte's still-settling flush (see the
			// subscribe-in-effect hazard fixture for what that looks like).
			subscribe: (_conversationId, handlers) => {
				if (label === 'a') {
					handlersA = handlers;
				} else {
					handlersB = handlers;
				}
				queueMicrotask(() => {
					if (label === 'a') {
						subscribeCountA += 1;
					} else {
						subscribeCountB += 1;
					}
				});
				return () => {
					if (label === 'a') {
						handlersA = undefined;
					} else {
						handlersB = undefined;
					}
					queueMicrotask(() => {
						if (label === 'a') {
							unsubscribeCountA += 1;
						} else {
							unsubscribeCountB += 1;
						}
					});
				};
			}
		};
	}

	const adapterA = createAdapter('a');
	const adapterB = createAdapter('b');
	const adapter = $derived<ChatAdapter>(useAdapterB ? adapterB : adapterA);

	function toggleMounted(): void {
		mounted = !mounted;
	}

	function swapAdapter(): void {
		useAdapterB = !useAdapterB;
	}

	/** No-op unless adapter A's subscription is still open. */
	function pushTypingViaA(): void {
		handlersA?.onTypingChange(true);
	}

	/** No-op unless adapter B's subscription is still open. */
	function pushTypingViaB(): void {
		handlersB?.onTypingChange(true);
	}
</script>

<div style="padding: 0.75rem 1rem; border-top: 1px solid var(--cinder-border);">
	<h2 style="font-size: 0.875rem; margin: 0 0 0.5rem;">Subscription lifecycle fixture</h2>
	<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
		<button type="button" data-testid="toggle-lifecycle-fixture" onclick={toggleMounted}>
			{mounted ? 'Unmount' : 'Mount'} lifecycle fixture
		</button>
		{#if mounted}
			<button type="button" data-testid="swap-lifecycle-adapter" onclick={swapAdapter}>
				Swap to adapter {useAdapterB ? 'A' : 'B'}
			</button>
			<button type="button" data-testid="push-lifecycle-via-a" onclick={pushTypingViaA}>
				Push typing via A
			</button>
			<button type="button" data-testid="push-lifecycle-via-b" onclick={pushTypingViaB}>
				Push typing via B
			</button>
		{/if}
	</div>
	<dl
		style="display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; font-size: 0.75rem; margin: 0.5rem 0;"
	>
		<div>
			<dt style="display: inline;">Subscribe A:</dt>
			<dd data-testid="lifecycle-subscribe-count-a" style="display: inline; margin: 0;">
				{subscribeCountA}
			</dd>
		</div>
		<div>
			<dt style="display: inline;">Unsubscribe A:</dt>
			<dd data-testid="lifecycle-unsubscribe-count-a" style="display: inline; margin: 0;">
				{unsubscribeCountA}
			</dd>
		</div>
		<div>
			<dt style="display: inline;">Subscribe B:</dt>
			<dd data-testid="lifecycle-subscribe-count-b" style="display: inline; margin: 0;">
				{subscribeCountB}
			</dd>
		</div>
		<div>
			<dt style="display: inline;">Unsubscribe B:</dt>
			<dd data-testid="lifecycle-unsubscribe-count-b" style="display: inline; margin: 0;">
				{unsubscribeCountB}
			</dd>
		</div>
	</dl>
	{#if mounted}
		<div
			data-testid="lifecycle-fixture-chat"
			style="height: 240px; border: 1px solid var(--cinder-border);"
		>
			<Chat id="adapter-push-lifecycle-chat" {conversation} {adapter} />
		</div>
	{/if}
</div>
