<script lang="ts" module>
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import type { IconComponent } from './types.js';

  export type ToolbarButtonProps = Omit<HTMLButtonAttributes, 'class'> & {
    /** Icon component to display */
    icon: IconComponent;
    /** Accessible label (required) */
    label: string;
    /** Whether this is a toggle button */
    toggle?: boolean;
    /** Current pressed state (for toggle buttons) */
    pressed?: boolean;
    /** Keyboard shortcut to display in tooltip */
    shortcut?: string;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import Tooltip from '../../tooltip/tooltip.svelte';

  let {
    icon: Icon,
    label,
    toggle = false,
    pressed = false,
    shortcut,
    disabled = false,
    class: className,
    onclick,
    ...rest
  }: ToolbarButtonProps = $props();

  const tooltipLabel = $derived(shortcut ? `${label} (${shortcut})` : label);
</script>

<Tooltip text={tooltipLabel} placement="bottom">
  <button
    type="button"
    class={classNames('toolbar-button', className)}
    aria-label={label}
    aria-pressed={toggle ? pressed : undefined}
    data-active={toggle && pressed ? '' : undefined}
    {disabled}
    {onclick}
    {...rest}
  >
    <Icon class="icon-sm" />
  </button>
</Tooltip>

<style>
  .toolbar-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: var(--cinder-radius-sm);
    background: transparent;
    color: var(--cinder-text-muted);
    cursor: pointer;
    transition:
      background-color var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .toolbar-button:hover:not(:disabled) {
      background: var(--cinder-surface-hover);
      color: var(--cinder-text);
    }
  }

  .toolbar-button:active:not(:disabled) {
    background: var(--cinder-surface-pressed);
  }

  .toolbar-button[data-active] {
    background: var(--cinder-surface-pressed);
    color: var(--cinder-accent-text);
  }

  @media (hover: hover) {
    .toolbar-button[data-active]:hover:not(:disabled) {
      background: var(--cinder-surface-pressed);
      color: var(--cinder-accent-text);
    }
  }

  .toolbar-button:focus-visible {
    outline: 2px solid transparent;
    box-shadow:
      0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
      0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--cinder-ring-color);
  }

  .toolbar-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    color: var(--cinder-text-disabled);
  }

  .toolbar-tooltip {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-2);
  }

  .toolbar-tooltip-keys {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
  }
</style>
