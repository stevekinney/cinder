<script lang="ts">
  /**
   * Dynamic workflow sources panel (WFT-116) — mounted on System → Registry,
   * above the registered-definitions table. Looks up the loading lifecycle
   * of one `engine.registerSource()`-registered `(name, revision)` key and
   * offers the one scoped action Weft exposes for it: preload.
   *
   * ## Why this combines a source list with exact lookup
   *
   * `weft.catalog.sources.list` enumerates the process-local
   * `registerSource()` keys that `weft.system.registry` deliberately omits.
   * Selecting a row only fills the exact `(name, revision)` lookup; the
   * diagnostics and preload controls still call their per-key operations, and
   * the manual form remains available for opaque keys or copied descriptors.
   *
   * ## Preload is the only exposed action
   *
   * `weft.workflows.revisions.preload` (`workflows:admin`) is the sole wire
   * operation over dynamic-source loading. `resolveWorkflowSource()` is
   * reachable only indirectly, through preload or through starting a
   * workflow, and there is no cancel operation at all — see
   * `<SourceLoadDiagnostics>`'s module doc for why this panel therefore
   * offers no Cancel control rather than an inert one.
   *
   * After a preload SETTLES — applied or refused — the diagnostics query for
   * that exact key is invalidated. That re-fetch is what makes a refusal
   * actionable: the server deliberately never forwards a loader's own error
   * message onto the wire, so `source.lastFailureCategory` from the
   * refreshed diagnostics is the only classified account of why the load
   * failed (`preload-workflow-revision.ts`'s own catch says so explicitly).
   */
  import { Badge, Button, Checkbox, Input } from '@lostgradient/cinder';
  import { AlertTriangle, Ban, CheckCircle2 } from 'lucide-svelte';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';

  import { getClient } from '../../lib/client.ts';
  import { queryKeys } from '../../lib/query.ts';
  import {
    getPrincipalStore,
    isForbidden,
    isUnauthorized,
    scopeGate,
  } from '../../lib/scopes.svelte.ts';
  import {
    describePreloadOutcome,
    sourceRejectionReasonLabel,
    type PreloadOutcome,
  } from './preload-outcome.ts';
  import DynamicSourceList, { type CatalogSourceListEntry } from './dynamic-source-list.svelte';
  import SourceLoadDiagnostics from './source-load-diagnostics.svelte';

  /** The `(name, revision)` pair a submitted lookup resolved to — `null` until the operator submits one. */
  interface LookupKey {
    readonly name: string;
    readonly revision: string;
  }

  const client = getClient();
  const principal = getPrincipalStore();
  const queryClient = useQueryClient();

  const adminGate = $derived(scopeGate(principal, ['workflows:admin']));

  let nameInput = $state('');
  let revisionInput = $state('');
  let revisionIsJsonString = $state(false);
  let lookup = $state<LookupKey | null>(null);
  let outcome = $state<PreloadOutcome | null>(null);

  /**
   * The name is trimmed; the revision deliberately is NOT.
   *
   * A workflow name has a grammar (`/^[A-Za-z_][A-Za-z0-9_-]*$/`) that excludes
   * whitespace outright, so trimming it can only turn a guaranteed
   * InvalidParams into a working lookup. A revision has no grammar at all —
   * `registerSource()` and `validateWorkflowRevisionField()` both accept any
   * non-empty, length-bounded string — so whitespace is part of the identity,
   * and trimming would silently look up a DIFFERENT key. A revision registered
   * as `" candidate "` would be unreachable from this panel, and the operator
   * would be told `"candidate"` is not registered.
   */
  const trimmedName = $derived(nameInput.trim());
  const submittedRevision = $derived.by((): string | undefined => {
    if (!revisionIsJsonString) return revisionInput;
    try {
      const parsed: unknown = JSON.parse(revisionInput);
      return typeof parsed === 'string' ? parsed : undefined;
    } catch {
      return undefined;
    }
  });
  const canSubmit = $derived(
    trimmedName.length > 0 && submittedRevision !== undefined && submittedRevision.length > 0,
  );

  /**
   * Whether the submitted lookup still matches what is typed in the inputs.
   * When it doesn't, the rendered diagnostics and outcome describe the
   * PREVIOUS key — stale relative to the form — and the panel says so
   * rather than letting an operator read them as answers about what they
   * just typed.
   */
  const isStale = $derived(
    lookup !== null &&
      (lookup.name !== trimmedName || lookup.revision !== (submittedRevision ?? '')),
  );

  function submitLookup(event: SubmitEvent): void {
    event.preventDefault();
    if (!canSubmit || submittedRevision === undefined) return;
    // A new key's outcome has not happened yet; carrying the previous key's
    // banner across would attribute it to the wrong revision.
    outcome = null;
    lookup = { name: trimmedName, revision: submittedRevision };
  }

  function selectSource(source: CatalogSourceListEntry): void {
    nameInput = source.name;
    revisionIsJsonString = true;
    revisionInput = JSON.stringify(source.revision);
    outcome = null;
    lookup = { name: source.name, revision: source.revision };
  }

  function isWorkflowRevisionRecordLike(
    value: unknown,
  ): value is { manifest: { revision: string } } {
    if (typeof value !== 'object' || value === null) return false;
    const manifest = (value as Record<string, unknown>)['manifest'];
    if (typeof manifest !== 'object' || manifest === null) return false;
    return typeof (manifest as Record<string, unknown>)['revision'] === 'string';
  }

  /**
   * Synchronous in-flight guard, and the ONLY thing that actually
   * deduplicates concurrent submissions. Disabling the button on
   * `preloadMutation.isPending` is presentation, not deduplication: neither
   * the pending flag nor the resulting `disabled` attribute is applied
   * synchronously, so several clicks dispatched before Svelte's next render
   * all pass that check and fire real requests. A plain flag flipped in the
   * handler itself closes that window, because every click handler in a
   * given task runs to completion before any re-render happens.
   *
   * The engine deduplicates concurrent loads for the same key on its own
   * side, so the duplicates were not corrupting anything durable — but they
   * were real extra requests, and their outcomes raced each other into the
   * one outcome banner, which could leave it describing an earlier attempt.
   *
   * It holds the KEY rather than a boolean so the button can stay honest
   * about which revision it is waiting on: a preload can still be running
   * for the previously inspected key while the operator looks at a new one,
   * and labelling that button "Preloading…" would attribute work on one
   * revision to another.
   */
  let preloadInFlightKey = $state<LookupKey | null>(null);

  /** Whether the in-flight preload, if there is one, is for the key currently displayed. */
  const isPreloadingLookup = $derived(
    preloadInFlightKey !== null &&
      lookup !== null &&
      preloadInFlightKey.name === lookup.name &&
      preloadInFlightKey.revision === lookup.revision,
  );

  const preloadMutation = createMutation<PreloadOutcome, unknown, LookupKey>(() => ({
    mutationFn: async (key: LookupKey) => {
      try {
        const raw = await client.operations['weft.workflows.revisions.preload']({
          name: key.name,
          revision: key.revision,
        });
        return describePreloadOutcome(
          isWorkflowRevisionRecordLike(raw)
            ? { installed: true, revision: raw.manifest.revision }
            : // A 2xx whose body this console can't read is not a failure to
              // report as one — the install DID happen server-side. Report it
              // against the requested revision, which is the key the server
              // was asked about.
              { installed: true, revision: key.revision },
          key.name,
          key.revision,
        );
      } catch (error) {
        // Degrade the local principal before describing the outcome, so the
        // control stops inviting a request the server will keep rejecting.
        // Describing a denial without this leaves the Preload button enabled
        // for the rest of the session.
        if (isUnauthorized(error)) principal.clear();
        else if (isForbidden(error)) principal.denyScope('workflows:admin');
        return describePreloadOutcome({ installed: false, error }, key.name, key.revision);
      }
    },
    onSuccess: (result: PreloadOutcome, key: LookupKey) => {
      // Invalidate unconditionally, BEFORE the display guard below: the query
      // cache is global, so a settled preload's effect on `(key.name,
      // key.revision)` is worth recording whether or not that key happens to
      // be the one on screen right now.
      //
      // Invalidate on EVERY settled outcome, not just an applied one: a
      // refusal moves `source.state`/`lastFailureCategory` too, and that
      // refreshed classification is the actionable half of the refusal.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.catalog.diagnostics(key.name, key.revision),
      });
      void queryClient.invalidateQueries({ queryKey: ['catalog', 'sources'] });
      if (result.kind === 'installed') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.revisions(key.name) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.active(key.name) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.registry() });
      }

      // The outcome banner sits directly under this panel's identity badges,
      // so it is only truthful while it describes the key those badges name.
      // Nothing stops an operator inspecting a different key while a preload
      // is still in flight; without this guard the earlier key's outcome
      // lands under the new key's badges and reads as a result for a revision
      // that was never preloaded at all.
      if (lookup === null || lookup.name !== key.name || lookup.revision !== key.revision) return;
      outcome = result;
    },
    onSettled: () => {
      preloadInFlightKey = null;
    },
  }));

  function runPreload(): void {
    if (lookup === null || preloadInFlightKey !== null) return;
    // Retrying the SAME key would otherwise leave the previous attempt's
    // banner standing for the whole new request, so a slow retry reads as
    // having already produced the old result. Submitting a different lookup
    // already clears it; a retry has exactly the same claim to.
    outcome = null;
    preloadInFlightKey = { name: lookup.name, revision: lookup.revision };
    // An idle diagnostics response normally polls slowly. Refresh immediately
    // when this panel starts a preload so the mounted query observes the
    // corresponding server-side load and then stays on its fast cadence.
    void queryClient.refetchQueries({
      queryKey: queryKeys.catalog.diagnostics(lookup.name, lookup.revision),
    });
    preloadMutation.mutate(lookup);
  }
</script>

<section class="weft-dynamic-source" aria-labelledby="weft-dynamic-source-title">
  <div class="weft-dynamic-source__header">
    <h2 class="weft-dynamic-source__title" id="weft-dynamic-source-title">
      Dynamic workflow sources
    </h2>
    <p class="weft-dynamic-source__note">
      Dynamic workflows never appear in the registered-definitions table below. Select a registered
      source revision, or enter the exact workflow name and revision its <code
        >registerSource()</code
      >
      descriptor declares.
    </p>
    <p class="weft-dynamic-source__note">
      Load diagnostics describe the responding engine process. Use a stable per-engine endpoint;
      load-balanced responses may come from different engines.
    </p>
  </div>

  <DynamicSourceList selectedKey={lookup} onSelect={selectSource} />

  <form class="weft-dynamic-source__form" onsubmit={submitLookup}>
    <Input
      id="weft-dynamic-source-name"
      label="Workflow name"
      bind:value={nameInput}
      placeholder="dynamic-invoice"
      autocomplete="off"
    />
    <Input
      id="weft-dynamic-source-revision"
      label="Revision"
      bind:value={revisionInput}
      placeholder={revisionIsJsonString ? '"line\\r\\nrevision"' : 'r1'}
      autocomplete="off"
      {...revisionIsJsonString && submittedRevision === undefined
        ? { error: 'Enter a JSON string literal.' }
        : {}}
    />
    <Checkbox
      id="weft-dynamic-source-revision-json"
      bind:checked={revisionIsJsonString}
      label="Revision is a JSON string literal"
      description={'Use this mode for opaque revisions containing CR or LF; for example, "line\\r\\nrevision".'}
    />
    <Button type="submit" size="sm" variant="secondary" label="Inspect" disabled={!canSubmit} />
  </form>

  {#if lookup === null}
    <p class="weft-dynamic-source__note">
      No source inspected yet. Both fields are required — Weft answers for one exact
      <code>(name, revision)</code> key at a time.
    </p>
  {:else}
    <div class="weft-dynamic-source__result">
      <div class="weft-dynamic-source__result-identity">
        <Badge variant="neutral" monospace>{lookup.name}</Badge>
        <Badge variant="neutral" monospace>{lookup.revision}</Badge>
      </div>

      {#if isStale}
        <p class="weft-dynamic-source__stale" role="status">
          Showing the last inspected key. Select Inspect to look up what is currently typed above.
        </p>
      {/if}

      <SourceLoadDiagnostics
        workflowName={lookup.name}
        revision={lookup.revision}
        preloadPending={preloadInFlightKey?.name === lookup.name &&
          preloadInFlightKey?.revision === lookup.revision}
      />

      <div class="weft-dynamic-source__actions">
        <Button
          size="sm"
          variant="secondary"
          label={isPreloadingLookup ? 'Preloading…' : 'Preload'}
          disabled={adminGate.disabled || preloadInFlightKey !== null}
          title={preloadInFlightKey !== null && !isPreloadingLookup
            ? `Waiting for the preload of "${preloadInFlightKey.revision}" to finish.`
            : adminGate.title}
          onclick={runPreload}
        />
        <span class="weft-dynamic-source__note">
          Ensures this revision is installed in the durable catalog. Weft validates an existing
          entry or loads and validates the module, sharing one load per key within the serving
          engine process. The diagnostics above are a separate observation of the responding engine;
          they do not prove which process handled this preload. It cannot be cancelled from here.
        </span>
      </div>

      {#if outcome !== null}
        {#if outcome.kind === 'installed'}
          <p class="weft-dynamic-source__outcome weft-dynamic-source__outcome--ok" role="status">
            <CheckCircle2 aria-hidden="true" size={16} />
            <span>
              Revision "{outcome.revision}" is installed in the workflow catalog. A Load state of
              Idle above means this panel's last observation did not see an active load; another
              engine process may have loaded the revision.
            </span>
          </p>
        {:else if outcome.kind === 'rejected'}
          <div class="weft-dynamic-source__outcome weft-dynamic-source__outcome--bad" role="alert">
            <Ban aria-hidden="true" size={16} />
            <div>
              <Badge variant="danger">Refused: {outcome.reason}</Badge>
              <p>{outcome.message}</p>
              {#if outcome.rejectionReasons.length > 0}
                <ul>
                  {#each outcome.rejectionReasons as reason, index (index)}
                    <li>{sourceRejectionReasonLabel(reason)} ({reason})</li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
        {:else}
          <p class="weft-dynamic-source__outcome weft-dynamic-source__outcome--bad" role="alert">
            <AlertTriangle aria-hidden="true" size={16} />
            <span>{outcome.message}</span>
          </p>
        {/if}
      {/if}
    </div>
  {/if}
</section>

<style>
  .weft-dynamic-source {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    margin-block-end: 16px;
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
  }

  .weft-dynamic-source__header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .weft-dynamic-source__title {
    margin: 0;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-dynamic-source__note {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-dynamic-source__form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
  }

  .weft-dynamic-source__result {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
  }

  .weft-dynamic-source__result-identity {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .weft-dynamic-source__stale {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-dynamic-source__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .weft-dynamic-source__outcome {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-xs);
  }

  .weft-dynamic-source__outcome p,
  .weft-dynamic-source__outcome ul {
    margin: 6px 0 0;
  }

  .weft-dynamic-source__outcome ul {
    padding-inline-start: 18px;
  }

  .weft-dynamic-source__outcome--ok {
    background: var(--cinder-color-success-bg);
    border: 1px solid var(--cinder-color-success-border);
    color: var(--cinder-color-success-fg);
  }

  .weft-dynamic-source__outcome--bad {
    background: var(--cinder-color-danger-bg);
    border: 1px solid var(--cinder-color-danger-border);
    color: var(--cinder-color-danger-fg);
  }
</style>
