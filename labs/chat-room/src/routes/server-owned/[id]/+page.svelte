<script lang="ts">
	import { resolve } from '$app/paths';

	import ConversationSurface from './conversation-surface.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<!--
	Titled by the CONVERSATION, so several open at once are distinguishable in
	a tab strip and by screen-reader page-title navigation. The `<h1>` below is
	not a substitute: nothing outside the document reads it.
-->
<svelte:head><title>{data.title} · Server-owned · Chatroom</title></svelte:head>

<main>
	<aside class="variant-banner" role="note" data-testid="server-owned-banner">
		<strong>Noncanonical variant.</strong> This conversation is owned by the
		<em>server</em>. Reloading re-reads it from the session store.
		<a href={resolve('/')}>The canonical exemplar</a> keeps its transcript in the browser.
	</aside>

	<h1 data-testid="server-owned-title">{data.title}</h1>

	<!--
		KEYED on the conversation id, and this is load-bearing rather than
		defensive. SvelteKit reuses a page component when only a route parameter
		changes. `data` updated while the one-time initializer did not, so the next
		submission would be persisted to B underneath A's visible history.

		LATENT: there is no detail-to-detail link in this route family yet, and
		browser history between two separately loaded documents is a real
		navigation rather than a parameter-only update. See
		`conversation-surface.svelte` for the full note.

		A key rather than an effect that resets each field: the surface owns a
		mirror, a streaming flag, a failure banner, and a session controller with
		its own subscriptions and `onDestroy`. Tearing the whole thing down and
		rebuilding it makes the reset exhaustive by construction, instead of
		correct only while someone remembers to extend it.
	-->
	{#key data.id}
		<ConversationSurface id={data.id} conversation={data.conversation} />
	{/key}
</main>

<style>
	/*
		A DEFINITE height, because Chat's root is `height: 100%` and a percentage
		height against an auto-height ancestor resolves to auto. Without this the
		transcript viewport collapses to its intrinsic content height instead of
		owning the page's remaining space — it renders, so it looks fine with two
		messages and is wrong with twenty. The canonical exemplar does the same
		thing inline; here it belongs in the stylesheet the page already has.
	*/
	main {
		block-size: 100dvh;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.variant-banner {
		border: 1px solid var(--cinder-status-warning-border, currentColor);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--cinder-status-warning-background, transparent);
	}
</style>
