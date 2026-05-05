<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { BadgeVariant, BadgeSize } from '../badge.svelte';

  export type FrontMatterHeaderVariant = 'panel' | 'inline';

  export type FrontMatterHeaderProps = Omit<
    HTMLAttributes<HTMLButtonElement>,
    'class' | 'type' | 'onclick' | 'onkeydown'
  > & {
    /** Button id (optional, for aria-describedby or targeting) */
    id?: string;
    /** ID of the controlled content region */
    controlsId?: string;
    /** Header label */
    label?: string;
    /** Whether the section is expanded */
    expanded?: boolean;
    /** Optional badge label */
    badgeLabel?: string | null;
    /** Badge variant */
    badgeVariant?: BadgeVariant;
    /** Badge size */
    badgeSize?: BadgeSize;
    /** Visual variant for header layout */
    variant?: FrontMatterHeaderVariant;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Badge from '../badge.svelte';
  import { ChevronDown, ChevronRight, FileText } from '../icons/index.ts';

  let {
    id,
    controlsId,
    label = 'Front Matter',
    expanded = $bindable(true),
    badgeLabel,
    badgeVariant = 'neutral',
    badgeSize = 'xs',
    variant = 'panel',
    class: className,
    ...rest
  }: FrontMatterHeaderProps = $props();

  const showBadge = $derived(Boolean(badgeLabel));

  function toggleExpanded() {
    expanded = !expanded;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !expanded) {
      event.preventDefault();
      expanded = true;
    } else if (event.key === 'Escape' && expanded && !event.defaultPrevented) {
      event.preventDefault();
      expanded = false;
    }
  }
</script>

<button
  type="button"
  {id}
  class={classNames('front-matter-header', className)}
  data-expanded={expanded ? 'true' : 'false'}
  data-variant={variant}
  aria-expanded={expanded}
  aria-controls={controlsId}
  onclick={toggleExpanded}
  onkeydown={handleKeydown}
  {...rest}
>
  <span class="front-matter-icon">
    {#if expanded}
      <ChevronDown class="icon-sm" />
    {:else}
      <ChevronRight class="icon-sm" />
    {/if}
  </span>
  <FileText class="icon-sm" />
  <span class="front-matter-label">{label}</span>
  {#if showBadge}
    <Badge variant={badgeVariant} size={badgeSize}>{badgeLabel ?? ''}</Badge>
  {/if}
</button>

<style>
  .front-matter-header {
    all: unset;
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    width: 100%;
    padding: var(--cinder-space-2) var(--cinder-space-3);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-muted);
    background: var(--cinder-surface-inset);
    cursor: pointer;
    box-sizing: border-box;
    transition: background var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .front-matter-header[data-variant='panel'] {
    border-radius: var(--cinder-radius-md);
  }

  .front-matter-header[data-variant='panel'][data-expanded='true'] {
    border-radius: var(--cinder-radius-md) var(--cinder-radius-md) 0 0;
  }

  /*
   * Inline variant: align the header to the diff gutter layout.
   * The chevron icon occupies a 2rem slot (matching .diff-gutter width),
   * so "Front Matter" text starts at the same x-position as diff text.
   * No outer horizontal padding — the gutter slot provides the left indent.
   */
  .front-matter-header[data-variant='inline'] {
    padding: var(--cinder-space-1-5) var(--cinder-space-3) var(--cinder-space-1-5) 0;
    gap: var(--cinder-space-2);
  }

  .front-matter-header[data-variant='inline'] .front-matter-icon {
    width: 2rem;
    flex-shrink: 0;
    justify-content: center;
    padding: 0;
  }

  .front-matter-header:hover {
    background: var(--cinder-surface-hover);
  }

  .front-matter-header:focus-visible {
    outline: 2px solid transparent;
    box-shadow:
      0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
      0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--cinder-ring-color);
  }

  .front-matter-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .front-matter-label {
    flex: 1;
    text-align: left;
  }
</style>
