# SideNavigationGroup

A SideNavigationGroup component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import SideNavigationGroup from 'cinder/side-navigation-group';
</script>

<SideNavigationGroup />
```

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                    |
| ---------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `disabled` | `boolean`  | no       | —       | When true, the disclosure button is disabled. Default: false.                                                                  |
| `expanded` | `boolean`  | no       | —       | Whether the group is expanded. Bindable. Default: true.                                                                        |
| `id`       | `string`   | no       | —       | Optional stable id for the root <li>. Trigger uses `${id}-trigger`, panel uses `${id}-panel`. If omitted, generated via useId. |
| `label`    | `string`   | yes      | —       | Visible section header label.                                                                                                  |
| `badge`    | `(opaque)` | —        | —       | function-or-snippet                                                                                                            |
| `class`    | `(opaque)` | —        | —       | unknown-shape                                                                                                                  |
| `icon`     | `(opaque)` | —        | —       | function-or-snippet                                                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
