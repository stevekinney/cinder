<script lang="ts" module>
  import type { IconComponent } from './types.js';

  export type BlockType = 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'blockquote';

  export type BlockTypeOption = {
    type: BlockType;
    label: string;
    icon: IconComponent;
  };

  export type ToolbarDropdownProps = {
    /** Unique ID for accessibility */
    id: string;
    /** Currently selected block type */
    value: BlockType;
    /** Available block type options */
    options: BlockTypeOption[];
    /** Whether the dropdown is disabled */
    disabled?: boolean;
    /** Callback when selection changes */
    onchange?: (type: BlockType) => void;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import { ChevronDown, Check } from '../../icons/index.ts';
  import Dropdown from '../../dropdown.svelte';
  import DropdownTrigger from '../../dropdown-trigger.svelte';
  import DropdownMenu from '../../dropdown-menu.svelte';
  import DropdownItem from '../../dropdown-item.svelte';

  let {
    id,
    value,
    options,
    disabled = false,
    onchange,
    class: className,
  }: ToolbarDropdownProps = $props();

  const currentOption = $derived(options.find((opt) => opt.type === value) ?? options[0]);

  function handleSelect(type: BlockType) {
    onchange?.(type);
  }
</script>

<Dropdown {id}>
  <DropdownTrigger
    class={classNames('toolbar-dropdown-trigger', className)}
    {disabled}
    aria-label={`Block type: ${currentOption?.label ?? 'Paragraph'}`}
  >
    {#if currentOption}
      <currentOption.icon class="icon-sm" />
    {/if}
    <span class="toolbar-dropdown-label">{currentOption?.label ?? 'Paragraph'}</span>
    <ChevronDown class="icon-xs toolbar-dropdown-chevron" />
  </DropdownTrigger>
  <DropdownMenu>
    {#each options as option (option.type)}
      {@const isActive = option.type === value}
      <DropdownItem
        onclick={() => handleSelect(option.type)}
        data-active={isActive ? '' : undefined}
      >
        <option.icon class="icon-sm" />
        <span class="dropdown-item-label">{option.label}</span>
        {#if isActive}
          <Check class="icon-sm dropdown-item-check" />
        {/if}
      </DropdownItem>
    {/each}
  </DropdownMenu>
</Dropdown>

<style>
  :global(.toolbar-dropdown-trigger) {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
    height: 1.75rem;
    padding: 0 var(--cinder-space-1-5);
    border: none;
    border-radius: var(--cinder-radius-sm);
    background: transparent;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    cursor: pointer;
    transition:
      background-color var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  :global(.toolbar-dropdown-trigger:hover:not(:disabled)) {
    background: var(--cinder-surface-hover);
    color: var(--cinder-text);
  }

  :global(.toolbar-dropdown-trigger:focus-visible) {
    outline: 2px solid transparent;
    box-shadow:
      0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
      0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--cinder-ring-color);
  }

  :global(.toolbar-dropdown-trigger:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .toolbar-dropdown-label {
    min-width: 4rem;
    text-align: left;
  }

  :global(.toolbar-dropdown-chevron) {
    opacity: 0.6;
    flex-shrink: 0;
  }

  .dropdown-item-label {
    flex: 1;
  }

  :global(.dropdown-item-check) {
    color: var(--cinder-accent);
    flex-shrink: 0;
    margin-inline-start: auto;
  }
</style>
