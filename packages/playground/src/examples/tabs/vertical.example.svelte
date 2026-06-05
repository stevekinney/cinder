<script lang="ts" module>
  export const title = 'Vertical tabs with keyboard navigation';
  export const description =
    'A vertical tablist: focus a tab and use ↑/↓ to move. The focus ring must render complete on all sides even though the tab list is a clipping (overflow) container.';
</script>

<script lang="ts">
  import { Tabs } from '@lostgradient/cinder/tabs';
  let active = $state('design');
</script>

<Tabs bind:value={active} orientation="vertical">
  <Tabs.List label="Workflow stages (vertical)">
    <Tabs.Trigger value="design">Design</Tabs.Trigger>
    <Tabs.Trigger value="develop">Develop</Tabs.Trigger>
    <Tabs.Trigger value="ship" disabled>Ship</Tabs.Trigger>
    <Tabs.Trigger value="review">Review</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Panel value="design">
    <p>Sketch the user experience before writing code.</p>
  </Tabs.Panel>
  <Tabs.Panel value="develop">
    <p>Build the components and wire up the state.</p>
  </Tabs.Panel>
  <Tabs.Panel value="ship">
    <p>Disabled tab — its panel is unreachable.</p>
  </Tabs.Panel>
  <Tabs.Panel value="review">
    <p>Review and iterate based on feedback.</p>
  </Tabs.Panel>
</Tabs>
