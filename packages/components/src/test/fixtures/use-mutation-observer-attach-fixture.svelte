<script lang="ts" module>
  import type {
    MutationCallback,
    UseMutationObserverOptions,
  } from '../../utilities/use-mutation-observer.svelte.ts';

  export type UseMutationObserverAttachFixtureProps = {
    onMutate: MutationCallback;
    options?: UseMutationObserverOptions;
  };
</script>

<script lang="ts">
  import { useMutationObserver } from '../../utilities/use-mutation-observer.svelte.ts';

  let { onMutate, options }: UseMutationObserverAttachFixtureProps = $props();
</script>

<div data-testid="sentinel" {@attach useMutationObserver(onMutate, options)}></div>
