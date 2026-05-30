<script lang="ts">
  import Announcer from './announcer.svelte';
  import { Announcer as AnnouncerStore, setAnnouncer } from './announcer.svelte.ts';

  type Props = {
    /**
     * The announcer instance under test. The test holds the same reference so
     * it can call `announce()` / `cancel()` and read `message` directly while
     * the rendered live region reflects it.
     */
    announcer: AnnouncerStore;
  };

  let { announcer }: Props = $props();

  setAnnouncer(announcer);
</script>

<Announcer />
