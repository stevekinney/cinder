<script lang="ts" module>
  import type { Snippet } from 'svelte';

  import type { BadgeVariant } from './badge/badge.types.ts';

  export type ChipVariant = BadgeVariant;
  export type ChipSize = 'sm' | 'md';
  export type ChipMode = 'display' | 'toggle' | 'removable';

  /**
   * Opt the chip into a shared toolbar height (via `--cinder-control-height-sm`)
   * so it lines up with sibling Button (size="sm") and SegmentedControl
   * (density="toolbar"). Default rendering is unchanged.
   */
  export type ChipDensity = 'toolbar';

  export type ChipDisplayProps = {
    mode?: 'display';
    label: string;
    variant?: ChipVariant;
    size?: ChipSize;
    density?: ChipDensity;
    leadingIcon?: Snippet;
    class?: string;
    id?: string;
    title?: string;
    onpressedchange?: never;
    onremove?: never;
    [key: `data-${string}`]: string | number | boolean | undefined;
  };

  export type ChipToggleProps = {
    mode: 'toggle';
    label: string;
    variant?: ChipVariant;
    size?: ChipSize;
    density?: ChipDensity;
    leadingIcon?: Snippet;
    class?: string;
    id?: string;
    title?: string;
    pressed: boolean;
    onpressedchange?: (pressed: boolean) => void;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    'aria-label'?: string;
    [key: `data-${string}`]: string | number | boolean | undefined;
  };

  export type ChipRemovableProps = {
    mode: 'removable';
    label: string;
    variant?: ChipVariant;
    size?: ChipSize;
    density?: ChipDensity;
    leadingIcon?: Snippet;
    class?: string;
    id?: string;
    title?: string;
    onremove?: () => void;
    disabled?: boolean;
    removeAriaLabel?: string;
    [key: `data-${string}`]: string | number | boolean | undefined;
  };

  export type ChipProps = ChipDisplayProps | ChipToggleProps | ChipRemovableProps;
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let props: ChipProps = $props();
  const mode = $derived(props.mode ?? 'display');
  const label = $derived(props.label);
  const variant = $derived(props.variant ?? 'neutral');
  const size = $derived(props.size ?? 'md');
  const density = $derived(props.density);
  const customClassName = $derived(props.class);
  const leadingIcon = $derived(props.leadingIcon);
  const pressed = $derived(mode === 'toggle' ? (props as ChipToggleProps).pressed : false);
  const onpressedchange = $derived(
    mode === 'toggle' ? (props as ChipToggleProps).onpressedchange : undefined,
  );
  const disabled = $derived(
    mode !== 'display' ? (props as ChipToggleProps | ChipRemovableProps).disabled : undefined,
  );
  const onclick = $derived(mode === 'toggle' ? (props as ChipToggleProps).onclick : undefined);
  const ariaLabelRaw = $derived(
    mode === 'toggle' ? (props as ChipToggleProps)['aria-label'] : undefined,
  );
  const ariaLabel = $derived(
    typeof ariaLabelRaw === 'string' && ariaLabelRaw.trim().length > 0 ? ariaLabelRaw : undefined,
  );
  const onremove = $derived(
    mode === 'removable' ? (props as ChipRemovableProps).onremove : undefined,
  );
  const removeAriaLabel = $derived.by(() => {
    if (mode !== 'removable') return undefined;
    const raw = (props as ChipRemovableProps).removeAriaLabel;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
  });

  const extraAttrs = $derived.by(() => {
    const result: Record<string, string | number | boolean | undefined> = {};
    const p = props as Record<string, unknown>;
    if (typeof p['id'] === 'string') result['id'] = p['id'];
    if (typeof p['title'] === 'string') result['title'] = p['title'];
    for (const key of Object.keys(p)) {
      if (key.startsWith('data-') && !key.startsWith('data-cinder-')) {
        const val = p[key];
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          result[key] = val;
        }
      }
    }
    return result;
  });
</script>

{#if mode === 'toggle'}
  <button
    type="button"
    class={classNames('cinder-chip', customClassName)}
    {...extraAttrs}
    data-cinder-mode="toggle"
    data-cinder-variant={variant}
    data-cinder-size={size}
    data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
    aria-pressed={pressed}
    aria-label={ariaLabel}
    {disabled}
    onclick={(event) => {
      if (disabled) return;
      onclick?.(event);
      if (!event.defaultPrevented) {
        onpressedchange?.(!pressed);
      }
    }}
  >
    {#if leadingIcon}
      <span class="cinder-chip__icon" aria-hidden="true">{@render leadingIcon()}</span>
    {/if}
    <span class="cinder-chip__label">{label}</span>
  </button>
{:else if mode === 'removable'}
  <span
    class={classNames('cinder-chip', customClassName)}
    {...extraAttrs}
    data-cinder-mode="removable"
    data-cinder-variant={variant}
    data-cinder-size={size}
    data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
    data-cinder-disabled={disabled || undefined}
  >
    {#if leadingIcon}
      <span class="cinder-chip__icon" aria-hidden="true">{@render leadingIcon()}</span>
    {/if}
    <span class="cinder-chip__label">{label}</span>
    <button
      type="button"
      class="cinder-chip__remove"
      aria-label={removeAriaLabel ?? `Remove ${label}`}
      {disabled}
      onclick={() => {
        if (!disabled) onremove?.();
      }}
    >
      <span aria-hidden="true">×</span>
    </button>
  </span>
{:else}
  <span
    class={classNames('cinder-chip', customClassName)}
    {...extraAttrs}
    data-cinder-mode="display"
    data-cinder-variant={variant}
    data-cinder-size={size}
    data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
  >
    {#if leadingIcon}
      <span class="cinder-chip__icon" aria-hidden="true">{@render leadingIcon()}</span>
    {/if}
    <span class="cinder-chip__label">{label}</span>
  </span>
{/if}
