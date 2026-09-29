<script lang="ts" module>
  export type SliderHeaderValueRangeFixtureProps = {
    wrapInFormField?: boolean;
    headerVisible?: boolean;
    withDisplayValue?: boolean;
    value?: [number, number];
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import Slider from '../../components/slider/slider.svelte';

  let {
    wrapInFormField = false,
    headerVisible = true,
    withDisplayValue = false,
    value = [0, 22],
  }: SliderHeaderValueRangeFixtureProps = $props();

  const displayValue = ([low, high]: [number, number]) => `${low}–${high}`;
  // `exactOptionalPropertyTypes` rejects passing `displayValue={undefined}`
  // outright — an optional prop may be omitted, but not explicitly set to
  // `undefined`. Spreading an empty object omits the key entirely instead.
  const displayValueProp = $derived(withDisplayValue ? { displayValue } : {});
</script>

{#if wrapInFormField}
  <FormField id="octave-range" label="Octave range">
    <Slider
      label="Octave range"
      mode="range"
      {value}
      {headerVisible}
      min={0}
      max={22}
      {...displayValueProp}
    />
  </FormField>
{:else}
  <Slider
    label="Octave range"
    mode="range"
    {value}
    {headerVisible}
    min={0}
    max={22}
    {...displayValueProp}
  />
{/if}
