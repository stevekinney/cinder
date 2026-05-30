<script lang="ts" module>
  import type { Announcer } from './announcer.svelte.ts';

  export type AnnouncerNavHandle = {
    /** Run the real navigation side effects against this fixture's <main>. */
    navigate(componentName: string): Promise<void>;
    /** The fixture's main element, for focus assertions. */
    getMain(): HTMLElement | null;
  };
</script>

<script lang="ts">
  import AnnouncerRegion from './announcer.svelte';
  import { announceNavigation, setAnnouncer } from './announcer.svelte.ts';

  type Props = {
    /** Shared instance the test reads `message` from. */
    announcer: Announcer;
  };

  let { announcer }: Props = $props();

  setAnnouncer(announcer);

  let mainEl = $state<HTMLElement | null>(null);

  /** Drive the real `announceNavigation` from the test, targeting this <main>. */
  export function navigate(componentName: string): Promise<void> {
    return announceNavigation(announcer, componentName, () => mainEl);
  }

  /** Imperative handle to the focus target. */
  export function getMain(): HTMLElement | null {
    return mainEl;
  }
</script>

<main bind:this={mainEl} tabindex="-1">content</main>
<AnnouncerRegion />
