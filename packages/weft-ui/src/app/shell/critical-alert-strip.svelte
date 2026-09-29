<script lang="ts">
  /**
   * Critical-alert strip (design `Weft New Surfaces.dc.html` §C: "Critical
   * strip below header, dismissible"). Renders one banner per unread
   * critical notification — dismissing one calls
   * `NotificationStore.dismissCritical`, which marks it read (it stays
   * visible, dimmed, in the bell dropdown) rather than deleting it.
   */
  import { Siren, X } from 'lucide-svelte';

  import { router } from '../../lib/router.svelte.ts';
  import type { NotificationStore } from '../notifications.svelte.ts';

  interface CriticalAlertStripProps {
    store: NotificationStore;
  }

  let { store }: CriticalAlertStripProps = $props();
</script>

{#if store.criticalUnread.length > 0}
  <div class="weft-critical-strip" role="alert">
    {#each store.criticalUnread as item (item.id)}
      <div class="weft-critical-strip__row">
        <Siren aria-hidden="true" size={15} class="weft-critical-strip__icon" />
        <span class="weft-critical-strip__message">
          <strong>{item.title}:</strong>
          {item.body}
        </span>
        <a
          href={router.href(item.href)}
          class="weft-critical-strip__link"
          onclick={(event) => {
            event.preventDefault();
            store.dismissCritical(item.id);
            router.navigate(item.href);
          }}
        >
          View
        </a>
        <button
          type="button"
          class="weft-critical-strip__dismiss"
          aria-label={`Dismiss: ${item.title}`}
          onclick={() => store.dismissCritical(item.id)}
        >
          <X aria-hidden="true" size={13} />
        </button>
      </div>
    {/each}
  </div>
{/if}
