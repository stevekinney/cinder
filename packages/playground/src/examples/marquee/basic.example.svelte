<script lang="ts" module>
  export const title = 'Announcement ticker';
  export const description = 'Continuously loop short announcements with pause on hover and focus.';
</script>

<script lang="ts">
  import { Marquee } from '@lostgradient/cinder/marquee';
</script>

<Marquee label="Announcements">
  {#snippet children()}
    <span style="font-weight: 600;">New dark theme tokens are live</span>
    <span>•</span>
    <span>v0.4.1 now available</span>
    <span>•</span>
    <span>Try the updated component decision aid</span>
  {/snippet}
</Marquee>
