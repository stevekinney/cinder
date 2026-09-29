<script lang="ts">
  /**
   * Shared Tier-3 type-to-confirm dialog for the five filter-scoped bulk
   * workflow operations (cancel, signal, retry-failed, delete, mutate tags —
   * plan §9.2/§10.6 T8.1; design `Weft Patterns.dc.html` Tier-3 mock).
   * `bulk-purge-dialog.svelte` is separate — purge has no dry-run/
   * confirmation-token protocol at all (see that file's module doc).
   *
   * ## Why this composes `Modal` directly rather than `ConfirmDialog`
   *
   * `ConfirmDialog`'s `description` is a single plain-text `<p>` (its own
   * README: "For rich content … compose `Modal` directly instead"), but the
   * Tier-3 body needs a matched count, a filter-summary chip, and (for
   * delete) a finalizer-pending skip note — none of which fits a one-line
   * description. `AlertDialog` has neither a body-input slot nor
   * `typeToConfirm` at all (confirmed against its README), so it cannot host
   * this flow either — the same reasoning
   * `../../workers/clear-dead-letter-dialog.svelte` and
   * `../../workers/drain-dialog.svelte` already documented for their own
   * escape-hatch compositions. `role="alertdialog"` is intentionally NOT set
   * here: this dialog stays a `ConfirmDialog`-model interaction (the
   * operator opened it; Escape is a safe "never mind") right up until the
   * commit call is in flight, at which point `dismissOnEscape`/
   * `dismissOnBackdropClick`/`showCloseButton` all flip to `false` for the
   * one phase where dismissal would abandon a request already sent to the
   * server — see the `committing` phase below and its "closing this doesn't
   * cancel the server operation" note (plan §10.6 bulk-progress requirement).
   *
   * ## Phases
   *
   * `params` (optional, only when a `parameters` snippet is supplied — signal
   * needs a name/payload, tags needs an add/remove + tag list; cancel/retry/
   * delete skip straight to `loading`) → `loading` (dry-run in flight) →
   * `preview` (matched count + filter chip + type-to-confirm) → `committing`
   * (non-dismissible, indeterminate progress) → `result` | `fault`.
   *
   * A commit fault classified `invalid` (plan §10.4) means the confirmation
   * token no longer matches the current dry-run scope — weft's
   * `BulkOperationConfirmationError` (`weft/src/core/engine/errors.ts`),
   * content-based, not time-based: it fires when the matched set changed
   * between preview and commit, not on a clock. The UI response is to run a
   * fresh preview, not to show a generic error — `retryMeansPreview` below
   * drives that branch. Any OTHER fault kind at commit time (network,
   * `EngineFailure`, …) offers a same-token retry instead, since the token
   * itself is still valid.
   */
  import { Badge, Button, Input, Modal, Progress, Skeleton } from '@lostgradient/cinder';
  import type { Snippet } from 'svelte';
  import type { BulkOperationDryRunResult } from '@lostgradient/weft';

  import { faultTreatment } from '../../../lib/faults.ts';
  import { confirmPhrase, confirmPhraseMatches, filterSummaryChip } from './bulk-preview-format.ts';
  import type { BulkCommitSummary } from './bulk-result-summary.ts';

  interface BulkActionDialogProps {
    readonly title: string;
    /** Lowercase verb used in both the type-to-confirm phrase and the confirm button label — "cancel", "retry", "delete", "add tags to", "remove tags from". */
    readonly verb: string;
    readonly destructive?: boolean;
    /** Optional pre-preview parameter form (signal name/payload, tags op/list). Cancel/retry-failed/delete omit this and go straight to the dry run. */
    readonly parameters?: Snippet;
    /** Gates leaving the `params` phase — ignored when `parameters` is omitted. */
    readonly parametersValid?: boolean;
    readonly runDryRun: () => Promise<BulkOperationDryRunResult>;
    /** `matched` is the dry-run preview's own count, passed through so the caller can build a "N of M" result summary without re-deriving state this dialog already holds. */
    readonly runCommit: (confirmationToken: string, matched: number) => Promise<BulkCommitSummary>;
    readonly onClose: () => void;
    /** Optional free-text note rendered in the `preview` phase, below the matched-count/filter-chip line — e.g. the retry-failed dialog's revision-retention explanation (WFT-117). Omitted for callers with nothing to add. */
    readonly previewNote?: string;
    /**
     * Fired once, right when a commit actually succeeds — independent of
     * when (or whether) the user clicks the result phase's "Close" button
     * afterward. Distinct from `onClose` deliberately: `onClose` also fires
     * for every dismissal that did NOT commit anything (Escape, backdrop,
     * the params/preview phase's "Cancel"), where invalidating queries is
     * harmless but clearing the caller's row selection would not be — the
     * caller might want to retry a DIFFERENT action against the same
     * selection. Optional so `bulk-purge-dialog.svelte`'s equivalent single-
     * phase flow isn't forced to declare an unused prop.
     */
    readonly onSuccess?: () => void;
  }

  let {
    title,
    verb,
    destructive = true,
    parameters,
    parametersValid = true,
    runDryRun,
    runCommit,
    onClose,
    onSuccess,
    previewNote,
  }: BulkActionDialogProps = $props();

  type Phase = 'params' | 'loading' | 'preview' | 'committing' | 'result' | 'fault';

  // Intentional one-shot capture: `bulk-selection-bar.svelte` renders one
  // literal `<BulkActionDialog>` per `{#if activeAction === '…'}` branch,
  // each with its own fixed `parameters` snippet (or none) baked in —
  // switching `activeAction` destroys and recreates the whole instance, so
  // `parameters` never changes under a still-mounted dialog. Tracking it
  // reactively would also be wrong here: `phase` is meant to *start* in
  // 'params' and then move forward through the flow, not snap back to
  // 'params' if a later, unrelated re-render happened to re-evaluate this.
  // svelte-ignore state_referenced_locally
  let phase = $state<Phase>(parameters ? 'params' : 'loading');
  let preview = $state<BulkOperationDryRunResult | null>(null);
  let confirmText = $state('');
  let result = $state<BulkCommitSummary | null>(null);
  let faultMessage = $state('');
  /**
   * Which phase produced the current `fault` — decides what "Retry" does.
   * A fault from `loading` means the dry run itself never returned a
   * `preview` (nothing to commit yet, and nothing for the stale-token
   * question to apply to), so retry must re-run the dry run regardless of
   * fault kind. A fault from `committing` follows the module doc's
   * `faultMeansStalePreview` split (re-preview vs same-token retry).
   * Getting this wrong left "Retry" as a silent no-op after a failed
   * initial dry run (`commit()`'s own `!preview` guard swallowed it) —
   * caught via manual dev-harness verification, not a unit test, which is
   * exactly why `bulk-selection-bar.test.ts`'s coverage now includes this
   * path (module test file, "Retry re-runs the dry run after a failed
   * initial preview").
   */
  let faultOrigin = $state<'loading' | 'committing'>('loading');
  /** `true` when the commit fault means "re-run the preview", not "retry the same token" (module doc). Only meaningful when `faultOrigin === 'committing'`. */
  let faultMeansStalePreview = $state(false);

  $effect(() => {
    if (!parameters) void loadPreview();
  });

  async function loadPreview(): Promise<void> {
    phase = 'loading';
    confirmText = '';
    try {
      preview = await runDryRun();
      phase = 'preview';
    } catch (error) {
      faultMessage = faultTreatment(error).message;
      faultOrigin = 'loading';
      faultMeansStalePreview = false;
      phase = 'fault';
    }
  }

  function continueFromParams(): void {
    if (!parametersValid) return;
    void loadPreview();
  }

  const phrase = $derived(preview ? confirmPhrase(verb, preview.matched) : '');
  const confirmMatches = $derived(confirmPhraseMatches(confirmText, phrase));
  const chip = $derived(preview ? filterSummaryChip(preview.scope.filter) : '');

  async function commit(): Promise<void> {
    if (!preview || !confirmMatches) return;
    const token = preview.confirmationToken;
    const matched = preview.matched;
    phase = 'committing';
    try {
      result = await runCommit(token, matched);
      phase = 'result';
      onSuccess?.();
    } catch (error) {
      const treatment = faultTreatment(error);
      faultMessage = treatment.message;
      faultOrigin = 'committing';
      faultMeansStalePreview = treatment.kind === 'invalid';
      phase = 'fault';
    }
  }

  function retryFromFault(): void {
    if (faultOrigin === 'loading' || faultMeansStalePreview) void loadPreview();
    else void commit();
  }

  function handleDismiss(): void {
    if (phase === 'committing') return;
    onClose();
  }
</script>

<Modal
  open={true}
  {title}
  dismissOnBackdropClick={phase !== 'committing'}
  dismissOnEscape={phase !== 'committing'}
  closeButtonVisible={phase !== 'committing'}
  onDismiss={handleDismiss}
>
  {#snippet children()}
    {#if phase === 'params'}
      {@render parameters?.()}
    {:else if phase === 'loading'}
      <div aria-busy="true" aria-label="Checking how many workflows match">
        <Skeleton height="1.25rem" width="60%" />
        <Skeleton height="3rem" />
      </div>
    {:else if phase === 'preview' && preview}
      <p class="weft-bulk-dialog__lead">
        Operates on all <strong
          >{preview.matched} matching workflow{preview.matched === 1 ? '' : 's'}</strong
        >
        — not just the visible page.
      </p>
      {#if chip.length > 0}
        <code class="weft-bulk-dialog__chip">{chip}</code>
      {/if}
      {#if preview.skippedTeardownPending && preview.skippedTeardownPending.length > 0}
        <p class="weft-bulk-dialog__note">
          {preview.skippedTeardownPending.length} of these still owe a finalizer run and will be skipped.
        </p>
      {/if}
      {#if previewNote}
        <p class="weft-bulk-dialog__note">{previewNote}</p>
      {/if}
      {#if preview.matched === 0}
        <p class="weft-bulk-dialog__note">No workflows match the current filter — nothing to do.</p>
      {:else}
        <Input
          id="bulk-action-confirm-text"
          label={`Type "${phrase}" to confirm`}
          bind:value={confirmText}
          autocomplete="off"
        />
      {/if}
    {:else if phase === 'committing'}
      <div class="weft-bulk-dialog__progress">
        <Progress ariaLabel={`${title} in progress`} />
        <p class="weft-bulk-dialog__note">
          Please keep this open until it finishes. Closing this doesn't cancel the server operation
          — it will keep running.
        </p>
      </div>
    {:else if phase === 'result' && result}
      <p class="weft-bulk-dialog__headline">
        <Badge variant="success">Done</Badge>
        {result.headline}
      </p>
      {#if result.note}
        <p class="weft-bulk-dialog__note">{result.note}</p>
      {/if}
      {#if result.errors.length > 0}
        <ul class="weft-bulk-dialog__errors">
          {#each result.errors as entry (entry.id)}
            <li><code>{entry.id}</code> — {entry.error}</li>
          {/each}
        </ul>
      {/if}
    {:else if phase === 'fault'}
      <p class="weft-bulk-dialog__fault" role="alert">{faultMessage}</p>
      {#if faultMeansStalePreview}
        <p class="weft-bulk-dialog__note">
          The set of matching workflows changed since the preview. Run the preview again.
        </p>
      {/if}
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if phase === 'params'}
      <Button variant="ghost" size="sm" onclick={onClose}>Cancel</Button>
      <Button variant="primary" size="sm" disabled={!parametersValid} onclick={continueFromParams}>
        Continue
      </Button>
    {:else if phase === 'preview' && preview}
      <Button variant="ghost" size="sm" onclick={onClose}>Cancel</Button>
      {#if preview.matched > 0}
        <Button
          variant={destructive ? 'danger' : 'primary'}
          size="sm"
          disabled={!confirmMatches}
          onclick={commit}
        >
          {verb[0]?.toUpperCase()}{verb.slice(1)}
          {preview.matched} workflow{preview.matched === 1 ? '' : 's'}
        </Button>
      {/if}
    {:else if phase === 'result'}
      <Button variant="primary" size="sm" onclick={onClose}>Close</Button>
    {:else if phase === 'fault'}
      <Button variant="ghost" size="sm" onclick={onClose}>Close</Button>
      <Button variant="secondary" size="sm" onclick={retryFromFault}>
        {faultMeansStalePreview ? 'Refresh preview' : 'Retry'}
      </Button>
    {/if}
  {/snippet}
</Modal>

<style>
  .weft-bulk-dialog__lead {
    margin: 0 0 10px;
    font-size: var(--cinder-text-sm);
  }

  .weft-bulk-dialog__chip {
    display: block;
    margin-bottom: 12px;
    padding: 8px 10px;
    background: var(--cinder-surface-inset);
    border-radius: var(--cinder-radius-sm);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-muted);
  }

  .weft-bulk-dialog__note {
    margin: 8px 0 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-bulk-dialog__headline {
    margin: 0;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .weft-bulk-dialog__errors {
    margin: 10px 0 0;
    padding-inline-start: 18px;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
    max-height: 160px;
    overflow-y: auto;
  }

  .weft-bulk-dialog__fault {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-color-danger-fg);
  }

  .weft-bulk-dialog__progress {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
