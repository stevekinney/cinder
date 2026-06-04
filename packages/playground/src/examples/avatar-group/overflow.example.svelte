<script lang="ts" module>
  export const title = 'Overflow count';
  export const description =
    'Limit visible avatars and summarize hidden collaborators with a count.';
</script>

<script lang="ts">
  import { AvatarGroup } from '@lostgradient/cinder/avatar-group';

  const avatars = [
    { id: 'ada', name: 'Ada Lovelace' },
    { id: 'grace', name: 'Grace Hopper' },
    { id: 'katherine', name: 'Katherine Johnson' },
    { id: 'dorothy', name: 'Dorothy Vaughan' },
    { id: 'mary', name: 'Mary Jackson' },
    { id: 'annie', name: 'Annie Easley' },
  ];
</script>

<div class="example-preview-row">
  <AvatarGroup {avatars} maxVisible={3} overflowLabel="Three hidden collaborators" />
  <AvatarGroup {avatars} maxVisible={0} overflowLabel="Six hidden collaborators" />
</div>
