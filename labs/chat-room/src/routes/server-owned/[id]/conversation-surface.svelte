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

			const response = await fetch(`/api/server-owned/conversations/${id}/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text }),
				signal
			});
			if (!response.ok || !response.body) throw new Error(await failureMessage(response));
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

	/**
	 * The approval a server-owned run is waiting on, if any.
	 *
	 * POLLED rather than pushed, because the question cannot ride the stream:
	 * `@lostgradient/chat`'s wire vocabulary is a closed union with no frame
	 * for "the run is waiting on you", and inventing one would mean changing a
	 * published package's contract from inside a lab. CIN-615 carries that.
	 *
	 * Polling only WHILE STREAMING. Outside a turn there is nothing that could
	 * be waiting, so a background poll would be a request per interval for an
	 * answer that cannot change.
	 */
	type PendingApproval = {
		toolName: string;
		callId: string;
		message: string;
		arguments: Record<string, unknown>;
	};

	let pending = $state<PendingApproval | null>(null);
	let deciding = $state(false);

	/**
	 * The status paragraph, so focus can be moved to it when the controls it
	 * describes are removed.
	 *
	 * `tabindex="-1"` ALWAYS: programmatically focusable, never a tab stop. A
	 * status region is not something anyone should have to tab through on the
	 * way to the composer.
	 *
	 * It briefly carried a conditional `0`, when this paragraph also rendered
	 * the proposed arguments and a height bound had made it a scroll container —
	 * which `-1` keeps out of the tab order. That was the wrong fix twice over:
	 * `0` puts a tab stop on a non-interactive element, which Svelte's own a11y
	 * rule rejects. The arguments moved to their own `<details>`, whose
	 * `<summary>` is natively focusable and now owns the keyboard path to them,
	 * so this element went back to being only a sentence.
	 */
	let approvalQuestion = $state<HTMLElement | null>(null);

	/** The approval region, so focus handoff can ask whether focus is inside it. */
	let approvalSection = $state<HTMLElement | null>(null);

	/**
	 * Which polling session a response belongs to.
	 *
	 * Every tick starts an independent request, so responses can land out of
	 * order — or after `decide()` has cleared the question, or after the turn
	 * ended and the effect below cleaned up. An unconditional assignment then
	 * restores Approve/Deny controls for a question nobody can answer any more,
	 * permanently, because nothing polls again to correct it.
	 *
	 * A monotonic counter is enough: the effect bumps it on entry and on
	 * teardown, and a response carrying an older value is discarded.
	 */
	// NOT `$state`. Nothing renders from this, and making it reactive put the
	// effect below in an infinite loop — it reads the generation to capture it
	// and writes it on teardown, so a reactive value made the effect depend on
	// state it mutates. Svelte reported `effect_update_depth_exceeded` and the
	// whole page stopped hydrating, which surfaced as every region being empty
	// rather than as anything pointing at this line.
	let pollGeneration = 0;

	/**
	 * Bumped when an answer settles a question, to discard a response already in
	 * flight for it — WITHOUT stopping the loop.
	 *
	 * Separate from `pollGeneration` because the two mean different things, and
	 * conflating them broke polling outright: `decide()` incremented the
	 * generation to invalidate a stale GET, the loop read that as "my session
	 * ended" and returned, and because the generation is deliberately
	 * non-reactive nothing reran the effect. Answering one approval stopped
	 * polling for the rest of the turn — so a step carrying two gated calls, which
	 * the server hook explicitly elicits for one at a time, never showed the
	 * second question.
	 *
	 * The session's liveness belongs to the effect (`stopped` and the abort
	 * signal). Staleness of one answer belongs here.
	 */
	let answerEpoch = 0;

	/**
	 * The active polling session's controller, so anything that fetches on its
	 * behalf is cancelled with it.
	 *
	 * The 409 refresh in `decide()` had no signal while the loop did, so a
	 * stalled refresh left `decide()` suspended with `deciding = true` — and a
	 * newer question the loop then discovered could not be answered, because
	 * every handler returns early while that flag is set.
	 */
	let pollController: AbortController | null = null;

	/** Drops a poll-owned alert; nothing polls afterwards to replace it. */
	function clearPollFailure(): void {
		if (pollFailure !== null && failure === pollFailure) failure = null;
		pollFailure = null;
	}

	/**
	 * The exact banner value a poll installed, so a poll can clear only that.
	 *
	 * A BOOLEAN was not enough, which review caught: with a flag, a poll
	 * failure followed by a different failure — the approval POST rejecting
	 * while the run is still streaming — left the flag set, and the next
	 * successful poll cleared the newer, actionable error instead of its own
	 * stale one.
	 *
	 * Identity settles it. The banner is shared with the controller's turn
	 * failures and with `decide()`, so ownership has to be checked by value
	 * rather than asserted by a flag.
	 */
	let pollFailure: BannerFailure | null = null;

	/**
	 * The banner value `decide()` installed, cleared on its own success.
	 *
	 * Same reasoning as `pollFailure`, for the other writer: ownership of a
	 * shared banner is checked by identity, never asserted by a flag.
	 */
	let decideFailure: BannerFailure | null = null;

	async function readPendingApproval(generation: number, signal?: AbortSignal): Promise<void> {
		const epoch = answerEpoch;
		const stale = (): boolean => generation !== pollGeneration || epoch !== answerEpoch;
		try {
			const response = await fetch(`/api/server-owned/conversations/${id}/elicitation`, {
				...(signal === undefined ? {} : { signal })
			});
			if (stale()) return;

			if (!response.ok) {
				// REPORTED, not swallowed. A run parked on `remember_note` while
				// this endpoint keeps answering 404, 500, or the shutdown 503 shows
				// no controls and no explanation — the turn simply appears to hang.
				// An earlier version returned bare for every non-2xx.
				//
				// Polling CONTINUES after reporting, so a transient failure heals
				// itself and the success path below clears this text.
				const message = await failureMessage(response);
				// RECHECKED AFTER THE BODY, because reading it is an await like any
				// other: the turn can end while this one is still pulling text.
				// Installing an error then leaves a stale alert with nothing left
				// polling to replace it.
				if (stale()) return;
				const reported = toBannerFailure(new Error(message));
				pollFailure = reported;
				failure = reported;
				return;
			}

			const body = (await response.json()) as { pending: PendingApproval | null };
			// Checked AGAIN after the body is read, because awaiting it is another
			// point where the turn can end underneath this response.
			if (stale()) return;
			// FOCUS IS HANDED OFF when the question GOES AWAY *or CHANGES*, and the
			// second half is a consent defect rather than an ergonomic one.
			//
			// Another tab answering A while the same step advances to B leaves
			// `pending` non-null, so the previous version reused the already
			// focused Approve button. Sequential `remember_note` calls produce
			// identical status text, so B is never announced — and pressing Enter
			// then approves B's arguments on the strength of having read A's.
			//
			// Moving focus back to the question forces the new one to be read, and
			// re-announces it because the region's text is replaced rather than
			// left in place.
			const answeredOrChanged = body.pending === null || body.pending.callId !== pending?.callId;
			if (answeredOrChanged) handOffFocusFromApproval();
			pending = body.pending;
			// A SUCCESS CLEARS THE POLL'S OWN FAILURE. Without this a single
			// transient error left its `role="alert"` text on screen for the rest
			// of the turn — including after the controls it supposedly explained
			// had appeared, and after the turn completed.
			//
			// Only the poll's failure, which is why the banner is cleared here
			// rather than on any success: a turn failure reported by the
			// controller is not this function's to erase.
			// Cleared only when the banner still holds the value THIS poll path
			// installed. Anything else on screen belongs to `decide()` or to the
			// controller, and is the more actionable of the two.
			clearPollFailure();
		} catch (cause) {
			// An ABORT is this component's own cleanup, not a failure to report.
			if (signal?.aborted === true) return;
			if (stale()) return;
			const reported = toBannerFailure(cause);
			pollFailure = reported;
			failure = reported;
		}
	}

	/**
	 * Moves focus out of the approval controls, but only if it is in them.
	 *
	 * Every path that clears `pending` removes the focused subtree, and a
	 * browser then drops focus to `<body>` — outside the chat's tab context, at
	 * the moment the turn resumes. `decide()` handled its own case; the poll
	 * discovering that another client answered, and the cleanup that runs when
	 * the turn ends, did not.
	 *
	 * GUARDED on containment, because stealing focus from someone typing in the
	 * composer would be its own defect.
	 */
	function handOffFocusFromApproval(): void {
		const active = document.activeElement;
		if (active === null || approvalSection === null) return;
		if (!approvalSection.contains(active)) return;
		approvalQuestion?.focus();
	}

	async function decide(approved: boolean): Promise<void> {
		const question = pending;
		if (question === null || deciding) return;
		deciding = true;
		// Captured so a slow failure body cannot install its banner after the
		// question was answered elsewhere or the turn ended.
		const generation = pollGeneration;
		const epoch = answerEpoch;
		try {
			const response = await fetch(`/api/server-owned/conversations/${id}/elicitation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				// The CALL ID travels with the answer. Without it a click that
				// lands after this question's run ended would settle whatever is
				// pending next — approving a note nobody was shown.
				body: JSON.stringify({ approved, callId: question.callId })
			});
			if (response.status === 409) {
				// ONLY 409. The question moved on while it was being read — either
				// the run ended or it advanced to a different call — so the current
				// question is the actionable thing and re-reading offers it.
				//
				// The EPOCH IS BUMPED FIRST, so a regular poll already in flight
				// with the superseded question cannot install it after this refresh
				// installs the current one. Without that, two reads race and the
				// slower one wins.
				answerEpoch += 1;
				await readPendingApproval(pollGeneration, pollController?.signal);
				return;
			}
			if (!response.ok) {
				// Everything else is a failure a person has to be told about. This
				// branch used to be folded into the 409 above, which meant a 404, a
				// 500, or the shutdown 503 left the stale controls on screen with no
				// explanation and the run still unresolved.
				//
				// The controls stay up, so this is retryable — which is why the
				// value is remembered and cleared by a later success.
				const message = await failureMessage(response);
				// RECHECKED AFTER THE BODY, for the same reason the poll rechecks:
				// reading it is an await, and another tab can answer or the turn can
				// finish inside it. An obsolete continuation would otherwise install
				// an error for a decision nobody is waiting on.
				if (generation !== pollGeneration || epoch !== answerEpoch) return;
				const reported = toBannerFailure(new Error(message));
				decideFailure = reported;
				failure = reported;
				return;
			}
			// FOCUS FIRST, then clear — the same handoff the poll and the cleanup
			// use, so all three paths agree rather than one of them remembering.
			handOffFocusFromApproval();
			pending = null;

			// IN-FLIGHT POLLS ARE INVALIDATED, because answering settles the
			// question on the server but says nothing to a GET already running.
			// One that captured this question before the POST landed would
			// restore its Approve/Deny controls after the server had settled it.
			//
			// The EPOCH, not the generation. Bumping the generation here made the
			// loop conclude its session had ended and return for good — and with
			// a non-reactive generation nothing reran the effect, so answering one
			// approval stopped polling for the whole turn.
			answerEpoch += 1;

			// A DECISION'S OWN FAILURE is cleared on its own success. A transient
			// POST failure leaves the controls up for a retry, and the retry
			// succeeding used to leave the alert still claiming the approval
			// failed — while the approved tool ran and the turn completed. The
			// poll path deliberately clears only poll-owned errors, so this one
			// has to clear its own.
			if (decideFailure !== null && failure === decideFailure) {
				failure = null;
			}
			decideFailure = null;
		} catch (cause) {
			const reported = toBannerFailure(cause);
			decideFailure = reported;
			failure = reported;
		} finally {
			deciding = false;
		}
	}

	/**
	 * Polls while a turn is in flight and stops the moment it is not.
	 *
	 * SERIALIZED, not an interval. A `setInterval` started an independent fetch
	 * every 250ms whether or not the previous had settled, so a stall — a slow
	 * proxy, an unresponsive server — accumulated one request per tick for its
	 * whole duration, and cleanup only cleared the timer: the requests stayed
	 * alive past navigation until the network gave up on them. Review caught
	 * that, and it is a connection leak rather than a cosmetic one.
	 *
	 * Waiting for each poll to settle before scheduling the next also makes
	 * out-of-order responses impossible WITHIN a session, which is why the
	 * sequence tickets this used to carry are gone. One generation token still
	 * separates sessions, and the abort signal drops whatever is in flight when
	 * the turn ends.
	 */
	$effect(() => {
		if (!streaming) {
			handOffFocusFromApproval();
			pending = null;
			// CLEARED, because nothing polls after this to clear it. A poll that
			// failed just before an otherwise successful turn ended used to leave
			// its `role="alert"` text on screen indefinitely, describing a
			// background request rather than the turn the reader just watched
			// finish.
			clearPollFailure();
			// Bumped here too, so a response still in flight from the session that
			// just ended cannot land and restore its controls.
			pollGeneration += 1;
			return;
		}

		const generation = pollGeneration;
		const controller = new AbortController();
		pollController = controller;
		answerEpoch = 0;
		pollFailure = null;
		let stopped = false;

		const loop = async (): Promise<void> => {
			while (!stopped && generation === pollGeneration) {
				await readPendingApproval(generation, controller.signal);
				if (stopped || generation !== pollGeneration) return;
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
		};
		void loop();

		return () => {
			stopped = true;
			controller.abort();
			if (pollController === controller) pollController = null;
			clearPollFailure();
			pollGeneration += 1;
		};
	});

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

<!--
	The approval a run is waiting on.
	
	A LIVE REGION that is always mounted and empty until there is a question,
	following the same rule as every other announcing region in this lab: one
	mounted with its text already in place is not reliably announced. The
	CONTROLS are conditional — a disabled Approve button for a question nobody
	asked would be reachable by keyboard and mean nothing.

	`role="status"` rather than `alert`: a question is not an error, and `alert`
	interrupts whatever the screen reader was saying about the reply now
	streaming.
-->
<section class="approval" aria-labelledby="approval-heading" bind:this={approvalSection}>
	<h2 id="approval-heading" class="visually-hidden">Approval</h2>
	<!--
		THE ANNOUNCEMENT and THE ARGUMENTS are separate elements, because two
		earlier fixes collided when they were one.

		Moving focus after a decision needs this element programmatically
		focusable, which `tabindex="-1"` gives. Bounding a long note's height
		made the same element a SCROLL container — and `-1` keeps a scroll
		container out of the tab order, so a sighted keyboard-only user could
		reach Approve with no way to read the rest of what they were authorizing.
		Making it `0` instead put a tab stop on a non-interactive element, which
		Svelte's own a11y rule rejects, correctly.

		So the sentence announces and stays unfocusable-by-tab, and the proposed
		arguments live in their own `role="region"` with a name and a real tab
		stop. That is also the better shape on its own terms: one is a sentence,
		the other is a block someone may have to scroll.
	-->
	<p
		class="approval-question"
		role="status"
		data-testid="approval-question"
		bind:this={approvalQuestion}
		tabindex="-1"
	>
		{#if pending}
			{pending.message} The assistant wants to run {pending.toolName}.
		{/if}
	</p>
	{#if pending}
		<!--
			A DISCLOSURE, not a scrollable box, and that was the third attempt.

			A bounded `overflow: auto` region needs `tabindex="0"` for its scroll
			to be reachable without a mouse — which Svelte's
			`a11y_no_noninteractive_tabindex` rejects for a non-interactive
			element, correctly: a focusable element that does nothing is a dead
			tab stop, and `role="region"` does not change that.

			`<summary>` is natively focusable and operable, so the keyboard path
			comes for free. Closed it costs one line, which is what keeps the
			transcript's space on a short viewport; open it shows the whole note
			and the page scrolls, which is already permitted while a question is
			pending. Nothing is hidden from the person deciding, and nothing is
			suppressed to make the linter quiet.
		-->
		<details class="approval-arguments" data-testid="approval-arguments">
			<summary>{`Arguments proposed for ${pending.toolName}`}</summary>
			<pre>{JSON.stringify(pending.arguments, null, 1)}</pre>
		</details>
		<div class="approval-actions">
			<button
				type="button"
				data-testid="approval-approve"
				aria-disabled={deciding}
				onclick={() => void decide(true)}
			>
				Approve
			</button>
			<button
				type="button"
				data-testid="approval-deny"
				aria-disabled={deciding}
				onclick={() => void decide(false)}
			>
				Deny
			</button>
		</div>
	{/if}
</section>

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
	.approval {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/*
		COLLAPSED, NOT HIDDEN, while there is no question.

		`display: none` was the first version of this and it defeats the entire
		point of mounting the region early: a hidden node is absent from the
		accessibility tree, so the browser has not registered the live region it
		is about to inject text into — which is the same failure
		`error-live-regions.e2e.ts` exists to prevent, reintroduced by a
		stylesheet rather than by an `{#if}`.

		Clipping keeps it in the tree at zero visual cost. The border and padding
		go with it, so an empty region leaves no box behind.
	*/
	.approval-question:empty {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		margin: -1px;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.approval-question {
		margin: 0;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--cinder-status-warning-border, currentColor);
		border-radius: 0.5rem;
		background: var(--cinder-status-warning-background, transparent);
	}

	/*
		CLOSED BY DEFAULT, so a note of any length costs one line until someone
		asks for it.

		The tool's schema puts no limit on the note, and the page is a
		fixed-viewport-height flex column whose only flexible child is the
		transcript — so rendering the whole thing inline took the transcript's
		space while the person was still deciding. Measured at 844x390: 0px with
		the arguments inline, and still 8px with them merely capped at 8rem,
		because a fifth of a 390px viewport is most of what the transcript had.
	*/
	.approval-arguments {
		border: 1px solid var(--cinder-border);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
	}

	.approval-arguments summary {
		cursor: pointer;
	}

	.approval-arguments pre {
		margin: 0.5rem 0 0;
		font-family: var(--cinder-font-mono, monospace);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.approval-actions {
		display: flex;
		gap: 0.5rem;
	}

	.approval-actions button {
		padding: 0.35rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid var(--cinder-border);
		background: var(--cinder-surface);
		cursor: pointer;
	}

	.approval-actions button[aria-disabled='true'] {
		cursor: not-allowed;
		color: var(--cinder-text-disabled);
	}

	/*
		Visually hidden, not `display: none`: the heading names the region for a
		screen reader moving by landmark, and a hidden element is not in the
		accessibility tree at all.
	*/
	.visually-hidden {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	/*
		`min-block-size: 0` alongside `flex: 1`: a flex item's automatic minimum
		size is its content, so without this the wrapper refuses to shrink below
		the transcript's full height and the page scrolls instead of the
		transcript.
	*/
	.chat {
		flex: 1;
		/*
			ZERO, deliberately, and the fix for the collapse is NOT here.

			The obvious repair for a transcript squeezed to nothing is a floor on
			this child plus a scrollable page. Both were tried and both are
			wrong: a scrollable page hands the scroll to the document, and
			`server-owned-streaming.e2e.ts` pins the opposite property — the
			TRANSCRIPT scrolls, the page does not, because page-scroll is exactly
			what a collapsed viewport produces. That test caught the trade
			immediately.

			So the space is reclaimed from what was taking it instead: the
			recovery panel is collapsed by default. This child keeps shrinking
			freely, which is what lets its internal scroll work at all.
		*/
		min-block-size: 0;
	}

	.failure {
		margin: 0;
		color: var(--cinder-status-danger-text, currentColor);
	}
</style>
