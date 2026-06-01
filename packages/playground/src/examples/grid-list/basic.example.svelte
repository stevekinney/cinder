<script lang="ts" module>
  export const title = 'Basic grid list';
  export const description =
    'A responsive grid of items. Uses the GridList namespace API: GridList.Item composes inside the parent GridList.';
</script>

<script lang="ts">
  import { GridList } from 'cinder/grid-list';

  const projects = [
    { name: 'Phoenix', summary: 'Reactive runtime experiments.' },
    { name: 'Atlas', summary: 'Documentation site generator.' },
    { name: 'Beacon', summary: 'Observability dashboards.' },
    { name: 'Cinder', summary: 'Svelte component library.' },
  ];
</script>

<GridList minColumnWidth="14rem" aria-label="Projects">
  {#each projects as project (project.name)}
    <GridList.Item>
      {#snippet title()}
        <strong>{project.name}</strong>
      {/snippet}
      {#snippet subtitle()}
        <span>{project.summary}</span>
      {/snippet}
    </GridList.Item>
  {/each}
</GridList>
