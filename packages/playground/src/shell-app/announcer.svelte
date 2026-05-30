<script lang="ts">
  import { getAnnouncer } from './announcer.svelte.ts';

  // The shell's single polite live region. Both the top bar and the shell's
  // client-side navigation push messages through this one Announcer instance,
  // so there is exactly one region in the document (two would double-read).
  const announcer = getAnnouncer();
</script>

<span class="sr-only" aria-live="polite" aria-atomic="true">{announcer.message}</span>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
