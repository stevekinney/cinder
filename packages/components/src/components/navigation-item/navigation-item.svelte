<script lang="ts" module>
  export type { NavigationItemProps } from './navigation-item.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { LinkArm, NavigationItemProps } from './navigation-item.types.ts';

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
    if (isLink) {
      // Link arm: forward to consumer onclick if provided. The consumer
      // decides whether to preventDefault — useful for SPA navigation that
      // wants modified clicks (cmd/ctrl/shift/alt, middle-click) to fall
      // through to native browser behavior.
      const linkOnclick = (props as LinkArm).onclick;
      linkOnclick?.(event);
      return;
    }
    (props as { onclick: (event: MouseEvent) => void }).onclick(event);
  }
</script>

{#if isLink}
  <a
    href={(props as LinkArm).href}
    class={resolvedClass}
    aria-current={active ? 'page' : undefined}
    aria-disabled={disabled ? true : undefined}
    data-active={active}
    data-cinder-navigation-item
    data-variant={variant}
    onclick={handleClick}
  >
    {@render props.children()}
  </a>
{:else}
  <button
    type="button"
    class={resolvedClass}
    aria-current={active ? 'page' : undefined}
    aria-disabled={disabled ? true : undefined}
    data-active={active}
    data-cinder-navigation-item
    data-variant={variant}
    onclick={handleClick}
  >
    {@render props.children()}
  </button>
{/if}
