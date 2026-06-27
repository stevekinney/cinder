<script lang="ts" module>
  import type {
    IntersectionCallback,
    UseIntersectionOptions,
  } from '../../utilities/use-intersection.types.ts';

  export type UseIntersectionAttachFixtureProps = {
    onIntersect: IntersectionCallback;
    options?: UseIntersectionOptions;
  };
</script>

<script lang="ts">
  import { useIntersection } from '../../utilities/use-intersection.svelte.ts';

  let { onIntersect, options }: UseIntersectionAttachFixtureProps = $props();
</script>

<div data-testid="sentinel" {@attach useIntersection(onIntersect, options)}></div>
