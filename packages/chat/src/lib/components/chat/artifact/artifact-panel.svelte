<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type ArtifactPanelProps = {
    /**
     * Unique identifier for this panel instance. Used to namespace the title
     * element's DOM ID so that multiple ArtifactPanel instances on the same
     * page do not produce duplicate IDs.
     */
    instanceId?: string;
    title?: string | undefined;
    onclose?: (() => void) | undefined;
    children: Snippet;
  };
</script>

<script lang="ts">
  import { X } from '@lostgradient/cinder/icons';

  let { instanceId = 'artifact', title, onclose, children }: ArtifactPanelProps = $props();

  const titleId = $derived(`${instanceId}-panel-title`);

  /**
   * Take focus on open, and give it back on close.
   *
   * The taking half is deliberate: a keyboard user who opens the panel should
   * land inside it rather than being left behind in the transcript. The giving
   * half was missing, and the asymmetry is the whole bug — a component that
   * moves focus owes a restore, or closing drops the user on `<body>`, where the
   * next Tab restarts at the top of the document and a screen reader says
   * nothing. Reproduced identically in Chromium, Firefox, and WebKit, so this
   * was never an engine quirk.
   *
   * `isConnected` is checked because restoring to a detached node is a silent
   * no-op: `.focus()` succeeds, focus stays on `<body>`, and the bug is back
   * with no signal. Stated rather than papered over — if a consumer's close ALSO
   * removes the control that opened the panel, this restores nothing, because by
   * teardown the panel has no surviving element of its own to offer either. That
   * consumer has to manage focus itself, the same way `createFocusTrap`'s
   * `restoreFallback` exists for exactly that case. The common path, where the
   * message row outlives the panel, is what this fixes.
   *
   * This is `role="complementary"`, not a dialog: nothing here traps focus, and
   * nothing should. The contract is only "return it where you found it".
   */
  function focusOnMount(element: HTMLButtonElement) {
    const previous = document.activeElement;
    element.focus();

    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }
</script>

<div class="artifact-panel" role="complementary" aria-label={title ?? 'Artifact panel'}>
  <div class="artifact-panel-header">
    <span class="artifact-panel-title" id={titleId}>
      {title ?? 'Artifact'}
    </span>

    <button
      type="button"
      class="artifact-panel-close"
      onclick={onclose}
      aria-label="Close artifact panel"
      {@attach focusOnMount}
    >
      <X class="cinder-icon-sm" />
    </button>
  </div>

  <div class="artifact-panel-content">
    {@render children()}
  </div>
</div>

<style>
  .artifact-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-inline-start: 1px solid var(--cinder-border);
    background: var(--cinder-surface);
    min-width: 0;
    overflow: hidden;
  }

  .artifact-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--cinder-space-3) var(--cinder-space-4);
    border-bottom: 1px solid var(--cinder-border-muted);
    flex-shrink: 0;
    gap: var(--cinder-space-2);
  }

  .artifact-panel-title {
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-default);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .artifact-panel-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--cinder-touch-target-min);
    height: var(--cinder-touch-target-min);
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .artifact-panel-close:hover {
      background: var(--cinder-surface-hover);
      color: var(--cinder-text-default);
    }
  }

  /* Close button sits in the panel corner; an outset ring would overhang the
     panel edge, so paint an INSET ring (Strategy B-inset). */
  .artifact-panel-close:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-artifact-panel-close-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    .artifact-panel-close:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  .artifact-panel-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
