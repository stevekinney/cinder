<script lang="ts" module>
  export const title = 'Validated email tags';
  export const description =
    'Keep the value controlled and reject entries that are not email addresses.';
</script>

<script lang="ts">
  import { FormField, TagInput } from 'cinder';

  let tags = $state<string[]>([]);

  function validateEmailTag(tag: string): boolean | string {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tag) ? true : 'Enter a valid email address.';
  }
</script>

<FormField id="validated-tag-input" label="Guests" description="Enter one email address per guest.">
  <TagInput
    value={tags}
    placeholder="guest@example.com"
    validate={validateEmailTag}
    onchange={(nextTags) => {
      tags = nextTags;
    }}
  />
</FormField>
