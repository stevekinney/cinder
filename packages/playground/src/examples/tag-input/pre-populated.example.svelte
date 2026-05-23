<script lang="ts" module>
  export const title = 'Pre-populated tags';
  export const description = 'Start uncontrolled with existing tags and keep editing in place.';
</script>

<script lang="ts">
  import { FormField, TagInput } from 'cinder';
</script>

<FormField
  id="prepopulated-tag-input"
  label="Technologies"
  description="Review the initial stack and remove anything that does not apply."
>
  <TagInput defaultValue={['Svelte', 'Bun', 'TypeScript']} placeholder="Add a technology…" />
</FormField>
