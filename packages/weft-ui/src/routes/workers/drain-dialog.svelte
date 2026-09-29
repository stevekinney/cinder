<script lang="ts">
  /**
   * Drain-with-reason dialog (plan §9.4 T5.2: "drain (with reason) / resume
   * per worker and per deployment"). Draining is reversible (Resume undoes
   * it immediately, no confirmation — see `worker-detail-view.svelte`/
   * `fleet-view.svelte`), so this composes `Modal` directly rather than
   * `ConfirmDialog`/`AlertDialog`: the body needs a real form field (the
   * optional reason), which neither preset dialog can host (`ConfirmDialog`
   * only has a single `typeToConfirm` input slot for irreversible actions;
   * `AlertDialog` has no body slot at all) — `Modal` + `role="dialog"` is
   * exactly Cinder's own documented escape hatch for "richer body content"
   * (`confirm-dialog/README.md`).
   */
  import { Button, Modal, Textarea } from '@lostgradient/cinder';

  export type DrainTarget =
    | { readonly kind: 'worker'; readonly id: string }
    | { readonly kind: 'deployment'; readonly name: string };

  interface DrainDialogProps {
    readonly open: boolean;
    readonly target: DrainTarget;
    readonly submitting: boolean;
    readonly onDrain: (reason: string | undefined) => void;
    readonly onCancel: () => void;
  }

  let { open = $bindable(), target, submitting, onDrain, onCancel }: DrainDialogProps = $props();

  let reason = $state('');

  $effect(() => {
    if (open) reason = '';
  });

  const targetLabel = $derived(target.kind === 'worker' ? target.id : target.name);
  const title = $derived(target.kind === 'worker' ? 'Drain worker' : 'Drain deployment');

  function handleDrain(): void {
    const trimmed = reason.trim();
    onDrain(trimmed.length > 0 ? trimmed : undefined);
  }

  function handleDismiss(): void {
    open = false;
    onCancel();
  }
</script>

<Modal bind:open {title} onDismiss={handleDismiss}>
  {#snippet children()}
    <p class="weft-drain-dialog__description">
      Draining <strong class="weft-drain-dialog__target">{targetLabel}</strong> stops new task assignment
      while in-flight work finishes. Resume clears the drain marker at any time.
    </p>
    <Textarea
      id="drain-reason"
      label="Reason"
      description="Optional — shown to operators viewing this worker while it drains."
      bind:value={reason}
      rows={3}
      placeholder="e.g. rolling deploy #4791"
    />
  {/snippet}
  {#snippet footer()}
    <Button variant="secondary" onclick={handleDismiss} disabled={submitting}>Cancel</Button>
    <Button variant="primary" onclick={handleDrain} loading={submitting}>{title}</Button>
  {/snippet}
</Modal>
