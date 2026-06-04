<script lang="ts" module>
  export const title = 'Basic avatar';
  export const description = 'Image variant alongside an initials fallback.';
</script>

<script lang="ts">
  import { Avatar } from '@lostgradient/cinder/avatar';
</script>

<div class="example-preview-row">
  <Avatar src="https://i.pravatar.cc/96?img=12" name="Ada Lovelace" />
  <Avatar name="Ada Lovelace" />
  <Avatar name="Grace Hopper" />
  <Avatar />
</div>
