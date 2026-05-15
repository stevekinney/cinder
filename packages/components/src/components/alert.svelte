<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

  export type AlertProps = HTMLAttributes<HTMLDivElement> & {
    variant?: AlertVariant;
    dismissible?: boolean;
    onDismiss?: () => void;
    class?: string;
    children: Snippet;
    icon?: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    variant = 'info',
    dismissible = false,
    onDismiss,
    class: className,
    children,
    icon,
    ...rest
  }: AlertProps = $props();

  let visible = $state(true);

  function handleDismiss() {
    visible = false;
    onDismiss?.();
  }
</script>

{#if visible}
  <div class={cn('cinder-alert', className)} data-cinder-variant={variant} role="alert" {...rest}>
    {#if icon}
      <div class="cinder-alert__icon" aria-hidden="true">
        {@render icon()}
      </div>
    {/if}

    <div class="cinder-alert__content">
      {@render children()}
    </div>

    {#if dismissible}
      <button
        type="button"
        class="cinder-alert__dismiss"
        onclick={handleDismiss}
        aria-label="Dismiss alert"
      >
        <svg
          class="cinder-alert__dismiss-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
          />
        </svg>
      </button>
    {/if}
  </div>
{/if}
