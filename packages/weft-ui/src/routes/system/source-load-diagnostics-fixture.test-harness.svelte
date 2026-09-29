<script lang="ts">
  /**
   * Test-only fixed-props wrapper around `<SourceLoadDiagnostics>` for use as
   * `SystemRouteTestHarness`'s `component` prop, which renders its
   * `RouteComponent` with no props — the same convention
   * `workflow-revisions-panel-fixture.test-harness.svelte` follows.
   */
  import SourceLoadDiagnostics from './source-load-diagnostics.svelte';
</script>

<SourceLoadDiagnostics workflowName="invoice-reconciliation" revision="invoice-reconciliation-r1" />
