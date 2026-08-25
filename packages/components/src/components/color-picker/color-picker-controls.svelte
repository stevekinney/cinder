<script lang="ts">
  import Copy from 'lucide-svelte/icons/copy';
  import CopyButton from '@lostgradient/cinder/copy-button';

  import { isOpaqueForFormat, type ColorOutputFormat } from '../../utilities/color-format.ts';

  type ColorPickerControlsProps = {
    gradientId: string;
    hueId: string;
    alphaId: string;
    previewId: string;
    disabled: boolean;
    alpha: boolean;
    format: ColorOutputFormat;
    hue: number;
    saturation: number;
    lightnessValue: number;
    alphaValue: number;
    hueColor: string;
    previewColor: string;
    internalValue: string;
    hexValue: string;
    formatRgb: string;
    formatHsl: string;
    handlePosition: { x: number; y: number };
    hueAriaValue: number;
    alphaAriaValue: number;
    gradientElement?: HTMLDivElement | null;
    hueElement?: HTMLDivElement | null;
    alphaElement?: HTMLDivElement | null;
    onGradientPointerDown: (event: PointerEvent) => void;
    onGradientPointerMove: (event: PointerEvent) => void;
    onGradientPointerUp: (event: PointerEvent) => void;
    onGradientPointerCancel: (event: PointerEvent) => void;
    onGradientKeydown: (event: KeyboardEvent) => void;
    onHueKeydown: (event: KeyboardEvent) => void;
    onHuePointerDown: (event: PointerEvent) => void;
    onHuePointerMove: (event: PointerEvent) => void;
    onHuePointerUp: (event: PointerEvent) => void;
    onHuePointerCancel: (event: PointerEvent) => void;
    onAlphaKeydown: (event: KeyboardEvent) => void;
    onAlphaPointerDown: (event: PointerEvent) => void;
    onAlphaPointerMove: (event: PointerEvent) => void;
    onAlphaPointerUp: (event: PointerEvent) => void;
    onAlphaPointerCancel: (event: PointerEvent) => void;
  };

  let {
    gradientId,
    hueId,
    alphaId,
    previewId,
    disabled,
    alpha,
    format,
    hue,
    saturation,
    lightnessValue,
    alphaValue,
    hueColor,
    previewColor,
    internalValue,
    hexValue,
    formatRgb,
    formatHsl,
    handlePosition,
    hueAriaValue,
    alphaAriaValue,
    gradientElement = $bindable(null),
    hueElement = $bindable(null),
    alphaElement = $bindable(null),
    onGradientPointerDown,
    onGradientPointerMove,
    onGradientPointerUp,
    onGradientPointerCancel,
    onGradientKeydown,
    onHueKeydown,
    onHuePointerDown,
    onHuePointerMove,
    onHuePointerUp,
    onHuePointerCancel,
    onAlphaKeydown,
    onAlphaPointerDown,
    onAlphaPointerMove,
    onAlphaPointerUp,
    onAlphaPointerCancel,
  }: ColorPickerControlsProps = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={gradientElement}
  id={gradientId}
  role="application"
  aria-label="Color saturation and lightness. Use a pointer to select; arrow keys provide coarse keyboard adjustment."
  aria-describedby={previewId}
  aria-disabled={disabled ? 'true' : undefined}
  class="cinder-color-picker__gradient"
  style="--cinder-color-picker-hue: {hueColor};"
  tabindex={disabled ? -1 : 0}
  onpointerdown={onGradientPointerDown}
  onpointermove={onGradientPointerMove}
  onpointerup={onGradientPointerUp}
  onpointercancel={onGradientPointerCancel}
  onkeydown={onGradientKeydown}
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
  onkeydown={onHueKeydown}
  onpointerdown={onHuePointerDown}
  onpointermove={onHuePointerMove}
  onpointerup={onHuePointerUp}
  onpointercancel={onHuePointerCancel}
>
  <div
    class="cinder-color-picker__hue-thumb"
    style="left: {Math.min(100, (hue / 359) * 100)}%;"
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
    onkeydown={onAlphaKeydown}
    onpointerdown={onAlphaPointerDown}
    onpointermove={onAlphaPointerMove}
    onpointerup={onAlphaPointerUp}
    onpointercancel={onAlphaPointerCancel}
  >
    <div
      class="cinder-color-picker__alpha-thumb"
      style="left: {alphaValue * 100}%;"
      aria-hidden="true"
    ></div>
  </div>
{/if}

<div class="cinder-color-picker__footer">
  <!--
    The checkerboard backdrop is keyed off the ACTUAL alphaValue (< 1), not
    the `alpha` UI-affordance prop: a programmatically-retained translucent
    value (alpha={false} + a translucent `value`, per the CIN-104
    alpha-retention ruling) renders as an hsla(...) preview color and must
    show the checkerboard behind it, even with the alpha slider hidden —
    otherwise it composites flat against the surrounding surface and reads
    as a different opaque color despite the stored value and copy actions
    reporting alpha.
  -->
  <div
    id={previewId}
    role="img"
    class="cinder-color-picker__preview"
    data-cinder-alpha={isOpaqueForFormat(alphaValue, format) ? undefined : ''}
    aria-label={internalValue ? `Selected color: ${internalValue}` : 'Selected color: none'}
    style="--cinder-color-picker-preview: {previewColor};"
  ></div>
  <div class="cinder-color-picker__formats" role="group" aria-label="Copy color formats">
    <CopyButton
      value={hexValue}
      label="Copy HEX format"
      copiedLabel="HEX format copied"
      class="cinder-color-picker__format"
      disabled={!internalValue || disabled}
    >
      <span class="cinder-color-picker__hex-value">{hexValue || '—'}</span><Copy
        class="cinder-icon-xs"
        aria-hidden="true"
      />
    </CopyButton>
    <CopyButton
      value={formatRgb}
      label="Copy RGB format"
      copiedLabel="RGB format copied"
      class="cinder-color-picker__format"
      disabled={!internalValue || disabled}
    >
      <span>RGB {formatRgb}</span><Copy class="cinder-icon-xs" aria-hidden="true" />
    </CopyButton>
    <CopyButton
      value={formatHsl}
      label="Copy HSL format"
      copiedLabel="HSL format copied"
      class="cinder-color-picker__format"
      disabled={!internalValue || disabled}
    >
      <span>HSL {formatHsl}</span><Copy class="cinder-icon-xs" aria-hidden="true" />
    </CopyButton>
  </div>
</div>
