<script lang="ts" module>
  export const title = 'Disabled item';
  export const description = 'A disabled AccordionItem cannot be toggled.';
</script>

<script lang="ts">
  import { Accordion, AccordionItem } from '../../../../src/index.ts';

  let expandedIds = $state<string[]>([]);
</script>

<Accordion bind:expandedIds>
  <AccordionItem id="a" title="Available">This item can be toggled normally.</AccordionItem>
  <AccordionItem id="b" title="Disabled (locked)" disabled>
    This content is never shown because the item is disabled.
  </AccordionItem>
  <AccordionItem id="c" title="Also available">This one too.</AccordionItem>
</Accordion>
