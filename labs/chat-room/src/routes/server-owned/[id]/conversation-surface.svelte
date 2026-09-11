<script lang="ts">
	import {
		Chat,
		createChatSessionController,
		decodeChatStreamEvents,
		getMessages,
		type ChatAdapterErrorEvent,
		type ConversationHistory
	} from '@lostgradient/chat';
	import { onDestroy, untrack } from 'svelte';

	import { toBannerFailure, type BannerFailure } from '$lib/chat-failure';

	/**
	 * One conversation's live surface: its browser-side mirror, its session
	 * controller, and everything that resets when you move to a different
	 * conversation.
	 *
	 * Split out of `+page.svelte` and mounted under `{#key data.id}` because
	 * SvelteKit REUSES a page component when only a route parameter changes.
	 * Navigating `/server-owned/A` straight to `/server-owned/B` — browser
	 * back and forward between two conversations does exactly that — updated
	 * `data` while leaving the one-time `conversation` initializer alone. The
	 * heading and the transport URL then named B while `<Chat>` still rendered
	 * A's transcript, and the next submission was persisted to B underneath A's
	 * visible history. Keying on the id makes the reset structural rather than
	 * something every piece of per-conversation state has to remember.
	 */
	let { id, conversation: initialConversation }: { id: string; conversation: ConversationHistory } =
		$props();

	// Seeded from the server's copy ONCE, then kept in step as frames arrive.
	// The browser holds a MIRROR for rendering; the session store remains the
	// owner, and the endpoint writes the run's result back to it.
	//
	// `untrack` because the one-time read is the intent, not an oversight:
	// referencing a prop inside `$state` warns precisely because it usually
	// means someone expected reactivity. Here re-seeding would discard
	// everything streamed since the load — and the reset that DOES need to
	// happen, on a change of conversation, is the `{#key}` above this
	// component rather than a reactive read inside it.
	let conversation = $state<ConversationHistory>(untrack(() => initialConversation));
	let streaming = $state(false);
	let failure = $state<BannerFailure | null>(null);

	const session = createChatSessionController({
		getConversation: () => $state.snapshot(conversation),
		setConversation: (next) => (conversation = next),
		transport: async ({ conversation: history, signal }) => {
			// ONE message, never a transcript. `/api/chat` sends the whole
			// history because the browser owns it there; here the server holds
			// it, and only the turn the user just typed has to cross — the
			// server cannot know it any other way.
			// The LAST message must be the user turn being sent. The session
			// controller also calls this transport to CONTINUE a run after a
			// tool result, and on that call the last message is a tool result,
			// not a user turn — sending the previous user text again would
			// duplicate it as a new turn.
			//
			// This route runs with an empty toolbox (see the stream endpoint's
			// note: approval belongs to CIN-445), so no continuation can occur
			// today. The guard is here so that stops being true loudly rather
			// than silently, if a toolbox is ever added without the approval
			// wiring that has to come with it.
			const messages = getMessages(history);
			const last = messages.at(-1);
			if (last?.role !== 'user' || typeof last.content !== 'string') {
				throw new Error(
					'The server-owned transport was called to continue a run. That path needs approval wiring (CIN-445) before a toolbox is enabled here.'
				);
			}
			const text = last.content;

			const response = await fetch(`/api/server-owned/conversations/${id}/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text }),
				signal
			});
			if (!response.ok || !response.body) throw new Error(await response.text());
			return decodeChatStreamEvents(response.body);
		},
		hooks: {
			onStreamingChange: (value) => {
				streaming = value;
				// Cleared when the NEXT turn starts, not when this one fails: a
				// banner that outlived the send it described would read as a
				// fresh failure of the turn now in flight.
				if (value) failure = null;
			},
			// The controller reports a rejected turn here — the stream endpoint's
			// 404, 400, or 503 body, and the provider's own typed terminal
			// failure with its retryability classification. Without this the only
			// thing a user sees is Chat's generic per-message marker, and the
			// server's actual sentence is discarded.
			onError: (cause) => (failure = toBannerFailure(cause))
		}
	});

	const adapter = session.adapter;

	// The OTHER error path. `onError` covers failures the controller raises;
	// `onadaptererror` covers a command the adapter itself rejected. They are
	// different sources and neither implies the other, which is why the
	// canonical exemplar wires both and why wiring one here would leave a
	// reachable silence.
	function handleAdapterError(event: ChatAdapterErrorEvent): void {
		failure = toBannerFailure(event.error);
	}

	// Leaving this page while a response is streaming destroys `<Chat>` but not
	// the controller behind it: without this the run keeps going, its frames
	// keep arriving for a component that is gone, and the provider request
	// stays open and billed. `dispose()` stops the active run and releases the
	// controller's own subscriptions.
	onDestroy(() => {
		session.dispose();
	});
</script>

<!--
		Mounted ALWAYS, empty until there is something to say. Chat's own
		`chat-status-announcer.svelte` states the rule this follows — a live
		region mounted with its text already in place is not reliably
		announced — and `error-live-regions.e2e.ts` enforces it across the
		repository's banners.

		No RETRY DISPOSITION here, unlike the canonical exemplar, and the
		difference is not an oversight. There the banner says "you can try that
		again" because Retry works: the browser owns the transcript, so retrying
		rewinds and re-sends the same turn. Here `retry` is disabled, because the
		stream endpoint's only verb appends — so the sole way a user could act on
		such an invitation is to retype the message, which persists the prompt a
		second time beside the one that already failed. Telling someone to try
		again when the only available "again" corrupts their transcript is worse
		than saying nothing.

		`data-retryable` stays: the classification is real and worth exposing to
		a reader or a spec. What is withheld is the INSTRUCTION, until there is a
		server-side operation that replaces a failed turn rather than appending
		beside it.
	-->
<p
	class="failure"
	role="alert"
	data-testid="server-owned-turn-failure"
	data-retryable={failure?.retryable === undefined ? undefined : String(failure.retryable)}
>
	{#if failure}
		{failure.message}
	{/if}
</p>

<div class="chat" data-testid="server-owned-chat" data-streaming={streaming}>
	<!--
			Capabilities are narrowed to what this variant can actually honour.
			`Chat` enables all of them by default, and the defaults assume the
			BROWSER owns the transcript — which is exactly what is not true here.

			`editing`: the controller's edit flow rewinds the conversation and
			re-sends. The transcript lives in the session store, and this family
			has no endpoint that replaces a turn, so an edit would rewind the
			browser's mirror while the server kept the original — the two would
			silently disagree from that point on.

			`attachments`: the controller supplies attachments to the transport
			separately from the conversation, and this transport sends only the
			new turn's text. An attached file would appear in the composer, be
			dropped on the way out, and never reach the model.

			`retry`: Retry re-invokes the transport with the same text, and the
			stream endpoint handles EVERY invocation as
			`createSessionHandle(...).run(text)` — which appends a new user turn.
			So a retry would not retry the failed turn; it would persist the same
			prompt a second time, and a reload would show it twice. Retrying
			properly needs a server-side operation that replaces the failed turn
			rather than appending beside it, which is the same gap `editing`
			leaves open.

			All three are reachable defaults rather than hypotheticals, which is
			why they are turned off rather than left for a later issue to notice.

			`streaming` is forwarded for the opposite reason: it is not a
			capability to withdraw but state the component cannot infer. Left at
			its default the composer and Send button stay enabled through an
			in-flight response, Stop generating never appears, and a second
			submission is dropped by the controller's already-running guard with
			nothing shown to the user.
		-->
	<Chat
		id="server-owned-conversation"
		{conversation}
		{adapter}
		{streaming}
		capabilities={{ editing: false, attachments: false, retry: false }}
		onadaptererror={handleAdapterError}
	/>
</div>

<style>
	/*
		`min-block-size: 0` alongside `flex: 1`: a flex item's automatic minimum
		size is its content, so without this the wrapper refuses to shrink below
		the transcript's full height and the page scrolls instead of the
		transcript.
	*/
	.chat {
		flex: 1;
		min-block-size: 0;
	}

	.failure {
		margin: 0;
		color: var(--cinder-status-danger-text, currentColor);
	}
</style>
