<script lang="ts">
	import { resolve } from '$app/paths';

	import RecoveryStatus from '$lib/recovery-status.svelte';
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

	<!--
		INSIDE the `{#key}`, and the comment that used to sit here said the
		opposite: that this panel "holds no per-conversation state worth
		discarding". That was true when it was written and false by the time the
		panel grew `outcome`, `failure`, and `seenOrphan` — every one of which is
		about ONE conversation.

		Left outside, a client-side navigation from A to B reuses the component
		with only `id` changed, so B opens showing A's orphan and its failure
		list, and a benign check for B claims A's orphan was already reconciled.
		Remounting discards all of it by construction, which is the same reason
		the surface above is keyed.
	-->
	{#key data.id}
		<RecoveryStatus id={data.id} />
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

	/*
		WHILE AN APPROVAL IS UP, the column may grow and the page may scroll.

		Measured at 844x390 this page is exactly full when idle — banner 68,
		heading 35, transcript 129, recovery summary 47, plus gaps and padding,
		is 391 of 390 available pixels. So an approval prompt appearing mid-turn
		has nowhere to come from but the transcript, and capping the prompt only
		made the collapse smaller (0px, then 8px) rather than fixing it.

		The trade is resolved by WHEN rather than by how much. With no question
		pending the fixed height stands, which is what keeps the transcript
		owning its own scroll — the property `server-owned-streaming.e2e.ts`
		pins, and the one an earlier unconditional `min-block-size` broke on all
		three engines. While a question IS pending the task is the decision, and
		a page that scrolls is better than a transcript that is gone.

		`:has()` rather than a state flag threaded up from the surface: the
		condition is exactly "this subtree contains a non-empty question", which
		is what the selector says.

		`:global()` inside it because the question belongs to the child
		component. Without it Svelte scopes the class to THIS component, matches
		nothing, drops the rule, and reports it as an unused selector — which is
		how the first version of this silently did nothing at all.
	*/
	main:has(:global(.approval-question:not(:empty))),
	main:has(:global(.status:not(:empty))),
	main:has(:global(.failure:not(:empty))) {
		block-size: auto;
		min-block-size: 100dvh;
	}

	main:has(:global(.approval-question:not(:empty))) :global(.chat),
	main:has(:global(.status:not(:empty))) :global(.chat),
	main:has(:global(.failure:not(:empty))) :global(.chat) {
		min-block-size: 8rem;
	}

	.variant-banner {
		border: 1px solid var(--cinder-status-warning-border, currentColor);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--cinder-status-warning-background, transparent);
	}
</style>
