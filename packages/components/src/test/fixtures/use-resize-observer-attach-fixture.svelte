<script lang="ts" module>
  import type {
    ResizeCallback,
    UseResizeObserverOptions,
  } from '../../utilities/use-resize-observer.svelte.ts';

  export type UseResizeObserverAttachFixtureProps = {
    onResize: ResizeCallback;
    options?: UseResizeObserverOptions;
  };
</script>

<script lang="ts">
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';

  let { onResize, options }: UseResizeObserverAttachFixtureProps = $props();
</script>

<div data-testid="sentinel" {@attach useResizeObserver(onResize, options)}></div>
