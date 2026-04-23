<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  /** Visual style of the button. */
  export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

  /** Size of the button. */
  export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

  type SharedBase = {
    /** Visual style. */
    variant?: ButtonVariant;
    /** Size of the button. */
    size?: ButtonSize;
    /** Expand to container width. */
    fullWidth?: boolean;
    /** Disable the button and show a spinner. */
    loading?: boolean;
    /** Custom class merged with `.cinder-button`. */
    class?: string;
  };

  // At least one of `label` or `children` must be provided so the button has an accessible name.
  type WithLabel = { label: string; children?: Snippet };
  type WithChildren = { label?: string; children: Snippet };
  type SharedProps = SharedBase & (WithLabel | WithChildren);

  type ButtonOnlyProps = SharedProps & Omit<HTMLButtonAttributes, 'class'> & { href?: undefined };
  type LinkButtonProps = SharedProps & Omit<HTMLAnchorAttributes, 'class'> & { href: string };

  /** Props for the Button component. */
  export type ButtonProps = ButtonOnlyProps | LinkButtonProps;
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  // Destructured props let the Phase 4 analyzer read names + defaults mechanically.
  // `...rest` carries native HTML attributes through; each branch casts it to the correct element's
  // attribute type so the spread is type-safe without a runtime filter.
  const {
    variant = 'secondary',
    size = 'md',
    fullWidth = false,
    loading = false,
    children,
    label,
    class: customClassName,
    href,
    ...rest
  }: ButtonProps = $props();

  const mergedClassName = $derived(classNames('cinder-button', customClassName));
  const dataAttributes = $derived({
    'data-cinder-variant': variant,
    'data-cinder-size': size,
    'data-cinder-full-width': fullWidth ? '' : undefined,
    'data-cinder-loading': loading ? '' : undefined,
  });

  // Narrow `rest` per branch. The union-distributed rest loses both arms' specifics; casting here
  // is safe because the discriminant (`href !== undefined`) already selects the branch.
  const anchorAttributes = $derived(
    rest as Omit<HTMLAnchorAttributes, 'class' | 'href' | 'tabindex'>,
  );
  const buttonAttributes = $derived(
    rest as Omit<HTMLButtonAttributes, 'class' | 'type' | 'disabled'>,
  );
  const anchorTabIndex = $derived(
    (rest as { tabindex?: HTMLAnchorAttributes['tabindex'] }).tabindex,
  );
  const buttonType = $derived((rest as { type?: HTMLButtonAttributes['type'] }).type);
  const buttonDisabled = $derived((rest as { disabled?: boolean }).disabled ?? false);
</script>

{#if href !== undefined}
  <a
    {...anchorAttributes}
    href={loading ? undefined : href}
    tabindex={loading ? -1 : anchorTabIndex}
    class={mergedClassName}
    {...dataAttributes}
    aria-disabled={loading ? 'true' : undefined}
    aria-busy={loading ? 'true' : undefined}
  >
    {#if children}{@render children()}{:else}{label}{/if}
  </a>
{:else}
  <button
    {...buttonAttributes}
    type={buttonType ?? 'button'}
    class={mergedClassName}
    {...dataAttributes}
    disabled={buttonDisabled || loading}
    aria-busy={loading ? 'true' : undefined}
  >
    {#if children}{@render children()}{:else}{label}{/if}
  </button>
{/if}
