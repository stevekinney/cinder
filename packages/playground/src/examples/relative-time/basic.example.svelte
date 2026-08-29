<script lang="ts" module>
  export const title = 'RelativeTime';
  export const description =
    'Displays a localized label for a timestamp relative to the current time.';
</script>

<script lang="ts">
  import { RelativeTime } from '@lostgradient/cinder/relative-time';

  const yesterday = new Date(Date.now() - 86_400_000);
</script>

<RelativeTime date={yesterday} tick={false} />
