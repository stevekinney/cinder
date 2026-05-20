<script lang="ts">
  import { createEventSource, type EventSourceHandlers } from './event-source.svelte.ts';

  type Props = {
    /**
     * Bindable URL. The test passes a starting value and mutates it via
     * `bind:url={state}` from a component context where `$state` is defined.
     */
    url?: string | null;
    handlers?: EventSourceHandlers;
  };

  let { url = $bindable(null), handlers = {} }: Props = $props();
</script>

<div data-testid="event-source-host" {@attach createEventSource(() => url, handlers)}></div>
