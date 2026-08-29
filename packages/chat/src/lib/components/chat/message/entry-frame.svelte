<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Collapsible } from '@lostgradient/cinder';

  let {
    id,
    label,
    labelClass,
    status,
    triggerClass,
    busy = false,
    open = $bindable(false),
    disabled = false,
    onToggle,
    children,
  }: {
    id: string;
    label: string;
    labelClass?: string | undefined;
    status?: string | undefined;
    triggerClass?: string | undefined;
    busy?: boolean;
    open?: boolean;
    disabled?: boolean;
    onToggle?: ((open: boolean) => void) | undefined;
    children: Snippet;
  } = $props();
</script>

<Collapsible
  idBase={id}
  trigger={`${busy ? '● ' : ''}${label}${status ? ` · ${status}` : ''}`}
  {open}
  {disabled}
  onToggle={(nextOpen) => onToggle?.(nextOpen)}
  class={`chat-entry-frame${labelClass ? ` ${labelClass}` : ''}`}
  animated={false}
  {...triggerClass ? { triggerClass } : {}}
  triggerAriaLabel={({ open: expanded }) => `${expanded ? 'Collapse' : 'Expand'} ${label}`}
>
  {@render children()}
</Collapsible>
