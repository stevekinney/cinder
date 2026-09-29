<script lang="ts">
  /**
   * Workflows domain dispatcher (plan §9.2). `src/app/routes.ts` (frozen)
   * maps BOTH `/workflows` and `/workflows/:id` to this one component —
   * this file is the only place that can tell those apart, plus the
   * `?view=` sub-navigation this track (list/start wizard/aggregate) owns.
   * The `:id` branch (workflow detail — plan §9.2 T2.4-T2.7) is a separate
   * track's `./detail/workflow-detail.svelte`.
   */
  import { router } from '../../lib/router.svelte.ts';
  import AggregateView from './aggregate/aggregate-view.svelte';
  import WorkflowDetail from './detail/workflow-detail.svelte';
  import WorkflowList from './list/workflow-list.svelte';
  import StartWizard from './start/start-wizard.svelte';

  const workflowId = $derived(router.current.params['id']);
  const view = $derived(router.current.search.get('view'));
</script>

{#if workflowId}
  <WorkflowDetail />
{:else if view === 'start'}
  <StartWizard />
{:else if view === 'aggregate'}
  <AggregateView />
{:else}
  <WorkflowList />
{/if}
