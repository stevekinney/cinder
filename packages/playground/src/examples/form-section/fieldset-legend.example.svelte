<script lang="ts" module>
  export const title = 'Fieldset with legend';
  export const description =
    'Use as="fieldset" for semantically grouped inputs. The heading prop becomes a <legend>.';
</script>

<script lang="ts">
  import { FormField, FormSection, Input } from '../../../../components/src/index.ts';

  let street = $state('');
  let city = $state('');
  let postalCode = $state('');
</script>

<FormSection
  as="fieldset"
  heading="Shipping address"
  description="Where should we send your order?"
  columns={2}
>
  <FormField id="street" label="Street address" class="cinder-form-section__span-2">
    <Input id="street" bind:value={street} placeholder="123 Main St" />
  </FormField>
  <FormField id="city" label="City">
    <Input id="city" bind:value={city} placeholder="Springfield" />
  </FormField>
  <FormField id="postal-code" label="Postal code">
    <Input id="postal-code" bind:value={postalCode} placeholder="12345" />
  </FormField>
</FormSection>
