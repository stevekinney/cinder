<script lang="ts">
	import type { RecoveryOutcome } from '$lib/server-owned-recovery';

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
			outcome = (await response.json()) as Reported;
		} catch {
			failure = 'The recovery check could not reach the server.';
		} finally {
			checking = false;
		}
	}
</script>

<section class="recovery" aria-labelledby="recovery-heading">
	<h2 id="recovery-heading">Durable recovery</h2>

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
	<p class="explain" data-testid="recovery-durability">
		{#if outcome !== undefined}
			{#if outcome.durability === 'on-disk'}
				Storage: on disk. A run left in flight is still recorded when the next process starts.
			{:else}
				Storage: in memory. Nothing survives this process, so there is never a run to re-attach to —
				set <code>CHAT_ROOM_SERVER_OWNED_DATABASE</code> to a file path to make the question answerable.
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

	<p class="status" role="status" data-testid="recovery-status">
		{#if outcome?.kind === 'nothing-to-resume'}
			Nothing to resume. No run was in flight — this session is idle, not lost.
		{:else if outcome?.kind === 'recovered'}
			Re-attached to a run in flight. Progress is {outcome.progress}: {outcome.note}
		{:else if outcome?.kind === 'orphaned'}
			Orphaned. A re-attach was attempted and every candidate rejected, so this run's work is
			terminally gone.
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
</section>

<style>
	.recovery {
		border: 1px solid var(--cinder-border);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	h2 {
		font-size: 1rem;
		margin: 0;
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
