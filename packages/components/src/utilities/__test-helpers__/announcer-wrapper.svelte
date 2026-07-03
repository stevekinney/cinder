<script lang="ts">
  import { useAnnouncer } from '../use-announcer.svelte.ts';

  let {
    clearDelay = 1000,
    debounceMs = 0,
  }: {
    clearDelay?: number;
    debounceMs?: number;
  } = $props();

  const announcer = useAnnouncer({ clearDelay, debounceMs });
</script>

<button type="button" onclick={() => announcer.announce('Saved')}>announce saved</button>
<button type="button" onclick={() => announcer.announce('Updated')}>announce updated</button>
<button type="button" onclick={() => announcer.clear()}>clear</button>
<button type="button" onclick={() => announcer.destroy()}>destroy</button>

<div aria-live="polite" aria-atomic="true" data-message={announcer.message}>
  {announcer.message}
</div>
