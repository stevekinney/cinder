<script lang="ts">
  /**
   * Recent-activity feed band (plan §9.1, this track's brief: "Cinder Feed
   * fed by FleetEventSource (live, with ConnectionIndicator, batched
   * ≤100ms, '+N events' pause-to-read affordance)").
   *
   * **Shares the shell's one connection.** Plan §5 and `FleetEventSource`'s
   * own module doc require exactly ONE fleet SSE connection, fanned out to
   * every consumer (dashboard feed, notification center, list liveness).
   * `Shell` (`src/app/shell/shell.svelte`) constructs the one
   * `EngineStatusController` and provides its `fleetSource` via
   * `provideFleetEventSource()` (`src/app/engine-status.svelte.ts`); this
   * band reads it back with `getFleetEventSource()` and only `subscribe()`s
   * — the same pattern the Workflows and Schedules tracks already use
   * (`workflow-list.svelte`, `workflow-detail.svelte`, `schedule-detail.svelte`).
   * `FleetEventSource` is designed for exactly this fan-out: the connection
   * opens lazily on first `subscribe()` and stays open as long as ANY
   * subscriber remains, so this band must only `unsubscribe()` on unmount —
   * never `close()` the shared source, which would tear down the shell's
   * bell/notification feed too.
   */
  import type { ComponentType, SvelteComponent } from 'svelte';
  import type { IconProps } from 'lucide-svelte';
  import {
    Ban,
    CalendarClock,
    CalendarX,
    CheckCheck,
    CircleAlert,
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

  import { ConnectionIndicator, Card, Feed, FeedEvent, Skeleton } from '@lostgradient/cinder';

  import { getFleetEventSource } from '../../app/engine-status.svelte.ts';
  import { classifyFleetEvent } from '../../app/notifications.svelte.ts';
  import { formatRelativeTime } from '../../lib/format/index.ts';
  import { router } from '../../lib/router.svelte.ts';
  import { ActivityFeedBatcher, type ActivityFeedRow } from './activity-feed-batcher.svelte.ts';

  const source = getFleetEventSource();
  const batcher = new ActivityFeedBatcher();

  $effect(() => {
    const unsubscribe = source.subscribe((frame) => {
      const classified = classifyFleetEvent(frame);
      if (!classified) return;
      const row: ActivityFeedRow = { id: frame.cursor, ...classified };
      batcher.ingest(row);
    });

    return () => {
      unsubscribe();
      batcher.dispose();
    };
  });

  /** Same icon-name lookup `../../app/shell/notification-bell.svelte` uses for the same `classifyFleetEvent` icon strings — that table isn't exported from the frozen shell, so this is a small, intentional local duplicate (this track's final report flags it as a foundation follow-up: extract a shared icon-resolution helper). */
  const ICONS: Readonly<Record<string, ComponentType<SvelteComponent<IconProps>>>> = {
    siren: Siren,
    'circle-alert': CircleAlert,
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

  function goTo(href: string): void {
    router.navigate(href);
  }
</script>

<Card padding="none" class="weft-dashboard-card">
  {#snippet header()}
    <div class="weft-dashboard-card__header">
      <span class="weft-dashboard-card__title">Recent activity</span>
      <ConnectionIndicator status={source.status} />
    </div>
  {/snippet}

  <div
    class="weft-activity-feed"
    role="group"
    aria-label="Recent activity — updates pause while you're reading"
    onmouseenter={() => batcher.pause()}
    onmouseleave={() => batcher.resume()}
    onfocusin={() => batcher.pause()}
    onfocusout={() => batcher.resume()}
  >
    {#if batcher.pendingCount > 0}
      <button type="button" class="weft-activity-feed__pending" onclick={() => batcher.resume()}>
        +{batcher.pendingCount} new {batcher.pendingCount === 1 ? 'event' : 'events'}
      </button>
    {/if}

    {#if batcher.items.length === 0}
      {#if source.status === 'connecting'}
        <div class="weft-activity-feed__skeleton" aria-busy="true" aria-label="Loading activity">
          <Skeleton height="1.2rem" />
          <Skeleton height="1.2rem" />
          <Skeleton height="1.2rem" />
        </div>
      {:else}
        <p class="weft-activity-feed__empty">
          No activity since this page loaded. For the connection's replayed history, check the
          notification bell.
        </p>
      {/if}
    {:else}
      <Feed live class="weft-activity-feed__list">
        {#each batcher.items as item (item.id)}
          {@const Icon = iconFor(item.icon)}
          <FeedEvent datetime={new Date(item.emittedAtMs).toISOString()} timestamp="">
            {#snippet icon()}
              <Icon aria-hidden="true" size={14} />
            {/snippet}
            <a
              href={router.href(item.href)}
              class="weft-activity-feed__row"
              data-tier={item.tier}
              onclick={(event) => {
                event.preventDefault();
                goTo(item.href);
              }}
            >
              <span class="weft-activity-feed__text">
                {item.title}
                <span class="weft-activity-feed__detail">{item.body}</span>
              </span>
              <span class="weft-activity-feed__time">{formatRelativeTime(item.emittedAtMs)}</span>
            </a>
          </FeedEvent>
        {/each}
      </Feed>
    {/if}
  </div>
</Card>
