<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  /**
   * Visual + semantic variants for {@link Banner}.
   *
   * Note: `banner.svelte` uses `danger` (matching the semantic token
   * `--cinder-danger`) where `alert.svelte` uses `error`. The divergence is
   * intentional and tracked in `banner.a11y.md`.
   */
  export type BannerVariant = 'info' | 'success' | 'warning' | 'danger';

  /**
   * Props for the page-level {@link Banner} component.
   *
   * Banner is distinct from `alert.svelte` (contextual card, `role="alert"`)
   * and the forthcoming `callout.svelte` (inline prose admonition). A banner
   * stretches full-width just inside the top of a layout and announces
   * site-wide conditions such as maintenance windows, trial expiry, or
   * cookie consent.
   *
   * `role` is `Omit`ted from the underlying `HTMLAttributes` because the
   * component enforces `role="region"`. Accepting a consumer-supplied role
   * would let callers silently turn the banner into `role="alert"`, which
   * defeats the landmark-based design (see `banner.a11y.md`).
   *
   * "Full-width" means the banner fills its parent container's inline size,
   * not the viewport. To bleed edge-to-edge, render the banner outside any
   * `max-inline-size` content column.
   */
  export type BannerProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'role'> & {
    /** Visual + semantic variant. Default `'info'`. */
    variant?: BannerVariant;
    /** Whether the banner shows a dismiss (×) button. Default `true`. */
    dismissible?: boolean;
    /** Called after the dismiss button is clicked. Use to persist state. */
    onDismiss?: () => void;
    /** Banner body content. */
    children: Snippet;
    /** Optional trailing CTA region (e.g., "Renew now" button). */
    actions?: Snippet;
    /** Extra classes appended to the root element. */
    class?: string;
  };

  const VARIANT_LABEL = {
    info: 'Information',
    success: 'Success',
    warning: 'Warning',
    danger: 'Error',
  } as const;
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    variant = 'info',
    dismissible = true,
    onDismiss,
    class: className,
    children,
    actions,
    ...rest
  }: BannerProps = $props();

  let visible = $state(true);

  function handleDismiss() {
    visible = false;
    onDismiss?.();
  }

  const hasLabelledBy = $derived(Boolean(rest['aria-labelledby']));
  const ariaLabel = $derived(
    hasLabelledBy ? undefined : (rest['aria-label'] ?? VARIANT_LABEL[variant]),
  );
</script>

{#if visible}
  <div
    {...rest}
    class={cn('cinder-banner', className)}
    data-cinder-variant={variant}
    role="region"
    aria-label={ariaLabel}
  >
    <div class="cinder-banner__content">
      {@render children()}
    </div>

    {#if actions}
      <div class="cinder-banner__actions">
        {@render actions()}
      </div>
    {/if}

    {#if dismissible}
      <button
        type="button"
        class="cinder-banner__dismiss"
        onclick={handleDismiss}
        aria-label="Dismiss banner"
      >
        <svg
          class="cinder-banner__dismiss-icon"
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
