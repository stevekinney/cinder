# FormSection

Groups related form fields under a heading with optional description and layout control.

## Usage

```svelte
<script lang="ts">
  import FormField from '@lostgradient/cinder/form-field';
  import FormSection from '@lostgradient/cinder/form-section';
  import Input from '@lostgradient/cinder/input';
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
  <FormField id="street" label="Street address">
    <Input id="street" bind:value={street} placeholder="123 Main St" />
  </FormField>
  <FormField id="city" label="City">
    <Input id="city" bind:value={city} placeholder="Springfield" />
  </FormField>
  <FormField id="postal-code" label="Postal code">
    <Input id="postal-code" bind:value={postalCode} placeholder="12345" />
  </FormField>
</FormSection>
```

## Props

<!-- generated:props:start -->

| Prop           | Type                            | Required | Default | Description                                                                                                                     |
| -------------- | ------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `as`           | `"section"` \| `"fieldset"`     | no       | —       | Wrapper element. Default.                                                                                                       |
| `class`        | `string`                        | no       | —       | Additional class merged with `.cinder-form-section`.                                                                            |
| `columns`      | `2` \| `3` \| `4` \| `1`        | no       | —       | Column ceiling. Container queries pick the actual rendered count. Default 2.                                                    |
| `description`  | `string`                        | no       | —       | Optional descriptive paragraph rendered under the heading/legend.                                                               |
| `heading`      | `string`                        | no       | —       | Heading text rendered as `<h{level}>`.                                                                                          |
| `headingLevel` | `2` \| `3` \| `4` \| `5` \| `6` | no       | —       | Heading level. Default 2.                                                                                                       |
| `children`     | `(opaque)`                      | yes      | —       | Children (FormField instances or arbitrary content). Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
