<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

  export type TooltipProps = {
    text: string;
    placement?: TooltipPlacement;
    class?: string;
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let { text, placement = 'top', class: className, children }: TooltipProps = $props();

  // Generate a stable unique ID for aria-describedby linkage.
  // crypto.randomUUID() is client-only — use it directly since this component
  // is always rendered in a browser context (SSR renders nothing interactive).
  const tooltipId = `cinder-tooltip-${Math.random().toString(36).slice(2, 9)}`;

  let visible = $state(false);
  let showTimer: ReturnType<typeof setTimeout> | undefined;

  function show() {
    showTimer = setTimeout(() => {
      visible = true;
    }, 100);
  }

  function hide() {
    clearTimeout(showTimer);
    visible = false;
  }

  function handleMouseEnter() {
    show();
  }

  function handleMouseLeave() {
    hide();
  }

  function handleFocusIn() {
    show();
  }

  function handleFocusOut() {
    hide();
  }
</script>

<span
  class={cn('cinder-tooltip-wrapper', className)}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onfocusin={handleFocusIn}
  onfocusout={handleFocusOut}
  data-cinder-placement={placement}
  {@attach (el) => {
    const focusable = el.querySelector<HTMLElement>(
      'button, a, [tabindex]:not([tabindex="-1"]), input, select, textarea',
    );
    if (focusable) focusable.setAttribute('aria-describedby', tooltipId);
    return () => focusable?.removeAttribute('aria-describedby');
  }}
>
  {@render children()}

  <span
    id={tooltipId}
    role="tooltip"
    class="cinder-tooltip"
    aria-hidden={!visible}
    data-cinder-placement={placement}
  >
    {text}
  </span>
</span>
