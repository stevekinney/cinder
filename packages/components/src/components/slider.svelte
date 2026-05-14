<script lang="ts" module>
  /** Single-value or `[min, max]` tuple. */
  export type SliderValue = number | [number, number];

  /** Mode of the slider — `single` thumb or two-thumb `range`. */
  export type SliderMode = 'single' | 'range';

  type SliderBaseProps = {
    /** Minimum value. Default `0`. */
    min?: number;
    /** Maximum value. Default `100`. */
    max?: number;
    /** Step increment for arrow keys. Default `1`. Must be a positive finite number. */
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
  };

  /**
   * Props for the single-thumb slider. `value`/`defaultValue` are scalars and
   * `onchange` receives a scalar.
   */
  export type SliderSingleProps = SliderBaseProps & {
    mode?: 'single';
    value?: number;
    defaultValue?: number;
    onchange?: (value: number) => void;
  };

  /**
   * Props for the two-thumb range slider. `value`/`defaultValue` are `[low, high]`
   * tuples and `onchange` receives the same tuple shape.
   */
  export type SliderRangeProps = SliderBaseProps & {
    mode: 'range';
    value?: [number, number];
    defaultValue?: [number, number];
    onchange?: (value: [number, number]) => void;
  };

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
  export type SliderProps = SliderSingleProps | SliderRangeProps;
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

  // Guarantee a usable step. `0`, `NaN`, and negative values would let the
  // tick generator loop forever, so fall back to `1` and warn during dev.
  const safeStep = $derived.by(() => {
    if (!Number.isFinite(step) || step <= 0) {
      if (typeof console !== 'undefined') {
        console.warn(
          `[cinder/Slider] step must be a positive finite number — received ${step}. Falling back to 1.`,
        );
      }
      return 1;
    }
    return step;
  });

  const safePageStep = $derived.by(() => {
    if (pageStep === undefined) return safeStep * 10;
    if (!Number.isFinite(pageStep) || pageStep <= 0) {
      if (typeof console !== 'undefined') {
        console.warn(
          `[cinder/Slider] pageStep must be a positive finite number — received ${pageStep}. Falling back to ${safeStep * 10}.`,
        );
      }
      return safeStep * 10;
    }
    return pageStep;
  });

  // Normalize a tick array (or boolean) once. The list is filtered to
  // `[min, max]` so the renderer, snap, and keyboard neighbor lookups all
  // share the same set of valid stops.
  const tickList = $derived.by<number[] | null>(() => {
    if (!ticks) return null;
    if (Array.isArray(ticks)) {
      return ticks.filter((t) => Number.isFinite(t) && t >= min && t <= max).sort((a, b) => a - b);
    }
    return null;
  });

  function decimalsFromStep(s: number): number {
    if (!Number.isFinite(s) || s <= 0) return 0;
    const text = String(s);
    const dot = text.indexOf('.');
    return dot >= 0 ? text.length - dot - 1 : 0;
  }

  function clampToBounds(raw: number): number {
    if (raw === Infinity) return max;
    if (raw === -Infinity || Number.isNaN(raw)) return min;
    return Math.max(min, Math.min(max, raw));
  }

  function normalizeValueForMode(nextValue: SliderValue): SliderValue {
    if (mode === 'range') {
      const [rawLow, rawHigh] = Array.isArray(nextValue) ? nextValue : [min, max];
      const first = clampToBounds(rawLow);
      const second = clampToBounds(rawHigh);
      return first <= second ? [first, second] : [second, first];
    }
    return clampToBounds(Array.isArray(nextValue) ? nextValue[0] : nextValue);
  }

  // Uncontrolled state: initialized once from defaultValue / mode default.
  // Normalize at construction so the stored state never carries an
  // out-of-bounds or inverted-tuple value, even before the first commit.
  let uncontrolledInternal = $state<SliderValue>(
    normalizeValueForMode(defaultValue ?? (mode === 'range' ? [min, max] : min)),
  );

  // Controlled flag and current value. When `value` is provided we read
  // through to it; otherwise the uncontrolled state is the source of truth.
  const isControlled = $derived(value !== undefined);
  const currentValue = $derived<SliderValue>(
    normalizeValueForMode(
      value !== undefined
        ? Array.isArray(value)
          ? [value[0], value[1]]
          : value
        : uncontrolledInternal,
    ),
  );

  const isRange = $derived(mode === 'range');

  const lowValue = $derived(Array.isArray(currentValue) ? currentValue[0] : currentValue);
  const highValue = $derived(Array.isArray(currentValue) ? currentValue[1] : currentValue);

  /** Snap a raw value: clamp into `[min, max]`, then to the nearest tick or step. */
  function snap(raw: number): number {
    const clamped = clampToBounds(raw);
    if (tickList && tickList.length > 0) {
      let nearest = tickList[0]!;
      let nearestDelta = Math.abs(clamped - nearest);
      for (const tick of tickList) {
        const delta = Math.abs(clamped - tick);
        if (delta < nearestDelta) {
          nearest = tick;
          nearestDelta = delta;
        }
      }
      return nearest;
    }
    const stepped = Math.round((clamped - min) / safeStep) * safeStep + min;
    const decimals = decimalsFromStep(safeStep);
    const rounded = Number(stepped.toFixed(decimals));
    return clampToBounds(rounded);
  }

  function percentOf(numeric: number): number {
    if (max === min) return 0;
    return ((numeric - min) / (max - min)) * 100;
  }

  /** Apply a new value, respecting the controlled prop. */
  function commit(next: SliderValue) {
    const normalized = normalizeValueForMode(next);
    if (!isControlled) {
      uncontrolledInternal = Array.isArray(normalized)
        ? [normalized[0], normalized[1]]
        : normalized;
    }
    // The discriminated SliderProps union ensures the parent's onchange
    // matches the mode it declared; the cast here bridges the runtime
    // (SliderValue) and prop (number | [number, number]) types.
    (onchange as ((value: SliderValue) => void) | undefined)?.(normalized);
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

  function neighborTick(current: number, direction: 1 | -1): number {
    if (!tickList || tickList.length === 0) return current;
    if (direction === 1) {
      for (const tick of tickList) if (tick > current) return tick;
      return tickList.at(-1) ?? current;
    }
    for (let index = tickList.length - 1; index >= 0; index--) {
      const tick = tickList[index]!;
      if (tick < current) return tick;
    }
    return tickList[0] ?? current;
  }

  /**
   * Advance from `current` toward `direction` by at least `distance` of value,
   * landing on a tick. Guarantees at least one tick of movement so PageUp/PageDown
   * stays functional when tick spacing exceeds `pageStep`.
   */
  function tickPageJump(current: number, distance: number, direction: 1 | -1): number {
    if (!tickList || tickList.length === 0) return current;
    const target = current + direction * distance;
    let candidate = neighborTick(current, direction);
    while (true) {
      const stepped = neighborTick(candidate, direction);
      if (stepped === candidate) break;
      const passedTarget = direction === 1 ? stepped > target : stepped < target;
      if (passedTarget) break;
      candidate = stepped;
    }
    return candidate;
  }

  function handleKey(event: KeyboardEvent, thumb: 'single' | 'low' | 'high') {
    if (disabled) return;
    const current = thumb === 'high' ? highValue : lowValue;
    const hasTickArray = tickList !== null && tickList.length > 0;
    let next = current;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = hasTickArray ? neighborTick(current, 1) : current + safeStep;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = hasTickArray ? neighborTick(current, -1) : current - safeStep;
        break;
      case 'PageUp':
        next = hasTickArray ? tickPageJump(current, safePageStep, 1) : current + safePageStep;
        break;
      case 'PageDown':
        next = hasTickArray ? tickPageJump(current, safePageStep, -1) : current - safePageStep;
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
      activeThumbRecent = thumb;
      updateRange(thumb, next);
    }
  }

  // Pointer drag handling. The `pointermove`/`pointerup` listeners live on
  // `<svelte:document>` so they activate only while `activeThumb` is set,
  // and Svelte tears them down on unmount automatically.
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
      return raw < (lowValue + highValue) / 2 ? 'low' : 'high';
    }
    return distanceLow < distanceHigh ? 'low' : 'high';
  }

  function handleDocumentPointerMove(event: PointerEvent) {
    if (!activeThumb) return;
    const raw = valueFromClientX(event.clientX);
    if (activeThumb === 'single') {
      updateSingle(raw);
    } else {
      updateRange(activeThumb, raw);
    }
  }

  function handleDocumentPointerEnd() {
    activeThumb = null;
  }

  function handleThumbPointerDown(event: PointerEvent, thumb: 'single' | 'low' | 'high') {
    if (disabled) return;
    event.preventDefault();
    const target = event.currentTarget;
    if (target instanceof HTMLElement && document.activeElement !== target) {
      target.focus();
    }
    activeThumb = thumb;
    if (thumb === 'low' || thumb === 'high') activeThumbRecent = thumb;
  }

  function handleTrackPointerDown(event: PointerEvent) {
    if (disabled) return;
    // Ignore clicks that originated on a thumb — those are handled above.
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.dataset['cinderSliderThumb'] !== undefined) return;
    event.preventDefault();
    const raw = valueFromClientX(event.clientX);
    if (isRange) {
      const which = chooseNearestThumb(raw);
      updateRange(which, raw);
      activeThumb = which;
      activeThumbRecent = which;
    } else {
      updateSingle(raw);
      activeThumb = 'single';
    }
  }

  function accessibleNameFor(thumb: 'single' | 'low' | 'high'): string {
    if (thumb === 'single') return label;
    return `${label} — ${qualifierFor(thumb)}`;
  }

  function qualifierFor(thumb: 'low' | 'high'): string {
    return thumb === 'low' ? 'minimum value' : 'maximum value';
  }

  // FormField wiring. When inside a FormField the field's label becomes the
  // primary accessible name. In range mode we still need to disambiguate
  // the thumbs, so each thumb references both the field label and a hidden
  // qualifier span via `aria-labelledby`.
  const formFieldLabelId = $derived(formField?.labelId);
  const describedBy = $derived(formField?.describedBy);
  const ariaInvalidFromField = $derived(formField?.invalid);

  const sliderId = $props.id();
  const lowQualifierId = `${sliderId}-low-label`;
  const highQualifierId = `${sliderId}-high-label`;

  function labelledByFor(thumb: 'single' | 'low' | 'high'): string | undefined {
    if (!formFieldLabelId) return undefined;
    if (thumb === 'low') return `${formFieldLabelId} ${lowQualifierId}`;
    if (thumb === 'high') return `${formFieldLabelId} ${highQualifierId}`;
    return formFieldLabelId;
  }

  function ariaLabelFor(thumb: 'single' | 'low' | 'high'): string | undefined {
    return formFieldLabelId ? undefined : accessibleNameFor(thumb);
  }

  // Render tick mark positions.
  const tickMarks = $derived.by<number[]>(() => {
    if (tickList) return tickList;
    if (ticks !== true) return [];
    const out: number[] = [];
    const decimals = decimalsFromStep(safeStep);
    for (let v = min; v <= max + safeStep / 2; v += safeStep) {
      const snapped = Number(v.toFixed(decimals));
      if (snapped <= max) out.push(snapped);
    }
    return out;
  });
</script>

<svelte:document
  onpointermove={activeThumb ? handleDocumentPointerMove : null}
  onpointerup={activeThumb ? handleDocumentPointerEnd : null}
  onpointercancel={activeThumb ? handleDocumentPointerEnd : null}
/>

<div
  class={classNames('cinder-slider', isRange && 'cinder-slider--range', className)}
  data-cinder-disabled={disabled || undefined}
>
  {#if isRange}
    <span id={lowQualifierId} class="cinder-sr-only">
      {qualifierFor('low')}
    </span>
    <span id={highQualifierId} class="cinder-sr-only">
      {qualifierFor('high')}
    </span>
  {/if}

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
        aria-label={ariaLabelFor('low')}
        aria-labelledby={labelledByFor('low')}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalidFromField}
        aria-valuemin={min}
        aria-valuemax={highValue}
        aria-valuenow={lowValue}
        aria-valuetext={valueText ? valueText(lowValue) : undefined}
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
        aria-label={ariaLabelFor('high')}
        aria-labelledby={labelledByFor('high')}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalidFromField}
        aria-valuemin={lowValue}
        aria-valuemax={max}
        aria-valuenow={highValue}
        aria-valuetext={valueText ? valueText(highValue) : undefined}
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
        aria-label={ariaLabelFor('single')}
        aria-labelledby={labelledByFor('single')}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalidFromField}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={lowValue}
        aria-valuetext={valueText ? valueText(lowValue) : undefined}
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
