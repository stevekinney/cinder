<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Text input that validates and normalizes hex, `rgb()`, and `hsl()` color strings into a canonical hex value.
   * @tag form
   * @tag color
   * @useWhen Letting users enter or paste a precise color value as text alongside a visual picker.
   * @useWhen Editing brand colors, design-token values, or accessibility-critical hex codes that need exact entry.
   * @avoidWhen Letting users graze a color space without typing — use color-picker instead.
   * @avoidWhen Constraining selection to a fixed palette — use color-swatch-picker instead.
   * @related color-picker, color-swatch-picker, input, form-field
   */
  export type { ColorFieldFormat, ColorFieldProps } from './color-field.types.ts';
</script>

<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { DEV } from 'esm-env';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { parseColor } from '../../utilities/color-luminance.ts';

  import type { ColorFieldFormat, ColorFieldProps } from './color-field.types.ts';

  let {
    id,
    class: className,
    value,
    defaultValue,
    alpha = false,
    formats,
    disabled,
    name,
    placeholder,
    errorMessage,
    enterBehavior = 'commit-then-submit',
    onchange,
    ...forwarded
  }: ColorFieldProps = $props();

  // Controlled vs uncontrolled is captured once at mount. Runtime flips are
  // ignored — see the DEV warning in the controlled-sync effect below.
  const initiallyControlled = value !== undefined;

  const DEFAULT_FORMATS = ['hex', 'rgb', 'hsl'] as const satisfies readonly ColorFieldFormat[];

  const FORMAT_LABELS: Record<ColorFieldFormat, string> = {
    hex: 'hex',
    rgb: 'rgb()',
    hsl: 'hsl()',
  };

  const HEX_RE = /^#[0-9a-f]{3}([0-9a-f]([0-9a-f]{2})?([0-9a-f]{2})?)?$/i;
  const RGB_RE = /^rgba?\s*\([^)]*\)\s*$/i;
  const HSL_RE = /^hsla?\s*\([^)]*\)\s*$/i;

  type Rgba = { r: number; g: number; b: number; a: number };

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  function toHex2(n: number): string {
    return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  }

  function formatHexFromRgba(parsed: Rgba, withAlpha: boolean): string {
    const base = `#${toHex2(parsed.r)}${toHex2(parsed.g)}${toHex2(parsed.b)}`;
    if (withAlpha && parsed.a < 1) {
      return base + toHex2(parsed.a * 255);
    }
    return base;
  }

  function classify(trimmed: string): ColorFieldFormat | null {
    if (HEX_RE.test(trimmed)) return 'hex';
    if (RGB_RE.test(trimmed)) return 'rgb';
    if (HSL_RE.test(trimmed)) return 'hsl';
    return null;
  }

  function isFormatAllowed(
    format: ColorFieldFormat,
    accepted: readonly ColorFieldFormat[],
  ): boolean {
    return accepted.includes(format);
  }

  type ParseResult = { ok: true; rgba: Rgba; hex: string } | { ok: false };

  function tryParse(
    raw: string,
    currentAlpha: boolean,
    accepted: readonly ColorFieldFormat[],
  ): ParseResult {
    const trimmed = raw.trim();
    const shape = classify(trimmed);
    if (shape === null) return { ok: false };
    if (!isFormatAllowed(shape, accepted)) return { ok: false };
    const parsed = parseColor(trimmed);
    if (!parsed) return { ok: false };
    return { ok: true, rgba: parsed, hex: formatHexFromRgba(parsed, currentAlpha).toLowerCase() };
  }

  let visibleText = $state('');
  let committedHex = $state('');
  let committedRgba = $state<Rgba | null>(null);
  let parseError = $state<string | null>(null);

  const acceptedFormats = $derived<readonly ColorFieldFormat[]>(formats ?? DEFAULT_FORMATS);

  const defaultErrorMessage = $derived.by(() => {
    const labels = acceptedFormats.map((f) => FORMAT_LABELS[f]);
    if (labels.length === 1) return `Enter a valid ${labels[0]} color.`;
    const head = labels.slice(0, -1).join(', ');
    const tail = labels[labels.length - 1];
    return `Enter a valid ${head}, or ${tail} color.`;
  });
  const resolvedErrorMessage = $derived(errorMessage ?? defaultErrorMessage);

  if (initiallyControlled) {
    if (value !== undefined && value !== '') {
      const result = tryParse(value, alpha, acceptedFormats);
      if (result.ok) {
        visibleText = result.hex;
        committedHex = result.hex;
        committedRgba = result.rgba;
      } else {
        visibleText = value;
        committedHex = '';
        committedRgba = null;
        parseError = resolvedErrorMessage;
      }
    }
  } else if (defaultValue !== undefined && defaultValue !== '') {
    const result = tryParse(defaultValue, alpha, acceptedFormats);
    if (result.ok) {
      visibleText = result.hex;
      committedHex = result.hex;
      committedRgba = result.rgba;
    }
  }

  function reconcileFromValue(next: string): void {
    if (next === '') {
      visibleText = '';
      committedHex = '';
      committedRgba = null;
      parseError = null;
      return;
    }
    const result = tryParse(next, alpha, acceptedFormats);
    if (result.ok) {
      visibleText = result.hex;
      committedHex = result.hex;
      committedRgba = result.rgba;
      parseError = null;
    } else {
      visibleText = next;
      committedHex = '';
      committedRgba = null;
      parseError = resolvedErrorMessage;
    }
  }

  let didMount = false;
  $effect(() => {
    if (!initiallyControlled) {
      didMount = true;
      return;
    }
    const next = value;
    if (!didMount) {
      didMount = true;
      return;
    }
    if (next === undefined) {
      if (DEV) {
        console.warn('[cinder/ColorField] runtime mode switch ignored (controlled -> undefined)');
      }
      return;
    }
    reconcileFromValue(next);
  });

  let lastAlpha = alpha;
  $effect(() => {
    const currentAlpha = alpha;
    if (currentAlpha === lastAlpha) return;
    lastAlpha = currentAlpha;
    if (initiallyControlled) {
      if (value !== undefined) reconcileFromValue(value);
      return;
    }
    if (committedRgba) {
      const hex = formatHexFromRgba(committedRgba, currentAlpha).toLowerCase();
      committedHex = hex;
      visibleText = hex;
    }
  });

  let lastFormatsKey = (formats ?? DEFAULT_FORMATS).join(',');
  $effect(() => {
    const key = (formats ?? DEFAULT_FORMATS).join(',');
    if (key === lastFormatsKey) return;
    lastFormatsKey = key;
    if (parseError !== null && visibleText !== '') {
      const result = tryParse(visibleText, alpha, formats ?? DEFAULT_FORMATS);
      if (result.ok) parseError = null;
    }
  });

  function commit(): void {
    const trimmed = visibleText.trim();

    if (trimmed === '') {
      if (committedHex !== '') {
        const prev = committedHex;
        visibleText = '';
        committedHex = '';
        committedRgba = null;
        parseError = null;
        if (prev !== '') onchange?.('');
      } else {
        parseError = null;
      }
      return;
    }

    if (trimmed === committedHex) {
      visibleText = committedHex;
      parseError = null;
      return;
    }

    const result = tryParse(trimmed, alpha, acceptedFormats);
    if (!result.ok) {
      parseError = resolvedErrorMessage;
      return;
    }

    parseError = null;
    const prev = committedHex;
    visibleText = result.hex;

    if (initiallyControlled) {
      if (result.hex !== prev) {
        committedHex = result.hex;
        committedRgba = result.rgba;
        onchange?.(result.hex);
      }
    } else {
      committedHex = result.hex;
      committedRgba = result.rgba;
      if (result.hex !== prev) onchange?.(result.hex);
    }
  }

  let visibleInput: HTMLInputElement | undefined = $state();
  let hiddenMirror: HTMLInputElement | undefined = $state();

  function onFormReset(): void {
    if (initiallyControlled) return;
    if (defaultValue !== undefined && defaultValue !== '') {
      const result = tryParse(defaultValue, alpha, acceptedFormats);
      if (result.ok) {
        visibleText = result.hex;
        committedHex = result.hex;
        committedRgba = result.rgba;
        parseError = null;
        return;
      }
    }
    visibleText = '';
    committedHex = '';
    committedRgba = null;
    parseError = null;
  }

  const resetAttachment: Attachment<HTMLInputElement> = (input) => {
    // v1 does not support moving the component across forms at runtime —
    // see color-field.a11y.md. The form association is captured at mount.
    const form = input.form;
    if (!form) return;
    form.addEventListener('reset', onFormReset);
    return () => form.removeEventListener('reset', onFormReset);
  };

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    commit();
    const committed = parseError === null && committedHex !== '';
    if (!committed) return;
    // Only suppress the native submit once we know we have a committed value
    // to submit. Empty/invalid input lets the browser handle Enter normally.
    event.preventDefault();
    if (enterBehavior !== 'commit-then-submit') return;
    // Write synchronously so requestSubmit's FormData sees the canonical
    // value before Svelte's reactive flush updates the binding.
    if (hiddenMirror) hiddenMirror.value = committedHex;
    const form = visibleInput?.form ?? null;
    if (!form) return;
    const submitter = form.querySelector<HTMLButtonElement | HTMLInputElement>(
      'button:not([type]):not([disabled]), button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
    );
    form.requestSubmit(submitter ?? undefined);
  }

  // Field-control wiring (mirrors what Input does, since we render the native input ourselves).
  const context = getFormFieldContext();
  const hasError = $derived(parseError !== null);
  const ownDescriptionId = $derived(describeId(id, false));
  const defaultErrorIdForField = $derived(buildErrorId(id, hasError));
  const ownErrorId = $derived(
    hasError && defaultErrorIdForField === context?.errorId
      ? `${id}-color-field-error`
      : defaultErrorIdForField,
  );
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  // When both the field has a parse error AND the context owns a separate
  // application-level error, contribute both ids so aria-describedby points
  // at both messages. When the field has no error, only the context id flows
  // through — referencing a non-existent id violates WCAG 1.3.1.
  const contextErrorId = $derived(context?.errorId);
  const fieldErrorId = $derived(hasError ? ownErrorId : undefined);
  const describedBy = $derived(
    composeDescribedBy(
      resolvedDescriptionId,
      contextErrorId,
      fieldErrorId === contextErrorId ? undefined : fieldErrorId,
    ),
  );
  const resolvedAriaInvalid = $derived(
    hasError ? ariaInvalid(true) : (context?.invalid ?? ariaInvalid(false)),
  );
  const resolvedRequired = $derived(forwarded.required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  const swatchEmpty = $derived(committedHex === '');
  const swatchShowsAlpha = $derived(alpha && committedHex.length === 9);
</script>

<div
  class={classNames('cinder-color-field', className)}
  data-disabled={resolvedDisabled ? '' : undefined}
>
  <div
    class="cinder-input-group"
    data-trailing=""
    data-disabled={resolvedDisabled ? '' : undefined}
    data-invalid={hasError ? '' : undefined}
  >
    <input
      bind:this={visibleInput}
      {id}
      type="text"
      class="cinder-input"
      value={visibleText}
      {@attach resetAttachment}
      disabled={resolvedDisabled}
      required={resolvedRequired}
      {placeholder}
      autocomplete={forwarded.autocomplete ?? 'off'}
      autofocus={forwarded.autofocus}
      inputmode={forwarded.inputmode}
      readonly={forwarded.readonly}
      aria-label={forwarded['aria-label']}
      aria-labelledby={forwarded['aria-labelledby']}
      aria-invalid={resolvedAriaInvalid}
      aria-describedby={describedBy}
      spellcheck={false}
      oninput={(event) => {
        visibleText = (event.currentTarget as HTMLInputElement).value;
      }}
      onblur={commit}
      onkeydown={handleKeydown}
    />
    <span class="cinder-input-group__trailing cinder-_truncate" aria-hidden="true">
      <span
        class="cinder-color-field__swatch"
        data-empty={swatchEmpty ? '' : undefined}
        data-alpha={swatchShowsAlpha ? '' : undefined}
        aria-hidden="true"
        style="--cinder-color-field-swatch: {committedHex || 'transparent'};"
      ></span>
    </span>
  </div>

  <!-- Live region is rendered unconditionally so AT reliably announces text
       inserted into it. Empty state is visually hidden via :empty styling. -->
  <p id={ownErrorId} class="cinder-color-field__error" aria-live="polite" aria-atomic="true">
    {parseError ?? ''}
  </p>

  {#if name}
    <input bind:this={hiddenMirror} type="hidden" {name} value={committedHex} />
  {/if}
</div>
