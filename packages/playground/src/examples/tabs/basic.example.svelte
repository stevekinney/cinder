<script lang="ts" module>
  export const title = 'Basic tabs';
  export const description =
    'Three tabs with associated panels; clicking a tab switches the panel. Uses the Tabs namespace API.';
</script>

<script lang="ts">
  import { Tabs } from '@lostgradient/cinder/tabs';
  let active = $state('overview');
</script>

<Tabs bind:value={active}>
  <Tabs.List label="Project sections">
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Panel value="overview">
    <p>Cinder is a small but opinionated component library for Svelte 5.</p>
  </Tabs.Panel>
  <Tabs.Panel value="activity">
    <p>You have 3 unread comments and 1 pending review.</p>
  </Tabs.Panel>
  <Tabs.Panel value="settings">
    <p>Adjust your project preferences here.</p>
  </Tabs.Panel>
</Tabs>
