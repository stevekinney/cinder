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

  function isFlexGroupId(value: string | undefined): value is FlexGroupId {
    return value !== undefined && (flexGroupOrder as readonly string[]).includes(value);
  }

  // DOM refs used only for measurement inside the `{@attach}` below -- not
  // read from the template, only from imperative code. `$state` is still
  // required here (not just for `toolbar.svelte`-style plain `let`
  // bindings): several of these sit behind conditional (`{#if}`/snippet)
  // rendering, and Svelte's compiler flags a plain, non-`$state`
  // `bind:this` target on conditional markup as unsafe to update.
  let leadingElement = $state<HTMLDivElement | null>(null);
  let triggerGhostElement = $state<HTMLDivElement | null>(null);
  let trailingElement = $state<HTMLDivElement | null>(null);
  let actionsMeasureElement = $state<HTMLDivElement | null>(null);
  let textFormattingChunkElement = $state<HTMLDivElement | null>(null);
  let linksChunkElement = $state<HTMLDivElement | null>(null);
  let listsChunkElement = $state<HTMLDivElement | null>(null);
  let blockOperationsChunkElement = $state<HTMLDivElement | null>(null);

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

  // Real measurements, filled in by `toolbarOverflowSetup` below.
  //
  // `containerWidth` is `null` until the first `ResizeObserver` entry
  // lands -- see `computeToolbarOverflow`'s doc comment for why `null` (not
  // `0`) is the "unmeasured" sentinel: a real toolbar can legitimately
  // measure to 0 or less room once the leading cluster and reserved
  // trailing space are subtracted, and that must be handled as "no room,"
  // not misread as "not measured yet."
  //
  // `leadingWidth` is kept live (re-measured whenever the leading cluster's
  // own box changes) because it contains `ToolbarDropdown`, whose label
  // ("Paragraph" vs. "Heading 1") changes width with the active block type
  // -- a stale one-time measurement would silently drift out of sync with
  // reality. `triggerGhostWidth` and per-group `flexGroupWidths` are
  // measured once: the trigger is a fixed-size icon-only button and each
  // group's buttons/labels never change size.
  let containerWidth = $state<number | null>(null);
  let leadingWidth = $state(0);
  let gapPx = $state(0);
  let triggerGhostWidth = $state(0);
  let actionsReservedWidth = $state(0);
  let flexGroupWidths = $state<Record<FlexGroupId, number>>({
    'text-formatting': 0,
    links: 0,
    lists: 0,
    'block-operations': 0,
  });

  // If `actions` becomes absent (rare, but it's a consumer-supplied
  // optional snippet), release the space that had been reserved for it.
  $effect(() => {
    if (!actions) actionsReservedWidth = 0;
  });

  const rawOverflowGroupIds = $derived(
    computeToolbarOverflow({
      availableWidth:
        containerWidth === null ? null : containerWidth - leadingWidth - actionsReservedWidth,
      gap: gapPx,
      triggerWidth: triggerGhostWidth,
      groups: flexGroupOrder.map((groupId) => ({ id: groupId, width: flexGroupWidths[groupId] })),
    }).overflowGroupIds,
  );

  // Focus preservation (finding 5): whichever side (inline row vs. popover)
  // a group is on at the moment it receives focus is frozen until focus
  // leaves it, regardless of what the fit calculation recomputes to in the
  // meantime. Relocating a group -- either direction -- unmounts its
  // buttons from one render site and mounts new ones at the other, which
  // drops focus to <body>; that's true whether a resize would move a
  // focused inline group into the popover, or would move a focused
  // *popover* group back inline. See markdown-editor.a11y.md for the
  // rationale and the alternative considered.
  let focusedGroupId = $state<FlexGroupId | null>(null);
  let focusedGroupWasOverflowing = $state(false);

  const overflowGroupIds = $derived.by(() => {
    if (focusedGroupId === null) return rawOverflowGroupIds;
    const isOverflowingPerRawCalculation = rawOverflowGroupIds.includes(focusedGroupId);
    if (isOverflowingPerRawCalculation === focusedGroupWasOverflowing) {
      // Raw calculation already agrees with the frozen side; nothing to override.
      return rawOverflowGroupIds;
    }
    return focusedGroupWasOverflowing
      ? // Frozen on the popover side, but raw now says it fits inline -- keep
        // it in the overflow set anyway until focus moves on.
        [...rawOverflowGroupIds, focusedGroupId]
      : // Frozen on the inline side, but raw now says it should overflow --
        // keep it out of the overflow set anyway until focus moves on.
        rawOverflowGroupIds.filter((groupId) => groupId !== focusedGroupId);
  });

  // If a resize grows the toolbar back to the point nothing overflows while
  // the popover happens to be open, close it rather than leaving an empty
  // "Additional formatting" panel behind.
  $effect(() => {
    if (overflowGroupIds.length === 0) formattingPopoverOpen = false;
  });

  function isOverflowing(groupId: FlexGroupId): boolean {
    return overflowGroupIds.includes(groupId);
  }

  function flexGroupIdFromTarget(target: EventTarget | null): FlexGroupId | null {
    if (!(target instanceof HTMLElement)) return null;
    const chunk = target.closest<HTMLElement>('[data-toolbar-flex-group-id]');
    // Bracket access: `DOMStringMap` is an index signature, and this package's
    // tsconfig enables noPropertyAccessFromIndexSignature.
    const value = chunk?.dataset['toolbarFlexGroupId'];
    return isFlexGroupId(value) ? value : null;
  }

  /**
   * `{@attach}` runs client-side only (never during SSR), which is what
   * keeps `ResizeObserver` construction SSR-safe here -- no module-scope or
   * render-time reference to it exists.
   *
   * Thrash guard: the single `ResizeObserver` here watches only elements
   * whose own size changes for reasons unrelated to the overflow decision
   * it feeds -- the `<Toolbar>` root, the leading cluster, and the actions
   * measurer -- never the group elements that move between the inline row
   * and the popover. The toolbar has `overflow-x: auto`, so relocating a
   * group changes what *overflows* inside the root, not the root's own
   * content-box size -- and the root's size is set by its flex parent
   * (`flex: 1 1 0` when nested in `markdown-editor.svelte`, or intrinsic
   * width standalone), not by its children. Likewise, the leading
   * cluster's box only changes when its own content (the block-type label)
   * changes, and the actions measurer's box only changes when consumer
   * content changes -- neither is affected by which flexible groups are
   * currently inline. So none of these observations can be triggered by
   * this component's own writes, and the callback never re-triggers
   * itself.
   */
  function toolbarOverflowSetup(node: HTMLElement) {
    function readGapPx(): number {
      const gap = Number.parseFloat(getComputedStyle(node).columnGap || '0');
      return Number.isFinite(gap) ? gap : 0;
    }

    function measureTrailingReservation(): void {
      if (!actions || !trailingElement) {
        actionsReservedWidth = 0;
        return;
      }
      const trailingMinWidth = Number.parseFloat(getComputedStyle(trailingElement).minWidth || '0');
      const actionsWidth = actionsMeasureElement?.getBoundingClientRect().width ?? 0;
      // One gap between the last inline item (last visible group, or the
      // trigger) and `.toolbar-trailing`; `.toolbar-trailing` itself grows
      // to at least `actionsWidth`, so no second gap is charged between the
      // wrapper and its own content.
      actionsReservedWidth = gapPx + Math.max(trailingMinWidth, actionsWidth);
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

    function handleFocusIn(event: FocusEvent): void {
      const groupId = flexGroupIdFromTarget(event.target);
      if (!groupId) return;
      // Always (re-)snapshot on every focusin within a group, not just the
      // first one: this is also what re-arms the pin when focus moves
      // between two controls in the same group (e.g. Bold -> Italic),
      // keeping `focusedGroupWasOverflowing` accurate rather than stale.
      focusedGroupId = groupId;
      focusedGroupWasOverflowing = rawOverflowGroupIds.includes(groupId);
    }

    function handleFocusOut(event: FocusEvent): void {
      // `relatedTarget` is the element about to receive focus (`null` if
      // focus is leaving the document/window entirely). Only release the
      // pin once focus has actually left this group -- moving focus
      // between two controls inside the same group must not release it.
      // Don't try to pre-set the *new* group's id/snapshot here: the
      // upcoming `focusin` on the new target (which always fires right
      // after `focusout` for a same-document focus move) is the sole place
      // that does that, so there's exactly one snapshot write per
      // group-to-group move instead of two racing writes.
      const nextGroupId = flexGroupIdFromTarget(event.relatedTarget);
      if (nextGroupId !== focusedGroupId) focusedGroupId = null;
    }

    gapPx = readGapPx();
    leadingWidth = leadingElement?.getBoundingClientRect().width ?? 0;
    triggerGhostWidth = triggerGhostElement?.getBoundingClientRect().width ?? 0;
    measureTrailingReservation();
    measureFlexGroupWidths();

    node.addEventListener('focusin', handleFocusIn);
    node.addEventListener('focusout', handleFocusOut);

    const ResizeObserverConstructor =
      node.ownerDocument === document
        ? globalThis.ResizeObserver
        : node.ownerDocument.defaultView?.ResizeObserver;

    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserverConstructor === 'function') {
      observer = new ResizeObserverConstructor((entries) => {
        for (const entry of entries) {
          if (entry.target === node) {
            containerWidth = entry.contentRect.width;
          } else if (entry.target === leadingElement) {
            leadingWidth = entry.contentRect.width;
          } else if (entry.target === actionsMeasureElement) {
            measureTrailingReservation();
          }
        }
        // Widths are static (fixed-size icon buttons; label text never
        // changes), so this only fills in groups that weren't inline yet
        // to measure -- it never re-measures a group that already has a
        // cached width.
        measureFlexGroupWidths();
      });
      observer.observe(node);
      if (leadingElement) observer.observe(leadingElement);
      if (actionsMeasureElement) observer.observe(actionsMeasureElement);
    }

    return () => {
      node.removeEventListener('focusin', handleFocusIn);
      node.removeEventListener('focusout', handleFocusOut);
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
  <div
    class="toolbar-chunk"
    data-toolbar-flex-group-id="text-formatting"
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
  <div class="toolbar-chunk" data-toolbar-flex-group-id="links" bind:this={linksChunkElement}>
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
  <div class="toolbar-chunk" data-toolbar-flex-group-id="lists" bind:this={listsChunkElement}>
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
    <!--
      `.toolbar-trailing` grows to fill the remaining row and pushes its
      content to the end (replacing the old bare spacer). The inner
      `.toolbar-actions-measure` wrapper is intrinsically sized (not
      `flex: 1`), so it can be measured for the width `actions` actually
      needs -- measuring `.toolbar-trailing` itself would just report
      "however much room happened to be left," which is useless for
      reserving space.
    -->
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
    gap: var(--cinder-space-1);
    min-width: 14rem;
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
