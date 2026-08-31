<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose In-flow confirmation for reversible actions without modal interruption.
   * @useWhen Confirming a reversible action in the same flow as its trigger.
   * @avoidWhen The action requires modal interruption or extensive consequences; use ConfirmDialog.
   * @related confirm-dialog
   * @rationale Nearest alternative: ConfirmDialog interrupts with a modal; this keeps confirmation in flow.
   */
  export type { InlineConfirmProps } from './inline-confirm.types.ts';
</script>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import Button from '@lostgradient/cinder/button';
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { InlineConfirmProps } from './inline-confirm.types.ts';

  let {
    prompt,
    confirmLabel,
    cancelLabel = 'Cancel',
    destructive = false,
    open = $bindable(false),
    onConfirm,
    onCancel,
    class: className,
    children,
  }: InlineConfirmProps = $props();
  let root: HTMLElement | null = $state(null);
  let trigger: HTMLElement | null = $state(null);
  let releaseEscape: (() => void) | null = null;
  let wasOpen = false;

  $effect(() => {
    if (open === wasOpen) return;
    wasOpen = open;
    if (open) {
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      releaseEscape = pushEscapeHandler((event) => {
        event.preventDefault();
        cancel();
      });
      void tick().then(() =>
        root
          ?.querySelector<HTMLElement>('[data-cinder-inline-cancel]')
          ?.focus({ preventScroll: true }),
      );
    } else {
      releaseEscape?.();
      releaseEscape = null;
      restoreTriggerFocus();
    }
  });

  onDestroy(() => {
    releaseEscape?.();
    releaseEscape = null;
    restoreTriggerFocus();
  });

  function restoreTriggerFocus(): void {
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  }

  function cancel(): void {
    open = false;
    onCancel?.();
  }
  function confirm(): void {
    open = false;
    onConfirm?.();
  }
</script>

{#if open}
  <div
    bind:this={root}
    class={classNames('cinder-inline-confirm', className)}
    data-cinder-destructive={destructive ? '' : undefined}
    role="group"
    aria-label={prompt}
  >
    <div class="cinder-inline-confirm__layout">
      <p class="cinder-inline-confirm__prompt">{prompt}</p>
      {@render children?.()}
      <div class="cinder-inline-confirm__actions">
        <Button variant="secondary" size="xs" data-cinder-inline-cancel onclick={cancel}
          >{cancelLabel}</Button
        >
        <Button variant={destructive ? 'danger' : 'primary'} size="xs" onclick={confirm}
          >{confirmLabel}</Button
        >
      </div>
    </div>
  </div>
{/if}
