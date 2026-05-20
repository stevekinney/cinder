<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Inline status message with assertive role for surfacing time-sensitive feedback about a nearby action or region.
   * @tag feedback
   * @tag notice
   * @useWhen Surfacing the result of a just-completed action such as a save failure or success.
   * @useWhen Calling out a transient condition the user must notice immediately within a specific region.
   * @avoidWhen Communicating a page- or app-wide notice that persists across views — use a banner instead.
   * @avoidWhen Providing supplemental commentary or guidance inline with content — use a callout instead.
   * @related banner, callout, toast-region
   */
  export type { AlertProps, AlertVariant } from './alert.types.ts';
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';
  import type { AlertProps } from './alert.types.ts';

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
        class="cinder-_dismiss-button cinder-alert__dismiss"
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
