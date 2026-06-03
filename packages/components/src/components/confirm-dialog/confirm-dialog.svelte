<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Modal-backed confirmation prompt with cancel and confirm actions, including a destructive variant for irreversible operations.
   * @tag overlay
   * @tag dialog
   * @useWhen Requiring an explicit yes/no acknowledgement before performing a destructive or irreversible action.
   * @useWhen Asking the user to confirm a discrete decision with two clear outcomes.
   * @avoidWhen Collecting structured input or multiple fields — compose a modal with form controls instead.
   * @avoidWhen Announcing a non-blocking result — use toast-region or banner.
   * @related modal, drawer, sheet
   */
  export type { ConfirmDialogProps } from './confirm-dialog.types.ts';
</script>

<script lang="ts">
  import type { ConfirmDialogProps } from './confirm-dialog.types.ts';
  import Button from '../button/button.svelte';
  import Modal from '../modal/modal.svelte';
  import { cn } from '../../utilities/class-names.ts';

  const descriptionId = $props.id();

  let {
    open = $bindable(false),
    title,
    description,
    cancelLabel = 'Cancel',
    confirmLabel,
    destructive = false,
    onconfirm,
    oncancel,
    triggerRef = null,
    class: className,
  }: ConfirmDialogProps = $props();
  const describedById = $derived(description ? descriptionId : undefined);

  function handleCancel() {
    // Mirror Modal's dismiss() ordering: state first, then callback. No try/catch —
    // consumer errors must propagate so tests, error boundaries, and observability see them.
    open = false;
    oncancel?.();
  }

  function handleConfirm() {
    // Same ordering and error policy: close first, fire callback, let errors propagate.
    open = false;
    onconfirm();
  }
</script>

<Modal
  bind:open
  {title}
  {triggerRef}
  class={cn('cinder-confirm-dialog', className)}
  {...describedById ? { describedById } : {}}
  {...oncancel ? { ondismiss: oncancel } : {}}
>
  {#if description}
    <p id={descriptionId} class="cinder-confirm-dialog__description">{description}</p>
  {/if}

  {#snippet footer()}
    <Button variant="secondary" autofocus onclick={handleCancel}>{cancelLabel}</Button>
    <Button variant={destructive ? 'danger' : 'primary'} onclick={handleConfirm}
      >{confirmLabel}</Button
    >
  {/snippet}
</Modal>
