<script lang="ts" module>
  export const title = 'Overlap and order';
  export const description = 'Customize overlap amount, shape, size, and visible stacking order.';
</script>

<script lang="ts">
  import { AvatarGroup } from '@lostgradient/cinder/avatar-group';

  const avatars = [
    { id: 'ada', name: 'Ada Lovelace' },
    { id: 'grace', name: 'Grace Hopper' },
    { id: 'katherine', name: 'Katherine Johnson' },
    { id: 'dorothy', name: 'Dorothy Vaughan' },
  ];
</script>

<div class="example-preview-row">
  <AvatarGroup {avatars} overlap="0.5rem" zOrder="first-on-top" size="lg" />
  <AvatarGroup {avatars} overlap="1rem" zOrder="last-on-top" shape="square" />
</div>
