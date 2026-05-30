<script lang="ts" module>
  import type { Announcer } from './announcer.svelte.ts';

  /** Minimal store surface the popstate handler touches. */
  export type PopStateStoreStub = {
    currentComponent: string;
    syncFromUrl(): void;
  };

  export type AnnouncerPopStateHandle = {
    /**
     * Re-run the shell's exact `handlePopState` control flow against the
     * current `window.location`: parse the path, update the store, re-sync the
     * toolbar, then announce. Mirrors shell.svelte so the wiring (announce on
     * back/forward, only when a component resolves) is regression-covered
     * without mounting the full shell + cinder barrel.
     */
    popState(): Promise<void>;
    /** The fixture's main element, for focus assertions. */
    getMain(): HTMLElement | null;
  };
</script>

<script lang="ts">
  import AnnouncerRegion from './announcer.svelte';
  import { announceNavigation, setAnnouncer } from './announcer.svelte.ts';
  import { parseComponentFromPath } from './routing.ts';

  type Props = {
    /** Shared instance the test reads `message` from. */
    announcer: Announcer;
    /** Minimal store the handler mutates; the test asserts on it. */
    store: PopStateStoreStub;
  };

  let { announcer, store }: Props = $props();

  setAnnouncer(announcer);

  let mainEl = $state<HTMLElement | null>(null);

  /**
   * Replicates `shell.svelte`'s `handlePopState` exactly: guard on a resolved
   * component, sync the toolbar from the URL first, then apply the navigation
   * side effects (title + announcement + focus).
   */
  export async function popState(): Promise<void> {
    const parsed = parseComponentFromPath(window.location.pathname);
    if (parsed !== null) store.currentComponent = parsed;
    store.syncFromUrl();
    if (parsed !== null) await announceNavigation(announcer, parsed, () => mainEl);
  }

  /** Imperative handle to the focus target. */
  export function getMain(): HTMLElement | null {
    return mainEl;
  }
</script>

<main bind:this={mainEl} tabindex="-1">content</main>
<AnnouncerRegion />
