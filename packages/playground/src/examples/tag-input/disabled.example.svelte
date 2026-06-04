<script lang="ts" module>
  export const title = 'Disabled tag input';
  export const description = 'Mirror a locked field that can be read but not changed.';
</script>

<script lang="ts">
  import { FormField, TagInput } from '@lostgradient/cinder';
</script>

<FormField
  id="disabled-tag-input"
  label="Protected labels"
  description="This field is disabled while the record is syncing."
  disabled={true}
>
  <TagInput defaultValue={['Synced', 'Locked']} disabled={true} placeholder="Unavailable" />
</FormField>
