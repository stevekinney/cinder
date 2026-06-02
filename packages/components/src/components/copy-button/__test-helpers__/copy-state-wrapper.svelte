<script lang="ts">
  import { createCopyState } from '../use-copy-state.svelte.ts';

  interface Props {
    confirmDuration?: number;
  }

  let { confirmDuration = 2000 }: Props = $props();

  const copyState = createCopyState<'alpha' | 'beta'>(confirmDuration);

  let lastResult = $state<boolean | null>(null);

  async function copyAlpha() {
    lastResult = await copyState.trigger('alpha', 'alpha-value');
  }

  async function copyBeta() {
    lastResult = await copyState.trigger('beta', 'beta-value');
  }
</script>

<div>
  <span data-copied-key={copyState.copiedKey === null ? 'null' : copyState.copiedKey}></span>
  {#if lastResult !== null}
    <span data-last-result={lastResult.toString()}></span>
  {/if}
  <button onclick={copyAlpha}>copy-alpha</button>
  <button onclick={copyBeta}>copy-beta</button>
</div>
