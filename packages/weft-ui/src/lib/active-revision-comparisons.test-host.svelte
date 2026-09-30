<script lang="ts">
  /** Inner half of `active-revision-comparisons.test-harness.svelte`: query creation needs the `QueryClientProvider` context, so it lives one component below the provider. Renders each row's comparison as text. */
  import { createActiveRevisionComparisons } from './active-revision-comparisons.svelte.ts';
  import type { WorkflowActiveRevisionClient } from './workflow-revision.ts';

  interface Props {
    client: WorkflowActiveRevisionClient;
    rows: readonly { readonly type: string; readonly revision: string | undefined }[];
    enabled: boolean;
  }

  let { client, rows, enabled }: Props = $props();

  const comparisons = createActiveRevisionComparisons({
    get client() {
      return client;
    },
    rows: () => rows,
    enabled: () => enabled,
  });
</script>

<ul>
  {#each rows as row, index (index)}
    <li data-testid={`row-${index}`}>{comparisons.compare(row.type, row.revision)}</li>
  {/each}
</ul>
