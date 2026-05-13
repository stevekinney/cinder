<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * A single color entry in a ColorSwatchPicker palette.
   *
   * Supported `color` formats for alpha detection and contrast computation:
   * `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(r, g, b)`, `rgba(r, g, b, a)`,
   * `hsl(h, s%, l%)`, `hsla(h, s%, l%, a)` (legacy comma syntax only).
   * Other CSS color formats render via CSS but receive no checkerboard and a
   * best-effort `'white'` contrast indicator that may be invisible on near-white colors.
   */
  export type ColorSwatch = {
    /** CSS color string rendered as the swatch background. */
    color: string;
    /** Optional human label. When omitted, the `color` string is the accessible name. */
    name?: string;
    /** Disables this individual swatch. Skipped during keyboard navigation; not selectable. */
    disabled?: boolean;
  };

  /** Props for ColorSwatchPicker. */
  export type ColorSwatchPickerProps = {
    /** Controlled selected color. When provided, the parent owns the state. */
    value?: string;
    /** Initial selected color for uncontrolled use. Ignored when `value` is set. */
    defaultValue?: string;
    /** Palette to render. */
    colors: ColorSwatch[];
    /** Visual shape of each swatch. Default `'circle'`. */
    shape?: 'circle' | 'square';
    /** Swatch dimension token. Default `'md'`. */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    /**
     * Layout direction. Default `'grid'`.
     *
     * Note: grid layout uses one-dimensional DOM-order navigation for both
     * ArrowLeft/Right and ArrowUp/Down. True column-aware navigation is not
     * implemented in v1 — see a11y memo.
     */
    layout?: 'grid' | 'stack';
    /** Disables the entire listbox. Keyboard activation and clicks are ignored. */
    disabled?: boolean;
    /**
     * Accessible name for the listbox. Required — `role="listbox"` needs a label
     * so screen readers can announce the control's purpose.
     */
    label: string;
    /** Additional classes merged into the listbox `<ul>`. */
    class?: string;
    /** Fired when the selected swatch changes. */
    onchange?: (color: string) => void;
    /**
     * Snippet that replaces the default check-icon indicator on the selected swatch.
     * Receives the active swatch and the computed contrast color for the icon.
     */
    indicator?: Snippet<[{ swatch: ColorSwatch; contrastColor: 'black' | 'white' }]>;
  };
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { DEV } from 'esm-env';

  import { cn } from '../utilities/class-names.ts';
  import { hasAlpha, pickContrastColor } from '../utilities/color-luminance.ts';
  import { handleRovingKeydown } from '../utilities/roving-tabindex.ts';
  import { Check } from './icons/index.ts';

  let {
    value,
    defaultValue,
    colors,
    shape = 'circle',
    size = 'md',
    layout = 'grid',
    disabled = false,
    label,
    class: className,
    onchange,
    indicator,
  }: ColorSwatchPickerProps = $props();

  let internalValue = $state(defaultValue ?? '');
  const selected = $derived(value ?? internalValue);

  // Track focus index driven by user interaction. null = derive from selection.
  let userFocusIndex = $state<number | null>(null);

  // Reset stale focus index when palette identity changes.
  $effect(() => {
    void colors;
    userFocusIndex = null;
  });

  const effectiveFocusIndex = $derived.by(() => {
    if (colors.length === 0) return -1;

    // 1. User-driven focus if it points to a valid, non-item-disabled option.
    if (
      userFocusIndex !== null &&
      userFocusIndex < colors.length &&
      !colors[userFocusIndex]?.disabled
    ) {
      return userFocusIndex;
    }

    // 2. Currently selected swatch if it exists and is not item-disabled.
    const selectedIndex = colors.findIndex((s) => s.color === selected);
    if (selectedIndex !== -1 && !colors[selectedIndex]?.disabled) {
      return selectedIndex;
    }

    // 3. First non-item-disabled option.
    const firstEnabled = colors.findIndex((s) => !s.disabled);
    if (firstEnabled !== -1) return firstEnabled;

    // 4. First option in DOM order (ensures the control always has a tab stop).
    return 0;
  });

  // DOM refs for focusing after keyboard navigation.
  let liRefs: (HTMLLIElement | null)[] = $state([]);

  // Index of the first swatch (by DOM order) matching `selected` — for aria-selected.
  const selectedIndex = $derived(colors.findIndex((s) => s.color === selected));

  function isItemDisabledForRoving(index: number): boolean {
    return colors[index]?.disabled === true;
  }

  function isInteractive(index: number): boolean {
    return !disabled && !colors[index]?.disabled;
  }

  function selectSwatch(index: number): void {
    if (!isInteractive(index)) return;
    const swatch = colors[index];
    if (!swatch) return;
    internalValue = swatch.color;
    onchange?.(swatch.color);
  }

  async function handleKeydown(event: KeyboardEvent): Promise<void> {
    if (disabled) return;

    const { key } = event;

    if (key === 'Enter' || key === ' ') {
      if (effectiveFocusIndex < 0) return;
      event.preventDefault();
      selectSwatch(effectiveFocusIndex);
      return;
    }

    const newIndex = handleRovingKeydown(event, effectiveFocusIndex, colors.length, {
      vertical: true,
      horizontal: layout === 'grid',
      isDisabled: isItemDisabledForRoving,
    });

    if (newIndex !== null) {
      event.preventDefault();
      if (newIndex !== effectiveFocusIndex) {
        userFocusIndex = newIndex;
        await tick();
        liRefs[newIndex]?.focus();
      }
    }
  }

  function handleClick(index: number): void {
    if (!isInteractive(index)) return;
    userFocusIndex = index;
    selectSwatch(index);
  }

  // Warn in dev mode when duplicate colors appear in the palette.
  $effect(() => {
    if (DEV) {
      const colorValues = colors.map((c) => c.color);
      if (new Set(colorValues).size !== colorValues.length) {
        console.warn(
          '[ColorSwatchPicker] Duplicate color values detected in palette. ' +
            'Only the first matching swatch will be shown as selected.',
        );
      }
    }
  });
</script>

<ul
  role="listbox"
  aria-label={label}
  aria-disabled={disabled ? 'true' : undefined}
  aria-orientation={layout === 'stack' ? 'vertical' : undefined}
  class={cn('cinder-color-swatch-picker', className)}
  data-cinder-size={size}
  data-cinder-shape={shape}
  data-cinder-layout={layout}
  onkeydown={handleKeydown}
>
  {#each colors as swatch, index (swatch.color + index)}
    {@const isSelected = index === selectedIndex}
    {@const isDisabled = swatch.disabled === true}
    {@const contrastColor = pickContrastColor(swatch.color)}
    {@const alpha = hasAlpha(swatch.color)}
    <li
      role="option"
      aria-selected={isSelected}
      aria-label={swatch.name ? `${swatch.name}, ${swatch.color}` : swatch.color}
      aria-disabled={disabled || isDisabled ? 'true' : undefined}
      tabindex={index === effectiveFocusIndex ? 0 : -1}
      class="cinder-color-swatch-picker__swatch"
      data-cinder-selected={isSelected ? '' : undefined}
      data-cinder-disabled={isDisabled ? '' : undefined}
      data-cinder-alpha={alpha ? '' : undefined}
      style="--swatch-color: {swatch.color}"
      bind:this={liRefs[index]}
      onclick={() => handleClick(index)}
    >
      {#if isSelected}
        <span class="cinder-color-swatch-picker__indicator" style="color: {contrastColor}">
          {#if indicator}
            {@render indicator({ swatch, contrastColor })}
          {:else}
            <Check aria-hidden="true" />
          {/if}
        </span>
      {/if}
    </li>
  {/each}
</ul>
