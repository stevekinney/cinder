<script lang="ts" module>
  export const title = 'Disabled item';
  export const description = 'A disabled Accordion.Item cannot be toggled.';
</script>

<script lang="ts">
  import { Accordion } from '@lostgradient/cinder/accordion';
  let expandedIds = $state<string[]>([]);
</script>

<Accordion bind:expandedIds>
  <Accordion.Item id="a" title="Available">This item can be toggled normally.</Accordion.Item>
  <Accordion.Item id="b" title="Disabled (locked)" disabled>
    This content is never shown because the item is disabled.
  </Accordion.Item>
  <Accordion.Item id="c" title="Also available">This one too.</Accordion.Item>
</Accordion>
