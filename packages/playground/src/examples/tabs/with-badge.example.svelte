<script lang="ts" module>
  export const title = 'Tabs with trailing badges';
  export const description =
    'Tabs use a decorative `trailing` snippet (wrapped in aria-hidden) for badges and counters. The accessible name only includes the visible label.';
</script>

<script lang="ts">
  import { Tabs } from 'cinder/tabs';
  import { Badge } from 'cinder/badge';

  let active = $state('inbox');
</script>

<Tabs bind:value={active}>
  <Tabs.List label="Mailboxes">
    <Tabs.Trigger value="inbox">
      Inbox
      {#snippet trailing()}
        <Badge>3</Badge>
      {/snippet}
    </Tabs.Trigger>
    <Tabs.Trigger value="drafts">
      Drafts
      {#snippet trailing()}
        <Badge>12</Badge>
      {/snippet}
    </Tabs.Trigger>
    <Tabs.Trigger value="archive">Archive</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Panel value="inbox">
    <p>You have three unread messages.</p>
  </Tabs.Panel>
  <Tabs.Panel value="drafts">
    <p>Twelve drafts waiting for your attention.</p>
  </Tabs.Panel>
  <Tabs.Panel value="archive">
    <p>Nothing archived recently.</p>
  </Tabs.Panel>
</Tabs>
