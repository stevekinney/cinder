<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import type { Ctx } from '@milkdown/kit/ctx';
  import type { ActiveMarks, ActiveBlockType } from '../../../editor/index.ts';

  export type EditorToolbarProps = Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'class'> & {
    /** Required unique ID for accessibility */
    id: string;
    /** ID of the editor element this toolbar controls (for aria-controls) */
    editorId?: string;
    /** Milkdown editor context for command execution */
    editorContext: Ctx | null;
    /** Current active marks at selection */
    activeMarks: ActiveMarks;
    /** Current block type at selection */
    activeBlockType: ActiveBlockType;
    /** Whether undo is available */
    canUndo?: boolean;
    /** Whether redo is available */
    canRedo?: boolean;
    /** Whether the toolbar is disabled */
    disabled?: boolean;
    /** Callback to open link popover, receives the triggering button element */
    onLinkClick?: (triggerElement: HTMLElement) => void;
    /** Whether the link dialog is currently open */
    linkPopoverOpen?: boolean;
    /** Callback for undo button click */
    onUndo?: () => void;
    /** Callback for redo button click */
    onRedo?: () => void;
    /** Additional controls to render at the end of the toolbar */
    actions?: Snippet | undefined;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { classNames } from '../../../utilities/class-names.ts';
  import {
    Bold,
    Code,
    Italic,
    LinkIcon,
    List,
    ListOrdered,
    Quote,
    Redo2,
    Strikethrough,
    Undo2,
    Toolbar,
    Popover,
    Button,
    MoreHorizontal,
  } from '@lostgradient/cinder';

  import { getShortcutDisplay } from '../../../editor/index.ts';

  import ToolbarButton from './toolbar-button.svelte';
  import ToolbarSeparator from './toolbar-separator.svelte';
  import ToolbarDropdown from './toolbar-dropdown.svelte';
  import {
    blockTypeOptions,
    createToolbarCommandHandlers,
    resolveCurrentBlockType,
  } from './toolbar-commands.svelte.ts';
  import { ToolbarOverflowController } from './toolbar-overflow-controller.svelte.ts';

  let {
    id,
    editorId,
    editorContext,
    activeMarks,
    activeBlockType,
    canUndo = false,
    canRedo = false,
    disabled = false,
    linkPopoverOpen = false,
    onLinkClick,
    onUndo,
    onRedo,
    actions,
    class: className,
    // Destructure aria-label so it doesn't leak into Toolbar's ...rest spread.
    // EditorToolbar owns its accessible label ("Formatting toolbar"); consumer
    // overrides are intentionally ignored here.
    'aria-label': _ariaLabel,
    ...rest
  }: EditorToolbarProps = $props();

  let formattingPopoverOpen = $state(false);

  const toolbarInstanceId = $props.id();
  let leadingElement = $state<HTMLDivElement | null>(null);
  let triggerGhostElement = $state<HTMLDivElement | null>(null);
  let trailingElement = $state<HTMLDivElement | null>(null);
  let actionsMeasureElement = $state<HTMLDivElement | null>(null);
  let textFormattingChunkElement = $state<HTMLDivElement | null>(null);
  let linksChunkElement = $state<HTMLDivElement | null>(null);
  let listsChunkElement = $state<HTMLDivElement | null>(null);
  let blockOperationsChunkElement = $state<HTMLDivElement | null>(null);

  const overflowController = new ToolbarOverflowController(toolbarInstanceId, () => ({
    leading: leadingElement,
    trailing: trailingElement,
    triggerGhost: triggerGhostElement,
    actionsMeasure: actionsMeasureElement,
    groups: {
      leading: leadingElement,
      'text-formatting': textFormattingChunkElement,
      links: linksChunkElement,
      lists: listsChunkElement,
      'block-operations': blockOperationsChunkElement,
    },
  }));
  const overflowGroupIds = $derived(overflowController.overflowGroupIds);

  $effect(() => {
    const element = leadingElement;
    return untrack(() => overflowController.setLeadingElement(element));
  });
  $effect(() => {
    const element = actionsMeasureElement;
    const hasActions = actions !== undefined;
    return untrack(() => overflowController.setActionsElement(element, hasActions));
  });
  $effect(() => {
    if (overflowGroupIds.length === 0) formattingPopoverOpen = false;
  });

  function isOverflowing(groupId: string): boolean {
    return overflowGroupIds.includes(groupId);
  }

  function toolbarOverflowSetup(node: HTMLElement) {
    // Measurements update the groups' reactive refs. They must not recreate
    // the observer during delivery; the effects own changing measurer elements.
    return untrack(() => overflowController.attach(node));
  }

  const {
    handleBold,
    handleItalic,
    handleCode,
    handleStrikethrough,
    handleLink,
    handleBulletList,
    handleOrderedList,
    handleBlockquote,
    handleBlockTypeChange,
  } = createToolbarCommandHandlers(
    () => editorContext,
    () => (formattingPopoverOpen = false),
    () => onLinkClick,
  );
  const currentBlockType = $derived(resolveCurrentBlockType(activeBlockType));
</script>

{#snippet leadingChunk()}
  <div
    class="toolbar-leading"
    data-toolbar-flex-group-id="leading"
    data-toolbar-instance-id={toolbarInstanceId}
    bind:this={leadingElement}
  >
    <div class="toolbar-group" role="group" aria-label="History">
      <ToolbarButton
        icon={Undo2}
        label="Undo"
        shortcut={getShortcutDisplay('Mod-z')}
        disabled={disabled || !canUndo}
        onclick={() => onUndo?.()}
        data-testid="toolbar-undo"
      />
      <ToolbarButton
        icon={Redo2}
        label="Redo"
        shortcut={getShortcutDisplay('Mod-Shift-z')}
        disabled={disabled || !canRedo}
        onclick={() => onRedo?.()}
        data-testid="toolbar-redo"
      />
    </div>

    <ToolbarSeparator />

    <!-- Block type dropdown -->
    <div class="toolbar-group" role="group" aria-label="Block type">
      <ToolbarDropdown
        id={`${id}-block-type`}
        value={currentBlockType}
        options={blockTypeOptions}
        {disabled}
        onchange={handleBlockTypeChange}
      />
    </div>
  </div>
{/snippet}

{#snippet textFormattingChunk()}
  <div
    class="toolbar-chunk"
    data-toolbar-flex-group-id="text-formatting"
    data-toolbar-instance-id={toolbarInstanceId}
    bind:this={textFormattingChunkElement}
  >
    <ToolbarSeparator />
    <div class="toolbar-group" role="group" aria-label="Text formatting">
      <ToolbarButton
        icon={Bold}
        label="Bold"
        shortcut={getShortcutDisplay('Mod-b')}
        toggle
        pressed={activeMarks.bold}
        {disabled}
        onclick={handleBold}
        data-testid="toolbar-bold"
      />
      <ToolbarButton
        icon={Italic}
        label="Italic"
        shortcut={getShortcutDisplay('Mod-i')}
        toggle
        pressed={activeMarks.italic}
        {disabled}
        onclick={handleItalic}
        data-testid="toolbar-italic"
      />
      <ToolbarButton
        icon={Code}
        label="Inline Code"
        shortcut={getShortcutDisplay('Mod-e')}
        toggle
        pressed={activeMarks.code}
        {disabled}
        onclick={handleCode}
        data-testid="toolbar-code"
      />
      <ToolbarButton
        icon={Strikethrough}
        label="Strikethrough"
        shortcut={getShortcutDisplay('Mod-Shift-s')}
        toggle
        pressed={activeMarks.strikethrough}
        {disabled}
        onclick={handleStrikethrough}
        data-testid="toolbar-strikethrough"
      />
    </div>
  </div>
{/snippet}

{#snippet linksChunk()}
  <div
    class="toolbar-chunk"
    data-toolbar-flex-group-id="links"
    data-toolbar-instance-id={toolbarInstanceId}
    bind:this={linksChunkElement}
  >
    <ToolbarSeparator />
    <div class="toolbar-group" role="group" aria-label="Links">
      <ToolbarButton
        icon={LinkIcon}
        label="Insert Link"
        shortcut={getShortcutDisplay('Mod-k')}
        aria-haspopup="dialog"
        aria-expanded={linkPopoverOpen}
        {disabled}
        onclick={handleLink}
        data-testid="toolbar-link"
      />
    </div>
  </div>
{/snippet}

{#snippet listsChunk()}
  <div
    class="toolbar-chunk"
    data-toolbar-flex-group-id="lists"
    data-toolbar-instance-id={toolbarInstanceId}
    bind:this={listsChunkElement}
  >
    <ToolbarSeparator />
    <div class="toolbar-group" role="group" aria-label="Lists">
      <ToolbarButton
        icon={List}
        label="Bullet List"
        shortcut={getShortcutDisplay('Mod-Shift-8')}
        toggle
        pressed={activeBlockType.type === 'listItem' && activeBlockType.listType === 'bullet'}
        {disabled}
        onclick={handleBulletList}
        data-testid="toolbar-bullet-list"
      />
      <ToolbarButton
        icon={ListOrdered}
        label="Ordered List"
        shortcut={getShortcutDisplay('Mod-Shift-7')}
        toggle
        pressed={activeBlockType.type === 'listItem' && activeBlockType.listType === 'ordered'}
        {disabled}
        onclick={handleOrderedList}
        data-testid="toolbar-ordered-list"
      />
    </div>
  </div>
{/snippet}

{#snippet blockOperationsChunk()}
  <div
    class="toolbar-chunk"
    data-toolbar-flex-group-id="block-operations"
    data-toolbar-instance-id={toolbarInstanceId}
    bind:this={blockOperationsChunkElement}
  >
    <ToolbarSeparator />
    <div class="toolbar-group" role="group" aria-label="Block operations">
      <ToolbarButton
        icon={Quote}
        label="Blockquote"
        shortcut={getShortcutDisplay('Mod-Shift-9')}
        toggle
        pressed={activeBlockType.type === 'blockquote'}
        {disabled}
        onclick={handleBlockquote}
        data-testid="toolbar-blockquote"
      />
    </div>
  </div>
{/snippet}

<Toolbar
  {id}
  aria-label="Formatting toolbar"
  aria-controls={editorId}
  aria-disabled={disabled || undefined}
  tabindex={disabled ? 0 : undefined}
  class={classNames('editor-toolbar', className)}
  {@attach toolbarOverflowSetup}
  {...rest as Record<string, unknown>}
>
  <!-- Undo/Redo + Block type participate in the same priority overflow as
       the formatting groups, so narrow host rows keep every action reachable
       through the shared More formatting popover instead of clipping them. -->
  {#if !isOverflowing('leading')}
    {@render leadingChunk()}
  {/if}

  <!-- Flexible groups render inline, in priority order, for as long as
       `computeToolbarOverflow` says they fit. Each keeps its own
       `role="group"`/`aria-label` and leading separator whether it renders
       here or inside the popover below -- same snippet, different slot. -->
  {#if !isOverflowing('text-formatting')}
    {@render textFormattingChunk()}
  {/if}
  {#if !isOverflowing('links')}
    {@render linksChunk()}
  {/if}
  {#if !isOverflowing('lists')}
    {@render listsChunk()}
  {/if}
  {#if !isOverflowing('block-operations')}
    {@render blockOperationsChunk()}
  {/if}

  {#if overflowGroupIds.length > 0}
    <Popover
      bind:open={formattingPopoverOpen}
      label="More formatting"
      placement="bottom-start"
      focusManagement="panel"
    >
      {#snippet trigger()}
        <Button
          variant="ghost"
          size="sm"
          aria-label="More formatting"
          data-toolbar-instance-id={toolbarInstanceId}
          iconOnly
          {disabled}
          onclick={() => (formattingPopoverOpen = !formattingPopoverOpen)}
        >
          <MoreHorizontal class="cinder-icon-sm" />
        </Button>
      {/snippet}
      <div class="toolbar-overflow" role="group" aria-label="Additional formatting">
        {#if isOverflowing('leading')}
          {@render leadingChunk()}
        {/if}
        {#if isOverflowing('text-formatting')}
          {@render textFormattingChunk()}
        {/if}
        {#if isOverflowing('links')}
          {@render linksChunk()}
        {/if}
        {#if isOverflowing('lists')}
          {@render listsChunk()}
        {/if}
        {#if isOverflowing('block-operations')}
          {@render blockOperationsChunk()}
        {/if}
      </div>
    </Popover>
  {/if}

  <div class="toolbar-trigger-ghost" aria-hidden="true" inert bind:this={triggerGhostElement}>
    <Button variant="ghost" size="sm" iconOnly disabled label="More formatting">
      <MoreHorizontal class="cinder-icon-sm" />
    </Button>
  </div>

  {#if actions}
    <div class="toolbar-trailing" bind:this={trailingElement}>
      <div class="toolbar-actions-measure" bind:this={actionsMeasureElement}>
        {@render actions()}
      </div>
    </div>
  {/if}
</Toolbar>

<style>
  /*
   * `.editor-toolbar` is applied to the <Toolbar> child component's rendered
   * element, so it carries Toolbar's scope hash — not this component's. A
   * plain scoped selector here would be rewritten with this file's hash and
   * never match. `:global()` is required to cross that boundary. The class is
   * component-specific (only EditorToolbar emits `editor-toolbar`), so this is
   * not a true global leak. When embedded in markdown-editor, the wrapper
   * deliberately strips this chrome (see markdown-editor.svelte); these rules
   * give standalone EditorToolbar its surface and disabled-state styling.
   */
  :global(.editor-toolbar) {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    padding: var(--cinder-space-1) var(--cinder-space-2);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    /*
     * The primary overflow response is the computed priority-plus split in
     * <script> (see `toolbarOverflowSetup`/`computeToolbarOverflow`), which
     * relocates whole groups into the "More formatting" popover once they
     * stop fitting. `nowrap`/`overflow-x: auto` stay as the fallback for
     * the window before the first `ResizeObserver` measurement lands (SSR,
     * pre-mount) and as a safety net against any measurement imprecision.
     * `position: relative` gives `.toolbar-trigger-ghost` a containing
     * block to measure against without leaking into page layout.
     */
    position: relative;
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  :global(.editor-toolbar[aria-disabled='true']) {
    opacity: 0.6;
    pointer-events: none;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-0-5);
  }

  .toolbar-leading,
  .toolbar-chunk {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
  }

  .toolbar-overflow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--cinder-space-1);
    min-width: min(14rem, calc(100vw - var(--cinder-space-4)));
    max-inline-size: calc(100vw - var(--cinder-space-4));
  }

  .toolbar-trailing {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
    min-width: var(--cinder-space-2);
  }

  .toolbar-actions-measure {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
  }

  .toolbar-trigger-ghost {
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    visibility: hidden;
    pointer-events: none;
  }
</style>
