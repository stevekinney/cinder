<script lang="ts">
  /**
   * Notification bell + dropdown (design `Weft New Surfaces.dc.html` §C,
   * `design/README.md` "Notification center"): grouped Critical/Warning/
   * Info, unread heavier / read at 0.65 opacity, "Mark all read", footer
   * live pill + "Open alerts view →". The critical strip below the header
   * is a sibling component (`./critical-alert-strip.svelte`) fed by the
   * same store — not rendered here.
   *
   * Built on Cinder's `Dropdown` (compound-component doc: "Building a
   * custom dropdown layout") using the legacy `trigger`/`children` snippet
   * API so this component owns the full trigger-button and panel markup
   * (matching the design reference's plain-element structure) while
   * `Dropdown` supplies focus/Escape/click-outside/positioning behavior —
   * an app-local composition over the primitive, not a fork (PROJECT-BRIEF).
   */
  import { Badge, ConnectionIndicator, Dropdown } from '@lostgradient/cinder';
  import type { ComponentType, SvelteComponent } from 'svelte';
  import type { IconProps } from 'lucide-svelte';
  import {
    Ban,
    Bell,
    CalendarClock,
    CalendarX,
    CheckCheck,
    CircleCheck,
    CircleX,
    ClockAlert,
    Database,
    FileCheck,
    HardDrive,
    Pause,
    Pencil,
    Play,
    Plug,
    PlugZap,
    Radio,
    ShieldAlert,
    Siren,
    Tag,
    Trash2,
    TriangleAlert,
    UserCheck,
  } from 'lucide-svelte';

  import { formatRelativeTime } from '../../lib/format/index.ts';
  import type { LiveSourceStatus } from '../../lib/live-source/index.ts';
  import { router } from '../../lib/router.svelte.ts';
  import type { NotificationItem, NotificationStore } from '../notifications.svelte.ts';

  interface NotificationBellProps {
    store: NotificationStore;
    /** The shared fleet feed's own connection status — the footer's "Live" pill (design: "footer live pill") reflects where the notifications above it actually come from, rather than a static label. */
    liveStatus: LiveSourceStatus;
  }

  let { store, liveStatus }: NotificationBellProps = $props();

  let open = $state(false);

  /**
   * `lucide-svelte` still ships icons as `SvelteComponentTyped` classes, not
   * Svelte 5's native functional component shape — same
   * `ComponentType<SvelteComponent<IconProps>>` typing `fault-boundary.svelte`
   * (T1.5) already established for the same reason, reused here rather than
   * re-deriving a cast.
   */
  const ICONS: Readonly<Record<string, ComponentType<SvelteComponent<IconProps>>>> = {
    siren: Siren,
    'circle-x': CircleX,
    'calendar-x': CalendarX,
    'shield-alert': ShieldAlert,
    database: Database,
    'user-check': UserCheck,
    'check-check': CheckCheck,
    plug: Plug,
    'plug-zap': PlugZap,
    play: Play,
    'circle-check': CircleCheck,
    ban: Ban,
    'clock-alert': ClockAlert,
    pause: Pause,
    'trash-2': Trash2,
    radio: Radio,
    tag: Tag,
    pencil: Pencil,
    'file-check': FileCheck,
    'calendar-clock': CalendarClock,
    'triangle-alert': TriangleAlert,
    'hard-drive': HardDrive,
  };

  function iconFor(name: string): ComponentType<SvelteComponent<IconProps>> {
    return ICONS[name] ?? TriangleAlert;
  }

  function goTo(item: NotificationItem): void {
    store.markRead(item.id);
    router.navigate(item.href);
    open = false;
  }

  function openAlertsView(): void {
    router.navigate('/system');
    open = false;
  }

  const GROUPS: readonly { readonly label: string; readonly items: () => NotificationItem[] }[] = [
    { label: 'Critical', items: () => store.critical },
    { label: 'Warning', items: () => store.warning },
    { label: 'Info', items: () => store.info },
  ];
</script>

<Dropdown bind:open placement="bottom-end">
  {#snippet trigger()}
    <button
      type="button"
      class="weft-shell-icon-button weft-notification-bell"
      aria-label={`Notifications, ${store.unreadCount} unread`}
    >
      <Bell aria-hidden="true" size={17} />
      {#if store.unreadCount > 0}
        <span class="weft-notification-bell__count">{store.unreadCount}</span>
      {/if}
    </button>
  {/snippet}
  {#snippet children()}
    <div class="weft-notification-panel">
      <div class="weft-notification-panel__header">
        <span class="weft-notification-panel__title">Notifications</span>
        <Badge variant="danger" size="sm">{store.unreadCount} unread</Badge>
        <button
          type="button"
          class="weft-notification-panel__mark-read"
          onclick={() => store.markAllRead()}
        >
          Mark all read
        </button>
      </div>

      <div class="weft-notification-panel__list">
        {#each GROUPS as group (group.label)}
          {@const items = group.items()}
          {#if items.length > 0}
            <div class="weft-notification-panel__group-label" data-tier={group.label.toLowerCase()}>
              {group.label}
            </div>
            {#each items as item (item.id)}
              {@const Icon = iconFor(item.icon)}
              <a
                href={router.href(item.href)}
                class="weft-notification-panel__item"
                data-tier={item.tier}
                data-read={item.read}
                onclick={(event) => {
                  event.preventDefault();
                  goTo(item);
                }}
              >
                <Icon aria-hidden="true" size={14} class="weft-notification-panel__item-icon" />
                <span class="weft-notification-panel__item-body">
                  <span class="weft-notification-panel__item-title">{item.title}</span>
                  <span class="weft-notification-panel__item-detail">{item.body}</span>
                </span>
                <span class="weft-notification-panel__item-time">
                  {formatRelativeTime(item.emittedAtMs)}
                </span>
              </a>
            {/each}
          {/if}
        {/each}

        {#if store.items.length === 0}
          <p class="weft-notification-panel__empty">No notifications yet.</p>
        {/if}
      </div>

      <div class="weft-notification-panel__footer">
        <span class="weft-notification-panel__live">
          <ConnectionIndicator status={liveStatus} />
        </span>
        <button type="button" class="weft-notification-panel__alerts-link" onclick={openAlertsView}>
          Open alerts view →
        </button>
      </div>
    </div>
  {/snippet}
</Dropdown>
