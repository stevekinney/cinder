<script lang="ts">
  import { Tabs } from './index.ts';

  type FixtureProps = {
    active?: string;
  };

  let { active = 'overview' }: FixtureProps = $props();
</script>

<div class="tabs-fixture">
  <Tabs value={active}>
    <Tabs.List label="Project sections">
      <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
      <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
      <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Panel value="overview">
      <p>Project health, release notes, and the current delivery window.</p>
    </Tabs.Panel>
    <Tabs.Panel value="activity">
      <p>Three review comments and one pending deployment are ready for follow-up.</p>
    </Tabs.Panel>
    <Tabs.Panel value="settings">
      <p>Adjust notification, review, and release preferences for this workspace.</p>
    </Tabs.Panel>
  </Tabs>
</div>

<style>
  .tabs-fixture {
    max-inline-size: 36rem;
  }
</style>
