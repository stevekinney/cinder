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
  import Input from '../input/input.svelte';
  import Modal from '../modal/modal.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  const descriptionId = $props.id();
  const typedConfirmationId = `${descriptionId}-typed-confirmation`;

  let {
    open = $bindable(false),
    title,
    description,
    cancelLabel = 'Cancel',
    confirmLabel,
    destructive = false,
    typeToConfirm,
    typeToConfirmLabel,
    onconfirm,
    oncancel,
    triggerRef = null,
    class: className,
  }: ConfirmDialogProps = $props();
  const describedById = $derived(description ? descriptionId : undefined);
  let typedConfirmation = $state('');
  let previousOpen = open;
  const typedConfirmationMatches = $derived(
    typeToConfirm === undefined ||
      typedConfirmation.trim().toLocaleLowerCase() === typeToConfirm.toLocaleLowerCase(),
  );

  $effect(() => {
    if (open === previousOpen) return;
    previousOpen = open;
    typedConfirmation = '';
  });

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
  class={classNames('cinder-confirm-dialog', className)}
  {...describedById ? { describedById } : {}}
  {...oncancel ? { ondismiss: oncancel } : {}}
>
  {#if description}
    <p id={descriptionId} class="cinder-confirm-dialog__description">{description}</p>
  {/if}

  {#if typeToConfirm !== undefined}
    <Input
      id={typedConfirmationId}
      class="cinder-confirm-dialog__typed-confirmation"
      bind:value={typedConfirmation}
      label={typeToConfirmLabel ?? `Type "${typeToConfirm}" to confirm`}
      autocomplete="off"
    />
  {/if}

  {#snippet footer()}
    <Button variant="secondary" autofocus onclick={handleCancel}>{cancelLabel}</Button>
    <Button
      variant={destructive ? 'danger' : 'primary'}
      disabled={!typedConfirmationMatches}
      onclick={handleConfirm}>{confirmLabel}</Button
    >
  {/snippet}
</Modal>
