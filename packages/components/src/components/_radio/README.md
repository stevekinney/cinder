# Radio

A single radio option within a radio group, for mutually exclusive selection. It
reads the group's selection context and throws if rendered outside a `RadioGroup`,
so it is **namespace-only**: access it as `RadioGroup.Option`. There is no standalone
`@lostgradient/cinder/radio` import — a lone radio is semantically meaningless and would throw at
runtime. (A standalone `Checkbox`, by contrast, is a legitimate independent control.)

## Usage

```svelte
<script lang="ts">
  import { RadioGroup } from '@lostgradient/cinder/radio-group';
</script>

<RadioGroup name="plan" legend="Pricing tier">
  <RadioGroup.Option id="free" value="free" label="Free" />
  <RadioGroup.Option id="pro" value="pro" label="Pro" />
</RadioGroup>
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                             |
| ------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `description` | `string`   | no       | —       | Helper text rendered as `<p id="{id}-description">`, wired via aria-describedby.                        |
| `disabled`    | `boolean`  | no       | —       | Override the group's `disabled` for this single radio.                                                  |
| `id`          | `string`   | yes      | —       | Unique identifier — required for label association.                                                     |
| `label`       | `string`   | yes      | —       | Visible label rendered in a `<label>` element associated via `for`.                                     |
| `class`       | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature. |
| `value`       | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
