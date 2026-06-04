<script lang="ts" module>
  export const title = 'Maximum tag count';
  export const description =
    'Cap the number of committed tags and surface an inline message when the limit is reached.';
</script>

<script lang="ts">
  import { FormField, TagInput } from '@lostgradient/cinder';
</script>

<FormField
  id="max-tag-input"
  label="Three highlights"
  description="Add up to three short highlights for this release note."
>
  <TagInput max={3} placeholder="Add a highlight…" />
</FormField>
