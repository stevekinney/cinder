<script lang="ts" module>
  import type { EditorState } from './json-schema-editor-state.svelte.ts';

  export type JsonSchemaToolbarProps = {
    state: EditorState;
    localValidationErrorCount?: number;
    onUndo?: () => void;
    onRedo?: () => void;
    onRevert?: () => void;
    class?: string;
  };
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import CopyButton from '../copy-button/copy-button.svelte';

  let {
    state: editorState,
    localValidationErrorCount = 0,
    onUndo,
    onRedo,
    onRevert,
    class: className,
  }: JsonSchemaToolbarProps = $props();

  const validationBadgeVariant = $derived.by(() => {
    if (localValidationErrorCount > 0) return 'danger' as const;
    switch (editorState.validationStatus) {
      case 'valid':
        return 'success' as const;
      case 'invalid':
        return 'danger' as const;
      case 'pending':
        return 'neutral' as const;
    }
  });

  const validationBadgeText = $derived.by(() => {
    if (localValidationErrorCount > 0) {
      return `Invalid — ${localValidationErrorCount} field ${localValidationErrorCount === 1 ? 'error' : 'errors'}`;
    }
    switch (editorState.validationStatus) {
      case 'valid':
        return `Valid (${editorState.activeDraft})`;
      case 'invalid':
        return `Invalid${editorState.validationResult.errors.length > 0 ? ` — ${editorState.validationResult.errors.length} errors` : ''}`;
      case 'pending':
        return 'Validating…';
    }
  });

  // ---- Roving tabindex ----
  let toolbarRightElement: HTMLDivElement | undefined = $state();
  let rovingIndex = $state(0);

  /** Return the currently enabled action buttons inside the right toolbar slot. */
  function getActionButtons(): HTMLButtonElement[] {
    if (!toolbarRightElement) return [];
    return Array.from(
      toolbarRightElement.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    );
  }

  /**
   * Apply roving tabindex: exactly one enabled button gets tabindex=0, all
   * others get tabindex=-1. When the current rovingIndex goes out of range
   * (e.g. the previously-roved button becomes disabled), reset to the first
   * enabled action and move DOM focus there only if focus was inside the
   * toolbar.
   */
  $effect(() => {
    // Read each state field that can change which actions are enabled directly.
    // Getters on the `editorState` prop track correctly because they read the
    // closure's $state internally — no signature-string or `void` workaround is
    // needed. The reads must stay in the reactive scope so the effect re-runs
    // when participation changes.
    void editorState.canUndo;
    void editorState.canRedo;
    void editorState.hasChanges;
    void editorState.readonly;
    void editorState.copyValue;
    // Track `rovingIndex` too so a keydown/focusin handler moving the roved
    // button re-applies the DOM tabindex on the next flush.
    const currentRovingIndex = rovingIndex;

    const buttons = getActionButtons();
    if (buttons.length === 0) {
      // No enabled actions: nothing to rove. Reset the index so a future
      // re-enable starts from the first action rather than a stale offset.
      // Write untracked: the effect already depends on `rovingIndex`, so an
      // untracked write avoids re-triggering itself purely from its own reset.
      untrack(() => {
        rovingIndex = 0;
      });
      return;
    }

    // Clamp the roving index to the current participant count.
    let activeIndex = currentRovingIndex;
    if (activeIndex >= buttons.length) {
      const wasFocusedInsideToolbar =
        toolbarRightElement?.contains(document.activeElement) ?? false;
      activeIndex = 0;
      untrack(() => {
        rovingIndex = 0;
      });
      if (wasFocusedInsideToolbar) {
        buttons[0]?.focus();
      }
    }

    for (let index = 0; index < buttons.length; index += 1) {
      const button = buttons[index];
      if (button) {
        button.tabIndex = index === activeIndex ? 0 : -1;
      }
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    const buttons = getActionButtons();
    if (buttons.length === 0) return;

    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    if (currentIndex === -1) return;

    const nextIndex = handleRovingKeydown(event, currentIndex, buttons.length, {
      isDisabled: () => false, // already filtered to enabled buttons only
      vertical: true,
      horizontal: true,
    });

    if (nextIndex !== null && nextIndex !== currentIndex) {
      event.preventDefault();
      rovingIndex = nextIndex;
      buttons[nextIndex]?.focus();
    }
  }

  function handleRightFocusin(event: FocusEvent) {
    const buttons = getActionButtons();
    const index = buttons.findIndex((button) => button === event.target);
    if (index !== -1) {
      rovingIndex = index;
    }
  }
</script>

<div
  class={classNames('cinder-jse-toolbar', className)}
  role="toolbar"
  tabindex="-1"
  aria-label="Schema editor actions"
  onkeydown={handleKeydown}
>
  <div class="cinder-jse-toolbar__left">
    <Badge variant={validationBadgeVariant}>{validationBadgeText}</Badge>
    {#if editorState.validationResult.compileError}
      <Badge variant="warning" title={editorState.validationResult.compileError}
        >Compile warning</Badge
      >
    {/if}
  </div>

  <div
    bind:this={toolbarRightElement}
    class="cinder-jse-toolbar__right"
    onfocusin={handleRightFocusin}
  >
    <Button
      variant="ghost"
      size="sm"
      disabled={!editorState.canUndo || editorState.readonly}
      onclick={() => onUndo?.()}
    >
      Undo
    </Button>
    <Button
      variant="ghost"
      size="sm"
      disabled={!editorState.canRedo || editorState.readonly}
      onclick={() => onRedo?.()}
    >
      Redo
    </Button>
    <CopyButton value={editorState.copyValue}>
      {#snippet children()}Copy JSON{/snippet}
      {#snippet confirmation()}Copied{/snippet}
    </CopyButton>
    <Button
      variant="secondary"
      size="sm"
      disabled={!editorState.hasChanges || editorState.readonly}
      onclick={() => onRevert?.()}
    >
      Revert
    </Button>
  </div>
</div>
