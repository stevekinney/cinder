<script lang="ts">
  import { Accordion } from './index.ts';

  type FixtureProps = {
    expandedIds?: string[];
    multiple?: boolean;
  };

  let { expandedIds = [], multiple = false }: FixtureProps = $props();
  let selectedIds = $state([...expandedIds]);
</script>

<div class="accordion-fixture">
  <Accordion {multiple} bind:expandedIds={selectedIds}>
    <Accordion.Item id="item-1" title="What is Cinder?">
      Cinder is a Svelte 5 design system built for composability and accessibility.
    </Accordion.Item>
    <Accordion.Item id="item-2" title="How do I install it?">
      Run <code>bun add @lostgradient/cinder</code> and import components from the root package or subpath
      exports.
    </Accordion.Item>
    <Accordion.Item id="item-3" title="Does it support SSR?">
      Yes. Components render meaningful server HTML and hydrate without client-only wrappers.
    </Accordion.Item>
  </Accordion>
</div>

<style>
  .accordion-fixture {
    max-inline-size: 42rem;
  }
</style>
