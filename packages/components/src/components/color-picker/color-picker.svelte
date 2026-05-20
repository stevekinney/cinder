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
  import { tick } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { parseColor } from '../../utilities/color-luminance.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    value = $bindable(),
    defaultValue,
    alpha = false,
    name,
    swatches,
    disabled = false,
    class: className,
    label = 'Color picker',
    onchange,
    oninput,
  }: ColorPickerProps = $props();

  const pickerId = useId('cinder-color-picker');
  const gradientId = `${pickerId}-gradient`;
  const hueId = `${pickerId}-hue`;
  const alphaId = `${pickerId}-alpha`;
  const swatchesId = `${pickerId}-swatches`;
  const previewId = `${pickerId}-preview`;

  type Hsla = { h: number; s: number; l: number; a: number };

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

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  function toHex2(n: number): string {
    return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  }

  function normalizeHue(h: number): number {
    return Math.min(((h % 360) + 360) % 360, 359);
  }

  function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
    return { h, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const sn = clamp(s, 0, 100) / 100;
    const ln = clamp(l, 0, 100) / 100;
    const hn = (((h % 360) + 360) % 360) / 360;
    if (sn === 0) {
      const v = Math.round(ln * 255);
      return { r: v, g: v, b: v };
    }
    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
    const p = 2 * ln - q;
    const hueToRgb = (t: number): number => {
      let tn = t;
      if (tn < 0) tn += 1;
      if (tn > 1) tn -= 1;
      if (tn < 1 / 6) return p + (q - p) * 6 * tn;
      if (tn < 1 / 2) return q;
      if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
      return p;
    };
    return {
      r: Math.round(hueToRgb(hn + 1 / 3) * 255),
      g: Math.round(hueToRgb(hn) * 255),
      b: Math.round(hueToRgb(hn - 1 / 3) * 255),
    };
  }

  function formatHex(h: number, s: number, l: number, a: number, withAlpha: boolean): string {
    const { r, g, b } = hslToRgb(h, s, l);
    const base = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
    if (!withAlpha) return base;
    return base + toHex2(a * 255);
  }

  function parseToHsla(input: string): Hsla | null {
    const parsed = parseColor(input);
    if (!parsed) return null;
    const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
    return { h: normalizeHue(h), s, l, a: parsed.a };
  }

  /**
   * Canonicalize a swatch string to the same hex format the picker emits, so
   * aria-selected matches regardless of input syntax (#0f0 vs #00ff00 vs rgb()).
   * Returns null when the swatch is unparseable.
   */
  function normalizeSwatch(swatch: string): string | null {
    const parsed = parseToHsla(swatch);
    if (!parsed) return null;
    return formatHex(parsed.h, parsed.s, parsed.l, parsed.a, alpha).toLowerCase();
  }

  function applyHsla(next: Hsla): void {
    hue = next.h;
    saturation = next.s;
    lightnessValue = next.l;
    alphaValue = alpha ? next.a : 1;
  }

  // Initialize from defaultValue (only when uncontrolled).
  if (value === undefined && defaultValue) {
    const parsed = parseToHsla(defaultValue);
    if (parsed) {
      applyHsla(parsed);
      internalValue = formatHex(parsed.h, parsed.s, parsed.l, parsed.a, alpha);
    } else {
      hue = 0;
      saturation = 0;
      lightnessValue = 0;
      alphaValue = 1;
      internalValue = '';
      lastEmittedHex = '';
    }
  } else if (value !== undefined) {
    const parsed = parseToHsla(value);
    if (parsed) {
      applyHsla(parsed);
      internalValue = formatHex(parsed.h, parsed.s, parsed.l, parsed.a, alpha);
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
    // Every value mutation fires `oninput`; `onchange` additionally fires on commit.
    oninput?.(hex);
    if (reason === 'change') onchange?.(hex);
  }

  function commitFromHsla(next: Hsla, reason: 'input' | 'change'): void {
    applyHsla(next);
    emit(reason);
  }

  function commitCurrentValueChange(): void {
    const hex = formatHex(hue, saturation, lightnessValue, alphaValue, alpha);
    internalValue = hex;
    lastEmittedHex = hex;
    if (value !== undefined) value = hex;
    onchange?.(hex);
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

  // bind:this refs and the drag-discriminator are coordination state read only
  // inside event handlers, never inside the template or effects — plain `let`
  // is sufficient and avoids unnecessary reactive tracking.
  let hueElement: HTMLDivElement | null = null;
  let alphaElement: HTMLDivElement | null = null;
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

  function adjustHue(delta: number): void {
    const next = (((hue + delta) % 360) + 360) % 360;
    commitFromHsla({ h: next, s: saturation, l: lightnessValue, a: alphaValue }, 'change');
  }

  function adjustAlpha(delta: number): void {
    const next = clamp(alphaValue + delta, 0, 1);
    commitFromHsla({ h: hue, s: saturation, l: lightnessValue, a: next }, 'change');
  }

  function handleHueKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 1;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        adjustHue(-step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        adjustHue(step);
        break;
      case 'Home':
        event.preventDefault();
        commitFromHsla({ h: 0, s: saturation, l: lightnessValue, a: alphaValue }, 'change');
        break;
      case 'End':
        event.preventDefault();
        commitFromHsla({ h: 359, s: saturation, l: lightnessValue, a: alphaValue }, 'change');
        break;
      case 'PageUp':
        event.preventDefault();
        adjustHue(36);
        break;
      case 'PageDown':
        event.preventDefault();
        adjustHue(-36);
        break;
    }
  }

  function handleAlphaKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const step = event.shiftKey ? 0.1 : 0.01;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        adjustAlpha(-step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        adjustAlpha(step);
        break;
      case 'Home':
        event.preventDefault();
        commitFromHsla({ h: hue, s: saturation, l: lightnessValue, a: 0 }, 'change');
        break;
      case 'End':
        event.preventDefault();
        commitFromHsla({ h: hue, s: saturation, l: lightnessValue, a: 1 }, 'change');
        break;
      case 'PageUp':
        event.preventDefault();
        adjustAlpha(0.1);
        break;
      case 'PageDown':
        event.preventDefault();
        adjustAlpha(-0.1);
        break;
    }
  }

  // Gradient region keyboard arrow keys also nudge saturation/lightness so the
  // region is at least partially keyboard-operable, even though the underlying
  // 2D selection is inherently pointer-friendly. Documented in a11y memo.
  function handleGradientKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 1;
    let nextS = saturation;
    let nextL = lightnessValue;
    let handled = false;
    switch (event.key) {
      case 'ArrowLeft':
        nextS = clamp(saturation - step, 0, 100);
        handled = true;
        break;
      case 'ArrowRight':
        nextS = clamp(saturation + step, 0, 100);
        handled = true;
        break;
      case 'ArrowUp':
        nextL = clamp(lightnessValue + step, 0, 100);
        handled = true;
        break;
      case 'ArrowDown':
        nextL = clamp(lightnessValue - step, 0, 100);
        handled = true;
        break;
    }
    if (handled) {
      event.preventDefault();
      commitFromHsla({ h: hue, s: nextS, l: nextL, a: alphaValue }, 'change');
    }
  }

  // ── Swatch list ─────────────────────────────────────────────────────────

  const swatchList = $derived(swatches ?? []);
  let swatchFocusIndex: number | null = $state(null);
  let swatchRefs: (HTMLLIElement | null)[] = $state([]);

  const currentHex = $derived(formatHex(hue, saturation, lightnessValue, alphaValue, alpha));

  function selectSwatch(index: number, reason: 'input' | 'change'): void {
    if (disabled) return;
    const next = swatchList[index];
    if (!next) return;
    const parsed = parseToHsla(next);
    if (!parsed) return;
    commitFromHsla(parsed, reason);
  }

  async function focusSwatch(index: number): Promise<void> {
    swatchFocusIndex = index;
    await tick();
    swatchRefs[index]?.focus();
  }

  function handleSwatchKeydown(event: KeyboardEvent, index: number): void {
    if (disabled) return;
    const lastIndex = swatchList.length - 1;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        void focusSwatch(index === lastIndex ? 0 : index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        void focusSwatch(index === 0 ? lastIndex : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        void focusSwatch(0);
        break;
      case 'End':
        event.preventDefault();
        void focusSwatch(lastIndex);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectSwatch(index, 'change');
        break;
    }
  }

  // ── Form reset ──────────────────────────────────────────────────────────

  let hiddenInput: HTMLInputElement | null = $state(null);

  $effect(() => {
    const input: HTMLInputElement | null = hiddenInput;
    if (input === null) return;
    const resolvedInput: HTMLInputElement = input;
    let currentForm: HTMLFormElement | null = null;

    function resetToDefault(): void {
      const fallback = defaultValue ?? '';
      const parsed = fallback === '' ? null : parseToHsla(fallback);
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

    function attach(): void {
      const next = resolvedInput.form;
      if (next === currentForm) return;
      currentForm?.removeEventListener('reset', resetToDefault);
      currentForm = next;
      currentForm?.addEventListener('reset', resetToDefault);
    }

    attach();
    void tick().then(attach);

    return () => {
      currentForm?.removeEventListener('reset', resetToDefault);
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
  <div
    bind:this={gradientElement}
    id={gradientId}
    role="application"
    aria-label="Color saturation and lightness. Use a pointer to select; arrow keys provide coarse keyboard adjustment."
    aria-disabled={disabled ? 'true' : undefined}
    class="cinder-color-picker__gradient"
    style="--cinder-color-picker-hue: {hueColor};"
    tabindex={disabled ? -1 : 0}
    onpointerdown={handleGradientPointerDown}
    onpointermove={handleGradientPointerMove}
    onpointerup={handleGradientPointerUp}
    onpointercancel={handleGradientPointerCancel}
    onkeydown={handleGradientKeydown}
  >
    <div
      class="cinder-color-picker__gradient-handle"
      style="left: {handlePosition.x}%; top: {handlePosition.y}%;"
      aria-hidden="true"
    ></div>
  </div>

  <div
    bind:this={hueElement}
    id={hueId}
    role="slider"
    aria-label="Hue"
    aria-valuemin={0}
    aria-valuemax={359}
    aria-valuenow={hueAriaValue}
    aria-disabled={disabled ? 'true' : undefined}
    tabindex={disabled ? -1 : 0}
    class="cinder-color-picker__hue"
    onkeydown={handleHueKeydown}
    onpointerdown={handleHuePointerDown}
    onpointermove={handleHuePointerMove}
    onpointerup={handleHuePointerUp}
    onpointercancel={handleHuePointerCancel}
  >
    <div
      class="cinder-color-picker__hue-thumb"
      style="left: {(hue / 359) * 100}%;"
      aria-hidden="true"
    ></div>
  </div>

  {#if alpha}
    <div
      bind:this={alphaElement}
      id={alphaId}
      role="slider"
      aria-label="Alpha"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={alphaAriaValue}
      aria-valuetext="{alphaAriaValue}%"
      aria-disabled={disabled ? 'true' : undefined}
      tabindex={disabled ? -1 : 0}
      class="cinder-color-picker__alpha"
      style="--cinder-color-picker-base: hsl({hue}, {saturation}%, {lightnessValue}%);"
      onkeydown={handleAlphaKeydown}
      onpointerdown={handleAlphaPointerDown}
      onpointermove={handleAlphaPointerMove}
      onpointerup={handleAlphaPointerUp}
      onpointercancel={handleAlphaPointerCancel}
    >
      <div
        class="cinder-color-picker__alpha-thumb"
        style="left: {alphaValue * 100}%;"
        aria-hidden="true"
      ></div>
    </div>
  {/if}

  <div
    id={previewId}
    role="img"
    class="cinder-color-picker__preview"
    data-cinder-alpha={alpha ? '' : undefined}
    aria-label={internalValue ? `Selected color: ${internalValue}` : 'Selected color: none'}
    style="--cinder-color-picker-preview: {previewColor};"
  ></div>

  {#if swatchList.length > 0}
    <ul
      id={swatchesId}
      role="listbox"
      aria-label="Color swatches"
      aria-disabled={disabled ? 'true' : undefined}
      class="cinder-color-picker__swatches"
    >
      {#each swatchList as swatch, index (swatch + index)}
        {@const normalized = normalizeSwatch(swatch)}
        {@const isSelected =
          internalValue !== '' && normalized !== null && normalized === currentHex.toLowerCase()}
        <li
          bind:this={swatchRefs[index]}
          role="option"
          aria-selected={isSelected}
          aria-label={`Color ${swatch}`}
          tabindex={(swatchFocusIndex ?? 0) === index && !disabled ? 0 : -1}
          class="cinder-color-picker__swatch"
          data-cinder-selected={isSelected ? '' : undefined}
          style="--cinder-color-picker-swatch: {swatch};"
          onclick={() => selectSwatch(index, 'change')}
          onkeydown={(event) => handleSwatchKeydown(event, index)}
        ></li>
      {/each}
    </ul>
  {/if}

  {#if name}
    <input bind:this={hiddenInput} type="hidden" {name} value={internalValue} />
  {:else}
    <input bind:this={hiddenInput} type="hidden" value={internalValue} hidden />
  {/if}
</div>
