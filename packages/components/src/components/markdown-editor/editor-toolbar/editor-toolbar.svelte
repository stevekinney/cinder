<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import type { Ctx } from '@milkdown/kit/ctx';
  import type { ActiveMarks, ActiveBlockType } from 'cinder/editor/component-runtime';

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
  import Bold from 'lucide-svelte/icons/bold';
  import Code from 'lucide-svelte/icons/code';
  import Heading1 from 'lucide-svelte/icons/heading-1';
  import Heading2 from 'lucide-svelte/icons/heading-2';
  import Heading3 from 'lucide-svelte/icons/heading-3';
  import Italic from 'lucide-svelte/icons/italic';
  import Link from 'lucide-svelte/icons/link';
  import List from 'lucide-svelte/icons/list';
  import ListOrdered from 'lucide-svelte/icons/list-ordered';
  import Pilcrow from 'lucide-svelte/icons/pilcrow';
  import Quote from 'lucide-svelte/icons/quote';
  import Redo2 from 'lucide-svelte/icons/redo-2';
  import Strikethrough from 'lucide-svelte/icons/strikethrough';
  import Undo2 from 'lucide-svelte/icons/undo-2';

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
  } from 'cinder/editor/component-runtime';

  import Toolbar from '../../toolbar/toolbar.svelte';
  import ToolbarButton from './toolbar-button.svelte';
  import ToolbarSeparator from './toolbar-separator.svelte';
  import ToolbarDropdown, { type BlockType, type BlockTypeOption } from './toolbar-dropdown.svelte';

  let {
    id,
    editorId,
    editorContext,
    activeMarks,
    activeBlockType,
    canUndo = false,
    canRedo = false,
    disabled = false,
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
<!-- svelte-ignore ts_invalid_generic_position -->
<Toolbar
  {id}
  aria-label="Formatting toolbar"
  aria-controls={editorId}
  aria-disabled={disabled || undefined}
  class={classNames('editor-toolbar', className)}
  {...rest as Record<string, unknown>}
>
  <!-- Undo/Redo -->
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

  <ToolbarSeparator />

  <!-- Inline formatting -->
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

  <ToolbarSeparator />

  <!-- Link -->
  <div class="toolbar-group" role="group" aria-label="Links">
    <ToolbarButton
      icon={Link}
      label="Insert Link"
      shortcut={getShortcutDisplay('Mod-k')}
      toggle
      pressed={activeMarks.link}
      {disabled}
      onclick={handleLink}
      data-testid="toolbar-link"
    />
  </div>

  <ToolbarSeparator />

  <!-- Lists -->
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

  <ToolbarSeparator />

  <!-- Block operations -->
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

  {#if actions}
    <!-- Spacer pushes actions to the right -->
    <div class="toolbar-spacer"></div>
    {@render actions()}
  {/if}
</Toolbar>

<style>
  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    padding: var(--cinder-space-1) var(--cinder-space-2);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    flex-wrap: wrap;
  }

  .editor-toolbar[aria-disabled='true'] {
    opacity: 0.6;
    pointer-events: none;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-0-5);
  }

  .toolbar-spacer {
    flex: 1;
    min-width: var(--cinder-space-2);
  }
</style>
