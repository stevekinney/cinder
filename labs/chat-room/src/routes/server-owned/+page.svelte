<script lang="ts">
	import { resolve } from '$app/paths';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let title = $state('');
	let creating = $state(false);
	let failure = $state('');

	async function create(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (creating) return;
		creating = true;
		failure = '';
		try {
			const response = await fetch('/api/server-owned/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});
			if (!response.ok) {
				const body: unknown = await response.json().catch(() => ({}));
				failure =
					typeof (body as { error?: unknown }).error === 'string'
						? (body as { error: string }).error
						: 'Could not create the conversation.';
				return;
			}
			title = '';
			// A full navigation rather than a client-side patch: the list is
			// server-rendered, so re-rendering it on the server is what keeps
			// the page honest about where the state lives.
			location.reload();
		} finally {
			creating = false;
		}
	}
</script>

<main>
	<!--
		The label the acceptance criterion asks for, and it is deliberately
		the first thing in the document rather than a footnote. This family
		and the canonical exemplar at `/` look similar by design — same Chat
		component, same transcript shape — so anything short of a prominent,
		persistent banner invites someone to screenshot this and call it the
		reference implementation.

		`role="note"` rather than `role="alert"`: it is standing context, not
		something that just happened, and an alert would be announced ahead of
		the page's own heading on every visit.
	-->
	<aside class="variant-banner" role="note" data-testid="server-owned-banner">
		<strong>Noncanonical variant.</strong> Conversations here are owned by the
		<em>server</em> and persisted through Operative's session store. The canonical browser-owned
		exemplar lives at
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={resolve('/')}>the root route</a>.
	</aside>

	<h1>Server-owned conversations</h1>

	<form onsubmit={create}>
		<label for="new-conversation-title">New conversation</label>
		<input
			id="new-conversation-title"
			data-testid="server-owned-new-title"
			bind:value={title}
			maxlength="120"
			placeholder="Release planning"
			required
		/>
		<button type="submit" data-testid="server-owned-create" disabled={creating}>
			{creating ? 'Creating…' : 'Create'}
		</button>
	</form>

	{#if failure !== ''}
		<p class="failure" role="alert" data-testid="server-owned-failure">{failure}</p>
	{/if}

	<h2>Conversations</h2>
	{#if data.conversations.length === 0}
		<p data-testid="server-owned-empty">No conversations yet.</p>
	{:else}
		<ul data-testid="server-owned-list">
			{#each data.conversations as conversation (conversation.id)}
				<li data-testid="server-owned-conversation">
					<span data-testid="server-owned-conversation-title">{conversation.title}</span>
					<span data-testid="server-owned-conversation-count">
						{conversation.messageCount} message{conversation.messageCount === 1 ? '' : 's'}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 48rem;
	}

	.variant-banner {
		border: 1px solid var(--cinder-color-warning-border, currentColor);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--cinder-color-warning-bg, transparent);
	}

	form {
		display: flex;
		gap: 0.5rem;
		align-items: end;
		flex-wrap: wrap;
	}

	label {
		display: block;
		font-weight: 600;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}

	li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border: 1px solid var(--cinder-color-border, currentColor);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
	}

	.failure {
		color: var(--cinder-color-danger-fg, currentColor);
	}
</style>
