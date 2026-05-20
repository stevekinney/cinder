<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  /** Props for the Sidebar component. */
  export type SidebarProps = Omit<
    HTMLAttributes<HTMLElement>,
    'aria-label' | 'aria-labelledby' | 'class' | 'children'
  > & {
    /**
     * Whether the sidebar is collapsed. Bindable via `bind:collapsed`. Default `false`.
     *
     * On desktop (>= md breakpoint) `collapsed=true` switches the sidebar to
     * icon-only mode. Below the md breakpoint the sidebar renders inside a
     * `<Drawer>` and `collapsed=true` means the drawer is closed.
     */
    collapsed?: boolean;
    /**
     * Accessible name for the outer landmark and the mobile drawer. Required —
     * defaults to `'Sidebar'` for convenience but must be unique per page. The
     * inner `<nav>` landmark derives its own accessible name from this value
     * by appending `' navigation'` so screen readers can distinguish the
     * outer complementary region from the inner navigation region.
     */
    ariaLabel?: string;
    /** Additional CSS class merged with `.cinder-sidebar`. */
    class?: string;
    /** Optional branding region rendered above the navigation. */
    brand?: Snippet;
    /** Navigation region. Typically a `<SideNavigation>` subtree. Required. */
    navigation: Snippet;
    /** Optional footer region (e.g. user account, sign-out). */
    footer?: Snippet;
  };
</script>

<script lang="ts">
  import { setContext } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';

  import { SIDEBAR_CONTEXT_KEY, type SidebarContextValue } from '../_internal/sidebar-context.ts';
  import { classNames } from '../utilities/class-names.ts';
  import Drawer from './drawer/drawer.svelte';

  type SidebarRuntimeProps = SidebarProps & {
    'aria-label'?: unknown;
    'aria-labelledby'?: unknown;
  };

  let {
    id: sidebarId,
    collapsed = $bindable(false),
    ariaLabel = 'Sidebar',
    class: className,
    brand: brandSnippet,
    navigation: navigationSnippet,
    footer: footerSnippet,
    'aria-label': _ariaLabelAttribute,
    'aria-labelledby': _ariaLabelledbyAttribute,
    ...rest
  }: SidebarRuntimeProps = $props();

  const validatedLabel = $derived.by(() => {
    if (ariaLabel.trim() === '') {
      throw new Error('Sidebar requires a non-empty ariaLabel.');
    }
    return ariaLabel;
  });

  // The inner <nav> landmark gets a distinct accessible name so the outer
  // complementary <aside> and the inner navigation are not announced as two
  // identically-named landmarks.
  const navigationLabel = $derived(`${validatedLabel} navigation`);

  // Breakpoint matches the existing `47.99rem` (~767px) convention used by
  // navigation-bar.css and navigation-item.css. The fully-parenthesized form
  // is required — `window.matchMedia` rejects bare media feature expressions
  // on Firefox and Safari.
  const mobile = new MediaQuery('(max-width: 47.99rem)', false);

  const context: SidebarContextValue = {
    get collapsed() {
      return collapsed;
    },
  };
  setContext(SIDEBAR_CONTEXT_KEY, context);
</script>

{#if mobile.current}
  <Drawer
    {...rest}
    bind:open={
      () => !collapsed,
      (value: boolean) => {
        collapsed = !value;
      }
    }
    side="left"
    size="md"
    title={validatedLabel}
    id={sidebarId}
  >
    <div class={classNames('cinder-sidebar', 'cinder-sidebar--mobile', className)}>
      {#if brandSnippet}
        <div class="cinder-sidebar__brand">
          {@render brandSnippet()}
        </div>
      {/if}

      <nav class="cinder-sidebar__nav" aria-label={navigationLabel}>
        {@render navigationSnippet()}
      </nav>

      {#if footerSnippet}
        <div class="cinder-sidebar__footer cinder-sidebar__footer--mobile">
          {@render footerSnippet()}
        </div>
      {/if}
    </div>
  </Drawer>
{:else}
  <aside
    id={sidebarId}
    {...rest}
    class={classNames('cinder-sidebar', className)}
    aria-label={validatedLabel}
    data-cinder-collapsed={collapsed ? '' : undefined}
  >
    {#if brandSnippet}
      <div class="cinder-sidebar__brand">
        {@render brandSnippet()}
      </div>
    {/if}

    <nav class="cinder-sidebar__nav" aria-label={navigationLabel}>
      {@render navigationSnippet()}
    </nav>

    {#if footerSnippet}
      <div class="cinder-sidebar__footer">
        {@render footerSnippet()}
      </div>
    {/if}
  </aside>
{/if}
