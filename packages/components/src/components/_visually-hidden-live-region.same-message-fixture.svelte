<script lang="ts">
  /**
   * Test-only fixture: a parent that holds the announcement in `$state` and
   * re-assigns the SAME string on each click while bumping `announcementSequence`.
   * This reproduces the real consumer path (e.g. tag-input adding the same tag
   * twice) that a `rerender({ message })` call cannot — `rerender` always drives
   * the prop from outside and so never exercises Svelte 5's same-value `$state`
   * no-op. Used by `_visually-hidden-live-region.test.ts`.
   */
  import VisuallyHiddenLiveRegion from './_visually-hidden-live-region.svelte';

  let message = $state('');
  let announcementSequence = $state(0);

  function announceCopied(): void {
    message = 'Copied.';
    announcementSequence += 1;
  }
</script>

<button type="button" onclick={announceCopied}>Announce copied</button>

<VisuallyHiddenLiveRegion {message} {announcementSequence} />
