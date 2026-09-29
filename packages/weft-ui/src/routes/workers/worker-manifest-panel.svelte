<script lang="ts">
  import { Badge, DescriptionList, EmptyState, Skeleton, Table } from '@lostgradient/cinder';

  import { FAULT_TREATMENT_TITLE, faultTreatment } from '../../lib/faults.ts';
  import {
    MalformedWorkerDiagnosticsError,
    type WorkerManifestDiagnostics,
  } from './worker-manifest-diagnostics.ts';

  interface WorkerManifestPanelProps {
    readonly diagnostics: WorkerManifestDiagnostics | null | undefined;
    readonly loading: boolean;
    readonly refreshing: boolean;
    readonly error: unknown;
    readonly capabilities: Readonly<Record<string, unknown>>;
  }

  let { diagnostics, loading, refreshing, error, capabilities }: WorkerManifestPanelProps =
    $props();

  const identityItems = $derived(
    diagnostics
      ? [
          {
            term: 'Manifest schema',
            definition: String(diagnostics.deploymentVersion.manifestVersion),
          },
          {
            term: 'Wire protocol',
            definition: String(diagnostics.deploymentVersion.protocolVersion),
          },
          { term: 'SDK', definition: diagnostics.deploymentVersion.sdkVersion },
          {
            term: 'Runtime',
            definition: `${diagnostics.deploymentVersion.runtimeName} ${diagnostics.deploymentVersion.runtimeVersion}`,
          },
          { term: 'Deployment', definition: diagnostics.deploymentVersion.deploymentName },
          { term: 'Build', definition: diagnostics.deploymentVersion.buildId },
          { term: 'Artifact', definition: diagnostics.deploymentVersion.artifactDigest },
          { term: 'Accepted manifest', definition: diagnostics.deploymentVersion.manifestDigest },
          { term: 'Queue binding', definition: diagnostics.instance.queue },
        ]
      : [],
  );
</script>

<section class="weft-worker-manifest-panel" aria-labelledby="worker-manifest-heading">
  <div class="weft-worker-manifest-panel__heading-row">
    <h2 id="worker-manifest-heading">Canonical manifest</h2>
    {#if diagnostics}
      <Badge variant="success">Ready · server accepted</Badge>
    {/if}
    {#if refreshing}<Badge variant="neutral">Refreshing · showing cached evidence</Badge>{/if}
  </div>

  {#if loading}
    <div role="status" aria-busy="true" aria-label="Loading canonical worker manifest">
      <Skeleton height="8rem" />
    </div>
  {:else if error}
    {#if error instanceof MalformedWorkerDiagnosticsError}
      <EmptyState title="Malformed server response" description={error.message} />
    {:else}
      {@const treatment = faultTreatment(error)}
      <EmptyState title={FAULT_TREATMENT_TITLE[treatment.kind]} description={treatment.message} />
    {/if}
  {:else if diagnostics === null}
    <EmptyState
      title="Worker no longer connected"
      description="The fleet snapshot is stale; the server no longer has an accepted manifest for this worker."
    />
  {:else if diagnostics}
    <div class="weft-workers-panel">
      <div class="weft-workers-panel__header">Identity and admission</div>
      <div class="weft-worker-manifest-panel__identity">
        <DescriptionList items={identityItems} />
      </div>
    </div>

    <div class="weft-workers-panel">
      <div class="weft-workers-panel__header">Capabilities</div>
      <p class="weft-worker-manifest-panel__note">
        Capability claims are descriptive and do not grant authorization. Routing eligibility
        follows server manifest acceptance.
      </p>
      {#if Object.keys(capabilities).length === 0}
        <p class="weft-worker-manifest-panel__note">No capabilities were advertised.</p>
      {:else}
        <dl class="weft-worker-manifest-panel__capabilities">
          {#each Object.entries(capabilities).toSorted( ([left], [right]) => left.localeCompare(right) ) as [name, value] (name)}
            <div>
              <dt>{name}</dt>
              <dd><code>{JSON.stringify(value)}</code></dd>
            </div>
          {/each}
        </dl>
      {/if}
    </div>

    {#if Object.keys(diagnostics.deploymentVersion.workflows).length === 0}
      <EmptyState
        title="No executable workflow contracts"
        description="The accepted manifest advertises no workflows."
      />
    {:else}
      <Table caption="Accepted workflow and activity contracts" scrollable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Workflow / activity</Table.HeaderCell>
            <Table.HeaderCell>Workflow version</Table.HeaderCell>
            <Table.HeaderCell>Revision</Table.HeaderCell>
            <Table.HeaderCell>Contract identity</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each Object.entries(diagnostics.deploymentVersion.workflows) as [workflowName, workflow] (workflowName)}
            <Table.Row>
              <Table.Cell as="th" class="weft-workers-mono">{workflowName}</Table.Cell>
              <Table.Cell class="weft-workers-mono">{workflow.workflowVersion}</Table.Cell>
              <Table.Cell class="weft-workers-mono">{workflow.workflowRevision}</Table.Cell>
              <Table.Cell class="weft-workers-mono">{workflow.contractHash}</Table.Cell>
            </Table.Row>
            {#each Object.entries(workflow.activities) as [activityName, activity] (`${workflowName}:${activityName}`)}
              <Table.Row>
                <Table.Cell class="weft-workers-mono">↳ {activityName}</Table.Cell>
                <Table.Cell>Activity</Table.Cell>
                <Table.Cell class="weft-workers-mono">{activity.implementationRevision}</Table.Cell>
                <Table.Cell class="weft-workers-mono">{activity.contractHash}</Table.Cell>
              </Table.Row>
            {/each}
          {/each}
        </Table.Body>
      </Table>
    {/if}
  {/if}
</section>
