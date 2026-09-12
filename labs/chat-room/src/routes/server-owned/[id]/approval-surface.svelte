<script lang="ts">
	import { toBannerFailure, type BannerFailure } from '$lib/chat-failure';

	let {
		id,
		streaming,
		failure = $bindable<BannerFailure | null>(),
		failureMessage
	}: {
		id: string;
		streaming: boolean;
		failure?: BannerFailure | null;
		failureMessage: (response: Response) => Promise<string>;
	} = $props();

	type PendingApproval = {
		toolName: string;
		callId: string;
		message: string;
		arguments: Record<string, unknown>;
	};

	let pending = $state<PendingApproval | null>(null);
	let deciding = $state(false);

	let approvalQuestion = $state<HTMLElement | null>(null);

	let approvalSection = $state<HTMLElement | null>(null);

	let pollGeneration = 0;

	let answerEpoch = 0;

	let pollController: AbortController | null = null;
	let decisionController: AbortController | null = null;
	let decisionAttempt = 0;

	function clearPollFailure(): void {
		if (pollFailure !== null && failure === pollFailure) failure = null;
		pollFailure = null;
	}

	let pollFailure: BannerFailure | null = null;

	let decideFailure: BannerFailure | null = null;

	function invalidateDecision(): void {
		decisionAttempt += 1;
		decisionController?.abort();
		decisionController = null;
		deciding = false;
		if (decideFailure !== null && failure === decideFailure) failure = null;
		decideFailure = null;
	}

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
			if (answeredOrChanged) {
				invalidateDecision();
				handOffFocusFromApproval();
			}
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
		const attempt = ++decisionAttempt;
		const controller = new AbortController();
		decisionController = controller;
		try {
			const response = await fetch(`/api/server-owned/conversations/${id}/elicitation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				// The CALL ID travels with the answer. Without it a click that
				// lands after this question's run ended would settle whatever is
				// pending next — approving a note nobody was shown.
				body: JSON.stringify({ approved, callId: question.callId }),
				signal: controller.signal
			});
			// The question can change while this POST is in flight. A successful
			// response only answers the server; it does not authorize changing this
			// tab's controls for a different question.
			if (
				attempt !== decisionAttempt ||
				pending?.callId !== question.callId ||
				generation !== pollGeneration ||
				epoch !== answerEpoch
			) {
				return;
			}
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
				if (
					attempt !== decisionAttempt ||
					pending?.callId !== question.callId ||
					generation !== pollGeneration ||
					epoch !== answerEpoch
				)
					return;
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
			// The poll path clears only poll-owned errors, while an authoritative
			// question transition clears this decision's error, so this one also
			// has to clear its own on success.
			if (decideFailure !== null && failure === decideFailure) {
				failure = null;
			}
			decideFailure = null;
		} catch (cause) {
			if (
				attempt !== decisionAttempt ||
				pending?.callId !== question.callId ||
				generation !== pollGeneration ||
				epoch !== answerEpoch
			)
				return;
			const reported = toBannerFailure(cause);
			decideFailure = reported;
			failure = reported;
		} finally {
			if (attempt === decisionAttempt) {
				deciding = false;
				if (decisionController === controller) decisionController = null;
			}
		}
	}

	$effect(() => {
		if (!streaming) {
			invalidateDecision();
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
</script>

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

<style>
	.approval {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

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
</style>
