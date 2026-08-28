<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import type { Ctx } from '@milkdown/kit/ctx';
  import type { ActiveMarks, ActiveBlockType } from '../../../editor/component-runtime.ts';

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
    actions?: Snippet;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import {
    Bold,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    Link,
    List,
    ListOrdered,
    Pilcrow,
    Quote,
    Redo2,
    Strikethrough,
    Undo2,
  } from '@lostgradient/cinder/icons';

  import {
    toggleBold,
    toggleItalic,
    toggleCode,
    toggleStrikethrough,
    toggleBulletList,
    toggleOrderedList,
    toggleBlockquote,
    setHeading,
    setParagraph,
    getShortcutDisplay,
  } from '../../../editor/component-runtime.ts';

  import Toolbar from '@lostgradient/cinder/toolbar';
  import Popover from '@lostgradient/cinder/popover';
  import Button from '@lostgradient/cinder/button';
  import { MoreHorizontal } from '@lostgradient/cinder/icons';
  import ToolbarButton from './toolbar-button.svelte';
  import ToolbarSeparator from './toolbar-separator.svelte';
  import ToolbarDropdown, { type BlockType, type BlockTypeOption } from './toolbar-dropdown.svelte';
  import { computeToolbarOverflow } from './toolbar-overflow.ts';

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

  // --- Priority-plus overflow ------------------------------------------
  //
  // `computeToolbarOverflow` (toolbar-overflow.ts) is the actual decision
  // logic and is unit-tested directly. Everything below just feeds it real
  // measurements: which of the four flexible groups (Text formatting,
  // Links, Lists, Block operations) fit next to the always-visible History
  // + Block type cluster, given the toolbar's current width.

  type FlexGroupId = 'text-formatting' | 'links' | 'lists' | 'block-operations';

  const flexGroupOrder: readonly FlexGroupId[] = [
    'text-formatting',
    'links',
    'lists',
    'block-operations',
  ];

  // DOM refs used only for one-time-per-group width measurement inside the
  // `{@attach}` below -- not read reactively from the template, so plain
  // `let` bindings (not `$state`) are correct here, matching how
  // `toolbar.svelte` holds its own `rootElement`.
  let leadingElement: HTMLDivElement | null = null;
  let triggerGhostElement: HTMLDivElement | null = null;
  let textFormattingChunkElement: HTMLDivElement | null = null;
  let linksChunkElement: HTMLDivElement | null = null;
  let listsChunkElement: HTMLDivElement | null = null;
  let blockOperationsChunkElement: HTMLDivElement | null = null;

  function chunkElementFor(groupId: FlexGroupId): HTMLDivElement | null {
    switch (groupId) {
      case 'text-formatting':
        return textFormattingChunkElement;
      case 'links':
        return linksChunkElement;
      case 'lists':
        return listsChunkElement;
      case 'block-operations':
        return blockOperationsChunkElement;
    }
  }

  // Real measurements, filled in by `toolbarOverflowSetup` below. `0` means
  // "not yet measured" for all of these, which is also what
  // `computeToolbarOverflow` treats as "keep everything inline" -- the
  // toolbar's `flex-wrap: nowrap; overflow-x: auto` CSS is the fallback
  // for that window, not the primary layout mechanism.
  let containerWidth = $state(0);
  let leadingWidth = $state(0);
  let triggerReservedWidth = $state(0);
  let flexGroupWidths = $state<Record<FlexGroupId, number>>({
    'text-formatting': 0,
    links: 0,
    lists: 0,
    'block-operations': 0,
  });

  const overflowGroupIds = $derived(
    computeToolbarOverflow({
      availableWidth: containerWidth > 0 ? containerWidth - leadingWidth : 0,
      overflowTriggerWidth: triggerReservedWidth,
      groups: flexGroupOrder.map((groupId) => ({ id: groupId, width: flexGroupWidths[groupId] })),
    }).overflowGroupIds,
  );

  // If a resize grows the toolbar back to the point nothing overflows while
  // the popover happens to be open, close it rather than leaving an empty
  // "Additional formatting" panel behind.
  $effect(() => {
    if (overflowGroupIds.length === 0) formattingPopoverOpen = false;
  });

  function isOverflowing(groupId: FlexGroupId): boolean {
    return overflowGroupIds.includes(groupId);
  }

  /**
   * `{@attach}` runs client-side only (never during SSR), which is what
   * keeps `ResizeObserver` construction SSR-safe here -- no module-scope or
   * render-time reference to it exists.
   *
   * Thrash guard: the observer watches only the `<Toolbar>` root itself,
   * never the group elements that move between the inline row and the
   * popover. The toolbar has `overflow-x: auto`, so relocating a
   * group changes what *overflows* inside the root, not the root's own
   * content-box size -- and the root's size is set by its flex parent
   * (`flex: 1 1 0` when nested in `markdown-editor.svelte`, or intrinsic
   * width standalone), not by its children. So moving a group into or out
   * of the popover never produces a new `ResizeObserverEntry` for the node
   * being observed, and the callback never re-triggers itself.
   */
  function toolbarOverflowSetup(node: HTMLElement) {
    function readGapPx(): number {
      const gap = Number.parseFloat(getComputedStyle(node).columnGap || '0');
      return Number.isFinite(gap) ? gap : 0;
    }

    function measureStaticWidths(): void {
      const gap = readGapPx();
      leadingWidth = (leadingElement?.getBoundingClientRect().width ?? 0) + gap;
      triggerReservedWidth = (triggerGhostElement?.getBoundingClientRect().width ?? 0) + gap;
    }

    function measureFlexGroupWidths(): void {
      let next: Record<FlexGroupId, number> | null = null;
      for (const groupId of flexGroupOrder) {
        if (flexGroupWidths[groupId] !== 0) continue;
        const element = chunkElementFor(groupId);
        if (!element) continue;
        const width = element.getBoundingClientRect().width;
        if (width <= 0) continue;
        next = { ...(next ?? flexGroupWidths), [groupId]: width };
      }
      if (next) flexGroupWidths = next;
    }

    measureStaticWidths();
    measureFlexGroupWidths();

    const ResizeObserverConstructor =
      node.ownerDocument === document
        ? globalThis.ResizeObserver
        : node.ownerDocument.defaultView?.ResizeObserver;

    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserverConstructor === 'function') {
      observer = new ResizeObserverConstructor((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        containerWidth = entry.contentRect.width;
        // Widths are static (fixed-size icon buttons; label text never
        // changes), so this only fills in groups that weren't inline yet
        // to measure -- it never re-measures a group that already has a
        // cached width.
        measureFlexGroupWidths();
      });
      observer.observe(node);
    }

    return () => {
      observer?.disconnect();
      observer = null;
    };
  }

  // Block type options for dropdown
  // Note: codeBlock is omitted until proper toggle command is implemented
  const blockTypeOptions: BlockTypeOption[] = [
    { type: 'paragraph', label: 'Paragraph', icon: Pilcrow },
    { type: 'heading1', label: 'Heading 1', icon: Heading1 },
    { type: 'heading2', label: 'Heading 2', icon: Heading2 },
    { type: 'heading3', label: 'Heading 3', icon: Heading3 },
    { type: 'blockquote', label: 'Quote', icon: Quote },
  ];

  // Map active block type to dropdown value
  const currentBlockType = $derived.by((): BlockType => {
    if (activeBlockType.type === 'heading') {
      switch (activeBlockType.headingLevel) {
        case 1:
          return 'heading1';
        case 2:
          return 'heading2';
        case 3:
          return 'heading3';
        default:
          return 'paragraph';
      }
    }
    if (activeBlockType.type === 'blockquote') return 'blockquote';
    return 'paragraph';
  });

  // Command handlers
  function handleBold() {
    if (editorContext) toggleBold(editorContext);
  }

  function handleItalic() {
    if (editorContext) toggleItalic(editorContext);
  }

  function handleCode() {
    if (editorContext) toggleCode(editorContext);
  }

  function handleStrikethrough() {
    if (editorContext) toggleStrikethrough(editorContext);
  }

  function handleLink(event: MouseEvent) {
    formattingPopoverOpen = false;
    const triggerElement = event.currentTarget;
    if (triggerElement instanceof HTMLElement) {
      onLinkClick?.(triggerElement);
    }
  }

  function handleBulletList() {
    if (editorContext) toggleBulletList(editorContext);
  }

  function handleOrderedList() {
    if (editorContext) toggleOrderedList(editorContext);
  }

  function handleBlockquote() {
    if (editorContext) toggleBlockquote(editorContext);
  }

  function handleBlockTypeChange(type: BlockType) {
    if (!editorContext) return;

    switch (type) {
      case 'paragraph':
        setParagraph(editorContext);
        break;
      case 'heading1':
        setHeading(editorContext, 1);
        break;
      case 'heading2':
        setHeading(editorContext, 2);
        break;
      case 'heading3':
        setHeading(editorContext, 3);
        break;
      case 'blockquote':
        toggleBlockquote(editorContext);
        break;
    }
  }
</script>

<!--
  The Toolbar primitive owns roving tabindex and WAI-ARIA toolbar semantics.
  `aria-controls` is forwarded via the extra-attrs pattern. Toolbar accepts
  `...rest` so aria-controls, data-* and other passthrough attributes reach
  the rendered div. The explicit aria-label is pinned here; any aria-label in
  rest was stripped during $props() destructuring above.

  The `as` cast is required because HTMLAttributes uses `| null | undefined`
  for many attr types while Toolbar's discriminated-union requires `string`
  for aria-label/aria-labelledby. The cast is safe: we control the actual
  values passed at the callsite through EditorToolbarProps.
-->
{#snippet textFormattingChunk()}
  <div class="toolbar-chunk" bind:this={textFormattingChunkElement}>
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
  <div class="toolbar-chunk" bind:this={linksChunkElement}>
    <ToolbarSeparator />
    <div class="toolbar-group" role="group" aria-label="Links">
      <ToolbarButton
        icon={Link}
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
  <div class="toolbar-chunk" bind:this={listsChunkElement}>
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
  <div class="toolbar-chunk" bind:this={blockOperationsChunkElement}>
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
  <!-- Undo/Redo + Block type: always visible, measured together as one
       unit so the flexible groups below know how much room is left. -->
  <div class="toolbar-leading" bind:this={leadingElement}>
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
          iconOnly
          {disabled}
          onclick={() => (formattingPopoverOpen = !formattingPopoverOpen)}
        >
          <MoreHorizontal class="cinder-icon-sm" />
        </Button>
      {/snippet}
      <div class="toolbar-overflow" role="group" aria-label="Additional formatting">
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

  <!--
    Invisible, inert clone of the popover trigger, used only to measure how
    much width to reserve for it. It's laid out (so it has a real size) but
    taken out of flow and hidden, so it never affects visible layout or the
    accessibility tree, and never needs to be toggled in and out of the DOM.
  -->
  <div class="toolbar-trigger-ghost" aria-hidden="true" inert bind:this={triggerGhostElement}>
    <!--
      `label` mirrors the real trigger so the ghost measures the same width.
      Button's type requires an accessible name whenever `iconOnly` is set; the
      name is never exposed here because the wrapper is `aria-hidden` + `inert`.
    -->
    <Button variant="ghost" size="sm" iconOnly disabled label="More formatting">
      <MoreHorizontal class="cinder-icon-sm" />
    </Button>
  </div>

  {#if actions}
    <!-- Spacer pushes actions to the right -->
    <div class="toolbar-spacer"></div>
    {@render actions()}
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
    gap: var(--cinder-space-1);
    min-width: 14rem;
  }

  .toolbar-spacer {
    flex: 1;
    min-width: var(--cinder-space-2);
  }

  .toolbar-trigger-ghost {
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    visibility: hidden;
    pointer-events: none;
  }
</style>
