<script lang="ts" module>
  /**
   * Wraps a ColorField inside a `<form>` so tests can assert form-association
   * behavior (Enter-key submission, hidden mirror in `form.elements`, reset
   * listener) without each test having to scaffold its own form.
   */
  export type ColorFieldFormFixtureProps = {
    id: string;
    name?: string;
    value?: string;
    defaultValue?: string;
    alpha?: boolean;
    formats?: readonly ('hex' | 'rgb' | 'hsl')[];
    enterBehavior?: 'commit-then-submit' | 'commit-only';
    onchange?: (value: string) => void;
    onsubmit?: (event: SubmitEvent) => void;
  };
</script>

<script lang="ts">
  import ColorField from '../../components/color-field/color-field.svelte';

  let {
    id,
    name,
    value,
    defaultValue,
    alpha,
    formats,
    enterBehavior,
    onchange,
    onsubmit,
  }: ColorFieldFormFixtureProps = $props();

  const colorFieldProps = $derived({
    id,
    ...(name !== undefined ? { name } : {}),
    ...(value !== undefined ? { value } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(alpha !== undefined ? { alpha } : {}),
    ...(formats !== undefined ? { formats } : {}),
    ...(enterBehavior !== undefined ? { enterBehavior } : {}),
    ...(onchange !== undefined ? { onchange } : {}),
  });
</script>

<form {onsubmit}>
  <ColorField {...colorFieldProps} />
  <button>Save</button>
</form>
