<script lang="ts" module>
  export const title = 'Basic avatar';
  export const description = 'Image variant alongside an initials fallback.';
</script>

<script lang="ts">
  import { Avatar } from '@lostgradient/cinder/avatar';

  const adaPortrait =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='currentColor' opacity='.12'/%3E%3Ccircle cx='48' cy='37' r='19' fill='currentColor' opacity='.45'/%3E%3Cpath d='M20 96c4-22 16-34 28-34s24 12 28 34' fill='currentColor' opacity='.75'/%3E%3Cpath d='M29 35c2-18 36-23 39 1-7-7-28-8-39-1' fill='currentColor'/%3E%3C/svg%3E";
</script>

<div class="example-preview-row">
  <Avatar src={adaPortrait} name="Ada Lovelace" />
  <Avatar name="Ada Lovelace" />
  <Avatar name="Grace Hopper" />
  <Avatar />
</div>
