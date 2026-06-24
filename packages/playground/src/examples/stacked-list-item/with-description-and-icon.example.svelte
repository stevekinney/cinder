<script lang="ts" module>
  export const title = 'With description and leading icon';
  export const description =
    'A richer row pairing a `leading` visual (here a StatusDot) with a `title` and a secondary `description` snippet below it.';
</script>

<script lang="ts">
  import { DataList } from '@lostgradient/cinder/data-list';
  import { StackedListItem } from '@lostgradient/cinder/stacked-list-item';
  import { StatusDot } from '@lostgradient/cinder/status-dot';

  const services = [
    {
      id: 'api',
      name: 'API gateway',
      detail: 'All regions healthy',
      status: 'online' as const,
      statusLabel: 'Online',
    },
    {
      id: 'db',
      name: 'Primary database',
      detail: 'Replication lag 1.2s',
      status: 'warning' as const,
      statusLabel: 'Warning',
    },
    {
      id: 'cache',
      name: 'Cache cluster',
      detail: 'Node 3 unreachable',
      status: 'danger' as const,
      statusLabel: 'Danger',
    },
  ];
</script>

<DataList items={services} key={(service) => service.id}>
  {#snippet children(service)}
    <StackedListItem>
      {#snippet leading()}
        <StatusDot status={service.status} label={service.statusLabel} />
      {/snippet}
      {#snippet title()}{service.name}{/snippet}
      {#snippet description()}{service.detail}{/snippet}
    </StackedListItem>
  {/snippet}
</DataList>
