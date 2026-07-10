<script lang="ts" module>
  export type TagInputFormFixtureProps = {
    name?: string;
    value?: string[];
    defaultValue?: string[];
    max?: number;
    validate?: (tag: string) => boolean | string;
    allowDuplicates?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    commitOnSubmit?: boolean;
    onchange?: (tags: string[]) => void;
    onsubmit?: (event: SubmitEvent) => void;
  };
</script>

<script lang="ts">
  import TagInput from '../../components/tag-input/tag-input.svelte';

  let {
    name,
    value,
    defaultValue,
    max,
    validate,
    allowDuplicates,
    disabled,
    readonly,
    commitOnSubmit,
    onchange,
    onsubmit,
  }: TagInputFormFixtureProps = $props();

  const tagInputProps = $derived({
    ...(name !== undefined ? { name } : {}),
    ...(value !== undefined ? { value } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(validate !== undefined ? { validate } : {}),
    ...(allowDuplicates !== undefined ? { allowDuplicates } : {}),
    ...(disabled !== undefined ? { disabled } : {}),
    ...(readonly !== undefined ? { readonly } : {}),
    ...(commitOnSubmit !== undefined ? { commitOnSubmit } : {}),
    ...(onchange !== undefined ? { onchange } : {}),
  });
</script>

<form {onsubmit}>
  <TagInput {...tagInputProps} />
  <button>Save</button>
</form>
