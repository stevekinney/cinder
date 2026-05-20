<script lang="ts" module>
  export type { ConfirmDialogProps } from './confirm-dialog.types.ts';
</script>

<script lang="ts">
  import type { ConfirmDialogProps } from './confirm-dialog.types.ts';
  import Button from '../button/button.svelte';
  import Modal from '../modal/modal.svelte';
  import { cn } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';

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

  const descriptionId = useId('cinder-confirm-dialog-description');
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
