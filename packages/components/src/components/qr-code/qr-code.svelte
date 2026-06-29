<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Encodes a string payload as an inline SVG QR code with an explicit accessible label.
   * @tag qr-code
   * @tag sharing
   * @useWhen Presenting a scannable URL, token, or Wi-Fi credential that users can scan from another device.
   * @useWhen You need a theme-aware QR graphic that stays crisp at any scale.
   * @avoidWhen You only need to expose a copyable short text value without camera scanning affordance. | copy-button
   * @avoidWhen The payload is sensitive and should never be displayed as machine-readable visual data.
   * @related copy-button, share-card
   */
  export type { QrCodeErrorCorrectionLevel, QrCodeProps } from './qr-code.types.ts';
</script>

<script lang="ts">
  import QRCode from 'qrcode';

  import { classNames } from '../../utilities/class-names.ts';

  import type { QrCodeProps } from './qr-code.types.ts';

  let {
    value,
    label,
    size = 160,
    margin = 1,
    errorCorrectionLevel = 'M',
    class: customClassName,
    ...rest
  }: QrCodeProps = $props();

  const mergedClassName = $derived(classNames('cinder-qr-code', customClassName));
  const resolvedSize = $derived(Number.isFinite(size) && size > 0 ? size : 160);
  const resolvedMargin = $derived(Number.isFinite(margin) && margin >= 0 ? Math.floor(margin) : 1);
  const safeLabel = $derived(
    typeof label === 'string' && label.trim().length > 0 ? label.trim() : 'QR code',
  );

  function svgCommand(command: string, x: number, y?: number): string {
    return typeof y === 'number' ? `${command}${x} ${y}` : `${command}${x}`;
  }

  function qrModulesToPath(data: boolean[], moduleSize: number, marginSize: number): string {
    let path = '';
    let moveBy = 0;
    let newRow = false;
    let lineLength = 0;

    for (let index = 0; index < data.length; index += 1) {
      const column = Math.floor(index % moduleSize);
      const row = Math.floor(index / moduleSize);

      if (!column && !newRow) newRow = true;

      if (data[index]) {
        lineLength += 1;

        if (!(index > 0 && column > 0 && data[index - 1])) {
          path += newRow
            ? svgCommand('M', column + marginSize, 0.5 + row + marginSize)
            : svgCommand('m', moveBy, 0);
          moveBy = 0;
          newRow = false;
        }

        if (!(column + 1 < moduleSize && data[index + 1])) {
          path += svgCommand('h', lineLength);
          lineLength = 0;
        }
      } else {
        moveBy += 1;
      }
    }

    return path;
  }

  function renderSvg(modules: boolean[], moduleSize: number, marginSize: number, width: number): string {
    const qrSize = moduleSize + marginSize * 2;
    const widthAndHeight = width > 0 ? ` width="${width}" height="${width}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg"${widthAndHeight} viewBox="0 0 ${qrSize} ${qrSize}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" d="${qrModulesToPath(modules, moduleSize, marginSize)}"/></svg>`;
  }

  const qrGenerationResult = $derived.by(() => {
    try {
      const qrData = QRCode.create(value, { errorCorrectionLevel });
      const renderedSvg = renderSvg(
        qrData.modules.data,
        qrData.modules.size,
        resolvedMargin,
        resolvedSize,
      );

      return {
        svgMarkup: renderedSvg,
        generationFailed: false,
      };
    } catch {
      return {
        svgMarkup: '',
        generationFailed: true,
      };
    }
  });
  const svgMarkup = $derived(qrGenerationResult.svgMarkup);
  const generationFailed = $derived(qrGenerationResult.generationFailed);
  const resolvedRole = $derived(generationFailed ? 'status' : 'img');
  const resolvedAriaLabel = $derived(generationFailed ? 'Unable to render QR code' : safeLabel);
  const resolvedAriaLive = $derived(generationFailed ? 'polite' : undefined);
</script>

<span
  {...rest}
  class={mergedClassName}
  role={resolvedRole}
  aria-label={resolvedAriaLabel}
  aria-live={resolvedAriaLive}
  data-cinder-invalid={generationFailed ? 'true' : undefined}
  data-cinder-state={generationFailed ? 'error' : 'ready'}
  style:inline-size={`${resolvedSize}px`}
  style:block-size={`${resolvedSize}px`}
>
  {#if svgMarkup.length > 0}
    {@html svgMarkup}
  {:else}
    <span
      class="cinder-qr-code__placeholder"
      data-cinder-state={generationFailed ? 'error' : 'ready'}
      aria-hidden="true"
    >
      {#if generationFailed}
        <span class="cinder-qr-code__error-mark">!</span>
      {/if}
    </span>
    {#if generationFailed}
      <span class="cinder-sr-only">Unable to render QR code.</span>
    {/if}
  {/if}
</span>
