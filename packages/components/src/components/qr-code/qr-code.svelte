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

  let svgMarkup = $state('');
  let generationFailed = $state(false);

  const mergedClassName = $derived(classNames('cinder-qr-code', customClassName));
  const resolvedSize = $derived(Number.isFinite(size) && size > 0 ? size : 160);
  const safeLabel = $derived(
    typeof label === 'string' && label.trim().length > 0 ? label.trim() : `QR code for ${value}`,
  );

  function decorateSvg(svg: string): string {
    return svg
      .replace('<svg ', '<svg aria-hidden="true" focusable="false" ')
      .replaceAll('fill="#000000"', 'fill="currentColor"')
      .replaceAll('stroke="#000000"', 'stroke="currentColor"');
  }

  $effect(() => {
    let cancelled = false;
    generationFailed = false;
    svgMarkup = '';

    void QRCode.toString(value, {
      type: 'svg',
      width: resolvedSize,
      margin,
      errorCorrectionLevel,
      color: {
        dark: '#000000',
        light: '#00000000',
      },
    })
      .then((svg) => {
        if (cancelled) return;
        svgMarkup = decorateSvg(svg);
      })
      .catch(() => {
        if (cancelled) return;
        svgMarkup = '';
        generationFailed = true;
      });

    return () => {
      cancelled = true;
    };
  });
</script>

<span
  {...rest}
  class={mergedClassName}
  role={generationFailed ? undefined : 'img'}
  aria-label={generationFailed ? undefined : safeLabel}
  data-cinder-invalid={generationFailed ? 'true' : undefined}
  style:inline-size={`${resolvedSize}px`}
  style:block-size={`${resolvedSize}px`}
>
  {#if svgMarkup.length > 0}
    {@html svgMarkup}
  {:else}
    <span class="cinder-qr-code__placeholder" aria-hidden="true"></span>
  {/if}
</span>
