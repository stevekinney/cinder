<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status alpha
   * @purpose Frame a consumer-owned real PTY with terminal chrome, connection status, reload handling, and character-cell resize reporting.
   * @tag terminal
   * @tag pty
   * @tag shell
   * @useWhen Hosting a real interactive terminal implementation that needs consistent chrome and resize dimensions.
   * @avoidWhen Rendering a read-only stream — use TerminalOutput.
   * @related terminal-output, preview-panel
   */
  export type {
    TerminalFrameDimensions,
    TerminalFrameProps,
    TerminalFrameStatus,
  } from './terminal-frame.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Grid from '../grid/grid.svelte';
  import type { TerminalFrameProps } from './terminal-frame.types.ts';

  let {
    title,
    status = 'connecting',
    error,
    onReloadRequest,
    onDimensionsChange,
    columnWidth = 8,
    rowHeight = 18,
    children,
    class: customClassName,
    ...rest
  }: TerminalFrameProps = $props();

  let viewport: HTMLDivElement;
  let previousColumns = -1;
  let previousRows = -1;
  const titleId = $props.id();

  $effect(() => {
    if (!viewport || !onDimensionsChange || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const columns = Math.max(1, Math.floor(entry.contentRect.width / columnWidth));
      const rows = Math.max(1, Math.floor(entry.contentRect.height / rowHeight));
      if (columns === previousColumns && rows === previousRows) return;
      previousColumns = columns;
      previousRows = rows;
      onDimensionsChange({ cols: columns, rows });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  });
</script>

<div
  {...rest}
  class={classNames('cinder-terminal-frame', customClassName)}
  data-status={status}
  aria-labelledby={titleId}
>
  <Grid as="header" columns="1fr auto 1fr" gap="0" class="cinder-terminal-frame__chrome">
    <span class="cinder-terminal-frame__traffic-lights" aria-hidden="true">
      <span></span><span></span><span></span>
    </span>
    <h2 id={titleId} class="cinder-terminal-frame__title">{title}</h2>
    <span class="cinder-terminal-frame__status">{status}</span>
  </Grid>

  {#if error}
    <div class="cinder-terminal-frame__error" role="alert">
      <span>{error}</span>
      {#if onReloadRequest}
        <button type="button" class="cinder-terminal-frame__reload" onclick={onReloadRequest}
          >Reload</button
        >
      {/if}
    </div>
  {/if}

  <div class="cinder-terminal-frame__viewport" bind:this={viewport}>
    {@render children()}
  </div>
</div>
