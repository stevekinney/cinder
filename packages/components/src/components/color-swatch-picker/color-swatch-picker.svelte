<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Keyboard-navigable listbox of preset color swatches that constrains selection to a curated palette.
   * @tag form
   * @tag color
   * @useWhen Restricting color choice to a fixed brand or theme palette.
   * @useWhen Pairing with color-picker as a shortcut for common values.
   * @avoidWhen Letting users author arbitrary colors across the spectrum — use color-picker instead.
   * @related color-picker
   */
  export type { ColorSwatch, ColorSwatchPickerProps } from './color-swatch-picker.types.ts';
</script>

<script lang="ts">
  import type { ColorSwatch, ColorSwatchPickerProps } from './color-swatch-picker.types.ts';
  import { tick, untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { hasAlpha, pickContrastColor } from '../../utilities/color-luminance.ts';
  import { handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import Check from 'lucide-svelte/icons/check';

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

  // Seeded once from `defaultValue` for the uncontrolled case; later selection
  // changes flow through user interaction, not the prop.
  let internalValue = $state(untrack(() => defaultValue) ?? '');
  const selected = $derived(value ?? internalValue);

  // Deduplicate swatches by color (first occurrence wins) so the keyed {#each}
  // never receives duplicate keys and Svelte cannot throw each_key_duplicate.
  // A dev warning is emitted when duplicates are found so the data author can fix
  // their input, but the component continues to render the deduplicated list.
  const renderableColors = $derived.by(() => {
    const seen = new Set<string>();
    const result: ColorSwatch[] = [];
    let hasDuplicates = false;
    for (const swatch of colors) {
      if (seen.has(swatch.color)) {
        hasDuplicates = true;
      } else {
        seen.add(swatch.color);
        result.push(swatch);
      }
    }
    if (hasDuplicates) {
      devWarn(
        '[ColorSwatchPicker] Duplicate color values detected in palette. ' +
          'Only the first matching swatch will be shown as selected. Duplicates were removed.',
      );
    }
    return result;
  });

  // Track focus index driven by user interaction. null = derive from selection.
  let userFocusIndex = $state<number | null>(null);

  // Reset stale focus index when palette identity changes.
  $effect(() => {
    void colors;
    userFocusIndex = null;
  });

  const effectiveFocusIndex = $derived.by(() => {
    if (renderableColors.length === 0) return -1;

    // 1. User-driven focus if it points to a valid, non-item-disabled option.
    if (
      userFocusIndex !== null &&
      userFocusIndex < renderableColors.length &&
      !renderableColors[userFocusIndex]?.disabled
    ) {
      return userFocusIndex;
    }

    // 2. Currently selected swatch if it exists and is not item-disabled.
    const selectedIndex = renderableColors.findIndex((s) => s.color === selected);
    if (selectedIndex !== -1 && !renderableColors[selectedIndex]?.disabled) {
      return selectedIndex;
    }

    // 3. First non-item-disabled option.
    const firstEnabled = renderableColors.findIndex((s) => !s.disabled);
    if (firstEnabled !== -1) return firstEnabled;

    // 4. First option in DOM order (ensures the control always has a tab stop).
    return 0;
  });

  // DOM refs for focusing after keyboard navigation.
  let liRefs: (HTMLLIElement | null)[] = $state([]);

  // Index of the first swatch (by DOM order) matching `selected` — for aria-selected.
  const selectedIndex = $derived(renderableColors.findIndex((s) => s.color === selected));

  function isItemDisabledForRoving(index: number): boolean {
    return renderableColors[index]?.disabled === true;
  }

  function isInteractive(index: number): boolean {
    return !disabled && !renderableColors[index]?.disabled;
  }

  function selectSwatch(index: number): void {
    if (!isInteractive(index)) return;
    const swatch = renderableColors[index];
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

    const newIndex = handleRovingKeydown(event, effectiveFocusIndex, renderableColors.length, {
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
</script>

<ul
  role="listbox"
  aria-label={label}
  aria-disabled={disabled ? 'true' : undefined}
  aria-orientation={layout === 'stack' ? 'vertical' : undefined}
  class={classNames('cinder-color-swatch-picker', className)}
  data-cinder-size={size}
  data-cinder-shape={shape}
  data-cinder-layout={layout}
  onkeydown={handleKeydown}
>
  {#each renderableColors as swatch, index (swatch.color)}
    {@const isSelected = index === selectedIndex}
    {@const isDisabled = swatch.disabled === true}
    {@const contrastColor = pickContrastColor(swatch.color)}
    {@const alpha = hasAlpha(swatch.color)}
    <!--
      Listbox pattern: keyboard activation (Enter/Space) and roving navigation
      are handled once on the role="listbox" container above, where the focused
      role="option" delegates its keydown by bubbling. Per-option click is a
      pointer convenience, so the colocated-keydown lint rule is a false positive.
    -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
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
