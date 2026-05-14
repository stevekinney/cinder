<script lang="ts" module>
  /** Single-value or `[min, max]` tuple. */
  export type SliderValue = number | [number, number];

  /** Mode of the slider — `single` thumb or two-thumb `range`. */
  export type SliderMode = 'single' | 'range';

  /**
   * Props for the Slider component.
   *
   * Implements the WAI-ARIA `role="slider"` pattern. Each thumb is its own
   * focusable `<div role="slider">` carrying `aria-valuemin`, `aria-valuemax`,
   * `aria-valuenow`, optional `aria-valuetext`, and an accessible name from
   * either `aria-label` or `aria-labelledby`.
   *
   * The slider is controlled when `value` is supplied and uncontrolled when
   * only `defaultValue` is supplied. `onchange` fires after every committed
   * change (keyboard step, track click, end of pointer drag).
   *
   * Distinct from `progress.svelte` (passive read-only progress) and from
   * the internal sliders inside `color-picker.svelte` (specialized for
   * color manipulation).
   */
  export type SliderProps = {
    /** Controlled value. Pass a number for `single`, a tuple for `range`. */
    value?: SliderValue;
    /** Initial value for uncontrolled usage. */
    defaultValue?: SliderValue;
    /** `single` (default) or `range`. */
    mode?: SliderMode;
    /** Minimum value. Default `0`. */
    min?: number;
    /** Maximum value. Default `100`. */
    max?: number;
    /** Step increment for arrow keys. Default `1`. */
    step?: number;
    /** Step increment for Page Up/Down. Default `step * 10`. */
    pageStep?: number;
    /** Visible label / accessible name for the slider. Required. */
    label: string;
    /** Formats the numeric value for `aria-valuetext`. */
    valueText?: (value: number) => string;
    /** Optional tick marks. `true` renders one per `step`; an array snaps to those values. */
    ticks?: boolean | number[];
    /** Disables interaction. */
    disabled?: boolean;
    /** Form field name. Renders hidden inputs for form submission. */
    name?: string;
    /** Extra class names merged with `.cinder-slider`. */
    class?: string;
    /** Called after every committed value change. */
    onchange?: (value: SliderValue) => void;
  };
</script>

<script lang="ts">
  import { getFormFieldContext } from '../_internal/form-field-context.ts';
  import { classNames } from '../utilities/class-names.ts';

  let {
    value,
    defaultValue,
    mode = 'single',
    min = 0,
    max = 100,
    step = 1,
    pageStep,
    label,
    valueText,
    ticks,
    disabled: disabledProp = false,
    name,
    class: className,
    onchange,
  }: SliderProps = $props();

  const formField = getFormFieldContext();
  const disabled = $derived(disabledProp || (formField?.disabled ?? false));

  const effectivePageStep = $derived(pageStep ?? step * 10);

  // Internal state mirrors `value` when controlled, otherwise tracks the
  // uncontrolled value initialized from `defaultValue`.
  const initialInternal: SliderValue =
    value ?? defaultValue ?? (mode === 'range' ? [min, max] : min);
  let internal = $state<SliderValue>(initialInternal);

  // Treat `value` as the source of truth when provided so external updates
  // flow through. Reads of `value` inside this effect register dependency.
  $effect(() => {
    if (value !== undefined) {
      internal = Array.isArray(value) ? [value[0], value[1]] : value;
    }
  });

  const isRange = $derived(mode === 'range');

  const lowValue = $derived(Array.isArray(internal) ? internal[0] : (internal as number));
  const highValue = $derived(Array.isArray(internal) ? internal[1] : (internal as number));

  /** Snap a raw value to the nearest tick / step and clamp into `[min, max]`. */
  function snap(raw: number): number {
    const clamped = Math.max(min, Math.min(max, raw));
    if (Array.isArray(ticks) && ticks.length > 0) {
      let nearest = ticks[0]!;
      let nearestDelta = Math.abs(clamped - nearest);
      for (const tick of ticks) {
        const delta = Math.abs(clamped - tick);
        if (delta < nearestDelta) {
          nearest = tick;
          nearestDelta = delta;
        }
      }
      return nearest;
    }
    const stepped = Math.round((clamped - min) / step) * step + min;
    // Floating point hygiene — round to the precision implied by `step`.
    const decimals = decimalsFromStep(step);
    const rounded = Number(stepped.toFixed(decimals));
    return Math.max(min, Math.min(max, rounded));
  }

  function decimalsFromStep(s: number): number {
    if (!Number.isFinite(s) || s <= 0) return 0;
    const text = String(s);
    const dot = text.indexOf('.');
    return dot >= 0 ? text.length - dot - 1 : 0;
  }

  function percentOf(numeric: number): number {
    if (max === min) return 0;
    return ((numeric - min) / (max - min)) * 100;
  }

  /** Apply a new value, respecting range constraint and controlled prop. */
  function commit(next: SliderValue) {
    let normalized: SliderValue = next;
    if (isRange && Array.isArray(next)) {
      const [a, b] = next;
      normalized = a <= b ? [a, b] : [b, a];
    }
    if (value === undefined) {
      internal = Array.isArray(normalized) ? [normalized[0], normalized[1]] : normalized;
    }
    onchange?.(normalized);
  }

  function updateSingle(nextValue: number) {
    commit(snap(nextValue));
  }

  function updateRange(thumb: 'low' | 'high', nextValue: number) {
    const snapped = snap(nextValue);
    if (thumb === 'low') {
      commit([Math.min(snapped, highValue), highValue]);
    } else {
      commit([lowValue, Math.max(snapped, lowValue)]);
    }
  }

  function thumbAccessibleName(thumb: 'single' | 'low' | 'high'): string {
    if (thumb === 'single') return label;
    if (thumb === 'low') return `${label} — minimum value`;
    return `${label} — maximum value`;
  }

  function neighborTick(current: number, direction: 1 | -1): number {
    if (!Array.isArray(ticks) || ticks.length === 0) return current;
    const sorted = [...ticks].filter((t) => t >= min && t <= max).sort((a, b) => a - b);
    if (direction === 1) {
      for (const tick of sorted) if (tick > current) return tick;
      return sorted.at(-1) ?? current;
    }
    for (let index = sorted.length - 1; index >= 0; index--) {
      const tick = sorted[index]!;
      if (tick < current) return tick;
    }
    return sorted[0] ?? current;
  }

  function handleKey(event: KeyboardEvent, thumb: 'single' | 'low' | 'high') {
    if (disabled) return;
    const current = thumb === 'high' ? highValue : lowValue;
    const tickArray = Array.isArray(ticks);
    let next = current;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = tickArray ? neighborTick(current, 1) : current + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = tickArray ? neighborTick(current, -1) : current - step;
        break;
      case 'PageUp':
        next = current + effectivePageStep;
        break;
      case 'PageDown':
        next = current - effectivePageStep;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (thumb === 'single') {
      updateSingle(next);
    } else {
      updateRange(thumb, next);
    }
  }

  // Pointer drag handling. We attach move/up listeners on `document` so that
  // dragging continues to track the pointer even when it leaves the thumb.
  let trackElement: HTMLDivElement | undefined = $state();
  let activeThumb: 'single' | 'low' | 'high' | null = $state(null);
  let activeThumbRecent: 'low' | 'high' | null = $state(null);

  function valueFromClientX(clientX: number): number {
    if (!trackElement) return min;
    const rect = trackElement.getBoundingClientRect();
    if (rect.width === 0) return min;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return min + ratio * (max - min);
  }

  function chooseNearestThumb(raw: number): 'low' | 'high' {
    const distanceLow = Math.abs(raw - lowValue);
    const distanceHigh = Math.abs(raw - highValue);
    if (distanceLow === distanceHigh) {
      // Tie-break: prefer moving the thumb closer to the click target's side.
      return raw < (lowValue + highValue) / 2 ? 'low' : 'high';
    }
    return distanceLow < distanceHigh ? 'low' : 'high';
  }

  function onPointerMove(event: PointerEvent) {
    if (!activeThumb) return;
    const raw = valueFromClientX(event.clientX);
    if (activeThumb === 'single') {
      updateSingle(raw);
    } else {
      updateRange(activeThumb, raw);
    }
  }

  function onPointerUp() {
    activeThumb = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
  }

  function beginDrag(thumb: 'single' | 'low' | 'high') {
    activeThumb = thumb;
    if (thumb === 'low' || thumb === 'high') activeThumbRecent = thumb;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }

  function handleThumbPointerDown(event: PointerEvent, thumb: 'single' | 'low' | 'high') {
    if (disabled) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).focus();
    beginDrag(thumb);
  }

  function handleTrackPointerDown(event: PointerEvent) {
    if (disabled) return;
    // Ignore clicks that originated on a thumb — those are handled above.
    const target = event.target as HTMLElement | null;
    if (target?.dataset['cinderSliderThumb'] !== undefined) return;
    event.preventDefault();
    const raw = valueFromClientX(event.clientX);
    if (isRange) {
      const which = chooseNearestThumb(raw);
      updateRange(which, raw);
      beginDrag(which);
    } else {
      updateSingle(raw);
      beginDrag('single');
    }
  }

  // Resolve aria-labelledby from a FormField wrapper when present, so labels
  // remain visible and the slider does not double up `aria-label`.
  const labelledBy = $derived(formField?.labelId);
  const describedBy = $derived(formField?.describedBy);
  const ariaInvalid = $derived(formField?.invalid);

  function ariaAttrs(thumbKind: 'single' | 'low' | 'high', currentValue: number) {
    const name = thumbAccessibleName(thumbKind);
    return {
      ariaLabel: labelledBy ? undefined : name,
      ariaLabelledBy: labelledBy,
      ariaDescribedBy: describedBy,
      ariaInvalid,
      ariaValueText: valueText ? valueText(currentValue) : undefined,
    };
  }

  // Render tick mark positions. `true` produces one tick per step.
  const tickMarks = $derived.by<number[]>(() => {
    if (!ticks) return [];
    if (Array.isArray(ticks)) return ticks.filter((t) => t >= min && t <= max);
    const out: number[] = [];
    for (let v = min; v <= max + step / 2; v += step) {
      const snapped = Number(v.toFixed(decimalsFromStep(step)));
      if (snapped <= max) out.push(snapped);
    }
    return out;
  });

  const singleAttrs = $derived(ariaAttrs('single', lowValue));
  const lowAttrs = $derived(ariaAttrs('low', lowValue));
  const highAttrs = $derived(ariaAttrs('high', highValue));
</script>

<div
  class={classNames('cinder-slider', isRange && 'cinder-slider--range', className)}
  data-cinder-disabled={disabled || undefined}
>
  <div
    bind:this={trackElement}
    class="cinder-slider__track"
    onpointerdown={handleTrackPointerDown}
    role="presentation"
  >
    <div
      class="cinder-slider__range"
      style:--_cinder-slider-low="{percentOf(lowValue)}%"
      style:--_cinder-slider-high="{percentOf(isRange ? highValue : lowValue)}%"
      aria-hidden="true"
    ></div>

    {#if tickMarks.length > 0}
      <div class="cinder-slider__ticks" aria-hidden="true">
        {#each tickMarks as tick (tick)}
          <span class="cinder-slider__tick" style:--_cinder-slider-tick="{percentOf(tick)}%"></span>
        {/each}
      </div>
    {/if}

    {#if isRange}
      <div
        class="cinder-slider__thumb"
        data-cinder-slider-thumb="low"
        data-cinder-active={activeThumbRecent === 'low' || undefined}
        role="slider"
        tabindex={disabled ? -1 : 0}
        aria-label={lowAttrs.ariaLabel}
        aria-labelledby={lowAttrs.ariaLabelledBy}
        aria-describedby={lowAttrs.ariaDescribedBy}
        aria-invalid={lowAttrs.ariaInvalid}
        aria-valuemin={min}
        aria-valuemax={highValue}
        aria-valuenow={lowValue}
        aria-valuetext={lowAttrs.ariaValueText}
        aria-disabled={disabled || undefined}
        aria-orientation="horizontal"
        style:--_cinder-slider-pos="{percentOf(lowValue)}%"
        onkeydown={(event) => handleKey(event, 'low')}
        onpointerdown={(event) => handleThumbPointerDown(event, 'low')}
      ></div>
      <div
        class="cinder-slider__thumb"
        data-cinder-slider-thumb="high"
        data-cinder-active={activeThumbRecent === 'high' || undefined}
        role="slider"
        tabindex={disabled ? -1 : 0}
        aria-label={highAttrs.ariaLabel}
        aria-labelledby={highAttrs.ariaLabelledBy}
        aria-describedby={highAttrs.ariaDescribedBy}
        aria-invalid={highAttrs.ariaInvalid}
        aria-valuemin={lowValue}
        aria-valuemax={max}
        aria-valuenow={highValue}
        aria-valuetext={highAttrs.ariaValueText}
        aria-disabled={disabled || undefined}
        aria-orientation="horizontal"
        style:--_cinder-slider-pos="{percentOf(highValue)}%"
        onkeydown={(event) => handleKey(event, 'high')}
        onpointerdown={(event) => handleThumbPointerDown(event, 'high')}
      ></div>
    {:else}
      <div
        class="cinder-slider__thumb"
        data-cinder-slider-thumb="single"
        role="slider"
        tabindex={disabled ? -1 : 0}
        aria-label={singleAttrs.ariaLabel}
        aria-labelledby={singleAttrs.ariaLabelledBy}
        aria-describedby={singleAttrs.ariaDescribedBy}
        aria-invalid={singleAttrs.ariaInvalid}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={lowValue}
        aria-valuetext={singleAttrs.ariaValueText}
        aria-disabled={disabled || undefined}
        aria-orientation="horizontal"
        style:--_cinder-slider-pos="{percentOf(lowValue)}%"
        onkeydown={(event) => handleKey(event, 'single')}
        onpointerdown={(event) => handleThumbPointerDown(event, 'single')}
      ></div>
    {/if}
  </div>

  {#if name}
    {#if isRange}
      <input type="hidden" name="{name}.min" value={lowValue} />
      <input type="hidden" name="{name}.max" value={highValue} />
    {:else}
      <input type="hidden" {name} value={lowValue} />
    {/if}
  {/if}
</div>
