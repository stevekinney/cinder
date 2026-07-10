<script lang="ts" module>
  export type TagInputControlledFormFixtureProps = {
    name: string;
    onsubmit?: (event: SubmitEvent) => void;
  };
</script>

<script lang="ts">
  import TagInput from '../../components/tag-input/tag-input.svelte';

  let { name, onsubmit }: TagInputControlledFormFixtureProps = $props();

  let tags = $state(['Svelte']);
</script>

<form {onsubmit}>
  <TagInput
    {name}
    value={tags}
    commitOnSubmit
    onchange={(nextTags) => {
      tags = nextTags;
    }}
  />
  <button>Save</button>
</form>
