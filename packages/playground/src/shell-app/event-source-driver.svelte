<script lang="ts" module>
  import type { EventSourceHandlers } from './event-source.svelte.ts';

  export type EventSourceDriverProps = {
    initial: string | null;
    handlers?: EventSourceHandlers;
  };

  export type EventSourceDriverHandle = {
    setUrl(next: string | null): void;
  };
</script>

<script lang="ts">
  import Fixture from './event-source-fixture.svelte';

  let { initial, handlers = {} }: EventSourceDriverProps = $props();

  let url = $state<string | null>(initial);

  /** Imperative handle the test holds onto so it can mutate `url`. */
  export function setUrl(next: string | null): void {
    url = next;
  }
</script>

<Fixture bind:url {handlers} />
