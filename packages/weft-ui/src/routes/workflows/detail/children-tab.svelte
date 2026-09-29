<script lang="ts">
  /**
   * Children tab (plan T2.6). Real, clickable rows as of weft#732 item 1
   * (`@lostgradient/weft@0.15.0`, PR #760).
   *
   * ## Real ids, not timeline-derived guesses
   *
   * This used to derive rows from `getTimeline()`'s `child-workflow` entries
   * (`workflow-timeline-data.ts`'s `childWorkflowsFromTimeline`), which could
   * never recover a real workflow id — `WorkflowTimelineEntry.outputSummary`
   * is the child's own business result for an AWAITED child, indistinguishable
   * from a detached child's `{ id }` result (see that module's removed
   * doc for the confirmed-live reason). `WorkflowState.parentWorkflowId` is
   * now a public field (weft#732 item 1) and `ListFilter.parentWorkflowId`
   * lets a client ask for exactly this parent's children directly — verified
   * live against the `fulfillment-parent` fixture: `client.list({
   * parentWorkflowId })` returns BOTH the awaited `validate-shipment` child
   * AND the detached `monitor-delivery` child, each with its real id, no
   * ambiguity. This tab now queries that directly instead of going through
   * the timeline at all.
   *
   * Reuses `../list/workflow-status-badge.ts` + `workflow-status-icon.svelte`
   * (the same status→badge mapping the main workflow list renders rows
   * with) rather than a second hand-rolled status/icon map — see this
   * track's other status module, `workflow-status.ts`, for why it's a
   * SEPARATE mapping from that one (list rows work off `WorkflowSummary`,
   * which — unlike the single-workflow `WorkflowState` this detail page
   * fetches — never carries finalizer status).
   */
  import { Badge, EmptyState, Skeleton, Tooltip } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';
  import type { HttpClient, WorkflowState } from '@lostgradient/weft';

  import { formatRelativeTime, truncateId } from '../../../lib/format/index.ts';
  import { queryKeys } from '../../../lib/query.ts';
  import { router, workflowDetailPath } from '../../../lib/router.svelte.ts';
  import { workflowStatusBadge } from '../list/workflow-status-badge.ts';
  import WorkflowStatusIcon from '../list/workflow-status-icon.svelte';

  interface ChildrenTabProps {
    readonly client: Pick<HttpClient, 'list'>;
    readonly workflow: WorkflowState;
  }

  let { client, workflow }: ChildrenTabProps = $props();

  const CHILDREN_PAGE_LIMIT = 50;

  const childrenQuery = createQuery(() => ({
    queryKey: queryKeys.workflows.list({
      parentWorkflowId: workflow.id,
      limit: CHILDREN_PAGE_LIMIT,
    }),
    queryFn: () => client.list({ parentWorkflowId: workflow.id, limit: CHILDREN_PAGE_LIMIT }),
  }));

  const children = $derived(childrenQuery.data?.items ?? []);
  const total = $derived(childrenQuery.data?.total ?? 0);
  const hasMore = $derived(total > children.length);

  function goToWorkflow(id: string): void {
    router.navigate(workflowDetailPath(id));
  }
</script>

{#if childrenQuery.isPending}
  <div class="weft-children-tab"><div style="padding: 15px;"><Skeleton height="3rem" /></div></div>
{:else if children.length === 0}
  <EmptyState
    title="No child workflows"
    description="This run hasn't started any child workflows."
  />
{:else}
  <div class="weft-children-tab">
    <div class="weft-children-tab__scroll">
      <div class="weft-children-tab__row weft-children-tab__header">
        <span>Status</span>
        <span>Workflow ID</span>
        <span>Type</span>
        <span>Revision</span>
        <span>Created</span>
      </div>
      {#each children as child (child.id)}
        {@const badge = workflowStatusBadge(child.status)}
        <a
          class="weft-children-tab__row weft-children-tab__row--link"
          href={router.href(workflowDetailPath(child.id))}
          onclick={(event) => {
            event.preventDefault();
            goToWorkflow(child.id);
          }}
        >
          <Badge variant={badge.tone} size="sm">
            <WorkflowStatusIcon icon={badge.icon} />
            {badge.label}
          </Badge>
          <span class="weft-children-tab__id" title={child.id}>{truncateId(child.id)}</span>
          <span>{child.type}</span>
          {#if child.revision !== undefined}
            <Tooltip text={`Revision (exact executable artifact): ${child.revision}`}>
              <span class="weft-children-tab__revision">{truncateId(child.revision)}</span>
            </Tooltip>
          {:else}
            <span class="weft-children-tab__revision weft-children-tab__revision--unpinned">
              Unpinned
            </span>
          {/if}
          <span class="weft-children-tab__meta">{formatRelativeTime(child.createdAt)}</span>
        </a>
      {/each}
    </div>
    {#if hasMore}
      <p class="weft-children-tab__more">
        Showing {children.length} of {total} — narrow with a workflow-list filter on {`parentWorkflowId: "${truncateId(
          workflow.id,
        )}"`} to see the rest.
      </p>
    {/if}
  </div>
{/if}

<style>
  /* Adds an id column and makes rows real links — see module doc. Scoped
     here rather than growing the shared `workflow-detail.css` (already at
     this repo's ≤500-line implementation-file guidance — `events-tab.svelte`
     sets this precedent). */
  .weft-children-tab__row {
    grid-template-columns: 120px 200px 1fr 130px 110px;
  }

  .weft-children-tab__row--link {
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  @media (hover: hover) {
    .weft-children-tab__row--link:hover {
      background: var(--cinder-surface-hover);
    }
  }

  .weft-children-tab__id {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
  }

  .weft-children-tab__meta {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    font-family: var(--cinder-font-mono);
  }

  .weft-children-tab__revision {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-children-tab__revision--unpinned {
    font-family: inherit;
    color: var(--cinder-text-disabled);
  }

  .weft-children-tab__more {
    margin: 0;
    padding: 10px 16px;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
    border-top: 1px solid var(--cinder-border-muted);
  }
</style>
