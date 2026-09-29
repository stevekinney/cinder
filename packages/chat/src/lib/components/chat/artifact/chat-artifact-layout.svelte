<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type ChatArtifactLayoutProps = {
    /**
     * Unique identifier for this layout instance. Passed to the ArtifactPanel
     * to namespace the title element ID and avoid duplicate IDs when multiple
     * instances share a page.
     */
    instanceId?: string;
    /** Whether the artifact panel is open */
    open?: boolean;
    /** Content for the main chat area */
    children: Snippet;
    /** Content for the artifact panel */
    panel?: Snippet;
    /** Title for the artifact panel */
    panelTitle?: string | undefined;
    /** Called when the panel is closed */
    onclose?: (() => void) | undefined;
    class?: string | null | undefined;
    style?: string | null | undefined;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import ArtifactPanel from './artifact-panel.svelte';

  let {
    instanceId = 'artifact',
    open = false,
    children,
    panel,
    panelTitle,
    onclose,
    class: className,
    style,
  }: ChatArtifactLayoutProps = $props();
</script>

<div class={classNames('chat-artifact-layout', className)} {style}>
  <div class="chat-artifact-grid" data-panel-open={open}>
    <div class="chat-artifact-main">
      {@render children()}
    </div>

    {#if open && panel}
      <ArtifactPanel {instanceId} title={panelTitle} {onclose}>
        {@render panel()}
      </ArtifactPanel>
    {/if}
  </div>
</div>

<style>
  .chat-artifact-layout {
    container-type: inline-size;
    height: 100%;
    width: 100%;
    min-width: 0;
    min-height: 0;
  }

  .chat-artifact-grid {
    display: grid;
    grid-template-columns: 1fr;
    height: 100%;
    width: 100%;
    transition: grid-template-columns var(--cinder-duration-base) var(--cinder-ease-standard);
  }

  .chat-artifact-grid[data-panel-open='true'] {
    grid-template-columns: 1fr 40%;
  }

  .chat-artifact-main {
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }

  /* Narrow viewport: stack vertically */
  @container (max-width: 768px) {
    .chat-artifact-grid[data-panel-open='true'] {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 50%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-artifact-grid {
      transition: none;
    }
  }
</style>
