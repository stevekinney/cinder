<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Interactive saturation, hue, and alpha control for picking an arbitrary color and emitting a normalized hex value.
   * @tag form
   * @tag color
   * @useWhen Letting users pick any color from the full spectrum with optional alpha.
   * @useWhen Composing a custom color with a fallback palette of preset swatches.
   * @avoidWhen Constraining selection to a fixed brand palette — use color-swatch-picker instead.
   * @related color-swatch-picker, input
   */
  export type { ColorPickerProps } from './color-picker.types.ts';
</script>

<script lang="ts">
  import type { ColorPickerProps } from './color-picker.types.ts';
  import type {
    ColorSwatch,
    ColorSwatchPickerProps,
  } from '../color-swatch-picker/color-swatch-picker.types.ts';
  import { untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import ColorSwatchPicker from '../color-swatch-picker/color-swatch-picker.svelte';
  import ColorPickerControls from './color-picker-controls.svelte';
  import {
    alphaFromKeyboard,
    clamp,
    formatHex,
    gradientFromKeyboard,
    hslToRgb,
    hueFromKeyboard,
    parseToHsla,
    type Hsla,
  } from './color-picker.utilities.ts';

  const pickerId = $props.id();

  let {
    value = $bindable(''),
    alpha = false,
    name,
    swatches,
    disabled = false,
    class: className,
    label = 'Color picker',
    onValueCommit,
    onValueChange,
  }: ColorPickerProps = $props();

  const gradientId = `${pickerId}-gradient`;
  const hueId = `${pickerId}-hue`;
  const alphaId = `${pickerId}-alpha`;
  const previewId = `${pickerId}-preview`;

  // Internal canonical state is HSLA. We only round-trip to RGB/hex at the edges.
  let hue = $state(0); // 0–360
  let saturation = $state(100); // 0–100 (HSL saturation at the gradient corner)
  let lightnessValue = $state(50); // 0–100
  let alphaValue = $state(1); // 0–1

  let internalValue = $state('');
  // Plain (non-reactive) coordination var: holds the most recent value the component
  // wrote out to `value`. The controlled-sync effect uses this to skip its own echo.
  let lastEmittedHex = '';
  let isDragging = $state(false);

  function applyHsla(next: Hsla): void {
    hue = next.h;
    saturation = next.s;
    lightnessValue = next.l;
    alphaValue = alpha ? next.a : 1;
  }

  // Snapshot the seed props once. Initialization reads only the mount-time
  // values; the controlled-sync effect (below) handles later `value` changes.
  const initialValue = untrack(() => value);
  const resetTarget = initialValue;
  const initialAlpha = untrack(() => alpha);

  // Initialize from the mount-time bindable value.
  if (initialValue !== '') {
    const parsed = parseToHsla(initialValue);
    if (parsed) {
      applyHsla(parsed);
      internalValue = formatHex(parsed.h, parsed.s, parsed.l, parsed.a, initialAlpha);
    } else {
      hue = 0;
      saturation = 0;
      lightnessValue = 0;
      alphaValue = 1;
      internalValue = '';
      lastEmittedHex = '';
    }
  }

  // Sync incoming `value` (controlled) to internal HSLA, but skip the echo of our
  // own writes. We compare against `lastEmittedHex` rather than using a one-shot
  // suppression flag so a parent that normalizes or rejects the emitted value
  // (and writes a different one back) is not ignored.
  $effect(() => {
    if (value === undefined) return;
    if (value !== '' && value === lastEmittedHex) return;
    const parsed = value === '' ? null : parseToHsla(value);
    if (parsed === null) {
      hue = 0;
      saturation = 0;
      lightnessValue = 0;
      alphaValue = 1;
      internalValue = '';
      lastEmittedHex = '';
      return;
    }
    applyHsla(parsed);
    internalValue = formatHex(parsed.h, parsed.s, parsed.l, parsed.a, alpha);
  });

  // Re-normalize internal value when the `alpha` mode toggles after mount so
  // hidden input / bound value reflect the new emit format immediately.
  $effect(() => {
    void alpha;
    if (internalValue === '') return;
    const hex = formatHex(hue, saturation, lightnessValue, alphaValue, alpha);
    if (hex === internalValue) return;
    internalValue = hex;
    lastEmittedHex = hex;
    if (value !== undefined && value !== hex) value = hex;
  });

  function emit(reason: 'input' | 'change'): void {
    const hex = formatHex(hue, saturation, lightnessValue, alphaValue, alpha);
    internalValue = hex;
    lastEmittedHex = hex;
    if (value !== undefined) value = hex;
    // Every value mutation fires `onValueChange`; `onValueCommit` additionally fires on commit.
    onValueChange?.(hex);
    if (reason === 'change') onValueCommit?.(hex, 'keyboard');
  }

  function commitFromHsla(next: Hsla, reason: 'input' | 'change'): void {
    applyHsla(next);
    emit(reason);
  }

  function commitCurrentValueChange(reason: 'pointer' | 'swatch' = 'pointer'): void {
    const hex = formatHex(hue, saturation, lightnessValue, alphaValue, alpha);
    internalValue = hex;
    lastEmittedHex = hex;
    if (value !== undefined) value = hex;
    onValueCommit?.(hex, reason);
  }

  // ── Gradient handling ──────────────────────────────────────────────────

  let gradientElement: HTMLDivElement | null = $state(null);

  /**
   * Map a pointer event to (saturation, lightness) using the HSV-style square
   * common to color pickers: x = saturation 0→100, y = value 100→0. We convert
   * HSV to HSL on the way out so internal state stays HSL.
   */
  function pointerToHsl(event: PointerEvent): { s: number; l: number } {
    const target = gradientElement;
    if (!target) return { s: saturation, l: lightnessValue };
    const rect = target.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    const sv = rect.width === 0 ? 0 : x / rect.width; // 0–1 HSV saturation
    const vv = rect.height === 0 ? 1 : 1 - y / rect.height; // 0–1 HSV value
    // HSV → HSL
    const l = vv * (1 - sv / 2);
    const s = l === 0 || l === 1 ? 0 : (vv - l) / Math.min(l, 1 - l);
    return { s: s * 100, l: l * 100 };
  }

  function handleGradientPointerDown(event: PointerEvent): void {
    if (disabled) return;
    event.preventDefault();
    gradientElement?.setPointerCapture(event.pointerId);
    isDragging = true;
    const { s, l } = pointerToHsl(event);
    commitFromHsla({ h: hue, s, l, a: alphaValue }, 'input');
  }

  function handleGradientPointerMove(event: PointerEvent): void {
    if (!isDragging || disabled) return;
    const { s, l } = pointerToHsl(event);
    commitFromHsla({ h: hue, s, l, a: alphaValue }, 'input');
  }

  function handleGradientPointerUp(event: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    gradientElement?.releasePointerCapture(event.pointerId);
    commitCurrentValueChange();
  }

  function handleGradientPointerCancel(event: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    gradientElement?.releasePointerCapture(event.pointerId);
  }

  // ── Slider pointer handling ─────────────────────────────────────────────

  // bind:this refs use $state so teardown sees the latest element references;
  // the drag discriminator is read only inside event handlers.
  let hueElement = $state<HTMLDivElement | null>(null);
  let alphaElement = $state<HTMLDivElement | null>(null);
  let draggingSlider: 'hue' | 'alpha' | null = null;

  function pointerToFraction(event: PointerEvent, element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    return rect.width === 0 ? 0 : x / rect.width;
  }

  function handleHuePointerDown(event: PointerEvent): void {
    if (disabled || !hueElement) return;
    event.preventDefault();
    hueElement.setPointerCapture(event.pointerId);
    draggingSlider = 'hue';
    const fraction = pointerToFraction(event, hueElement);
    commitFromHsla({ h: fraction * 359, s: saturation, l: lightnessValue, a: alphaValue }, 'input');
  }

  function handleHuePointerMove(event: PointerEvent): void {
    if (draggingSlider !== 'hue' || disabled || !hueElement) return;
    const fraction = pointerToFraction(event, hueElement);
    commitFromHsla({ h: fraction * 359, s: saturation, l: lightnessValue, a: alphaValue }, 'input');
  }

  function handleHuePointerUp(event: PointerEvent): void {
    if (draggingSlider !== 'hue') return;
    draggingSlider = null;
    hueElement?.releasePointerCapture(event.pointerId);
    commitCurrentValueChange();
  }

  function handleHuePointerCancel(event: PointerEvent): void {
    if (draggingSlider !== 'hue') return;
    draggingSlider = null;
    hueElement?.releasePointerCapture(event.pointerId);
  }

  function handleAlphaPointerDown(event: PointerEvent): void {
    if (disabled || !alphaElement) return;
    event.preventDefault();
    alphaElement.setPointerCapture(event.pointerId);
    draggingSlider = 'alpha';
    const fraction = pointerToFraction(event, alphaElement);
    commitFromHsla({ h: hue, s: saturation, l: lightnessValue, a: fraction }, 'input');
  }

  function handleAlphaPointerMove(event: PointerEvent): void {
    if (draggingSlider !== 'alpha' || disabled || !alphaElement) return;
    const fraction = pointerToFraction(event, alphaElement);
    commitFromHsla({ h: hue, s: saturation, l: lightnessValue, a: fraction }, 'input');
  }

  function handleAlphaPointerUp(event: PointerEvent): void {
    if (draggingSlider !== 'alpha') return;
    draggingSlider = null;
    alphaElement?.releasePointerCapture(event.pointerId);
    commitCurrentValueChange();
  }

  function handleAlphaPointerCancel(event: PointerEvent): void {
    if (draggingSlider !== 'alpha') return;
    draggingSlider = null;
    alphaElement?.releasePointerCapture(event.pointerId);
  }

  // ── Slider keyboard handling ────────────────────────────────────────────

  function currentHsla(): Hsla {
    return { h: hue, s: saturation, l: lightnessValue, a: alphaValue };
  }

  function handleHueKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const next = hueFromKeyboard(currentHsla(), event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    commitFromHsla(next, 'change');
  }

  function handleAlphaKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const next = alphaFromKeyboard(currentHsla(), event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    commitFromHsla(next, 'change');
  }

  // Gradient region keyboard arrow keys also nudge saturation/lightness so the
  // region is at least partially keyboard-operable, even though the underlying
  // 2D selection is inherently pointer-friendly. Documented in a11y memo.
  function handleGradientKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const next = gradientFromKeyboard(currentHsla(), event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    commitFromHsla(next, 'change');
  }

  // ── Swatch composition ──────────────────────────────────────────────────

  /**
   * Canonicalize a swatch string to the same hex format the picker emits, so
   * value-matching in ColorSwatchPicker works regardless of input syntax
   * (#0f0 vs #00ff00 vs rgb()). Returns null when the swatch is unparseable.
   */
  function normalizeSwatch(swatch: string): string | null {
    const parsed = parseToHsla(swatch);
    if (!parsed) return null;
    return formatHex(parsed.h, parsed.s, parsed.l, parsed.a, alpha).toLowerCase();
  }

  /**
   * Pre-normalized swatches mapped to the ColorSwatch shape that ColorSwatchPicker
   * expects. Entries that fail `normalizeSwatch` keep their original string as the
   * color: a CSS-valid-but-non-normalizable value still paints its swatch background,
   * while a truly invalid value (e.g. `not-a-color`) paints nothing — either way it
   * never matches the selected value, so it can never show as selected or be committed.
   */
  const normalizedSwatchColors = $derived<ColorSwatch[]>(
    (swatches ?? []).map((swatch) => {
      const normalized = normalizeSwatch(swatch);
      return {
        color: normalized ?? swatch,
        disabled: normalized === null,
      };
    }),
  );

  const currentHex = $derived(formatHex(hue, saturation, lightnessValue, alphaValue, alpha));

  const formatRgb = $derived.by(() => {
    const { r, g, b } = hslToRgb(hue, saturation, lightnessValue);
    const channels = `${r}, ${g}, ${b}`;
    return alpha ? `rgba(${channels}, ${roundFormatAlpha(alphaValue)})` : `rgb(${channels})`;
  });
  function roundFormatChannel(value: number): number {
    return Math.round(value * 100) / 100;
  }
  function roundFormatAlpha(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
  const formatHsl = $derived(
    alpha
      ? `hsla(${roundFormatChannel(hue)}, ${roundFormatChannel(saturation)}%, ${roundFormatChannel(lightnessValue)}%, ${roundFormatAlpha(alphaValue)})`
      : `hsl(${roundFormatChannel(hue)}, ${roundFormatChannel(saturation)}%, ${roundFormatChannel(lightnessValue)}%)`,
  );
  function handleSwatchChange(
    selectedColor: Parameters<NonNullable<ColorSwatchPickerProps['onValueChange']>>[0],
  ): void {
    if (disabled) return;
    const parsed = parseToHsla(selectedColor);
    if (!parsed) return;
    commitFromHsla(parsed, 'input');
    const hex = formatHex(parsed.h, parsed.s, parsed.l, parsed.a, alpha);
    onValueCommit?.(hex, 'swatch');
  }

  // ── Form reset ──────────────────────────────────────────────────────────

  let hiddenInput: HTMLInputElement | null = $state(null);

  $effect(() => {
    const input = hiddenInput;
    if (input === null) return;
    // Use input.form (not closest('form')): HTMLInputElement.form honors the `form`
    // attribute association, so a hidden input linked to a non-ancestor form via
    // <input form="id"> still wires up its reset listener.
    const form = input.form;
    if (form === null) return;

    function resetToDefault(): void {
      const parsed = resetTarget === '' ? null : parseToHsla(resetTarget);
      if (parsed === null) {
        hue = 0;
        saturation = 0;
        lightnessValue = 0;
        alphaValue = 1;
        internalValue = '';
        lastEmittedHex = '';
        if (value !== undefined) value = '';
        return;
      }
      applyHsla(parsed);
      const hex = formatHex(parsed.h, parsed.s, parsed.l, parsed.a, alpha);
      internalValue = hex;
      lastEmittedHex = hex;
      if (value !== undefined) value = hex;
    }

    form.addEventListener('reset', resetToDefault);
    return () => {
      form.removeEventListener('reset', resetToDefault);
    };
  });

  // ── Visual derived data ─────────────────────────────────────────────────

  const hueColor = $derived(`hsl(${hue}, 100%, 50%)`);
  const previewColor = $derived(
    internalValue === ''
      ? 'transparent'
      : alpha
        ? `hsla(${hue}, ${saturation}%, ${lightnessValue}%, ${alphaValue})`
        : `hsl(${hue}, ${saturation}%, ${lightnessValue}%)`,
  );

  // HSV position of the gradient handle (x = HSV saturation, y = HSV value).
  const handlePosition = $derived.by(() => {
    const ln = lightnessValue / 100;
    const sn = saturation / 100;
    const v = ln + sn * Math.min(ln, 1 - ln);
    const svFromHsl = v === 0 ? 0 : 2 * (1 - ln / v);
    return { x: svFromHsl * 100, y: (1 - v) * 100 };
  });

  const hueAriaValue = $derived(Math.round(hue));
  const alphaAriaValue = $derived(Math.round(alphaValue * 100));
</script>

<div
  class={classNames('cinder-color-picker', className)}
  data-cinder-disabled={disabled ? '' : undefined}
  data-cinder-alpha={alpha ? '' : undefined}
  aria-label={label}
  role="group"
  id={pickerId}
>
  <ColorPickerControls
    {gradientId}
    {hueId}
    {alphaId}
    {previewId}
    {disabled}
    {alpha}
    {hue}
    {saturation}
    {lightnessValue}
    {alphaValue}
    {hueColor}
    {previewColor}
    {internalValue}
    {formatRgb}
    {formatHsl}
    {handlePosition}
    {hueAriaValue}
    {alphaAriaValue}
    bind:gradientElement
    bind:hueElement
    bind:alphaElement
    onGradientPointerDown={handleGradientPointerDown}
    onGradientPointerMove={handleGradientPointerMove}
    onGradientPointerUp={handleGradientPointerUp}
    onGradientPointerCancel={handleGradientPointerCancel}
    onGradientKeydown={handleGradientKeydown}
    onHueKeydown={handleHueKeydown}
    onHuePointerDown={handleHuePointerDown}
    onHuePointerMove={handleHuePointerMove}
    onHuePointerUp={handleHuePointerUp}
    onHuePointerCancel={handleHuePointerCancel}
    onAlphaKeydown={handleAlphaKeydown}
    onAlphaPointerDown={handleAlphaPointerDown}
    onAlphaPointerMove={handleAlphaPointerMove}
    onAlphaPointerUp={handleAlphaPointerUp}
    onAlphaPointerCancel={handleAlphaPointerCancel}
  />

  {#if normalizedSwatchColors.length > 0}
    <ColorSwatchPicker
      colors={normalizedSwatchColors}
      value={internalValue !== '' ? currentHex.toLowerCase() : ''}
      label="Color swatches"
      size="sm"
      {disabled}
      class="cinder-color-picker__swatches"
      onValueChange={handleSwatchChange}
    />
  {/if}

  {#if name}
    <input bind:this={hiddenInput} type="hidden" {name} value={internalValue} />
  {:else}
    <input bind:this={hiddenInput} type="hidden" value={internalValue} hidden />
  {/if}
</div>
