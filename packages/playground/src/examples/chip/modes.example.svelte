<script lang="ts" module>
  export const title = 'Chip modes';
  export const description = 'Display, toggle, and removable chip modes.';
</script>

<script lang="ts">
  import { Chip } from '@lostgradient/cinder/chip';
  let pressed = $state(false);
  let tags = $state(['JavaScript', 'TypeScript', 'Svelte']);
</script>

<!-- Manual check: click anywhere on the chip label text — onremove must not fire. -->
<div class="example-preview-row">
  <Chip label="Display" />

  <Chip
    mode="toggle"
    label={pressed ? 'Active' : 'Inactive'}
    {pressed}
    onpressedchange={(value) => {
      pressed = value;
    }}
  />

  {#each tags as tag (tag)}
    <Chip
      mode="removable"
      label={tag}
      onremove={() => {
        tags = tags.filter((t) => t !== tag);
      }}
    />
  {/each}
</div>
