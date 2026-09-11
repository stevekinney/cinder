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
		} catch {
			// A rejected `fetch` — connection reset, offline — reaches here, not
			// the `!response.ok` branch. Without this the `finally` would reset
			// the button and the form would look idle, as though nothing had
			// been attempted.
			failure = 'Could not reach the server. Check your connection and try again.';
		} finally {
			creating = false;
		}
	}
</script>

<!--
	A document title, because the heading is not one. Browser tabs, window
	switchers, and screen-reader page-title navigation all read `<title>`, and
	with several conversations open the tab strip is the only place they are
	told apart. Neither the shared layout nor `app.html` supplies one.
-->
<svelte:head><title>Server-owned conversations · Chatroom</title></svelte:head>

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
		<!--
			A STABLE accessible name plus `aria-busy`, rather than swapping the
			label to "Creating…" alone. A control whose name changes and which
			then goes disabled reads to a screen reader as a different,
			unavailable control — no confirmation that anything started. The
			visible text still changes, since that is the right affordance for a
			sighted user; the accessible name does not.
		-->
		<button
			type="submit"
			data-testid="server-owned-create"
			aria-label="Create conversation"
			aria-busy={creating}
			disabled={creating}
		>
			{creating ? 'Creating…' : 'Create'}
		</button>
	</form>

	<!--
		Mounted ALWAYS, empty until a create fails, rather than gated on
		`{#if failure}`. Chat's own `chat-status-announcer.svelte` states the
		rule — "mounting with pre-existing text is not reliably announced" — and
		`error-live-regions.e2e.ts` enforces it across every banner in this
		repository, this one included. Conditionally mounting the region would
		leave a screen-reader user with a visible error and no announcement,
		which is precisely the failure that spec was written after finding seven
		times.
	-->
	<p class="failure" role="alert" data-testid="server-owned-failure">
		{#if failure !== ''}
			{failure}
		{/if}
	</p>

	<h2>Conversations</h2>
	{#if data.conversations.length === 0}
		<p data-testid="server-owned-empty">No conversations yet.</p>
	{:else}
		<!--
			`role="list"` restated, because `list-style: none` below removes it.
			Safari with VoiceOver drops a list from the accessibility tree once
			its markers are gone, so the conversations would be announced as
			unrelated links and text rather than as a collection with a count.
			This repository's own `DataList` handles the same browser behaviour
			the same way, which is why this is a convention here rather than a
			workaround.
		-->
		<ul role="list" data-testid="server-owned-list">
			{#each data.conversations as conversation (conversation.id)}
				<li data-testid="server-owned-conversation">
					<!--
						The accessible name carries the message count and a short
						id fragment as well as the title, because titles are not
						unique — the create endpoint permits duplicates, and two
						conversations called "Release planning" with the same
						message count render identical rows. A screen reader's
						links list would then offer two identically named
						destinations whose URLs are opaque UUIDs, and the only way
						to tell them apart would be to open both.

						NO TIMESTAMP, and it was removed for two reasons that
						arrived in that order. It was measured not to distinguish
						anything: two conversations created in the same second
						produce the same `toLocaleString()`, which is how the test
						for this first failed, and sessions saved inside one
						millisecond share `updatedAt` outright. And it was a
						hydration hazard — `toLocaleString()` renders against the
						server's locale and time zone during SSR and the browser's
						on hydration, so the attribute differed whenever the two
						disagreed.

						The id carries the whole distinguishing claim. Eight
						characters of a UUID are not meaningful to anyone, and
						that is accepted: the claim is only that two rows can be
						told apart, which nothing else on the row guarantees. The
						name still LEADS with the title, so the announcement opens
						with what the user was looking for.

						`aria-label` rather than more visible text: the count is
						already on screen beside the link, and repeating it in the
						row would be noise for a sighted reader while the
						announcement is what actually lacks the context.
					-->
					<a
						href={resolve('/server-owned/[id]', { id: conversation.id })}
						data-testid="server-owned-conversation-title"
						aria-label="{conversation.title}, {conversation.messageCount} message{conversation.messageCount ===
						1
							? ''
							: 's'}, id {conversation.id.slice(0, 8)}">{conversation.title}</a
					>
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

		/* Centred, not pinned left. Every other route in this lab that caps its
		   width pairs the cap with `margin: 0 auto`; this one set the cap and
		   not the centring, so on a wide viewport the 48rem column sat against
		   the left edge with the rest of the window empty. */
		margin-inline: auto;
	}

	.variant-banner {
		border: 1px solid var(--cinder-status-warning-border, currentColor);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--cinder-status-warning-background, transparent);
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

	/*
		Styled, because cinder's base stylesheet resets `button` and this page
		otherwise rendered its only action as bare text — no border, no fill,
		nothing to say it could be pressed. The visual pass this project ends
		with caught it, and "the primary control does not look like a control"
		is not something to leave in a route that ships.
		
		Composed from cinder's own tokens rather than a cinder `Button`
		component: no route in this lab imports one, and every exercise here is
		deliberately plain scaffolding around the component actually under
		demonstration. Introducing the first component import in this one route
		would make it the odd one out without making it better. The tokens give
		the affordance and stay on the design system's ramp.

		Worth noting for someone doing the same pass later: every other bare
		`<button>` in this lab has the same problem, and fixing them is not this
		pull request's job.
	*/
	button {
		padding: var(--cinder-space-1-5) var(--cinder-space-4);
		border: 1px solid transparent;
		border-radius: var(--cinder-radius-md);
		background: var(--cinder-accent-solid);
		color: var(--cinder-accent-contrast);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: var(--cinder-accent-solid-hover);
	}

	/* Disabled while a create is in flight — it has to read as unavailable
	   rather than merely unchanged, since the label also swaps to "Creating…". */
	button:disabled {
		background: var(--cinder-surface-inset);
		color: var(--cinder-text-disabled);
		cursor: not-allowed;
	}

	/* The input is given the same border and radius so the two read as one
	   control pair rather than a styled button beside a browser default. */
	input {
		padding: var(--cinder-space-1-5) var(--cinder-space-2);
		border: 1px solid var(--cinder-border);
		border-radius: var(--cinder-radius-md);
		background: var(--cinder-surface);
		color: var(--cinder-text-default);
		font: inherit;
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
		border: 1px solid var(--cinder-border, currentColor);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
	}

	/*
		A title is up to 120 characters and nothing forces them to contain a
		space. A flex item's automatic minimum size is its MIN-CONTENT width, so
		one unbroken 120-character title would push the row — and with it the
		page — wider than the viewport, leaving a reader at 320px or high zoom
		scrolling sideways to read a list.

		`min-inline-size: 0` lets the item shrink below that intrinsic minimum,
		and `overflow-wrap: anywhere` gives the text somewhere to break when
		there is no space to break at. Both are needed: the first alone would
		clip, the second alone never gets the chance.
	*/
	li a {
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}

	/* The count must not be the thing that gets squeezed — it is short and
	   fixed, so it keeps its intrinsic width while the title takes the slack. */
	li span {
		flex: none;
	}

	/*
		`margin: 0` because the region is now always in the layout: a default
		paragraph margin would open a gap under the form on every visit, whether
		or not anything failed.
	*/
	.failure {
		margin: 0;
		color: var(--cinder-status-danger-text, currentColor);
	}
</style>
