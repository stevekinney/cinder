<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Sticky alert dialog for urgent acknowledgement that cannot be dismissed by backdrop click or Escape.
   * @tag overlay
   * @tag dialog
   * @useWhen Requiring acknowledgement of a blocking warning before the user can continue.
   * @useWhen Presenting a destructive or high-risk message that needs an explicit OK action.
   * @avoidWhen Asking a reversible yes/no question — use confirm-dialog.
   * @avoidWhen Collecting rich form input — compose modal instead.
   * @related modal, confirm-dialog, drawer
   */
  export type { AlertDialogProps } from './alert-dialog.types.ts';
</script>

<script lang="ts">
  import type { AlertDialogProps } from './alert-dialog.types.ts';
  import Button from '../button/button.svelte';
  import Modal from '../modal/modal.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    open = $bindable(false),
    title,
    description,
    acknowledgeLabel = 'OK',
    cancelLabel,
    destructive = false,
    onacknowledge,
    oncancel,
    triggerRef = null,
    class: className,
  }: AlertDialogProps = $props();

  const descriptionId = useId('cinder-alert-dialog-description');

  function handleAcknowledge() {
    open = false;
    onacknowledge();
  }

  function handleCancel() {
    open = false;
    oncancel?.();
  }

  const acknowledgeAutofocus = $derived(!(destructive && cancelLabel));
  const cancelAutofocus = $derived(Boolean(destructive && cancelLabel));
</script>

<Modal
  bind:open
  {title}
  {triggerRef}
  role="alertdialog"
  dismissOnBackdropClick={false}
  dismissOnEscape={false}
  showCloseButton={false}
  describedById={descriptionId}
  class={classNames('cinder-alert-dialog', className)}
>
  <p id={descriptionId} class="cinder-alert-dialog__description">{description}</p>

  {#snippet footer()}
    {#if cancelLabel}
      <Button variant="secondary" autofocus={cancelAutofocus} onclick={handleCancel}>
        {cancelLabel}
      </Button>
    {/if}
    <Button
      variant={destructive ? 'danger' : 'primary'}
      autofocus={acknowledgeAutofocus}
      onclick={handleAcknowledge}
    >
      {acknowledgeLabel}
    </Button>
  {/snippet}
</Modal>
