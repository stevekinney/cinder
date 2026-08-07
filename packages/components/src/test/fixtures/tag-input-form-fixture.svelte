<script lang="ts" module>
  export type TagInputFormFixtureProps = {
    name?: string;
    value?: string[];
    defaultValue?: string[];
    max?: number;
    validate?: (tag: string) => boolean | string;
    duplicateValuesAllowed?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    commitOnSubmit?: boolean;
    onValueChange?: (tags: string[]) => void;
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
    duplicateValuesAllowed,
    disabled,
    readonly,
    commitOnSubmit,
    onValueChange,
    onsubmit,
  }: TagInputFormFixtureProps = $props();

  const tagInputProps = $derived({
    ...(name !== undefined ? { name } : {}),
    ...(value !== undefined ? { value } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(validate !== undefined ? { validate } : {}),
    ...(duplicateValuesAllowed !== undefined ? { duplicateValuesAllowed } : {}),
    ...(disabled !== undefined ? { disabled } : {}),
    ...(readonly !== undefined ? { readonly } : {}),
    ...(commitOnSubmit !== undefined ? { commitOnSubmit } : {}),
    ...(onValueChange !== undefined ? { onValueChange } : {}),
  });
</script>

<form {onsubmit}>
  <TagInput {...tagInputProps} />
  <button>Save</button>
</form>
