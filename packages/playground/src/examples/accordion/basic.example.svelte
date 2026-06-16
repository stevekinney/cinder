<script lang="ts" module>
  export const title = 'Basic accordion';
  export const description =
    'Single-select: opening one item closes the others. Uses the Accordion namespace API.';
  export const featured = true;
</script>

<script lang="ts">
  import { Accordion } from '@lostgradient/cinder/accordion';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let item1Id = $derived(`${mountIdPrefix ?? uid}-item-1`);
  let item2Id = $derived(`${mountIdPrefix ?? uid}-item-2`);
  let item3Id = $derived(`${mountIdPrefix ?? uid}-item-3`);

  let expandedIds = $state<string[]>([]);
</script>

<Accordion bind:expandedIds>
  <Accordion.Item id={item1Id} title="What is Cinder?">
    Cinder is a Svelte 5 design system built for composability and accessibility.
  </Accordion.Item>
  <Accordion.Item id={item2Id} title="How do I install it?">
    Run <code>bun add @lostgradient/cinder</code> and import components from
    <code>@lostgradient/cinder</code> or via subpath imports.
  </Accordion.Item>
  <Accordion.Item id={item3Id} title="Does it support SSR?">
    Yes — every component is SSR-safe and renders meaningful HTML before hydration.
  </Accordion.Item>
</Accordion>
