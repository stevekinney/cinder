<script lang="ts">
  /**
   * Left sidebar (plan §13 T1.6; design `Weft UI.dc.html` "SIDEBAR"):
   * product mark, the 7 domains with Lucide icons + badge counts, active
   * state from the router. Badge counts (reviews pending, workers
   * unhealthy) are TanStack queries — a fetch failure (e.g. a 403 from a
   * scope this principal lacks) just hides the count rather than showing a
   * stale/wrong number or breaking the nav.
   *
   * "Unhealthy" for the workers badge has no dedicated wire field —
   * `WorkerSummary.health` is `'active' | 'draining' | 'drained'` (an
   * operator-intent state, not a liveness one). This counts `'drained'`
   * (fully disconnected) plus workers whose heartbeat is stale beyond
   * `STALE_HEARTBEAT_MS`, a documented v1 heuristic — the Workers track
   * (§13 track C) owns the authoritative staleness presentation on its own
   * surface; this badge is a coarse smell test only.
   */
  import {
    Badge,
    ConnectionIndicator,
    Sidebar,
    SIDEBAR_MOBILE_MEDIA_QUERY,
    SideNavigation,
    SideNavigationItem,
  } from '@lostgradient/cinder';
  import type { HttpClient } from '@lostgradient/weft';
  import {
    Building2,
    CalendarClock,
    ChevronRight,
    LayoutDashboard,
    ServerCog,
    Settings,
    UserCheck,
    Workflow,
  } from 'lucide-svelte';
  import { MediaQuery } from 'svelte/reactivity';

  import { createQuery } from '@tanstack/svelte-query';

  import { queryKeys } from '../../lib/query.ts';
  import { router } from '../../lib/router.svelte.ts';
  import type { LiveSourceStatus } from '../../lib/live-source/index.ts';

  interface SidebarNavProps {
    client: HttpClient;
    engineStatus: LiveSourceStatus;
    collapsed?: boolean;
  }

  let { client, engineStatus, collapsed = $bindable(false) }: SidebarNavProps = $props();

  /**
   * On a mobile viewport, `collapsed` doubles as "drawer closed" (Cinder
   * `Sidebar`'s own `open = !collapsed`) — a nav click there should close
   * the drawer after navigating, same as any other mobile drawer nav
   * pattern. On desktop, `collapsed` is the user's icon-rail preference and
   * must NOT be touched by a nav click.
   */
  const isMobileViewport = new MediaQuery(SIDEBAR_MOBILE_MEDIA_QUERY, false);

  /**
   * App-owned collapsed/mobile layout hooks for `foundation.css`'s width
   * rules. Derived from state this component already owns (`collapsed`,
   * bound straight into `Sidebar`, and `isMobileViewport`, computed from the
   * same public `SIDEBAR_MOBILE_MEDIA_QUERY` breakpoint Sidebar itself uses)
   * rather than reading back Cinder's rendered mobile class or
   * collapsed-state attribute on the sidebar root.
   */
  const sidebarStateClass = $derived(
    `weft-shell-sidebar${collapsed ? ' weft-shell-sidebar--collapsed' : ''}${isMobileViewport.current ? ' weft-shell-sidebar--mobile' : ''}`,
  );

  const STALE_HEARTBEAT_MS = 30_000;

  const reviewsQuery = createQuery(
    () => ({
      queryKey: queryKeys.reviews.list({}),
      queryFn: () => client.listReviews({}),
      staleTime: 15_000,
    }),
    undefined,
  );

  const workersQuery = createQuery(
    () => ({
      queryKey: queryKeys.workers.list(),
      queryFn: () => client.operations['weft.workers.list']({}),
      staleTime: 15_000,
    }),
    undefined,
  );

  const reviewsPendingCount = $derived(reviewsQuery.data?.length);
  const workersUnhealthyCount = $derived(
    workersQuery.data?.items.filter(
      (worker) => worker.health === 'drained' || worker.heartbeatAgeMs > STALE_HEARTBEAT_MS,
    ).length,
  );

  interface NavEntry {
    readonly path: string;
    readonly label: string;
    readonly icon: typeof LayoutDashboard;
    /** `undefined` for domains with no badge count; `badgeVariant` stays a plain required field (never `undefined`) so it never needs a per-entry default under `exactOptionalPropertyTypes`. */
    readonly badge: number | undefined;
    readonly badgeVariant: 'warning' | 'danger';
  }

  const navEntries = $derived<readonly NavEntry[]>([
    {
      path: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
      badgeVariant: 'warning',
    },
    {
      path: '/workflows',
      label: 'Workflows',
      icon: Workflow,
      badge: undefined,
      badgeVariant: 'warning',
    },
    {
      path: '/schedules',
      label: 'Schedules',
      icon: CalendarClock,
      badge: undefined,
      badgeVariant: 'warning',
    },
    {
      path: '/workers',
      label: 'Workers',
      icon: ServerCog,
      badge: workersUnhealthyCount,
      badgeVariant: 'danger',
    },
    {
      path: '/reviews',
      label: 'Reviews',
      icon: UserCheck,
      badge: reviewsPendingCount,
      badgeVariant: 'warning',
    },
    {
      path: '/storage',
      label: 'Storage',
      icon: Building2,
      badge: undefined,
      badgeVariant: 'warning',
    },
    { path: '/system', label: 'System', icon: Settings, badge: undefined, badgeVariant: 'warning' },
  ]);

  function isActivePath(path: string): boolean {
    if (path === '/') return router.pathname === '/';
    return router.pathname === path || router.pathname.startsWith(`${path}/`);
  }

  function onNavClick(event: MouseEvent, path: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    router.navigate(path);
    if (isMobileViewport.current) collapsed = true;
  }

  const enginePillLabel: Readonly<Record<LiveSourceStatus, string>> = {
    connecting: 'Engine connecting',
    live: 'Engine healthy',
    reconnecting: 'Engine reconnecting',
    polling: 'Engine healthy (polling)',
    stale: 'Engine status stale',
    closed: 'Engine unreachable',
  };
</script>

<Sidebar label="Weft UI" bind:collapsed class={sidebarStateClass}>
  {#snippet navigation()}
    <SideNavigation ariaLabel="Domains">
      {#each navEntries as entry (entry.path)}
        {@const Icon = entry.icon}
        <SideNavigationItem
          href={router.href(entry.path)}
          active={isActivePath(entry.path)}
          onclick={(event) => onNavClick(event, entry.path)}
        >
          <span class="weft-shell-nav-item">
            <Icon aria-hidden="true" size={16} class="weft-shell-nav-item__icon" />
            <span class="weft-shell-nav-item__label">{entry.label}</span>
            {#if entry.badge !== undefined && entry.badge > 0}
              <Badge variant={entry.badgeVariant} size="sm">{entry.badge}</Badge>
            {/if}
          </span>
        </SideNavigationItem>
      {/each}
    </SideNavigation>
  {/snippet}
  {#snippet footer()}
    <a
      href={router.href('/system')}
      class="weft-shell-engine-pill"
      onclick={(event) => onNavClick(event, '/system')}
    >
      <ConnectionIndicator status={engineStatus} label={enginePillLabel[engineStatus]} />
      <ChevronRight aria-hidden="true" size={14} class="weft-shell-engine-pill__chevron" />
    </a>
  {/snippet}
</Sidebar>
