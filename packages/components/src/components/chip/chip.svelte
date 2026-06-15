<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Compact pill for metadata labels, applied filters, selected entities, and tag-like tokens, with optional removal or toggle interactions via its mode prop.
   * @tag tag
   * @tag filter
   * @useWhen Representing issue labels, free-form tags, applied filters, selected entities, or other metadata tokens.
   * @useWhen Offering a small toggleable option inside a group of choices.
   * @avoidWhen Showing a numeric count, short status, or compact category annotation next to another element — use badge instead.
   * @avoidWhen Picking one of a small fixed set — use segmented-control instead.
   * @related badge, status-dot
   */
  export type {
    ChipDensity,
    ChipDisplayProps,
    ChipMode,
    ChipProps,
    ChipRemovableProps,
    ChipSize,
    ChipToggleProps,
    ChipVariant,
  } from './chip.types.ts';
</script>

<script lang="ts">
  import type { ChipProps, ChipRemovableProps, ChipToggleProps } from './chip.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  // `ChipProps` is a discriminated union across three variants with different underlying HTML
  // element types (<button> for toggle, <span> for display/removable). Destructuring the union
  // directly is not possible for mode-specific props. Instead, `props` is kept as the raw typed
  // value and bespoke props are accessed via `$derived` with narrowing casts per mode.
  //
  // Native HTML attributes pass through via `rest`: we strip the known bespoke prop keys at
  // runtime and spread the remainder onto the rendered element BEFORE controlled attrs, so that
  // component-owned attrs (data-cinder-*, aria-pressed, aria-label for toggle) always win.
  //
  // `onclick` for the toggle button is read via a cast so it can be wrapped — the wrapper calls
  // the consumer's handler first, then fires `onpressedchange` unless `defaultPrevented`.
  //
  // `aria-label` for toggle is read via a cast so empty strings can be suppressed (an empty
  // aria-label overrides the accessible-name computation per ARIA spec §4.3 without providing
  // a name). Display/removable modes forward `aria-label` unchanged through `rest`.
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
  const consumerOnClick = $derived(
    mode === 'toggle' ? (props as ChipToggleProps).onclick : undefined,
  );
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

  // Compute `rest` by stripping all known bespoke prop keys from the raw props object.
  // Whatever remains is a set of native HTML attributes the consumer intends to forward.
  // This achieves the same effect as `const { a, b, c, ...rest } = $props()` but works
  // across the discriminated union where not all keys are common to every variant.
  // `onclick` is intentionally NOT in this set: for display/removable modes it should flow
  // through `rest` unchanged. For toggle mode, the explicit `onclick={wrapper}` on the <button>
  // appears after the spread and overrides `rest`'s value; the wrapper reads `consumerOnClick`
  // (captured via $derived cast above) and calls it first.
  //
  // `aria-label` is also NOT stripped: display/removable modes forward it through `rest`.
  // For toggle mode, the explicit `aria-label={ariaLabel}` (empty-string-filtered) overrides.
  const BESPOKE_KEYS = new Set([
    'mode',
    'label',
    'variant',
    'size',
    'density',
    'leadingIcon',
    'class',
    'pressed',
    'onpressedchange',
    'disabled',
    'onremove',
    'removeAriaLabel',
  ]);

  const rest = $derived.by(() => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      if (!BESPOKE_KEYS.has(key)) {
        result[key] = value;
      }
    }
    return result;
  });

  // A bare `role="group"` needs an accessible name, so removable mode names the
  // group with its `label` by default. But `aria-label` flows through `rest` for
  // display/removable modes (see above), so a consumer-supplied `aria-label`
  // must win. Resolve to the consumer's value when present, falling back to
  // `label` — and apply it explicitly so it can't be clobbered by the spread.
  const removableAriaLabel = $derived.by(() => {
    const forwarded = rest['aria-label'];
    return typeof forwarded === 'string' && forwarded.trim().length > 0 ? forwarded : label;
  });
</script>

{#if mode === 'toggle'}
  <button
    {...rest}
    type="button"
    data-cinder-mode="toggle"
    data-cinder-variant={variant}
    data-cinder-size={size}
    data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
    class={classNames('cinder-chip', customClassName)}
    aria-pressed={pressed}
    aria-label={ariaLabel}
    {disabled}
    onclick={(event) => {
      if (disabled) return;
      consumerOnClick?.(event);
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
    {...rest}
    role="group"
    aria-label={removableAriaLabel}
    data-cinder-mode="removable"
    data-cinder-variant={variant}
    data-cinder-size={size}
    data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
    data-cinder-disabled={disabled || undefined}
    aria-disabled={disabled || undefined}
    class={classNames('cinder-chip', customClassName)}
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
    {...rest}
    data-cinder-mode="display"
    data-cinder-variant={variant}
    data-cinder-size={size}
    data-cinder-density={density === 'toolbar' ? 'toolbar' : undefined}
    class={classNames('cinder-chip', customClassName)}
  >
    {#if leadingIcon}
      <span class="cinder-chip__icon" aria-hidden="true">{@render leadingIcon()}</span>
    {/if}
    <span class="cinder-chip__label">{label}</span>
  </span>
{/if}
