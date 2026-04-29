<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type PopoverPlacement =
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'
    | 'top-start'
    | 'top-end'
    | 'right-start'
    | 'right-end'
    | 'bottom-start'
    | 'bottom-end'
    | 'left-start'
    | 'left-end';

  /**
   * EXPERIMENTAL — Popover API may change between minor versions until
   * promoted to stable.
   *
   * Anchored interactive surface. Distinct from Tooltip (display-only) and
   * Dropdown (menu semantics). v1 uses the platform Popover API where
   * available with a graceful fallback for older browsers.
   */
  export type PopoverProps = {
    /** Whether the popover is open. Bindable. */
    open?: boolean;
    /** Position relative to the trigger. Default `bottom-start`. */
    placement?: PopoverPlacement;
    /** Additional class names merged with `.cinder-popover`. */
    class?: string;
    /** Trigger snippet — must contain a focusable element. */
    trigger: Snippet;
    /** Popover content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { cn } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    open = $bindable(false),
    placement = 'bottom-start',
    class: className,
    trigger,
    children,
  }: PopoverProps = $props();

  const popoverId = useId('cinder-popover');

  let supportsPopover = $state(false);
  let rootElement: HTMLDivElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  let triggerWrapper: HTMLDivElement | undefined = $state();
  let releaseEscape: (() => void) | null = null;

  $effect(() => {
    supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
  });

  // Wire ARIA on the first focusable trigger element.
  $effect(() => {
    const btn = triggerWrapper?.querySelector<HTMLElement>(
      'button, a, [tabindex]:not([tabindex="-1"]), input, select',
    );
    if (!btn) return;
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-controls', popoverId);
    return () => {
      btn.removeAttribute('aria-haspopup');
      btn.removeAttribute('aria-expanded');
      btn.removeAttribute('aria-controls');
    };
  });

  // ESC handling via the shared overlay escape stack so nested overlays
  // resolve in order.
  $effect(() => {
    if (!open) return;
    releaseEscape = pushEscapeHandler(() => {
      open = false;
    });
    return () => {
      if (releaseEscape) {
        releaseEscape();
        releaseEscape = null;
      }
    };
  });

  // Imperative show/hide via the platform Popover API where available.
  $effect(() => {
    if (!supportsPopover || !panelElement) return;
    const panel = panelElement as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    };
    if (open) {
      panel.showPopover?.();
    } else {
      panel.hidePopover?.();
    }
  });

  // Fallback outside-click handler for browsers without the Popover API.
  $effect(() => {
    if (supportsPopover || !open) return;
    const handler = (event: MouseEvent) => {
      if (rootElement && !rootElement.contains(event.target as Node)) {
        open = false;
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  });

  function handlePopoverToggle(event: Event) {
    const toggle = event as ToggleEvent;
    open = toggle.newState === 'open';
  }
</script>

<div
  bind:this={rootElement}
  class={cn('cinder-popover-wrapper', className)}
  data-cinder-placement={placement}
>
  <div class="cinder-popover__trigger" bind:this={triggerWrapper} onclick={() => (open = !open)}>
    {@render trigger()}
  </div>

  {#if supportsPopover}
    <div
      bind:this={panelElement}
      id={popoverId}
      class="cinder-popover"
      role="dialog"
      popover="auto"
      data-cinder-placement={placement}
      ontoggle={handlePopoverToggle}
    >
      {@render children()}
    </div>
  {:else if open}
    <div id={popoverId} class="cinder-popover" role="dialog" data-cinder-placement={placement}>
      {@render children()}
    </div>
  {/if}
</div>
