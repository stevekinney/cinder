<script lang="ts" module>
  export const title = 'Basic accordion';
  export const description = 'Single-select: opening one item closes the others.';
</script>

<script lang="ts">
  import { Accordion, AccordionItem } from '../../../../src/index.ts';

  let expandedIds = $state<string[]>([]);
</script>

<Accordion bind:expandedIds>
  <AccordionItem id="item-1" title="What is Cinder?">
    Cinder is a Svelte 5 design system built for composability and accessibility.
  </AccordionItem>
  <AccordionItem id="item-2" title="How do I install it?">
    Run <code>bun add cinder</code> and import components from <code>cinder</code> or via subpath imports.
  </AccordionItem>
  <AccordionItem id="item-3" title="Does it support SSR?">
    Yes — every component is SSR-safe and renders meaningful HTML before hydration.
  </AccordionItem>
</Accordion>
