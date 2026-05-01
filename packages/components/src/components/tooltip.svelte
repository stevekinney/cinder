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
  import { useId } from '../utilities/use-id.ts';

  let { text, placement = 'top', class: className, children }: TooltipProps = $props();

  const tooltipId = useId('cinder-tooltip');

  let visible = $state(false);
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hasPendingShow = $state(false);

  function show() {
    clearTimeout(showTimer);
    hasPendingShow = true;
    showTimer = setTimeout(() => {
      showTimer = undefined;
      hasPendingShow = false;
      visible = true;
    }, 100);
  }

  function hide() {
    clearTimeout(showTimer);
    showTimer = undefined;
    hasPendingShow = false;
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

  // WAI-ARIA APG: tooltips must be dismissible via Escape without losing
  // pointer or focus on the trigger. Hide the tooltip but don't blur — the
  // user keeps interacting with the trigger.
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      hide();
    }
  }

  $effect(() => {
    if (!visible && !hasPendingShow) return;
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
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
    if (!focusable) return;
    // Append our tooltipId to any existing aria-describedby value rather than replacing it,
    // so consumer-provided relationships on the trigger element are preserved.
    const existing = focusable.getAttribute('aria-describedby');
    const ids = existing ? existing.split(' ').filter(Boolean) : [];
    if (!ids.includes(tooltipId)) {
      focusable.setAttribute('aria-describedby', [...ids, tooltipId].join(' '));
    }
    return () => {
      const current = focusable.getAttribute('aria-describedby');
      if (!current) return;
      const remaining = current
        .split(' ')
        .filter((id) => id !== tooltipId)
        .join(' ');
      if (remaining) {
        focusable.setAttribute('aria-describedby', remaining);
      } else {
        focusable.removeAttribute('aria-describedby');
      }
    };
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
