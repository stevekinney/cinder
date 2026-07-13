<script lang="ts" module>
  export const title = 'Dense inspector accordion';
  export const description =
    'Inspector panels can compact trigger and panel spacing with public Accordion.Item CSS variables.';
</script>

<script lang="ts">
  import { Accordion } from '@lostgradient/cinder/accordion';

  let expandedIds = $state<string[]>(['selection', 'metadata']);
</script>

<div style="max-inline-size: 32rem;">
  <Accordion multiple bind:expandedIds>
    <Accordion.Item
      id="selection"
      title="Selection"
      style="--cinder-accordion-item-trigger-padding-block: var(--cinder-space-2); --cinder-accordion-item-trigger-padding-inline: var(--cinder-space-3); --cinder-accordion-item-trigger-gap: var(--cinder-space-2); --cinder-accordion-item-trigger-font-size: var(--cinder-text-sm); --cinder-accordion-item-panel-inner-padding-block-start: var(--cinder-space-2); --cinder-accordion-item-panel-inner-padding-block-end: var(--cinder-space-3); --cinder-accordion-item-panel-inner-padding-inline: var(--cinder-space-3); --cinder-accordion-item-panel-font-size: var(--cinder-text-sm);"
    >
      Current workflow edge, matched transition, and queued activity identifiers.
    </Accordion.Item>
    <Accordion.Item
      id="metadata"
      title="Metadata"
      style="--cinder-accordion-item-trigger-padding-block: var(--cinder-space-2); --cinder-accordion-item-trigger-padding-inline: var(--cinder-space-3); --cinder-accordion-item-trigger-gap: var(--cinder-space-2); --cinder-accordion-item-trigger-font-size: var(--cinder-text-sm); --cinder-accordion-item-panel-inner-padding-block-start: var(--cinder-space-2); --cinder-accordion-item-panel-inner-padding-block-end: var(--cinder-space-3); --cinder-accordion-item-panel-inner-padding-inline: var(--cinder-space-3); --cinder-accordion-item-panel-font-size: var(--cinder-text-sm);"
    >
      Retry policy, namespace, task queue, and worker lease timing.
    </Accordion.Item>
    <Accordion.Item
      id="payload"
      title="Payload"
      style="--cinder-accordion-item-trigger-padding-block: var(--cinder-space-2); --cinder-accordion-item-trigger-padding-inline: var(--cinder-space-3); --cinder-accordion-item-trigger-gap: var(--cinder-space-2); --cinder-accordion-item-trigger-font-size: var(--cinder-text-sm); --cinder-accordion-item-panel-inner-padding-block-start: var(--cinder-space-2); --cinder-accordion-item-panel-inner-padding-block-end: var(--cinder-space-3); --cinder-accordion-item-panel-inner-padding-inline: var(--cinder-space-3); --cinder-accordion-item-panel-font-size: var(--cinder-text-sm);"
    >
      Normalized event fields and source artifact references.
    </Accordion.Item>
  </Accordion>
</div>
