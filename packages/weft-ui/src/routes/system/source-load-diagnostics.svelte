<script lang="ts">
  /**
   * Per-`(name, revision)` dynamic-source load diagnostics (WFT-116). One
   * `weft.catalog.diagnostics` query, rendered as the bounded lifecycle
   * fields WFT-16 exposes: source kind, requested revision, load state,
   * load duration, waiter count, and last failure category.
   *
   * ## Scope
   *
   * `weft.catalog.diagnostics` requires `system:read`, so this component gates
   * itself rather than assuming its caller's grant.
   *
   * ## Cancellation is not offered, deliberately
   *
   * A `loading` state with a non-zero waiter count is exactly where an
   * operator reaches for a Cancel button, and Weft publishes no operation
   * that cancels an in-flight source load. Aborting the console's own HTTP
   * request would not touch the engine's single-flight load — it would only
   * stop this console from watching it, while every real waiter stayed
   * blocked. So there is no Cancel control here, and the `loading` copy
   * says plainly that the load is server-side. `cancelled` still renders as
   * a first-class state: it records that the final waiting caller went away.
   * The shared load can continue and install the revision after that state
   * transition; `cancelled` does not establish that the work stopped.
   */
  import { Badge } from '@lostgradient/cinder';
  import { AlertTriangle, CircleDashed, CheckCircle2, Loader, XCircle } from 'lucide-svelte';
  import { createQuery } from '@tanstack/svelte-query';

  import { getClient } from '../../lib/client.ts';
  import { queryKeys } from '../../lib/query.ts';
  import { getPrincipalStore, isForbidden, isUnauthorized } from '../../lib/scopes.svelte.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';
  import {
    isCatalogDiagnosticsLike,
    ACTIVE_SOURCE_POLL_MS,
    sourceLoadPollInterval,
    summarizeSourceLoad,
    type SourceLoadPollInterval,
    type SourceLoadSummary,
  } from './source-load-diagnostics-view.ts';

  interface Props {
    workflowName: string;
    revision: string;
    /** Keeps polling fast while this exact key has a preload request in flight. */
    preloadPending?: boolean;
  }

  let { workflowName, revision, preloadPending = false }: Props = $props();

  const client = getClient();
  const principal = getPrincipalStore();

  const canRead = $derived(principal.hasScope('system:read'));

  /**
   * Poll cadence comes from `sourceLoadPollInterval` rather than being decided
   * here: fast while a load is in flight, slow but NOT stopped once settled.
   *
   * Stopping at settled was wrong. A settled source still changes whenever
   * something else starts a load — another operator's preload, or a workflow
   * start resolving the source — and neither invalidates this console's cache.
   * A row left unpolled would silently show `idle` for the rest of the session
   * while the engine went `loading` and back.
   */
  const diagnosticsQuery = createQuery(() => ({
    queryKey: queryKeys.catalog.diagnostics(workflowName, revision),
    queryFn: async (): Promise<unknown> => {
      try {
        return await client.operations['weft.catalog.diagnostics']({
          name: workflowName,
          revision,
        });
      } catch (error) {
        // The repository's runtime-degrade path (`scopes.svelte.ts`), which
        // this query needs more than most: it polls. A scope revoked
        // server-side mid-session would otherwise 403 forever on a 2s or 30s
        // timer — TanStack Query keeps the last good data, so the data-driven
        // interval stays armed — while showing a fault banner instead of the
        // honest "requires system:read" state. Revoking locally flips
        // `canRead`, which disables the query outright.
        // 401 first: a credential that expired or was rotated mid-session is
        // not a scope problem, and `denyScope` would mislabel it. Clearing
        // the principal returns the shell to its authentication-required
        // state instead of re-sending an invalid credential on the timer.
        if (isUnauthorized(error)) principal.clear();
        else if (isForbidden(error)) principal.denyScope('system:read');
        throw error;
      }
    },
    enabled: canRead,
    refetchInterval: (query: { state: { data: unknown } }): SourceLoadPollInterval | false => {
      const data = query.state.data;
      // A malformed response is the one case worth stopping for: re-polling
      // cannot reinterpret bytes this build already failed to recognize, and
      // the rendered state says so explicitly. Every recognized state keeps
      // polling — see `sourceLoadPollInterval`.
      if (!isCatalogDiagnosticsLike(data)) return false;
      return preloadPending
        ? ACTIVE_SOURCE_POLL_MS
        : sourceLoadPollInterval(summarizeSourceLoad(data));
    },
  }));

  /** `undefined` for a successful-but-unrecognized response — an explicit malformed-response state, never rendered as a partial guess. */
  const summary = $derived.by((): SourceLoadSummary | undefined => {
    const data = diagnosticsQuery.data;
    return isCatalogDiagnosticsLike(data) ? summarizeSourceLoad(data) : undefined;
  });

  const isResolved = $derived(diagnosticsQuery.data !== undefined);
</script>

<div class="weft-source-load" role="group" aria-label="Source load diagnostics">
  {#if !canRead}
    <p class="weft-source-load__note">Requires system:read to view load diagnostics.</p>
  {:else if diagnosticsQuery.isPending}
    <p class="weft-source-load__note" role="status" aria-busy="true">Loading diagnostics…</p>
  {:else if diagnosticsQuery.isError}
    <QueryFaultBanner error={diagnosticsQuery.error} onRetry={() => diagnosticsQuery.refetch()} />
  {:else if summary === undefined}
    <p class="weft-source-load__malformed" role="alert">
      <AlertTriangle aria-hidden="true" size={14} />
      <span>
        The server returned load diagnostics this console doesn't recognize — showing nothing rather
        than a guess.
      </span>
    </p>
  {:else if summary.kind === 'not-dynamic'}
    <p class="weft-source-load__note">{summary.message}</p>
  {:else}
    <!--
      The load state IS the thing an operator is waiting on, and polling can
      change it without any interaction, so it lives in a polite live region.
      Scoped to this block deliberately: the sibling "Refreshing diagnostics…"
      text is intentionally outside it, so a background poll that changes
      nothing announces nothing, while idle -> loading -> ready/failed does.
    -->
    <div class="weft-source-load__state" role="status">
      {#if summary.tone === 'positive'}
        <CheckCircle2 aria-hidden="true" size={14} />
      {:else if summary.tone === 'progress'}
        <Loader aria-hidden="true" size={14} />
      {:else if summary.tone === 'attention'}
        <XCircle aria-hidden="true" size={14} />
      {:else}
        <CircleDashed aria-hidden="true" size={14} />
      {/if}
      <Badge variant={summary.tone === 'attention' ? 'danger' : 'neutral'}>
        Load state: {summary.stateLabel}
      </Badge>
      {#if summary.stateDescription !== undefined}
        <span class="weft-source-load__description">{summary.stateDescription}</span>
      {/if}
    </div>

    {#if summary.state === 'loading'}
      <p class="weft-source-load__note">
        This load is shared by waiting callers on the serving engine process. The console cannot
        cancel it; closing or refreshing this page does not stop it.
      </p>
    {/if}

    <dl class="weft-source-load__meta">
      {#each summary.meta as item (item.term)}
        <div>
          <dt>{item.term}</dt>
          <dd class={item.mono ? 'weft-source-load__mono' : ''} title={item.title}>{item.value}</dd>
        </div>
      {/each}
    </dl>

    {#if summary.lastFailureCategory !== undefined}
      <p class="weft-source-load__failure">
        <AlertTriangle aria-hidden="true" size={14} />
        <span>
          Last failure category: <strong>{summary.lastFailureCategory}</strong
          >{#if summary.lastFailureDescription !== undefined}&nbsp;—&nbsp;{summary.lastFailureDescription}{/if}
        </span>
      </p>
    {/if}
  {/if}

  <!-- Background refreshes stay quiet; the state badge is the live region. -->
  {#if canRead && isResolved && diagnosticsQuery.isFetching}
    <span class="weft-source-load__refreshing">Refreshing diagnostics…</span>
  {/if}
</div>

<style>
  .weft-source-load {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .weft-source-load__note,
  .weft-source-load__description {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-source-load__refreshing {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }

  .weft-source-load__state {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .weft-source-load__malformed,
  .weft-source-load__failure {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    padding: 8px 10px;
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-color-warning-bg);
    border: 1px solid var(--cinder-color-warning-border);
    color: var(--cinder-color-warning-fg);
    font-size: var(--cinder-text-xs);
  }

  .weft-source-load__meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px 16px;
    margin: 0;
  }

  .weft-source-load__meta dt {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }

  .weft-source-load__meta dd {
    margin: 0;
    font-size: var(--cinder-text-xs);
    overflow-wrap: anywhere;
  }

  .weft-source-load__mono {
    font-family: var(--cinder-font-mono);
  }
</style>
