<script lang="ts" module>
  export const title = 'Collaborator stack';
  export const description =
    'A compact stack of visible collaborators with keyboard-discoverable names.';
</script>

<script lang="ts">
  import { AvatarGroup } from 'cinder/avatar-group';

  const avatars = [
    { id: 'ada', name: 'Ada Lovelace' },
    { id: 'grace', name: 'Grace Hopper' },
    { id: 'katherine', name: 'Katherine Johnson' },
  ];
</script>

<div class="example-preview-row">
  <AvatarGroup {avatars} aria-label="Active collaborators" />
</div>
