<script lang="ts" module>
  export const title = 'RelativeTime';
  export const description =
    'Displays a localized label for a timestamp relative to the current time.';
</script>

<script lang="ts">
  import { RelativeTime } from '@lostgradient/cinder/relative-time';
</script>

<RelativeTime date="2026-08-28T18:00:00Z" />
