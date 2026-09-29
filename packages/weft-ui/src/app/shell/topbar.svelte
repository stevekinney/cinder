<script lang="ts">
  /**
   * Topbar (plan §13 T1.6; design `Weft UI.dc.html` "header"): ⌘K
   * search trigger, scopes pill (links to the System → Scope panel, plan
   * §9.7), notification bell, theme toggle. `router.current.route` drives a
   * lightweight current-domain label — full breadcrumbs are a per-surface
   * concern (workflow/schedule/review detail headers, plan §9.2–§9.5), out
   * of the shell's scope.
   *
   * The leading menu button (PROJECT-BRIEF: "topbar condenses … overflow
   * menu for secondary controls") is CSS-hidden above Cinder Sidebar's own
   * mobile breakpoint (`foundation.css`, `47.99rem`) and is the only way to
   * reopen the navigation drawer on a small viewport once it's closed —
   * `Sidebar` itself renders no trigger of its own below that width.
   */
  import { Menu, Monitor, Moon, Search, Shield, Sun } from 'lucide-svelte';

  import type { LiveSourceStatus } from '../../lib/live-source/index.ts';
  import type { PrincipalStore } from '../../lib/scopes.svelte.ts';
  import { router } from '../../lib/router.svelte.ts';
  import type { ThemeStore } from '../theme.svelte.ts';
  import NotificationBell from './notification-bell.svelte';
  import type { NotificationStore } from '../notifications.svelte.ts';

  interface TopbarProps {
    principal: PrincipalStore;
    notifications: NotificationStore;
    /** The shared fleet feed's connection status — passed through to the notification bell's footer live pill. */
    liveStatus: LiveSourceStatus;
    theme: ThemeStore;
    paletteOpen: boolean;
    /** Bound to `Sidebar`'s own `collapsed` (`./shell.svelte`) — below the mobile breakpoint this doubles as "drawer closed"; the menu button toggles it open. */
    sidebarCollapsed: boolean;
  }

  let {
    principal,
    notifications,
    liveStatus,
    theme,
    paletteOpen = $bindable(false),
    sidebarCollapsed = $bindable(false),
  }: TopbarProps = $props();

  const DOMAIN_LABELS: Readonly<Record<string, string>> = {
    '/': 'Dashboard',
    '/workflows': 'Workflows',
    '/schedules': 'Schedules',
    '/workers': 'Workers',
    '/reviews': 'Reviews',
    '/storage': 'Storage',
    '/system': 'System',
  };

  const domainLabel = $derived.by(() => {
    const pattern = router.current.route?.pattern;
    if (pattern === undefined) return 'Weft UI';
    const domainPattern = `/${pattern.split('/').filter(Boolean)[0] ?? ''}`;
    return DOMAIN_LABELS[pattern] ?? DOMAIN_LABELS[domainPattern] ?? 'Weft UI';
  });

  const grantedScopeCount = $derived(principal.principal?.scopes.length ?? 0);
  const scopeTitle = $derived(
    principal.principal
      ? `Current scopes: ${principal.principal.scopes.join(', ')}`
      : 'No principal resolved yet',
  );

  const THEME_LABEL = { light: 'Light theme', dark: 'Dark theme', system: 'System theme' } as const;

  function onScopePillClick(event: MouseEvent): void {
    event.preventDefault();
    router.navigate('/system');
  }
</script>

<header class="weft-shell-topbar">
  <button
    type="button"
    class="weft-shell-icon-button weft-shell-menu-trigger"
    aria-label="Toggle navigation menu"
    onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
  >
    <Menu aria-hidden="true" size={18} />
  </button>

  <span class="weft-shell-topbar__domain">{domainLabel}</span>

  <button type="button" class="weft-shell-search-trigger" onclick={() => (paletteOpen = true)}>
    <Search aria-hidden="true" size={15} />
    <span>Search workflows, schedules, workers…</span>
    <span class="weft-shell-search-trigger__kbd" aria-hidden="true">
      <kbd>⌘</kbd><kbd>K</kbd>
    </span>
  </button>

  <a
    href={router.href('/system')}
    class="weft-shell-scope-pill"
    title={scopeTitle}
    onclick={onScopePillClick}
  >
    <Shield aria-hidden="true" size={13} />
    <span>{grantedScopeCount} scope{grantedScopeCount === 1 ? '' : 's'}</span>
  </a>

  <NotificationBell store={notifications} {liveStatus} />

  <button
    type="button"
    class="weft-shell-icon-button"
    aria-label={`Theme: ${THEME_LABEL[theme.mode]}. Activate to switch.`}
    title={THEME_LABEL[theme.mode]}
    onclick={() => theme.cycle()}
  >
    {#if theme.mode === 'light'}
      <Sun aria-hidden="true" size={16} />
    {:else if theme.mode === 'dark'}
      <Moon aria-hidden="true" size={16} />
    {:else}
      <Monitor aria-hidden="true" size={16} />
    {/if}
  </button>
</header>
