<script lang="ts">
	// Base stylesheet must load first — it declares the cascade @layer order.
	// The guard warns in dev if a component's styles ever land before it.
	import '@lostgradient/cinder/styles';
	import '@lostgradient/cinder/styles/guard';

	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// Hydration beacon for Playwright: effects run only in the browser, after
	// the tree mounts, so this marks the moment SSR-rendered controls have
	// live handlers. Tests wait for it before their first interaction —
	// clicking earlier lands on dead DOM and flakes under parallel workers.
	$effect(() => {
		document.body.dataset.hydrated = 'true';
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
