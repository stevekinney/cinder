# Tab

A Tab component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Tab from 'cinder/tab';
</script>

<Tab />
```

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                              |
| ---------- | ---------- | -------- | ------- | ------------------------------------------------------------------------ |
| `class`    | `string`   | no       | —       | Additional class names merged with `.cinder-tab`.                        |
| `disabled` | `boolean`  | no       | —       | Disables this single tab. The panel content is hidden but its DOM stays. |
| `id`       | `string`   | no       | —       | Optional explicit id override; auto-generated otherwise for ARIA wiring. |
| `value`    | `string`   | yes      | —       | Identifier — matches the value of the corresponding TabPanel.            |
| `children` | `(opaque)` | —        | —       | function-or-snippet                                                      |
| `trailing` | `(opaque)` | —        | —       | function-or-snippet                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
