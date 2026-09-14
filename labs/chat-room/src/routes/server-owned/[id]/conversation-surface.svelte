<script lang="ts">
	import {
		Chat,
		createChatSessionController,
		decodeChatStreamEvents,
		getMessages,
		markMessageDeliveryFailed,
		removeMessage,
		type ChatRowContext,
		type ChatAdapterErrorEvent,
		type ConversationHistory
	} from '@lostgradient/chat';
	import { onDestroy, onMount, untrack } from 'svelte';

	import { toBannerFailure, type BannerFailure } from '$lib/chat-failure';
	import {
		createServerOwnedSynchronizer,
		type ServerOwnedSynchronizer
	} from '$lib/server-owned-synchronization';
	import { withUnsavedFailures, type UnsavedFailure } from '$lib/server-owned-failure-overlay';
	import {
		parseServerOwnedPersistenceFailureHint,
		type ServerOwnedConversationSnapshot
	} from '$lib/server-owned-snapshot';
	import ApprovalSurface from './approval-surface.svelte';

	/**
	 * The sentence a failed request meant to say, not the envelope it arrived
	 * in.
	 *
	 * Every non-streaming failure from this endpoint is JSON — `{ error }` for
	 * the 400s, the 404, and the 503 when `ANTHROPIC_API_KEY` is unset. Reading
	 * `response.text()` and throwing that put the raw body into the banner, so
	 * a user and a screen reader both got
	 * `{"error":"ANTHROPIC_API_KEY is not configured"}` — the right
	 * information wrapped in something nobody should have to read past.
	 *
	 * Falls back to the body text, then to a status line, because a failure
	 * that is not this endpoint's own — a proxy, a gateway — has no `error`
	 * field and an empty banner would be worse than an ugly one.
	 */
	async function failureMessage(response: Response): Promise<string> {
		const body = await response.text();
		try {
			const parsed: unknown = JSON.parse(body);
			const message = (parsed as { error?: unknown }).error;
			if (typeof message === 'string' && message.length > 0) return message;
		} catch {
			// Not JSON. The text itself is the best available answer.
		}
		return body.length > 0 ? body : `The server responded ${response.status}.`;
	}

	/**
	 * One conversation's live surface: its browser-side mirror, its session
	 * controller, and everything that resets when you move to a different
	 * conversation.
	 *
	 * Split out of `+page.svelte` and mounted under `{#key data.id}` because
	 * SvelteKit REUSES a page component when only a route parameter changes.
	 * Navigating `/server-owned/A` straight to `/server-owned/B` updated
	 * `data` while leaving the one-time `conversation` initializer alone. The
	 * heading and the transport URL then named B while `<Chat>` still rendered
	 * A's transcript, and the next submission was persisted to B underneath A's
	 * visible history. Keying on the id makes the reset structural rather than
	 * something every piece of per-conversation state has to remember.
	 *
	 * LATENT today, and worth saying so rather than implying otherwise. This
	 * route family has no detail-to-detail link, and browser back/forward
	 * between two separately loaded conversation documents performs a real
	 * navigation rather than a parameter-only update — so nothing a user can do
	 * right now reaches this path. The spec has to inject a same-origin anchor
	 * to exercise it at all.
	 *
	 * Kept because the path becomes reachable the moment client-side
	 * detail-to-detail navigation exists, and the failure it prevents is
	 * silent data loss: a turn persisted to B underneath A's visible history.
	 * An earlier version of this comment claimed back/forward already covered
	 * it, which would have read as proof the case was exercised.
	 */
	let {
		id,
		conversation: initialConversation,
		turnFailures: initialTurnFailures = {}
	}: {
		id: string;
		conversation: ConversationHistory;
		turnFailures?: ServerOwnedConversationSnapshot['turnFailures'];
	} = $props();

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
	let conversation = $state<ConversationHistory>(
		withServerFailures(
			untrack(() => initialConversation),
			untrack(() => initialTurnFailures)
		)
	);
	let turnFailures = $state.raw<ServerOwnedConversationSnapshot['turnFailures']>(
		untrack(() => initialTurnFailures)
	);
	let unsavedFailures = $state<Record<string, UnsavedFailure>>({});
	let seenFailureIds = $state<Set<string>>(
		untrack(() => new Set(Object.keys(initialTurnFailures)))
	);
	let syncStatus = $state('');
	let syncStatusGeneration = $state(0);
	let knownRejectedUserId = $state<string | undefined>(undefined);
	let streaming = $state(false);
	let streamEpoch = 0;
	let disposed = false;
	// Failures are replaced as immutable records. Preserve their identity so the
	// approval child clears only the banner it owns across the binding.
	let failure = $state.raw<BannerFailure | null>(null);

	function withServerFailures(
		history: ConversationHistory,
		failures: ServerOwnedConversationSnapshot['turnFailures']
	): ConversationHistory {
		return Object.keys(failures).reduce(
			(current, messageId) => markMessageDeliveryFailed(current, messageId),
			history
		);
	}

	function retainUnsavedFailure(
		authoritativeId: string,
		clientId: string,
		message: UnsavedFailure['message'],
		failure: UnsavedFailure['failure']
	): void {
		unsavedFailures = { ...unsavedFailures, [authoritativeId]: { clientId, message, failure } };
		turnFailures = { ...turnFailures, [clientId]: failure };
		conversation = markMessageDeliveryFailed(conversation, clientId);
	}

	function applySnapshot(snapshot: ServerOwnedConversationSnapshot): void {
		const newFailureIds = Object.keys(snapshot.turnFailures).filter(
			(messageId) => !seenFailureIds.has(messageId)
		);
		if (newFailureIds.length > 0) {
			syncStatusGeneration += 1;
			syncStatus =
				newFailureIds.length === 1
					? '1 failed turn is recorded in this conversation.'
					: `${newFailureIds.length} additional failed turns are recorded in this conversation.`;
			seenFailureIds = new Set([...seenFailureIds, ...newFailureIds]);
		}
		const remainingUnsaved: Record<string, UnsavedFailure> = {};
		const visibleFailures = { ...snapshot.turnFailures };
		let next = snapshot.conversation;
		for (const [authoritativeId, unsaved] of Object.entries(unsavedFailures)) {
			if (snapshot.turnFailures[authoritativeId]) continue;
			remainingUnsaved[authoritativeId] = unsaved;
			if (
				next.messages[authoritativeId] === undefined &&
				next.messages[unsaved.clientId] === undefined
			) {
				next = {
					...next,
					ids: [...next.ids, unsaved.clientId],
					messages: { ...next.messages, [unsaved.clientId]: unsaved.message }
				};
			}
			if (next.messages[authoritativeId] === undefined) {
				visibleFailures[unsaved.clientId] = unsaved.failure;
			} else {
				visibleFailures[authoritativeId] = unsaved.failure;
			}
		}
		unsavedFailures = remainingUnsaved;
		const rejected = knownRejectedUserId;
		if (rejected && !next.messages[rejected]) {
			const local = conversation.messages[rejected];
			if (local) {
				next = {
					...next,
					ids: [...next.ids, rejected],
					messages: { ...next.messages, [rejected]: local }
				};
			}
		}
		turnFailures = visibleFailures;
		conversation = withServerFailures(next, visibleFailures);
	}

	let synchronizer: ServerOwnedSynchronizer | undefined;

	const session = createChatSessionController({
		getConversation: () => $state.snapshot(conversation),
		setConversation: (next) => (conversation = withUnsavedFailures(next, unsavedFailures)),
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
			// A CONTINUATION HAS NOTHING TO FETCH HERE, and that is a property of
			// this family rather than a gap in it.
			//
			// The session controller calls the transport again whenever a turn
			// ended with every tool call resolved, because in the browser-owned
			// route the client drives the next step. Here the server ran the
			// whole turn: the approved tool settled, the loop issued a second
			// generate, and the assistant's reply arrived in the SAME response.
			// There is no next step to ask for — and no user text to send if
			// there were, since the last message on this call is a tool result.
			//
			// An empty stream is the honest answer. It used to throw, which was
			// right while the toolbox was empty and a continuation could only
			// mean a wiring mistake; once a real tool could succeed, that same
			// throw marked the turn FAILED right after its side effect had
			// succeeded. The run options this family uses drop
			// `stopAfterAnyToolCall` precisely so the turn is complete by the
			// time this is reached.
			const messages = getMessages(history);
			const last = messages.at(-1);
			if (last?.role !== 'user' || typeof last.content !== 'string') {
				return (async function* () {})();
			}
			const text = last.content;

			const clientUserId = last.id;
			const clientMessage = conversation.messages[clientUserId];
			const requestEpoch = streamEpoch;
			const response = await fetch(`/api/server-owned/conversations/${id}/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text }),
				signal
			});
			if (!response.ok || !response.body) {
				if (!response.ok) {
					const latest = getMessages(history).at(-1);
					if (latest?.role === 'user') knownRejectedUserId = latest.id;
				}
				throw new Error(await failureMessage(response));
			}
			const events = decodeChatStreamEvents(response.body);
			return (async function* () {
				for await (const event of events) {
					if (event.type === 'stream:error') {
						const hint = parseServerOwnedPersistenceFailureHint(event.error);
						if (hint === undefined) {
							yield event;
							continue;
						}
						if (!disposed && !signal.aborted && requestEpoch === streamEpoch) {
							if (clientMessage) {
								retainUnsavedFailure(hint.userMessageId, clientUserId, clientMessage, hint.failure);
							}
						}
						continue;
					}
					yield event;
				}
			})();
		},
		hooks: {
			onStreamingChange: (value) => {
				if (value) streamEpoch += 1;
				streaming = value;
				synchronizer?.setStreaming(value);
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
	const synchronizedAdapter = {
		...adapter,
		sendMessage: async (...args: Parameters<typeof adapter.sendMessage>) => {
			if (knownRejectedUserId !== undefined) {
				conversation = removeMessage(conversation, knownRejectedUserId);
			}
			knownRejectedUserId = undefined;
			await adapter.sendMessage(...args);
		}
	};

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
		disposed = true;
		streamEpoch += 1;
		synchronizer?.dispose();
		session.dispose();
	});

	onMount(() => {
		synchronizer = createServerOwnedSynchronizer({
			id,
			visible: () => document.visibilityState === 'visible',
			streaming: () => streaming,
			apply: applySnapshot
		});
		const onFocus = (): void => synchronizer?.trigger();
		const onVisibility = (): void =>
			synchronizer?.setVisible(document.visibilityState === 'visible');
		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onVisibility);
		synchronizer.trigger();
		return () => {
			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onVisibility);
			synchronizer?.dispose();
			synchronizer = undefined;
		};
	});
</script>

<ApprovalSurface {id} {streaming} bind:failure {failureMessage} />

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

<p class="sync-status" role="status" data-testid="server-owned-sync-status">
	{#key syncStatusGeneration}<span>{syncStatus}</span>{/key}
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
		adapter={synchronizedAdapter}
		{streaming}
		capabilities={{ editing: false, attachments: false, retry: false }}
		onadaptererror={handleAdapterError}
	>
		{#snippet messageStatus({ message }: ChatRowContext)}
			{#if turnFailures[message.id]}
				<span class="turn-reason" data-testid="server-owned-turn-reason">
					{turnFailures[message.id].message}
				</span>
			{/if}
		{/snippet}
	</Chat>
</div>

<style>
	.chat {
		flex: 1;
		/* The idle transcript owns scrolling. The page supplies an 8rem floor
		   while approval or recovery content is visible. */
		min-block-size: 0;
	}

	/* Approval removal hands focus here programmatically. Firefox does not
	   match :focus-visible for that handoff, so keep the destination visible
	   whenever focused. An inset ring stays inside the scrolling transcript. */
	.chat :global([role='log']:focus) {
		outline: var(--cinder-ring-width) solid transparent;
		box-shadow: inset 0 0 0 var(--cinder-ring-width)
			var(--_cinder-chat-timeline-ring, var(--cinder-ring-color));
	}

	@media (forced-colors: active) {
		.chat :global([role='log']:focus) {
			outline: var(--cinder-ring-width) solid ButtonText;
			outline-offset: calc(var(--cinder-ring-width) * -1);
		}
	}

	.failure {
		margin: 0;
		color: var(--cinder-status-danger-text, currentColor);
	}

	.sync-status {
		margin: 0;
	}

	.sync-status:empty {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		margin: -1px;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
