<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Text input that validates and normalizes hex, rgb(), and hsl() color strings into a canonical hex value emitted on blur.
   * @tag form
   * @tag color
   * @useWhen Accepting an exact color value via keyboard entry, including pasted hex, rgb(), or hsl() strings.
   * @useWhen Pairing with color-picker for combined visual selection and text-based entry.
   * @avoidWhen Letting users graze visually across a color space — use color-picker instead.
   * @avoidWhen Constraining selection to a fixed brand palette — use color-swatch-picker instead.
   * @related color-picker, color-swatch-picker, input, form-field
   */
  export type { ColorFieldProps, ColorFieldFormat } from './color-field.types.ts';
</script>

<script lang="ts">
  import { DEV } from 'esm-env';
  import { tick } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { parseColor } from '../../utilities/color-luminance.ts';
  import Input from '../input/input.svelte';
  import type { ColorFieldProps } from './color-field.types.ts';

  let {
    id,
    class: className,
    value,
    defaultValue,
    alpha = false,
    formats = ['hex', 'rgb', 'hsl'],
    disabled = false,
    required = false,
    readonly = false,
    name,
    placeholder,
    ariaLabel,
    ariaLabelledby,
    errorMessage,
    enterBehavior = 'commit-then-submit',
    onchange,
  }: ColorFieldProps = $props();

  // Mode is captured once at mount. Runtime mode switches are unsupported.
  const isControlled = value !== undefined;

  type RgbaParts = { r: number; g: number; b: number; a: number };

  let visibleText = $state('');
  let committedHex = $state('');
  let committedRgba = $state<RgbaParts | null>(null);
  let parseError = $state<string | null>(null);
  let anchorInput: HTMLInputElement | null = $state(null);

  function toHex2(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  }

  function normalizeHex(parts: RgbaParts, emitAlpha: boolean): string {
    const base = `#${toHex2(parts.r)}${toHex2(parts.g)}${toHex2(parts.b)}`;
    if (emitAlpha) return base + toHex2(parts.a * 255);
    return base;
  }

  // Emit rule: emit `#rrggbbaa` only when `alpha === true` AND parsed `a < 1`.
  function emitFor(parts: RgbaParts): string {
    return normalizeHex(parts, alpha && parts.a < 1);
  }

  const HEX_RE = /^#[0-9a-f]{3}([0-9a-f]([0-9a-f]{2})?([0-9a-f]{2})?)?$/i;
  const RGB_RE = /^rgba?\s*\([^)]*\)\s*$/i;
  const HSL_RE = /^hsla?\s*\([^)]*\)\s*$/i;

  function passesFormatGate(text: string): boolean {
    if (HEX_RE.test(text)) return formats.includes('hex');
    if (RGB_RE.test(text)) return formats.includes('rgb');
    if (HSL_RE.test(text)) return formats.includes('hsl');
    return false;
  }

  function defaultErrorMessage(): string {
    return errorMessage ?? 'Enter a valid hex, rgb(), or hsl() color.';
  }

  function seedFromParts(parts: RgbaParts): void {
    committedRgba = parts;
    committedHex = emitFor(parts);
    visibleText = committedHex;
  }

  function clearAll(): void {
    committedRgba = null;
    committedHex = '';
    visibleText = '';
  }

  // ── Initialization ──────────────────────────────────────────────────────

  if (isControlled) {
    if (value !== undefined && value !== '') {
      const parsed = parseColor(value);
      if (parsed !== null) {
        seedFromParts(parsed);
      } else {
        visibleText = value;
        committedHex = '';
        committedRgba = null;
        parseError = defaultErrorMessage();
      }
    }
  } else if (defaultValue !== undefined && defaultValue !== '') {
    const parsed = parseColor(defaultValue);
    if (parsed !== null) {
      seedFromParts(parsed);
    }
  }

  // ── Controlled sync ─────────────────────────────────────────────────────

  function reconcileFromValue(next: string): void {
    if (next === '') {
      clearAll();
      parseError = null;
      return;
    }
    const parsed = parseColor(next);
    if (parsed === null) {
      visibleText = next;
      committedHex = '';
      committedRgba = null;
      parseError = defaultErrorMessage();
      return;
    }
    seedFromParts(parsed);
    parseError = null;
  }

  $effect(() => {
    if (!isControlled) return;
    if (value === undefined) {
      if (DEV) {
        console.warn(
          '[cinder/ColorField] runtime mode switch ignored (controlled -> undefined)',
        );
      }
      return;
    }
    reconcileFromValue(value);
  });

  // ── alpha runtime changes ───────────────────────────────────────────────

  // Re-derive `committedHex` and `visibleText` from `committedRgba` when the
  // alpha mode toggles after mount. In controlled mode the parent's value is
  // canonical — derive from there. Never emit `onchange` on a config change.
  $effect(() => {
    void alpha;
    if (isControlled) {
      // Controlled mode: re-run reconcile against the current controlled value.
      if (value !== undefined && value !== '') {
        const parsed = parseColor(value);
        if (parsed !== null) {
          committedRgba = parsed;
          committedHex = emitFor(parsed);
          visibleText = committedHex;
        }
      }
      return;
    }
    // Uncontrolled mode: re-derive from preserved committedRgba.
    if (committedRgba === null) return;
    const nextHex = emitFor(committedRgba);
    if (nextHex === committedHex) return;
    committedHex = nextHex;
    visibleText = nextHex;
  });

  // ── formats runtime changes — display-only validation ───────────────────

  // A `formats` change only affects the input-time gate. It must never mutate
  // committed state. If there's a current parse error, re-run the gate on the
  // visible text and clear the error when the value now passes.
  $effect(() => {
    void formats;
    if (parseError === null) return;
    const text = visibleText.trim();
    if (text === '') {
      parseError = null;
      return;
    }
    if (!passesFormatGate(text)) return;
    const parsed = parseColor(text);
    if (parsed === null) return;
    parseError = null;
  });

  // ── Commit pipeline (blur + Enter) ──────────────────────────────────────

  function runCommit(): { committed: boolean; emittedHex: string | null } {
    const trimmed = visibleText.trim();

    if (trimmed === '') {
      const hadCommitted = committedHex !== '';
      const hadError = parseError !== null;
      clearAll();
      parseError = null;
      if (hadCommitted) {
        onchange?.('');
        return { committed: true, emittedHex: '' };
      }
      return { committed: hadError, emittedHex: null };
    }

    // Canonical-display bypass: typing the existing committed hex back in is a no-op.
    if (trimmed === committedHex) {
      visibleText = committedHex;
      parseError = null;
      return { committed: false, emittedHex: null };
    }

    if (!passesFormatGate(trimmed)) {
      parseError = defaultErrorMessage();
      return { committed: false, emittedHex: null };
    }

    const parsed = parseColor(trimmed);
    if (parsed === null) {
      parseError = defaultErrorMessage();
      return { committed: false, emittedHex: null };
    }

    const normalized = emitFor(parsed);
    const previousHex = committedHex;
    parseError = null;
    visibleText = normalized;

    if (!isControlled) {
      // Uncontrolled — always update all three slots so a later alpha toggle
      // can reconstruct `#rrggbbaa` even if the strip-on-emit hid it.
      committedRgba = parsed;
      committedHex = normalized;
      if (normalized !== previousHex) {
        onchange?.(normalized);
        return { committed: true, emittedHex: normalized };
      }
      return { committed: true, emittedHex: null };
    }

    // Controlled mode — only mutate committedRgba / committedHex when the
    // emitted value actually changes. Parent authority is strict: alpha not
    // present in `value` is not retained.
    if (normalized !== previousHex) {
      committedRgba = parsed;
      committedHex = normalized;
      onchange?.(normalized);
      return { committed: true, emittedHex: normalized };
    }
    return { committed: false, emittedHex: null };
  }

  function handleBlur(): void {
    runCommit();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const result = runCommit();

    if (result.emittedHex !== null && anchorInput !== null) {
      // Imperatively sync the hidden mirror's DOM value so a synchronous
      // requestSubmit sees the canonical hex even before Svelte's effect
      // queue flushes.
      anchorInput.value = result.emittedHex;
    }

    if (!result.committed) return;
    if (parseError !== null) return;
    if (enterBehavior !== 'commit-then-submit') return;

    const form = anchorInput?.form ?? null;
    if (form === null) return;
    const submitter = form.querySelector<HTMLButtonElement | HTMLInputElement>(
      'button:not([type]):not([disabled]), button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
    );
    form.requestSubmit(submitter ?? undefined);
  }

  // ── Form reset wiring ───────────────────────────────────────────────────

  function onFormReset(): void {
    if (isControlled) return;
    parseError = null;
    if (defaultValue === undefined || defaultValue === '') {
      clearAll();
      return;
    }
    const parsed = parseColor(defaultValue);
    if (parsed === null) {
      clearAll();
      return;
    }
    seedFromParts(parsed);
  }

  $effect(() => {
    const input = anchorInput;
    if (input === null) return;
    const resolvedInput: HTMLInputElement = input;
    let currentForm: HTMLFormElement | null = null;

    function attach(): void {
      const nextForm = resolvedInput.form;
      if (nextForm === currentForm) return;
      currentForm?.removeEventListener('reset', onFormReset);
      currentForm = nextForm;
      currentForm?.addEventListener('reset', onFormReset);
    }

    attach();
    void tick().then(attach);

    return () => {
      currentForm?.removeEventListener('reset', onFormReset);
    };
  });

  // ── Derived display state ───────────────────────────────────────────────

  const swatchEmpty = $derived(committedHex === '');
  const swatchColor = $derived(committedHex === '' ? 'transparent' : committedHex);
</script>

{#snippet swatch()}
  <span
    class="cinder-color-field__swatch"
    data-cinder-empty={swatchEmpty ? '' : undefined}
    data-cinder-alpha={alpha ? '' : undefined}
    aria-hidden="true"
    style="--cinder-color-field-swatch: {swatchColor};"
  ></span>
{/snippet}

<div
  class={classNames('cinder-color-field', className)}
  data-cinder-disabled={disabled ? '' : undefined}
>
  <Input
    {id}
    bind:value={visibleText}
    disabled={disabled}
    required={required}
    readonly={readonly}
    placeholder={placeholder ?? ''}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
    error={parseError ?? ''}
    onblur={handleBlur}
    onkeydown={handleKeydown}
    trailing={swatch}
  />

  <input
    type="hidden"
    {name}
    value={committedHex}
    bind:this={anchorInput}
    aria-hidden="true"
  />
</div>
