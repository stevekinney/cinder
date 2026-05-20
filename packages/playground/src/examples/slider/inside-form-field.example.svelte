<script lang="ts" module>
  export const title = 'Slider inside FormField';
  export const description =
    'Compose `Slider` with `FormField` for label, helper text, and error wiring.';
</script>

<script lang="ts">
  import { FormField } from 'cinder/form-field';
  import { Slider } from 'cinder/slider';
  let value = $state(50);
</script>

<form style="display: flex; flex-direction: column; gap: 1rem; max-width: 24rem;">
  <FormField id="quality" label="Quality" description="Higher values produce larger files.">
    <Slider
      label="Quality"
      {value}
      min={0}
      max={100}
      step={10}
      name="quality"
      onchange={(next) => {
        value = next;
      }}
    />
  </FormField>
</form>
