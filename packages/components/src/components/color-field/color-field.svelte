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
    disabled = false,
    name,
    placeholder,
    errorMessage,
    enterBehavior = 'commit-then-submit',
    onchange,
    ...forwarded
  }: ColorFieldProps = $props();

  const isControlled = value !== undefined;

  const DEFAULT_FORMATS = ['hex', 'rgb', 'hsl'] as const satisfies readonly ColorFieldFormat[];
  const DEFAULT_ERROR = 'Enter a valid hex, rgb(), or hsl() color.';

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
  const resolvedErrorMessage = $derived(errorMessage ?? DEFAULT_ERROR);

  if (isControlled) {
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
    if (!isControlled) {
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
    if (isControlled) {
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

    if (isControlled) {
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

  let anchorInput: HTMLInputElement | undefined = $state();
  let hiddenMirror: HTMLInputElement | undefined = $state();

  function onFormReset(): void {
    if (isControlled) return;
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

  const resetAttachment: Attachment = (element) => {
    const input = element as HTMLInputElement;
    let currentForm: HTMLFormElement | null = null;

    const sync = (): void => {
      const nextForm = input.form;
      if (nextForm === currentForm) return;
      if (currentForm) currentForm.removeEventListener('reset', onFormReset);
      currentForm = nextForm;
      if (currentForm) currentForm.addEventListener('reset', onFormReset);
    };

    sync();
    queueMicrotask(sync);

    return () => {
      if (currentForm) currentForm.removeEventListener('reset', onFormReset);
      currentForm = null;
    };
  };

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    visibleText = target.value;
  }

  function handleBlur(): void {
    commit();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const prevCommitted = committedHex;
    commit();
    const committed = parseError === null && committedHex !== '';
    if (!committed) return;
    if (enterBehavior !== 'commit-then-submit') return;
    if (hiddenMirror) hiddenMirror.value = committedHex;
    const form = anchorInput?.form ?? null;
    if (!form) return;
    if (committedHex !== prevCommitted || prevCommitted !== '') {
      const submitter = form.querySelector<HTMLButtonElement | HTMLInputElement>(
        'button:not([type]):not([disabled]), button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
      );
      form.requestSubmit(submitter ?? undefined);
    }
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
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);
  const describedBy = $derived(composeDescribedBy(resolvedDescriptionId, resolvedErrorId));
  const resolvedAriaInvalid = $derived(
    hasError ? ariaInvalid(true) : (context?.invalid ?? ariaInvalid(false)),
  );
  const resolvedRequired = $derived(forwarded.required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  const swatchEmpty = $derived(committedHex === '');
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
      {id}
      type="text"
      class="cinder-input"
      value={visibleText}
      disabled={resolvedDisabled}
      required={resolvedRequired}
      placeholder={placeholder ?? null}
      autocomplete={forwarded.autocomplete ?? 'off'}
      autofocus={forwarded.autofocus ?? null}
      inputmode={forwarded.inputmode ?? null}
      readonly={forwarded.readonly ?? null}
      aria-label={forwarded['aria-label'] ?? null}
      aria-labelledby={forwarded['aria-labelledby'] ?? null}
      aria-invalid={resolvedAriaInvalid}
      aria-describedby={describedBy}
      spellcheck={false}
      oninput={handleInput}
      onblur={handleBlur}
      onkeydown={handleKeydown}
    />
    <span class="cinder-input-group__trailing cinder-_truncate" aria-hidden="true">
      <span
        class="cinder-color-field__swatch"
        data-empty={swatchEmpty ? '' : undefined}
        data-alpha={alpha ? '' : undefined}
        aria-hidden="true"
        style="--cinder-color-field-swatch: {committedHex || 'transparent'};"
      ></span>
    </span>
  </div>

  {#if parseError}
    <p id={ownErrorId} class="cinder-input-field__error" aria-live="polite">{parseError}</p>
  {/if}

  {#if name}
    <input bind:this={hiddenMirror} type="hidden" {name} value={committedHex} />
  {/if}

  <input bind:this={anchorInput} type="hidden" aria-hidden="true" {@attach resetAttachment} />
</div>
