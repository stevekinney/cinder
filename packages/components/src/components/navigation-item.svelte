<script lang="ts" module>
  import type { Snippet } from 'svelte';

  type CommonArm = {
    active?: boolean;
    disabled?: boolean;
    class?: string;
    /** Controls stacked layout on mobile. Emitted as data-variant. Default 'horizontal'. */
    variant?: 'horizontal' | 'mobile';
    children: Snippet;
  };

  type LinkArm = CommonArm & { href: string };
  type ButtonArm = CommonArm & { onClick: (event: MouseEvent) => void };

  /** Props for the NavigationItem component. Pass `href` for a link, `onClick` for a button. */
  export type NavigationItemProps = LinkArm | ButtonArm;
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  const props: NavigationItemProps = $props();

  const isLink = $derived('href' in props);

  const resolvedClass = $derived(classNames('cinder-navigation-item', props.class));
  const active = $derived(props.active ?? false);
  const disabled = $derived(props.disabled ?? false);
  const variant = $derived(props.variant ?? 'horizontal');

  function handleClick(event: MouseEvent): void {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (!isLink) {
      (props as { onClick: (event: MouseEvent) => void }).onClick(event);
    }
  }
</script>

{#if isLink}
  <a
    href={(props as LinkArm).href}
    class={resolvedClass}
    aria-current={active ? 'page' : undefined}
    aria-disabled={disabled ? true : undefined}
    data-active={active}
    data-variant={variant}
    onclick={handleClick}
  >
    {@render props.children()}
  </a>
{:else}
  <button
    type="button"
    class={resolvedClass}
    aria-current={active ? 'true' : undefined}
    aria-disabled={disabled ? true : undefined}
    data-active={active}
    data-variant={variant}
    onclick={handleClick}
  >
    {@render props.children()}
  </button>
{/if}
