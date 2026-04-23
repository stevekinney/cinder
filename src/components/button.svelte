<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  /** Visual style of the button. */
  export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

  /** Size of the button. */
  export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

  type SharedProps = {
    /** Visual style. */
    variant?: ButtonVariant;
    /** Size of the button. */
    size?: ButtonSize;
    /** Expand to container width. */
    fullWidth?: boolean;
    /** Disable the button and show a spinner if styled for it. */
    loading?: boolean;
    /** Slot content (takes precedence over `label`). */
    children?: Snippet;
    /** Fallback text when `children` is not provided. */
    label?: string;
    /** Custom class merged with `.cinder-button`. */
    class?: string;
  };

  type ButtonOnlyProps = SharedProps & Omit<HTMLButtonAttributes, 'class'> & { href?: undefined };

  type LinkButtonProps = SharedProps & Omit<HTMLAnchorAttributes, 'class'> & { href: string };

  /** Props for the Button component. */
  export type ButtonProps = ButtonOnlyProps | LinkButtonProps;

  const SHARED_KEYS = new Set([
    'variant',
    'size',
    'fullWidth',
    'loading',
    'children',
    'label',
    'class',
  ]);

  /** Strip component-specific props so the remainder can spread onto the native element. */
  function nativeAttrs(props: ButtonProps): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (!SHARED_KEYS.has(key)) out[key] = value;
    }
    return out;
  }
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  const props: ButtonProps = $props();

  const variant = $derived(props.variant ?? 'secondary');
  const size = $derived(props.size ?? 'md');
  const fullWidth = $derived(props.fullWidth ?? false);
  const loading = $derived(props.loading ?? false);
  const classes = $derived(cn('cinder-button', props.class));
  const dataAttrs = $derived({
    'data-cinder-variant': variant,
    'data-cinder-size': size,
    'data-cinder-full-width': fullWidth || undefined,
    'data-cinder-loading': loading || undefined,
  });
</script>

{#if props.href !== undefined}
  <a {...nativeAttrs(props)} class={classes} {...dataAttrs} aria-disabled={loading || undefined}>
    {#if props.children}{@render props.children()}{:else}{props.label}{/if}
  </a>
{:else}
  <button
    {...nativeAttrs(props)}
    type={props.type ?? 'button'}
    class={classes}
    {...dataAttrs}
    disabled={(props.disabled ?? false) || loading}
    aria-busy={loading || undefined}
  >
    {#if props.children}{@render props.children()}{:else}{props.label}{/if}
  </button>
{/if}
