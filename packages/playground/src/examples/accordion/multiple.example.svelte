<script lang="ts" module>
  export const title = 'Multiple open';
  export const description = 'With multiple={true}, any number of items can be open at once.';
</script>

<script lang="ts">
  import { Accordion, AccordionItem } from '../../../../components/src/index.ts';

  let expandedIds = $state<string[]>(['faq-1', 'faq-3']);
</script>

<Accordion multiple bind:expandedIds>
  <AccordionItem id="faq-1" title="Can I use multiple themes?">
    Yes — swap the CSS variables or layer your own tokens on top.
  </AccordionItem>
  <AccordionItem id="faq-2" title="Is it tree-shakeable?">
    Every component is individually importable via subpath exports.
  </AccordionItem>
  <AccordionItem id="faq-3" title="What browsers are supported?">
    Modern evergreen browsers. IE is not supported.
  </AccordionItem>
</Accordion>
