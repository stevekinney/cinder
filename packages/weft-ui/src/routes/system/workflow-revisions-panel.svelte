<script lang="ts">
  /**
   * Revisions panel (WFT-115) — mounted below the schema panels on the
   * Registry → workflow definition detail view (`registry-detail.svelte`).
   * Lists every durably installed revision of one workflow name
   * (`weft.workflows.revisions.list`) against the currently active pointer
   * (`weft.workflows.active.get`), and lets an operator with `workflows:admin`
   * activate a non-active revision.
   *
   * ## Activation IS the compatibility preview (see
   * `packages/weft/documentation/guides/workflow-versioning.md`, verified)
   *
   * There is no separate read-only "preview" operation — the only
   * server-supplied compatibility verdict is the outcome of a real
   * `weft.workflows.revisions.activate` call. A refusal is a pure no-op
   * (nothing durable changes; `WorkflowCatalogConflictError`/the four
   * refusal reasons never mutate the active pointer), so this panel treats
   * Activate as a real, honestly-labeled mutation whose outcome doubles as
   * the compatibility preview the acceptance criteria asks for — never a
   * separate non-committing "check" control, and never a local
   * reimplementation of `checkWorkflowCompatibility` (that function is
   * server-only; see `../../lib/faults.ts`'s module doc for why only
   * `@lostgradient/weft` is browser-safe to import as a VALUE).
   *
   * `weft.workflows.active.get` faults `NotFound` for a workflow that has
   * never been activated — a legitimate state (an eagerly-registered
   * fixture workflow always has one by the time this panel can be reached
   * from the Registry tab, but a name reachable only via
   * `weft.workflows.revisions.install` might not), rendered here as "no
   * active revision" rather than the fault banner.
   *
   * ## Why the Activate button is offered for the CURRENTLY active revision too
   *
   * Under the strict default compatibility policy
   * (`requireExactRevision: true`), re-activating the already-active
   * revision is a legitimate generation re-stamp (workflow-versioning
   * guide) — this panel deliberately does not special-case it out, but
   * labels the row's own action "Refresh" instead of "Activate" so an
   * operator never reads a same-revision success as "a new revision just
   * went live." The compatibility-policy override
   * (`policy.requireExactRevision: false`) is a deliberate omission from
   * this batch, not an oversight — see the PR body.
   */
  import { Badge, Button, ConfirmDialog, CopyButton } from '@lostgradient/cinder';
  import { AlertTriangle } from 'lucide-svelte';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';

  import { HttpClientError } from '@lostgradient/weft';

  import { getClient } from '../../lib/client.ts';
  import { truncateId } from '../../lib/format/index.ts';
  import { queryKeys } from '../../lib/query.ts';
  import { getPrincipalStore, scopeGate } from '../../lib/scopes.svelte.ts';
  import ActivationOutcomeBanner from './activation-outcome-banner.svelte';
  import {
    describeActivationOutcome,
    resolveExpectedGeneration,
    type ActivationAttempt,
    type WorkflowActivationOutcome,
  } from './compatibility-verdict.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';
  import {
    isBackgroundRefreshing,
    isWorkflowCatalogActivePointerLike,
    rowMeta,
    workflowRevisionRows,
    type WorkflowCatalogActivePointerLike,
    type WorkflowRevisionRow,
  } from './workflow-revisions-view.ts';

  interface Props {
    workflowName: string;
  }

  let { workflowName }: Props = $props();

  const client = getClient();
  const principal = getPrincipalStore();
  const queryClient = useQueryClient();

  const canRead = $derived(principal.hasScope('workflows:read'));
  const adminGate = $derived(scopeGate(principal, ['workflows:admin']));

  const revisionsQuery = createQuery(() => ({
    queryKey: queryKeys.catalog.revisions(workflowName),
    queryFn: (): Promise<unknown> =>
      client.operations['weft.workflows.revisions.list']({ name: workflowName }),
    enabled: canRead,
  }));

  const activeQuery = createQuery(() => ({
    queryKey: queryKeys.catalog.active(workflowName),
    queryFn: async (): Promise<WorkflowCatalogActivePointerLike | null> => {
      try {
        const raw = await client.operations['weft.workflows.active.get']({ name: workflowName });
        if (isWorkflowCatalogActivePointerLike(raw)) return raw;
        // A successful-but-malformed response is NOT the same as "never
        // activated": collapsing it to `null` would make every row read
        // as Installed (no Active badge) and drop `expectedGeneration`
        // from the next Activate call, which the server then refuses as
        // a stale/expected-generation conflict for a workflow that DOES
        // have a real active revision. Throw instead — this reaches the
        // ordinary catch below, which only special-cases the genuine
        // `NotFound` fault; anything else (this included) rethrows and
        // renders through `{:else if activeQuery.isError}`. Modeled as
        // an `HttpClientError` with `Unprocessable` (-> the non-retrying
        // 'invalid' treatment) rather than a plain `Error`: a plain
        // `Error` fails `classifyFault`'s `instanceof` check, which
        // `shouldRetryQuery` (`lib/query.ts`) treats as retryable —
        // several seconds of real backoff to report data the console
        // already has in hand and knows is unusable.
        throw new HttpClientError(422, 'Malformed active-pointer response', {
          faultCode: 'Unprocessable',
        });
      } catch (error) {
        // A workflow that has never been activated is a legitimate state
        // (module doc), not a fault to surface — every other NotFound (or
        // any other fault) is a real error this query should report.
        if (error instanceof HttpClientError && error.faultCode === 'NotFound') return null;
        throw error;
      }
    },
    enabled: canRead,
  }));

  /** `undefined` when the wire payload isn't a top-level array at all — the explicit malformed-response state, distinct from "resolved to zero rows". */
  const revisionsArray = $derived.by((): readonly unknown[] | undefined => {
    const data = revisionsQuery.data;
    return Array.isArray(data) ? data : undefined;
  });

  /**
   * `undefined` when `revisionsArray` itself is undefined (not an array at
   * all) OR when `workflowRevisionRows` rejected it because at least one
   * entry failed its structural guard — either way, an explicit malformed
   * response this panel must not render as a partial list (see
   * `workflow-revisions-view.ts`'s doc on why a partial list is unsafe
   * here).
   */
  const rows = $derived(
    revisionsArray === undefined
      ? undefined
      : workflowRevisionRows(revisionsArray, activeQuery.data ?? null),
  );

  /**
   * `revisionsQuery` and `activeQuery` are independent, unordered fetches —
   * a narrow but real race (or a revision uninstalled between the two
   * responses) can leave a non-null active pointer naming a revision that
   * isn't in the resolved `rows` at all. Every row would then render
   * "Installed" with no "Active" badge, and — because `activeQuery.data`
   * is non-null — the "No active revision — never activated" note stays
   * suppressed too, silently understating that this workflow DOES have an
   * active revision this console just can't currently show. Accepted
   * behavior (this is a display staleness window, not malformed data — the
   * next `revisionsQuery` refetch resolves it), but called out explicitly
   * rather than silently dropped, mirroring the malformed-record note
   * above.
   */
  const activePointerRevisionMissing = $derived(
    rows !== undefined && activeQuery.data !== null && !rows.some((row) => row.isActive),
  );

  const isLoading = $derived(canRead && (revisionsQuery.isPending || activeQuery.isPending));
  const isRefreshing = $derived(isBackgroundRefreshing(revisionsQuery, activeQuery));
  function invalidateAfterActivation(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.revisions(workflowName) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.active(workflowName) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.registry() });
  }

  function isAppliedActivationResult(value: unknown): value is {
    applied: true;
    pointer: { revision: string; generation: number; activatedAt: number };
  } {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Record<string, unknown>;
    if (record['applied'] !== true) return false;
    const pointer = record['pointer'];
    if (typeof pointer !== 'object' || pointer === null) return false;
    const pointerRecord = pointer as Record<string, unknown>;
    return (
      typeof pointerRecord['revision'] === 'string' &&
      typeof pointerRecord['generation'] === 'number' &&
      typeof pointerRecord['activatedAt'] === 'number'
    );
  }

  /**
   * The `currentGeneration` a `stale` refusal most recently reported, when
   * one has. `weft.workflows.active.get`'s documented contract is
   * in-memory-only (not read from the durable store this catalog write
   * path itself uses) — refetching it after a stale-generation refusal can
   * return the exact same lagging value, which would otherwise make the
   * next Activate attempt reuse the same wrong `expectedGeneration` and
   * refuse again forever. The refusal's own `currentGeneration` IS the
   * durable truth at refusal time, so once we have one, prefer it over
   * `activeQuery`'s cache for the next attempt. Reset to `null` on an
   * applied outcome, whose `pointer.generation` is itself now the fresh
   * durable truth and flows back through `activeQuery` via
   * `invalidateAfterActivation`.
   *
   * An `incompatible` outcome ALSO confirms a durable generation: the
   * server only evaluates compatibility after the generation fence passes
   * (`activationRefusalToFault`'s reasons are mutually exclusive with a
   * stale refusal), so the `expectedGeneration` this attempt submitted is,
   * by construction, the current durable generation at refusal time — even
   * though nothing durable changed. Discarding it (the prior behavior)
   * threw away a confirmed value and could resubmit `activeQuery`'s stale
   * in-memory cache on the very next attempt, earning a guaranteed stale
   * refusal for an unrelated candidate.
   */
  let pendingExpectedGeneration = $state<number | null>(null);

  const activateMutation = createMutation<WorkflowActivationOutcome, unknown, string>(() => ({
    mutationFn: async (candidateRevision: string) => {
      const activePointer = activeQuery.data ?? null;
      const expectedGeneration = resolveExpectedGeneration(
        pendingExpectedGeneration,
        activePointer?.generation,
      );
      let attempt: ActivationAttempt;
      try {
        const raw = await client.operations['weft.workflows.revisions.activate']({
          name: workflowName,
          revision: candidateRevision,
          ...(expectedGeneration === undefined ? {} : { expectedGeneration }),
        });
        attempt = isAppliedActivationResult(raw)
          ? { applied: true, pointer: raw.pointer }
          : { applied: false, error: new Error('Malformed activation response') };
      } catch (error) {
        attempt = { applied: false, error };
      }
      const outcome = describeActivationOutcome(attempt);
      pendingExpectedGeneration =
        outcome.kind === 'stale'
          ? outcome.currentGeneration
          : outcome.kind === 'incompatible'
            ? (expectedGeneration ?? null)
            : null;
      return outcome;
    },
    onSuccess: invalidateAfterActivation,
  }));

  let confirmRevision = $state<string | null>(null);
  /** Whether the open confirm dialog is re-stamping the already-active revision (the row's own "Refresh" action) rather than activating a different candidate — see this file's module doc on why the two need distinct wording. */
  let confirmIsRefresh = $state(false);
  /**
   * Whether the LAST COMPLETED mutation (not the currently open dialog) was
   * a refresh — captured at the moment `mutate` fires, so opening a
   * different row's dialog afterward (while the success banner from a
   * previous attempt is still visible) can't retroactively relabel it.
   * `confirmIsRefresh` is live-bound to whichever dialog is open right now,
   * which is the wrong source for the banner: it would rewrite an already-
   * displayed "Activated"/"Refreshed" banner the instant a new confirm
   * dialog opens, before the operator even confirms it.
   */
  let completedMutationWasRefresh = $state(false);
  let confirmOpen = $state(false);
  let triggerRef = $state<HTMLElement | null>(null);

  function openConfirm(row: WorkflowRevisionRow, trigger: HTMLElement): void {
    confirmRevision = row.revision;
    confirmIsRefresh = row.isActive;
    triggerRef = trigger;
    confirmOpen = true;
  }

  function refetchAll(): void {
    void revisionsQuery.refetch();
    void activeQuery.refetch();
  }
</script>

<section class="weft-revisions-panel" aria-label="Installed revisions">
  <div class="weft-revisions-panel__header">
    <h3 class="weft-revisions-panel__title">Revisions</h3>
    {#if isRefreshing}
      <span class="weft-revisions-panel__refreshing" role="status">Refreshing…</span>
    {/if}
  </div>

  {#if !canRead}
    <p class="weft-revisions-panel__note">Requires workflows:read to view installed revisions.</p>
  {:else if isLoading}
    <div role="status" aria-busy="true" aria-label="Loading revisions">
      <p class="weft-revisions-panel__note">Loading…</p>
    </div>
  {:else if revisionsQuery.isError}
    <QueryFaultBanner error={revisionsQuery.error} onRetry={() => revisionsQuery.refetch()} />
  {:else if activeQuery.isError}
    <QueryFaultBanner error={activeQuery.error} onRetry={() => activeQuery.refetch()} />
  {:else if rows === undefined}
    <div class="weft-revisions-panel__malformed" role="alert">
      <AlertTriangle aria-hidden="true" size={16} />
      <span
        >The server returned a revisions list this console doesn't recognize — showing nothing
        rather than a guess.</span
      >
    </div>
  {:else if rows.length === 0}
    <p class="weft-revisions-panel__note">No revisions installed for this workflow yet.</p>
  {:else}
    {#if activeQuery.data === null}
      <p class="weft-revisions-panel__note">No active revision — never activated.</p>
    {:else if activePointerRevisionMissing}
      <p class="weft-revisions-panel__note">
        This workflow has an active revision the current list doesn't include yet — refreshing.
      </p>
    {/if}
    <ul class="weft-revisions-panel__list">
      {#each rows as row (row.revision)}
        <li class="weft-revisions-panel__row">
          <div class="weft-revisions-panel__row-identity">
            <span class="weft-revisions-panel__revision" title={row.revision}>
              {truncateId(row.revision)}
            </span>
            <CopyButton value={row.revision} iconOnly label={`Copy revision ${row.revision}`} />
            {#if row.isActive}
              <Badge variant="success">Active</Badge>
            {:else}
              <Badge variant="neutral">Installed</Badge>
            {/if}
          </div>
          <dl class="weft-revisions-panel__row-meta">
            {#each rowMeta(row) as item (item.term)}
              <div>
                <dt>{item.term}</dt>
                <dd class={item.mono ? 'weft-revisions-panel__mono' : ''} title={item.title}>
                  {item.value}
                </dd>
              </div>
            {/each}
          </dl>
          <Button
            size="sm"
            variant="secondary"
            label={row.isActive ? 'Refresh' : 'Activate'}
            disabled={adminGate.disabled || activateMutation.isPending}
            title={adminGate.title}
            onclick={(event) => openConfirm(row, event.currentTarget as HTMLElement)}
          />
        </li>
      {/each}
    </ul>
  {/if}

  {#if activateMutation.isSuccess}
    <ActivationOutcomeBanner
      outcome={activateMutation.data}
      verb={completedMutationWasRefresh ? 'Refreshed' : 'Activated'}
      onRefresh={refetchAll}
    />
  {/if}
</section>

<ConfirmDialog
  bind:open={confirmOpen}
  {triggerRef}
  title={confirmIsRefresh ? 'Refresh active revision?' : 'Activate revision?'}
  description={confirmRevision === null
    ? ''
    : confirmIsRefresh
      ? `Refresh "${confirmRevision}" — Weft re-stamps it as the active revision under a new generation. Nothing about the running revision changes; this does not activate a different revision.`
      : `Activate "${confirmRevision}" as the active revision for ${workflowName}? Weft evaluates compatibility against the currently active revision before applying — an incompatible candidate is refused with no durable change.`}
  confirmLabel={confirmIsRefresh ? 'Refresh' : 'Activate'}
  onConfirm={() => {
    if (confirmRevision !== null) {
      completedMutationWasRefresh = confirmIsRefresh;
      activateMutation.mutate(confirmRevision);
    }
  }}
/>

<style>
  .weft-revisions-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .weft-revisions-panel__header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .weft-revisions-panel__title {
    margin: 0;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-revisions-panel__refreshing {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }

  .weft-revisions-panel__note {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
  }

  .weft-revisions-panel__malformed {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-color-warning-bg);
    border: 1px solid var(--cinder-color-warning-border);
    color: var(--cinder-color-warning-fg);
    font-size: var(--cinder-text-sm);
  }

  .weft-revisions-panel__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .weft-revisions-panel__row {
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .weft-revisions-panel__row-identity {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .weft-revisions-panel__revision {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-revisions-panel__row-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px 16px;
    margin: 0;
  }

  .weft-revisions-panel__row-meta dt {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }

  .weft-revisions-panel__row-meta dd {
    margin: 0;
    font-size: var(--cinder-text-xs);
  }

  .weft-revisions-panel__mono {
    font-family: var(--cinder-font-mono);
  }
</style>
