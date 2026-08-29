<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status alpha
   * @purpose Bounded preview layout shell with title, status, optional chrome regions, and nested overflow discipline.
   * @tag layout
   * @tag preview
   * @tag panel
   * @useWhen Framing a generated preview, artifact inspection area, or side-by-side review surface.
   * @useWhen A preview needs consistent header, tabs, body, and footer slots without owning product-specific behavior.
   * @avoidWhen Communicating an urgent standalone message — use alert.
   * @avoidWhen You only need generic spacing — use stack.
   * @related stack, card, tabs, alert
   */
  export type { PreviewPanelProps, PreviewPanelStatus } from './preview-panel.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { PreviewPanelProps } from './preview-panel.types.ts';

  let {
    title,
    status = 'idle',
    leading,
    actions,
    tabs,
    children,
    footer,
    class: customClassName,
    ...rest
  }: PreviewPanelProps = $props();

  const titleId = $props.id();
  const error = $derived(status === 'error');
</script>

<div
  {...rest}
  class={classNames('cinder-preview-panel', customClassName)}
  data-cinder-status={status}
  aria-labelledby={titleId}
  role={error ? 'alert' : undefined}
>
  <header class="cinder-preview-panel__header">
    {#if leading}
      <div class="cinder-preview-panel__leading">
        {@render leading()}
      </div>
    {/if}
    <h2 id={titleId} class="cinder-preview-panel__title">{title}</h2>
    <span class="cinder-preview-panel__status">{status}</span>
    {#if actions}
      <div class="cinder-preview-panel__actions">
        {@render actions()}
      </div>
    {/if}
  </header>

  {#if tabs}
    <div class="cinder-preview-panel__tabs">
      {@render tabs()}
    </div>
  {/if}

  <div class="cinder-preview-panel__body">
    {@render children()}
  </div>

  {#if footer}
    <footer class="cinder-preview-panel__footer">
      {@render footer()}
    </footer>
  {/if}
</div>
