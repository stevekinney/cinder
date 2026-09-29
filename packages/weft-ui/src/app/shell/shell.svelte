<script lang="ts">
  /**
   * Console chrome (plan §13 T1.6): mounted once a client + principal are
   * final (`../app.svelte` owns the bootstrap/API-key-entry sequence ahead
   * of this). `provideClient()`/`providePrincipalStore()` run here, during
   * this component's own initialization — Svelte only allows `setContext`
   * during init, which is why the API-key rebuild flow lives one level up.
   * The app remounts `<Shell>` when the active credential changes (plan §6,
   * T1.1's `ApiKeyEntry` doc: "the shell owns rebuilding the client … and
   * re-providing context").
   *
   * Keyboard (plan §13 T1.6's "⌘K opens palette, Esc closes overlays"):
   * ⌘K is registered by `./command-palette.svelte`; Esc-closes-overlays is
   * already Cinder's own contract for `CommandPalette` and `Dropdown` (both
   * close on Escape internally) — nothing extra to wire here.
   */
  import { SIDEBAR_MOBILE_MEDIA_QUERY } from '@lostgradient/cinder';
  import type { HttpClient } from '@lostgradient/weft';
  import { untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';

  import { provideClient } from '../../lib/client.ts';
  import type { Principal } from '../../lib/scopes.svelte.ts';
  import { providePrincipalStore } from '../../lib/scopes.svelte.ts';
  import { EngineStatusController, provideFleetEventSource } from '../engine-status.svelte.ts';
  import { NotificationStore } from '../notifications.svelte.ts';
  import { ThemeStore } from '../theme.svelte.ts';
  import AuthModeBanner from './auth-mode-banner.svelte';
  import CommandPaletteLauncher from './command-palette.svelte';
  import CriticalAlertStrip from './critical-alert-strip.svelte';
  import RouteOutlet from './route-outlet.svelte';
  import Sidebar from './sidebar.svelte';
  import Topbar from './topbar.svelte';

  interface ShellProps {
    client: HttpClient;
    initialPrincipal: Principal;
    onAuthExpired: (expiredClient: HttpClient) => void;
  }

  let { client, initialPrincipal, onAuthExpired }: ShellProps = $props();

  // `client`/`initialPrincipal` are read exactly once, here, at Shell's own
  // initialization — see the module doc: these values belong to one
  // credential session, so there is deliberately no reactive dependency on
  // either prop past this point. `untrack()` makes that explicit instead of
  // triggering Svelte's "state referenced locally" warning.
  const {
    client: initialClient,
    principal: resolvedPrincipal,
    onAuthExpired: authExpiredHandler,
  } = untrack(() => ({
    client,
    principal: initialPrincipal,
    onAuthExpired,
  }));

  provideClient(initialClient);
  const principalStore = providePrincipalStore({
    onAuthExpired: () => authExpiredHandler(initialClient),
  });
  principalStore.setPrincipal(resolvedPrincipal);

  const theme = new ThemeStore();
  const notifications = new NotificationStore();
  const engineStatus = new EngineStatusController(initialClient, notifications);
  // Additive Track B workaround — see `engine-status.svelte.ts`'s
  // `provideFleetEventSource()` doc: shares the ONE fleet SSE connection with
  // route components instead of each opening its own.
  provideFleetEventSource(engineStatus.fleetSource);

  $effect(() => {
    return () => engineStatus.dispose();
  });

  /**
   * `collapsed` doubles as "drawer closed" once Cinder's `Sidebar` switches
   * to its mobile presentation below `SIDEBAR_MOBILE_MEDIA_QUERY` (its own
   * internal `open = !collapsed` — `sidebar.svelte`). Left at its plain
   * default of `false`, a mobile page load would render the navigation
   * drawer OPEN over the whole screen with no trigger to close it. Start
   * collapsed on a mobile viewport instead.
   *
   * The desktop shell has no manual icon-rail toggle (the design keeps the
   * sidebar always expanded above the mobile breakpoint — see the CSS
   * comment on `.weft-shell-menu-trigger` in `foundation.css`), so
   * `collapsed` must track the breakpoint directly: true while the
   * viewport is mobile, false once it crosses back to desktop. Anything
   * short of that (e.g. only forcing collapse on mobile *entry*) leaves a
   * desktop→mobile→desktop resize with the sidebar permanently stuck at
   * 64px with no way to re-expand it, since the only toggle
   * (`.weft-shell-menu-trigger`) is CSS-hidden above the breakpoint.
   */
  const isMobileViewport = new MediaQuery(SIDEBAR_MOBILE_MEDIA_QUERY, false);

  let sidebarCollapsed = $state(isMobileViewport.current);

  $effect(() => {
    sidebarCollapsed = isMobileViewport.current;
  });

  let paletteOpen = $state(false);
</script>

<div class="weft-shell">
  <Sidebar {client} engineStatus={engineStatus.status} bind:collapsed={sidebarCollapsed} />
  <div class="weft-shell-main">
    <Topbar
      principal={principalStore}
      {notifications}
      liveStatus={engineStatus.fleetSource.status}
      {theme}
      bind:paletteOpen
      bind:sidebarCollapsed
    />
    <AuthModeBanner mode={principalStore.bannerMode} />
    <CriticalAlertStrip store={notifications} />
    <RouteOutlet />
  </div>
</div>

<CommandPaletteLauncher bind:open={paletteOpen} {client} />
