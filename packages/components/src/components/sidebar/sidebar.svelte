<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Responsive layout shell that anchors a collapsible column beside main content and swaps to a drawer below a configurable breakpoint.
   * @tag layout
   * @tag responsive
   * @useWhen Wrapping the page chrome so a navigation column can collapse and become a mobile drawer automatically.
   * @useWhen Sharing collapsed state between a side-navigation column and the rest of the app shell via context.
   * @avoidWhen Building the page body itself rather than the surrounding shell — use a hand-rolled page scaffold instead.
   * @avoidWhen Rendering navigation entries directly — place side-navigation inside the sidebar column.
   * @related side-navigation, drawer
   */
  export type { SidebarProps } from './sidebar.types.ts';
</script>

<script lang="ts">
  import type { SidebarProps } from './sidebar.types.ts';

  import { setSidebarContext, type SidebarContextValue } from '../../_internal/sidebar-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import Drawer from '../drawer/drawer.svelte';
  import { SIDEBAR_MOBILE_BREAKPOINT } from './sidebar.constants.ts';

  type SidebarRuntimeProps = SidebarProps & {
    'aria-label'?: unknown;
    'aria-labelledby'?: unknown;
  };

  let {
    id: sidebarId,
    collapsed = $bindable(false),
    label = 'Sidebar',
    mobileBreakpoint = SIDEBAR_MOBILE_BREAKPOINT,
    class: className,
    brand: brandSnippet,
    navigation: navigationSnippet,
    footer: footerSnippet,
    'aria-label': _ariaLabelAttribute,
    'aria-labelledby': _ariaLabelledbyAttribute,
    ...rest
  }: SidebarRuntimeProps = $props();

  const validatedLabel = $derived.by(() => {
    if (label.trim() === '') {
      throw new Error('Sidebar requires a non-empty label.');
    }
    return label;
  });

  // The inner <nav> landmark gets a distinct accessible name so the outer
  // complementary <aside> and the inner navigation are not announced as two
  // identically-named landmarks.
  const navigationLabel = $derived(`${validatedLabel} navigation`);

  const validatedMobileBreakpoint = $derived.by(() => {
    if (typeof mobileBreakpoint !== 'string') {
      throw new Error('Sidebar mobileBreakpoint must be a CSS length such as "47.99rem".');
    }
    const value = mobileBreakpoint.trim();
    if (!isSimpleCssLength(value)) {
      throw new Error('Sidebar mobileBreakpoint must be a CSS length such as "47.99rem".');
    }
    return value;
  });

  const mobileMediaQuery = $derived(`(max-width: ${validatedMobileBreakpoint})`);
  const responsiveFallbackCss = $derived(
    `@media (max-width: ${validatedMobileBreakpoint}) { .cinder-sidebar--desktop[data-cinder-sidebar-mobile-breakpoint="${validatedMobileBreakpoint}"][data-cinder-ssr-mobile-fallback], .cinder-sidebar--desktop[data-cinder-sidebar-mobile-breakpoint="${validatedMobileBreakpoint}"][data-cinder-collapsed] { display: none; } }`,
  );

  // The fully-parenthesized form is required — `window.matchMedia` rejects
  // bare media feature expressions on Firefox and Safari.
  // Keep the fallback explicit for SSR-contract test environments where
  // `window.matchMedia` is unavailable.
  const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  let syncedMobileMediaQuery = $state(false);
  let mobile = $state(false);
  $effect(() => {
    if (!hasMatchMedia) return undefined;
    const list = window.matchMedia(mobileMediaQuery);
    const update = () => {
      mobile = list.matches;
      syncedMobileMediaQuery = true;
    };
    update();

    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', update);
      return () => {
        list.removeEventListener('change', update);
      };
    }

    if (typeof list.addListener === 'function') {
      list.addListener(update);
      return () => {
        list.removeListener(update);
      };
    }
    return undefined;
  });
  const usesSsrResponsiveFallback = $derived(!syncedMobileMediaQuery);
  const rendersCustomResponsiveFallbackStyle = $derived(
    usesSsrResponsiveFallback && validatedMobileBreakpoint !== SIDEBAR_MOBILE_BREAKPOINT,
  );

  const context: SidebarContextValue = {
    get collapsed() {
      return collapsed;
    },
  };
  setSidebarContext(context);

  function isSimpleCssLength(value: string): boolean {
    return /^(?:0|(?:\d+|\d*\.\d+)(?:px|rem|em|ch|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|cqw|cqh|cqi|cqb|cqmin|cqmax))$/.test(
      value.trim(),
    );
  }
</script>

{#snippet sidebarContents(isMobile: boolean)}
  {#if brandSnippet}
    <div class="cinder-sidebar__brand">
      {@render brandSnippet()}
    </div>
  {/if}

  {#if navigationSnippet}
    <!-- Guard the entire <nav> landmark, not just its contents. An empty <nav>
         is an accessibility problem (screen readers announce a navigation landmark
         with no destinations). navigation is optional so a sidebar can be used as
         app chrome without a nav list. -->
    <nav class="cinder-sidebar__nav" aria-label={navigationLabel}>
      {@render navigationSnippet()}
    </nav>
  {/if}

  {#if footerSnippet}
    <div class={classNames('cinder-sidebar__footer', isMobile && 'cinder-sidebar__footer--mobile')}>
      {@render footerSnippet()}
    </div>
  {/if}
{/snippet}

{#if rendersCustomResponsiveFallbackStyle}
  <svelte:element this={'style'} data-cinder-sidebar-breakpoint-style>
    {responsiveFallbackCss}
  </svelte:element>
{/if}

{#if mobile}
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
    <div
      class={classNames('cinder-sidebar', 'cinder-sidebar--mobile', className)}
      data-cinder-sidebar-mobile-breakpoint={validatedMobileBreakpoint}
      style:--cinder-sidebar-mobile-breakpoint={validatedMobileBreakpoint}
    >
      {@render sidebarContents(true)}
    </div>
  </Drawer>
{:else}
  <aside
    id={sidebarId}
    {...rest}
    class={classNames('cinder-sidebar', 'cinder-sidebar--desktop', className)}
    aria-label={validatedLabel}
    data-cinder-sidebar-mobile-breakpoint={validatedMobileBreakpoint}
    data-cinder-collapsed={collapsed ? '' : undefined}
    data-cinder-ssr-mobile-fallback={usesSsrResponsiveFallback ? '' : undefined}
    style:--cinder-sidebar-mobile-breakpoint={validatedMobileBreakpoint}
  >
    {@render sidebarContents(false)}
  </aside>
{/if}
