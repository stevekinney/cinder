<script lang="ts">
  /**
   * Lineage panel (plan T2.7, design `Weft New Surfaces.dc.html` §B):
   * schedule provenance row, continuation chips, forked-from row, child
   * tree. IDs `first8…last4` + hover title + copy; names — never IDs — as
   * link labels.
   *
   * ## What's real, as of weft 0.15.0 (weft#732, PR #760)
   *
   * - **Forked from**: real since the original build. `WorkflowState.forkedFrom`
   *   (`{ workflowId, step }`) is a public field on `GET /api/v1/workflows/:id`.
   *   This panel additionally fetches the forked-from workflow's own workflow
   *   to show its TYPE as the link label (never the raw id) — falls back to
   *   the truncated id if that lookup 404s (e.g. the source run was since
   *   purged).
   * - **Children**: real. `WorkflowState.parentWorkflowId` + `ListFilter.
   *   parentWorkflowId` (weft#732 item 1) let this panel query `client.
   *   list({ parentWorkflowId })` directly — verified live against the
   *   `fulfillment-parent` fixture: real ids, real links, for BOTH awaited
   *   and detached children (see `children-tab.svelte`'s module doc for the
   *   full verification story; this panel shows a short preview of the same
   *   data).
   * - **Schedule provenance**: real. `weft.workflows.scheduleprovenance.get`
   *   returns the durable `{ scheduleId, occurrence? }` a schedule-launched
   *   run recorded — verified live against the dev harness's
   *   `inventory-sync-every-5-minutes` fixture schedule actually firing.
   *   Links to the schedule's detail page (`/schedules?id=...`).
   * - **Continuation chain**: real, with one honest limit. `WorkflowState.
   *   restartedFrom` (`{ workflowId, workflowExecutionToken, replacedAt }`)
   *   is the immediate predecessor `onTerminalConflict: 'start-new'`
   *   displaced. It carries NO status field (verified against
   *   `@lostgradient/weft`'s `RestartLineage` type), so the "Previous run"
   *   chip renders without a status badge — the design mock's illustrative
   *   "Completed" badge on that chip isn't backable by real data, so this
   *   panel doesn't fabricate one. The chip is also deliberately NOT a link:
   *   `restartedFrom.workflowId` is the SAME id as the current run (that's
   *   the whole point of `start-new` — it reuses the id), and the displaced
   *   run itself is purged as part of the atomic replace, so there is no
   *   distinct destination to navigate to. "No successor" is always shown
   *   and always true by construction: `GET /api/v1/workflows/:id` always
   *   returns the LATEST generation for that id, so whatever run this panel
   *   is currently showing can never itself have a successor — if one
   *   existed, this panel would already be showing it instead.
   *
   * ## Revision display (WFT-117)
   *
   * "Forked from" shows the SOURCE run's own persisted `revision` (from
   * `forkSourceQuery`, the same fetch that already resolves the source's
   * type for the link label) once it resolves — never fabricated from this
   * run's own `forkedFrom.revision` (there is no such field; a fork's
   * SOURCE revision is a property of the source run, not of the link
   * pointing to it). The "This run" chip in the continuation chain shows
   * THIS run's own `workflow.revision`, plus an explicit explanation that
   * `onTerminalConflict: 'start-new'` selects whichever revision is active
   * at the moment it replaces the prior run — no pin carries over from the
   * displaced run, matching `documentation/guides/
   * workflow-versioning.md`'s per-run pinning contract (`@lostgradient/weft`).
   * That explanation carries `FRESH_START_REVISION_HEDGE`, not
   * `EAGER_REVISION_HEDGE` (Codex review, PR #978): a start-new replacement
   * is a FRESH start, not a fork or recovery of the displaced run, so it's
   * the "can bypass the active pointer entirely" caveat that applies here,
   * not the "retains the source run's own revision" one. Every revision
   * display degrades to an explicit "Unpinned" label for a
   * pre-revision-pinning (legacy) record rather than a blank space —
   * including the "Forked from" row's own attributable-but-unpinned case
   * (Codex review, PR #978), and its purged (`forkSourceQuery.data ===
   * null`, `client.get()`'s documented 404 contract) and query-error
   * (`forkSourceQuery.isError`) cases (Codex review, PR #978, round 6),
   * both of which a prior version of this file silently rendered nothing
   * for — every one of the three `sourceRevisionAttributable`-gated
   * branches requires truthy `data`, so neither a purged source nor a
   * failed lookup ever matched any of them.
   *
   * `forkSourceQuery` fetches `forkedFrom.workflowId` — a stable id, not the
   * concrete generation actually forked from. `GET /api/v1/workflows/:id`
   * always returns that id's LATEST generation (see the "Continuation
   * chain" note above), and `ForkLineage` carries no execution token or
   * revision snapshot (`@lostgradient/weft`'s `ForkLineage` type — just
   * `{ workflowId, step }`) to pin down which one was actually forked. So
   * if the source id was later reused for an UNRELATED generation — either
   * tracked (`onTerminalConflict: 'start-new'` restarting it) or entirely
   * untracked (the original was purged, then a plain new `engine.start()`
   * happened to reuse the same explicit id, leaving no `restartedFrom` at
   * all) — showing that unrelated generation's `revision` here would
   * misattribute it to the historical fork.
   *
   * `sourceRevisionAttributable` requires BOTH, neither alone sufficing
   * (Codex review, PR #978, three rounds — see below):
   *
   * - `source.restartedFrom === undefined` — timestamp-free: proves this
   *   generation has never been displaced by ANY start-new replacement,
   *   tracked or not, so it has held this id continuously since its own
   *   origin regardless of clock behavior anywhere in the deployment.
   * - `source.createdAt < workflow.createdAt` — best-effort and
   *   wall-clock-based: the only signal available for the UNTRACKED reuse
   *   case the `restartedFrom` check can't see (a purged id reused by a
   *   plain fresh `engine.start()`, which sets no `restartedFrom` at all).
   *
   * History: round 1 shipped `restartedFrom`-only. Round 2 replaced it
   * with `createdAt`-only, reasoning `client.get` always returns the
   * current, unreplaced generation, so an origin strictly before the fork
   * proves continuous identity through fork time regardless of how the id
   * came to be held — believing this "subsumed" the `restartedFrom` check.
   * Round 5 disproved that: `createdAt` is stamped from each engine's own
   * wall-clock `getNow()` (`ownership: 'workflow-lease'` explicitly
   * permits multiple engines, and Weft's ownership documentation accounts
   * for clock skew between them), so a TRACKED replacement created causally
   * AFTER the fork on a clock-skewed engine can still stamp a `createdAt`
   * that appears to precede it — `createdAt`-only would misattribute it.
   * `ForkLineage` carries no durable generation token to check instead
   * (just `{ workflowId, step }`), so both signals are required together:
   * `restartedFrom` closes every TRACKED case without touching a clock at
   * all; `createdAt` remains the only (imperfect) signal for the untracked
   * case. When either check fails, the chip is omitted with an explicit
   * note rather than silently showing a possibly-wrong revision.
   *
   * Residual gap, accepted (Codex review, PR #978, round 7): an untracked
   * id reuse (purge, then a plain fresh `engine.start()` on the same
   * explicit id) combined with clock skew on the reusing engine can still
   * pass both checks, because `ForkLineage` carries no durable generation
   * token to rule it out — see the two paragraphs above. Closing this
   * fully needs an engine-side generation token on `ForkLineage`, which is
   * out of WFT-117's scope ("do not implement or copy Weft runtime
   * semantics in the Console"). Rather than silently trust the shown
   * revision, the rendered tooltip below now labels the attribution
   * "best-effort" and names the exact gap, so an operator reading it is
   * not told a stronger guarantee than the data can support.
   */
  import { Badge, CopyButton, Skeleton, Tooltip } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';
  import type { HttpClient, WorkflowState } from '@lostgradient/weft';
  import { ArrowRight, CalendarClock, CornerDownRight, GitBranch, GitFork } from 'lucide-svelte';

  import { formatRelativeTime, truncateId } from '../../../lib/format/index.ts';
  import { queryKeys } from '../../../lib/query.ts';
  import { router, workflowDetailPath } from '../../../lib/router.svelte.ts';
  import {
    EAGER_REVISION_HEDGE,
    FRESH_START_REVISION_HEDGE,
  } from '../../../lib/workflow-revision.ts';
  import { workflowStatusBadge } from '../list/workflow-status-badge.ts';
  import WorkflowStatusIcon from '../list/workflow-status-icon.svelte';
  import { getScheduleProvenance, scheduleProvenanceQueryKey } from './workflow-observability.ts';

  interface LineagePanelProps {
    readonly client: Pick<HttpClient, 'get' | 'list'> & {
      readonly operations: Pick<HttpClient['operations'], 'weft.workflows.scheduleprovenance.get'>;
    };
    readonly workflow: WorkflowState;
  }

  let { client, workflow }: LineagePanelProps = $props();

  const forkedFrom = $derived(workflow.forkedFrom);
  const restartedFrom = $derived(workflow.restartedFrom);

  const forkSourceQuery = createQuery(() => ({
    queryKey: queryKeys.workflows.detail(forkedFrom?.workflowId ?? ''),
    queryFn: () => client.get(forkedFrom?.workflowId ?? ''),
    enabled: forkedFrom !== undefined,
  }));

  /** See the module doc's "Revision display" section for why BOTH checks are required, not either alone. */
  const sourceRevisionAttributable = $derived.by(() => {
    const source = forkSourceQuery.data;
    if (source === null || source === undefined) return false;
    return source.restartedFrom === undefined && source.createdAt < workflow.createdAt;
  });

  const scheduleProvenanceQuery = createQuery(() => ({
    queryKey: scheduleProvenanceQueryKey(workflow.id),
    queryFn: () => getScheduleProvenance(client, workflow.id),
  }));

  const CHILDREN_PREVIEW_LIMIT = 5;

  const childrenQuery = createQuery(() => ({
    queryKey: queryKeys.workflows.list({
      parentWorkflowId: workflow.id,
      limit: CHILDREN_PREVIEW_LIMIT,
    }),
    queryFn: () => client.list({ parentWorkflowId: workflow.id, limit: CHILDREN_PREVIEW_LIMIT }),
  }));

  const children = $derived(childrenQuery.data?.items ?? []);
  const childrenTotal = $derived(childrenQuery.data?.total ?? 0);
  const moreChildren = $derived(Math.max(0, childrenTotal - children.length));

  const thisRunBadge = $derived(workflowStatusBadge(workflow.status));

  function goToWorkflow(id: string): void {
    router.navigate(workflowDetailPath(id));
  }

  function goToSchedule(scheduleId: string): void {
    router.navigate(`/schedules?id=${encodeURIComponent(scheduleId)}`);
  }
</script>

<div class="weft-lineage-panel">
  <div class="weft-lineage-panel__header">
    <GitBranch aria-hidden="true" size={15} />
    Lineage
  </div>
  <div class="weft-lineage-panel__body">
    {#if scheduleProvenanceQuery.isPending}
      <Skeleton height="2rem" />
    {:else if scheduleProvenanceQuery.data}
      {@const provenance = scheduleProvenanceQuery.data}
      <div class="weft-lineage-panel__row">
        <CalendarClock aria-hidden="true" size={14} />
        <span class="weft-lineage-panel__row-label">Launched by schedule</span>
        <a
          href={router.href(`/schedules?id=${encodeURIComponent(provenance.scheduleId)}`)}
          onclick={(event) => {
            event.preventDefault();
            goToSchedule(provenance.scheduleId);
          }}
        >
          {provenance.scheduleId}
        </a>
        {#if provenance.occurrence !== undefined}
          <span class="weft-lineage-panel__meta">
            · occurrence {new Date(provenance.occurrence).toISOString()}
          </span>
        {/if}
      </div>
    {/if}

    {#if restartedFrom}
      <div>
        <div class="weft-lineage-panel__section-label">Continuation chain · same workflow id</div>
        <div class="weft-lineage-continuation">
          <span class="weft-lineage-continuation__chip weft-lineage-continuation__chip--previous">
            <span class="weft-lineage-continuation__label">Previous run</span>
            <span
              class="weft-lineage-panel__id"
              title={restartedFrom.workflowExecutionToken ?? restartedFrom.workflowId}
            >
              {truncateId(restartedFrom.workflowExecutionToken ?? restartedFrom.workflowId)}
            </span>
            <span class="weft-lineage-continuation__meta">
              replaced {formatRelativeTime(restartedFrom.replacedAt)}
            </span>
          </span>
          <ArrowRight aria-hidden="true" size={14} />
          <span class="weft-lineage-continuation__chip weft-lineage-continuation__chip--current">
            <WorkflowStatusIcon icon={thisRunBadge.icon} />
            <span class="weft-lineage-continuation__label">This run</span>
            {#if workflow.revision !== undefined}
              <Tooltip
                text={`Revision (exact executable artifact): ${workflow.revision}. ${EAGER_REVISION_HEDGE}`}
              >
                <span class="weft-lineage-continuation__revision">
                  rev {truncateId(workflow.revision)}
                </span>
              </Tooltip>
            {:else}
              <Badge variant="neutral" size="sm">Unpinned</Badge>
            {/if}
          </span>
          <ArrowRight aria-hidden="true" size={14} />
          <span class="weft-lineage-continuation__chip weft-lineage-continuation__chip--none">
            No successor
          </span>
        </div>
        <p class="weft-lineage-panel__note">
          A start-new replacement resolves against whichever revision is active at the moment it
          replaces the prior run — no pin carries over from the run it replaced. {FRESH_START_REVISION_HEDGE}
        </p>
      </div>
    {/if}

    {#if forkedFrom}
      <div class="weft-lineage-panel__row">
        <GitFork aria-hidden="true" size={14} />
        <span class="weft-lineage-panel__row-label">Forked from</span>
        {#if forkSourceQuery.isPending}
          <Skeleton height="1rem" width="8rem" />
        {:else}
          <a
            href={router.href(workflowDetailPath(forkedFrom.workflowId))}
            onclick={(event) => {
              event.preventDefault();
              goToWorkflow(forkedFrom.workflowId);
            }}
          >
            {forkSourceQuery.data?.type ?? `${truncateId(forkedFrom.workflowId)} run`}
          </a>
          <span class="weft-lineage-panel__id" title={forkedFrom.workflowId}>
            {truncateId(forkedFrom.workflowId)}
          </span>
          <CopyButton value={forkedFrom.workflowId} iconOnly label="Copy workflow id" />
          {#if sourceRevisionAttributable && forkSourceQuery.data?.revision !== undefined}
            {@const sourceRevision = forkSourceQuery.data.revision}
            <Tooltip
              text={`Source revision (exact executable artifact): ${sourceRevision}. Best-effort attribution: this id has never been displaced by a tracked start-new replacement, and this record's own creation time precedes this fork — not an absolute guarantee against an untracked id reuse racing a clock-skewed engine.`}
            >
              <span class="weft-lineage-panel__id">rev {truncateId(sourceRevision)}</span>
            </Tooltip>
          {:else if sourceRevisionAttributable && forkSourceQuery.data}
            <Tooltip
              text="This source run predates revision pinning, so which revision was actually forked can't be stated."
            >
              <Badge variant="neutral" size="sm">Unpinned</Badge>
            </Tooltip>
          {:else if forkSourceQuery.data && !sourceRevisionAttributable}
            <Tooltip
              text={`This id was reused by a start-new replacement after this fork was created, so the current record's revision may not match what was actually forked. Not shown to avoid a wrong attribution.`}
            >
              <Badge variant="neutral" size="sm">Revision not attributable</Badge>
            </Tooltip>
          {:else if forkSourceQuery.data === null}
            <Tooltip text="The source run has been purged, so its revision can no longer be shown.">
              <Badge variant="neutral" size="sm">Revision unavailable</Badge>
            </Tooltip>
          {:else if forkSourceQuery.isError}
            <Tooltip
              text="The source run's record could not be loaded, so its revision can't be shown."
            >
              <Badge variant="neutral" size="sm">Revision unavailable</Badge>
            </Tooltip>
          {/if}
        {/if}
        <span class="weft-lineage-panel__meta">at step {forkedFrom.step}</span>
      </div>
    {/if}

    <div>
      <div class="weft-lineage-panel__section-label">
        Child workflows{#if childrenTotal > 0}
          &nbsp;· {childrenTotal}{/if}
      </div>
      {#if childrenQuery.isPending}
        <Skeleton height="1.5rem" />
      {:else if children.length === 0}
        <p class="weft-lineage-panel__note">No child workflows.</p>
      {:else}
        <div class="weft-lineage-panel__children">
          {#each children as child (child.id)}
            {@const badge = workflowStatusBadge(child.status)}
            <a
              class="weft-lineage-panel__child-row weft-lineage-panel__child-row--link"
              href={router.href(workflowDetailPath(child.id))}
              onclick={(event) => {
                event.preventDefault();
                goToWorkflow(child.id);
              }}
            >
              <CornerDownRight aria-hidden="true" size={12} />
              <span>{child.type}</span>
              <span class="weft-lineage-panel__id" title={child.id}>{truncateId(child.id)}</span>
              {#if child.revision !== undefined}
                <span
                  class="weft-lineage-panel__id"
                  title={`Revision (exact executable artifact): ${child.revision}`}
                >
                  rev {truncateId(child.revision)}
                </span>
              {:else}
                <span class="weft-lineage-panel__id">Unpinned</span>
              {/if}
              <span class="weft-lineage-panel__meta">
                <WorkflowStatusIcon icon={badge.icon} />
                {badge.label}
              </span>
            </a>
          {/each}
        </div>
        {#if moreChildren > 0}
          <p class="weft-lineage-panel__note">
            +{moreChildren} more — see the Children tab.
          </p>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .weft-lineage-panel__id {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }

  .weft-lineage-panel__meta {
    margin-inline-start: auto;
    color: var(--cinder-text-disabled);
    font-size: var(--cinder-text-2xs);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .weft-lineage-panel__child-row--link {
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  @media (hover: hover) {
    .weft-lineage-panel__child-row--link:hover {
      background: var(--cinder-surface-hover);
    }
  }

  /* Continuation chain (design "gen 41 → gen 42 → No successor") — scoped
     here rather than growing the shared `workflow-detail.css` (already at
     this repo's ≤500-line implementation-file guidance — `events-tab.svelte`
     sets this precedent). */
  .weft-lineage-continuation {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .weft-lineage-continuation__chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 9px;
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-xs);
    white-space: nowrap;
  }

  .weft-lineage-continuation__chip--previous {
    border: 1px solid var(--cinder-border);
    background: var(--cinder-surface);
  }

  .weft-lineage-continuation__chip--current {
    border: 1.5px solid var(--cinder-accent);
    background: color-mix(in oklch, var(--cinder-accent), transparent 92%);
    font-weight: 600;
  }

  .weft-lineage-continuation__chip--none {
    border: 1px dashed var(--cinder-border);
    color: var(--cinder-text-disabled);
    font-size: var(--cinder-text-2xs);
  }

  .weft-lineage-continuation__label {
    white-space: nowrap;
  }

  .weft-lineage-continuation__meta {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }

  .weft-lineage-continuation__revision {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }
</style>
