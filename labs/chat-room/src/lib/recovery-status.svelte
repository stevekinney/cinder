<script lang="ts">
	/**
	 * What a durable re-attach found, rendered so the three outcomes cannot be
	 * mistaken for each other.
	 *
	 * The distinction this exists for: `recover()` returns `null` both when
	 * nothing was in flight and when a re-attach was attempted and every
	 * candidate rejected. One is a healthy idle session; the other is a run
	 * whose work is gone. Rendering them identically would be the interface
	 * telling a comfortable lie about the second.
	 *
	 * MOUNTED ALWAYS, empty until asked, rather than gated behind `{#if}`. The
	 * lab's `error-live-regions.e2e.ts` enforces that rule for every status
	 * region here, because a region that appears with text already in it is not
	 * reliably announced.
	 */
	let { id }: { id: string } = $props();

	type Durability = 'in-memory' | 'on-disk';

	type Reported =
		| { kind: 'recovered'; progress: string; note: string; durability: Durability }
		| { kind: 'nothing-to-resume'; durability: Durability }
		| {
				kind: 'orphaned';
				durability: Durability;
				note: string;
				failures: readonly { runId: string; reason: string }[];
		  };

	let outcome = $state<Reported | undefined>(undefined);
	let checking = $state(false);
	let failure = $state('');

	/**
	 * Whether an orphan has already been reported on this page.
	 *
	 * Kept because the classification is REPORTED ONCE: Operative reconciles a
	 * stranded run as it reports the rejection, so the next check answers
	 * benignly. Without this the second reading would erase the first and claim
	 * nothing was ever in flight.
	 */
	let seenOrphan = $state(false);

	/** The backing store, in the sentence that announces the outcome. */
	function durabilitySentence(durability: Durability): string {
		return durability === 'on-disk'
			? 'Storage is on disk, so a run left in flight is recorded for the next process.'
			: 'Storage is in memory, so nothing survives this process and no previous run could be observed.';
	}

	async function check(): Promise<void> {
		if (checking) return;
		checking = true;
		failure = '';
		outcome = undefined;
		try {
			const response = await fetch(`/api/server-owned/conversations/${id}/recovery`);
			if (!response.ok) {
				const body = (await response.json().catch(() => ({}))) as { error?: string };
				// The SERVER'S sentence, not the JSON envelope — the same rule the
				// streaming surface follows, and for the same reason: a reader
				// should get a sentence rather than `{"error":"…"}`.
				failure = body.error ?? 'The recovery check failed.';
				return;
			}
			const reported = (await response.json()) as Reported;
			if (reported.kind === 'orphaned') seenOrphan = true;
			outcome = reported;
		} catch {
			failure = 'The recovery check could not reach the server.';
		} finally {
			checking = false;
		}
	}
</script>

<!--
	COLLAPSED BY DEFAULT, and that is a layout fix rather than a preference.

	The detail route is a fixed-viewport-height flex column whose only flexible
	child is the chat. Expanded, this panel took 200-285px of it — at a
	phone-landscape 844x390 the transcript and composer measured exactly 0px.
	The obvious repairs both fail: a floor on the chat plus a scrollable page
	hands the scroll to the document, and `server-owned-streaming.e2e.ts` pins
	the opposite property, because page-scroll is what a collapsed viewport
	produces in the first place.

	A diagnostic that is closed until asked for takes ~40px instead, which
	leaves the transcript usable at every viewport without touching how the
	scroll is owned. `<details>` also gets the disclosure semantics and keyboard
	behaviour for free.
-->
<details class="recovery">
	<summary>Durable recovery</summary>

	<p class="explain">
		Asks the server whether a run from a previous process is still re-attachable. After a restart
		this variant reports <em>orphaned</em> rather than recovering: a run's provider is bound to a request-scoped
		key and its writer to one HTTP response, so there is nothing to resume into.
	</p>

	<!--
		The backing store, named rather than left to be inferred. "Nothing to
		resume" is the TRUTH under in-memory storage and a bug-shaped surprise
		under on-disk storage, and a panel that reported the outcome without
		saying which it was running over would leave a reader unable to tell the
		two apart.
	-->
	<!--
		The same fact the announcement carries, with the part a reader can ACT on
		— the variable to set. Left out of the live region on purpose: an
		announcement should say what happened, not recite configuration.
	-->
	<p class="explain" data-testid="recovery-durability">
		{#if outcome !== undefined}
			{#if outcome.durability === 'on-disk'}
				Storage: on disk.
			{:else}
				Storage: in memory. Set <code>CHAT_ROOM_SERVER_OWNED_DATABASE</code> to a file path to make the
				question answerable.
			{/if}
		{/if}
	</p>

	<button
		type="button"
		data-testid="recovery-check"
		aria-busy={checking}
		aria-disabled={checking}
		onclick={check}
	>
		{checking ? 'Checking…' : 'Check for a recoverable run'}
	</button>

	<!--
		THE DURABILITY SENTENCE IS IN THE ANNOUNCEMENT, not only in the paragraph
		beside it. Review caught the split: the ordinary paragraph changed
		silently while this region announced the reassuring half, so a screen
		reader heard "idle, not lost" without learning that in-memory storage
		could not have observed a previous process at all. The qualifier is what
		makes the outcome mean anything.

		The benign reading is deliberately NOT "no run was in flight". After an
		orphan has been reported and reconciled, a run WAS in flight and its work
		was lost — so that wording would make a false historical claim in exactly
		the two-click scenario the exercise documents. "Nothing is currently
		resumable" is true either way.
	-->
	<p class="status" role="status" data-testid="recovery-status">
		{#if outcome?.kind === 'nothing-to-resume'}
			Nothing is currently resumable. {seenOrphan
				? 'The orphaned run reported earlier is already reconciled; this is what a second check answers, not a claim that nothing was lost.'
				: 'No run is in flight for this session.'}
			{durabilitySentence(outcome.durability)}
		{:else if outcome?.kind === 'recovered'}
			Re-attached to a run in flight. Progress is {outcome.progress}: {outcome.note}
			{durabilitySentence(outcome.durability)}
		{:else if outcome?.kind === 'orphaned'}
			Orphaned. A re-attach was attempted and every candidate rejected, so this run's work is
			terminally gone. {durabilitySentence(outcome.durability)}
		{/if}
	</p>

	{#if outcome?.kind === 'orphaned'}
		<ul data-testid="recovery-failures">
			{#each outcome.failures as entry (entry.runId)}
				<li><code>{entry.runId}</code> — {entry.reason}</li>
			{/each}
		</ul>
		<!--
			Said out loud, because the classification does not survive being asked
			for twice. Operative reconciles a stranded run to terminal as it reports
			the rejection, so the next check answers "nothing to resume" — a reader
			who clicked again and saw the orphan vanish would reasonably read that as
			a bug in this panel rather than the repair it is.
		-->
		<p class="explain" data-testid="recovery-once">{outcome.note}</p>
	{/if}

	<p class="failure" role="alert" data-testid="recovery-error">
		{#if failure !== ''}
			{failure}
		{/if}
	</p>
</details>

<style>
	.recovery {
		border: 1px solid var(--cinder-border);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
	}

	/*
		The panel's contents only participate in the flex column once the
		disclosure is open; closed, `<details>` is just its summary.
	*/
	.recovery[open] {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	summary {
		font-weight: 600;
		cursor: pointer;
	}

	.explain {
		margin: 0;
		color: var(--cinder-text-secondary);
		font-size: 0.875rem;
	}

	.status,
	.failure {
		margin: 0;
		min-block-size: 1.25rem;
	}

	.failure {
		color: var(--cinder-status-danger-text);
	}

	ul {
		margin: 0;
		padding-inline-start: 1.25rem;
		font-size: 0.875rem;
	}

	button {
		align-self: start;
		padding: 0.35rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid var(--cinder-border);
		background: var(--cinder-surface);
		cursor: pointer;
	}

	button[aria-disabled='true'] {
		background: var(--cinder-surface-inset);
		color: var(--cinder-text-disabled);
		cursor: not-allowed;
	}
</style>
