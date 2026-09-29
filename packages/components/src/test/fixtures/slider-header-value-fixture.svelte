<script lang="ts" module>
  export type SliderHeaderValueFixtureProps = {
    wrapInFormField?: boolean;
    headerVisible?: boolean;
    withDisplayValue?: boolean;
    value?: number;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import Slider from '../../components/slider/slider.svelte';

  let {
    wrapInFormField = false,
    headerVisible = true,
    withDisplayValue = false,
    value = 7,
  }: SliderHeaderValueFixtureProps = $props();

  const displayValue = (nextValue: number) => `${nextValue} notes · C4–B4`;
  // `exactOptionalPropertyTypes` rejects passing `displayValue={undefined}`
  // outright — an optional prop may be omitted, but not explicitly set to
  // `undefined`. Spreading an empty object omits the key entirely instead.
  const displayValueProp = $derived(withDisplayValue ? { displayValue } : {});
</script>

{#if wrapInFormField}
  <FormField id="scale" label="Scale">
    <Slider label="Scale" {value} {headerVisible} min={0} max={12} {...displayValueProp} />
  </FormField>
{:else}
  <Slider label="Scale" {value} {headerVisible} min={0} max={12} {...displayValueProp} />
{/if}
