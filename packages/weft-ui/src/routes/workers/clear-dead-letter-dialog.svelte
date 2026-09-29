<script lang="ts">
  /**
   * Tier-3 type-to-confirm dead-letter clear (plan §9.4 T5.3, §10.6 Tier 3:
   * "type-to-confirm (AlertDialog)"). `ConfirmDialog`'s own `typeToConfirm`
   * prop already gates the confirm button on a case-insensitive trimmed
   * match — this is the sanctioned Cinder pattern for a user-initiated
   * destructive confirmation (`confirm-dialog/README.md`: "This includes
   * high-impact destructive actions the user initiated, even ones that
   * affect other people"); `AlertDialog` is reserved for system-initiated
   * interruptions and has no `typeToConfirm`/body-input slot at all, so it
   * cannot host this flow (see `drain-dialog.svelte`'s doc comment for the
   * same distinction).
   */
  import { ConfirmDialog } from '@lostgradient/cinder';
  import type { TaskLedgerDetail } from './worker-catalog-types.ts';

  interface ClearDeadLetterDialogProps {
    readonly open: boolean;
    readonly operationId: string;
    readonly submitting: boolean;
    readonly task?: TaskLedgerDetail | undefined;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  }

  let {
    open = $bindable(),
    operationId,
    submitting,
    task,
    onConfirm,
    onCancel,
  }: ClearDeadLetterDialogProps = $props();

  const preview = $derived(
    task
      ? `Preview: ${task.state} attempt ${task.attempt} on queue ${task.queue}. Clearing removes the retained dead-letter record—it does not retry the task.`
      : 'Loading the authoritative attempt preview. Clearing removes the retained dead-letter record—it does not retry the task.',
  );
</script>

<ConfirmDialog
  bind:open
  title="Clear dead letter"
  description={`${preview} This cannot be undone.`}
  confirmLabel={submitting ? 'Clearing…' : 'Clear dead letter'}
  destructive
  typeToConfirm={operationId}
  {onConfirm}
  {onCancel}
/>
