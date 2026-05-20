<script lang="ts" module>
  export type SliderFormFieldFixtureProps = {
    renderSecond?: boolean;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import Slider from '../../components/slider.svelte';

  let { renderSecond = false }: SliderFormFieldFixtureProps = $props();
</script>

<FormField id="price" label="Price">
  <Slider label="Price" mode="range" defaultValue={[10, 90]} />
</FormField>

{#if renderSecond}
  <FormField id="quantity" label="Quantity">
    <Slider label="Quantity" mode="range" defaultValue={[1, 5]} min={0} max={10} />
  </FormField>
{/if}
