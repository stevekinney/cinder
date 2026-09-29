<script lang="ts">
  /**
   * Test-only fixed-props wrapper around `<WorkflowRevisionsPanel>` for use
   * as `SystemRouteTestHarness`'s `component` prop, which renders its
   * `RouteComponent` with no props (`<RouteComponent />`) — mirrors
   * `../workflows/start/start-wizard.test-harness.svelte`'s identical
   * "compose a fixed-props wrapper rather than thread props through the
   * shared harness" convention.
   */
  import WorkflowRevisionsPanel from './workflow-revisions-panel.svelte';
</script>

<WorkflowRevisionsPanel workflowName="order-processing" />
