<script lang="ts">
  /**
   * Schedules domain router (Track B, plan §9.3). `routes.ts` (frozen,
   * Foundation-owned) maps the single client-side pattern `/schedules` to
   * this file — there is no `/schedules/:id` route entry (unlike
   * `/workflows/:id`, already present in that frozen table). Schedule
   * selection and the create/edit drawer therefore live entirely in URL
   * QUERY state on top of the one owned pattern, matching plan §4's "URL
   * owns filter/pagination/tab state":
   *
   *   - `/schedules`                    → list
   *   - `/schedules?id=<id>`            → detail (full page, not a split panel — matches `Weft UI.dc.html`'s `schList`/`schDetail` mutually-exclusive screens)
   *   - `/schedules?create=1`           → list + create drawer over it
   *   - `/schedules?id=<id>&edit=1`     → detail + edit drawer over it
   */
  import { router } from '../../lib/router.svelte.ts';
  import ScheduleDetail from './schedule-detail.svelte';
  import ScheduleFormDrawer from './schedule-form-drawer.svelte';
  import ScheduleList from './schedule-list.svelte';

  const search = $derived(router.current.search);
  const id = $derived(search.get('id'));
  const isCreate = $derived(search.get('create') === '1');
  const isEdit = $derived(search.get('edit') === '1' && id !== null);

  /** Closes the drawer back to the surface it opened over — the detail page for edit, the list for create. */
  function closeDrawer(): void {
    router.navigate(id !== null ? `/schedules?id=${encodeURIComponent(id)}` : '/schedules');
  }
</script>

{#if id !== null}
  {#key id}
    <ScheduleDetail {id} />
  {/key}
{:else}
  <ScheduleList />
{/if}

{#if isCreate}
  <ScheduleFormDrawer mode="create" onClose={closeDrawer} />
{:else if isEdit && id !== null}
  <ScheduleFormDrawer mode="edit" scheduleId={id} onClose={closeDrawer} />
{/if}
