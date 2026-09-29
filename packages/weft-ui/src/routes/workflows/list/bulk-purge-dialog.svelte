<script lang="ts">
  /**
   * Purge confirmation dialog (plan §9.2/§13 T8.1;
   * `weft/src/server/operations/purge-workflows.ts`).
   *
   * ## Why this is a SEPARATE dialog from `bulk-action-dialog.svelte`
   *
   * Verified against the actual weft 0.12 source, not the plan's own §0
   * Ground Truth summary (which lists purge alongside the five
   * confirmation-token operations — that summary is stale against the real
   * `purgeWorkflowsOperation`):
   *
   * - `purgeWorkflowsOperation`'s `inputSchema` is `bulkListFilterInputSchema`
   *   ALONE — no `dryRun`/`confirmationToken`/`requestId` fields exist on
   *   the wire at all. There is no preview step and nothing to echo back for
   *   a second confirming call; `POST /v1/workflows/purge` executes
   *   immediately.
   * - `access: { kind: 'public' }` — unlike every other bulk operation
   *   (`bulkOperatorAccessPolicy`, `anyOf workflows:admin`), purge declares
   *   NO required scope server-side. `bulk-selection-bar.svelte` still
   *   gates the Purge button behind `workflows:admin` for UI consistency
   *   with its five siblings, but this dialog itself never claims a scope
   *   requirement it can't verify — see that file's module doc.
   * - `purge()` skips `assertScopedBulkWorkflowFilter` — an EMPTY filter
   *   purges every terminal workflow the engine holds, engine-wide. The
   *   matched-count display below is deliberately labeled from "the current
   *   filter" rather than implying a formal preview, and the bar still
   *   requires a real scoping dimension before this dialog can even open
   *   (`bulk-filter-scope.ts`) as a client-side safety rail beyond what the
   *   wire contract requires.
   *
   * `matchedCount` is the list's own already-fetched `total` for the current
   * filter — a real server-computed count, not a client guess, but NOT a
   * formal dry-run figure either: it can be stale by the time Purge commits
   * if workflows changed in between. The copy below says so; there is no
   * confirmation-token protocol to detect that staleness the way the other
   * five actions can.
   */
  import { Badge, Button, Input, Modal, Progress } from '@lostgradient/cinder';

  import { faultTreatment } from '../../../lib/faults.ts';
  import { confirmPhrase, confirmPhraseMatches } from './bulk-preview-format.ts';
  import type { BulkCommitSummary } from './bulk-result-summary.ts';

  interface BulkPurgeDialogProps {
    readonly matchedCount: number;
    readonly filterChip: string;
    readonly runPurge: () => Promise<BulkCommitSummary>;
    readonly onClose: () => void;
    /** Fired once purge actually succeeds — see `bulk-action-dialog.svelte`'s identical prop doc for why this is distinct from `onClose`. */
    readonly onSuccess?: () => void;
  }

  let { matchedCount, filterChip, runPurge, onClose, onSuccess }: BulkPurgeDialogProps = $props();

  type Phase = 'confirm' | 'committing' | 'result' | 'fault';

  let phase = $state<Phase>('confirm');
  let confirmText = $state('');
  let result = $state<BulkCommitSummary | null>(null);
  let faultMessage = $state('');

  const phrase = $derived(confirmPhrase('purge', matchedCount));
  const confirmMatches = $derived(confirmPhraseMatches(confirmText, phrase));

  async function commit(): Promise<void> {
    if (!confirmMatches) return;
    phase = 'committing';
    try {
      result = await runPurge();
      phase = 'result';
      onSuccess?.();
    } catch (error) {
      faultMessage = faultTreatment(error).message;
      phase = 'fault';
    }
  }

  function handleDismiss(): void {
    if (phase === 'committing') return;
    onClose();
  }
</script>

<Modal
  open={true}
  title="Purge terminal workflows"
  dismissOnBackdropClick={phase !== 'committing'}
  dismissOnEscape={phase !== 'committing'}
  closeButtonVisible={phase !== 'committing'}
  onDismiss={handleDismiss}
>
  {#snippet children()}
    {#if phase === 'confirm'}
      <p class="weft-bulk-dialog__lead">
        Permanently deletes <strong
          >{matchedCount} terminal workflow{matchedCount === 1 ? '' : 's'}</strong
        >
        matching the current filter — not just the visible page.
      </p>
      {#if filterChip.length > 0}
        <code class="weft-bulk-dialog__chip">{filterChip}</code>
      {/if}
      <p class="weft-bulk-dialog__warning" role="alert">
        Purge has no preview step and no undo. This count reflects the list's most recent fetch —
        the actual number purged may differ if workflows changed since then.
      </p>
      {#if matchedCount === 0}
        <p class="weft-bulk-dialog__note">No workflows match the current filter — nothing to do.</p>
      {:else}
        <Input
          id="bulk-purge-confirm-text"
          label={`Type "${phrase}" to confirm`}
          bind:value={confirmText}
          autocomplete="off"
        />
      {/if}
    {:else if phase === 'committing'}
      <div class="weft-bulk-dialog__progress">
        <Progress ariaLabel="Purge in progress" />
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
    {:else if phase === 'fault'}
      <p class="weft-bulk-dialog__fault" role="alert">{faultMessage}</p>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if phase === 'confirm'}
      <Button variant="ghost" size="sm" onclick={onClose}>Cancel</Button>
      {#if matchedCount > 0}
        <Button variant="danger" size="sm" disabled={!confirmMatches} onclick={commit}>
          Purge {matchedCount} workflow{matchedCount === 1 ? '' : 's'}
        </Button>
      {/if}
    {:else if phase === 'result'}
      <Button variant="primary" size="sm" onclick={onClose}>Close</Button>
    {:else if phase === 'fault'}
      <Button variant="ghost" size="sm" onclick={onClose}>Close</Button>
      <Button variant="secondary" size="sm" onclick={commit}>Retry</Button>
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

  .weft-bulk-dialog__warning {
    margin: 0 0 12px;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-color-danger-fg);
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
