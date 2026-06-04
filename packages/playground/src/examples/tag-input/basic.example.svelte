<script lang="ts" module>
  export const title = 'Basic tag input';
  export const description = 'Commit free-form tags with Enter or a comma delimiter.';
</script>

<script lang="ts">
  import { FormField, TagInput } from '@lostgradient/cinder';
</script>

<FormField
  id="basic-tag-input"
  label="Topics"
  description="Press Enter or comma to turn the current text into a tag."
>
  <TagInput placeholder="Add a topic…" />
</FormField>
