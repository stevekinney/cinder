# PageHeader

Page-level heading row that pairs a required title with optional metadata and optional trailing actions.

## Usage

```svelte
<script lang="ts">
  import PageHeader from '@lostgradient/cinder/page-header';
</script>

<PageHeader title="Approvals" />
```

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                      |
| ---------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Additional class names merged with `.cinder-page-header`.                                                                        |
| `meta`     | `string`   | no       | —       | Optional supporting metadata displayed beside the title.                                                                         |
| `title`    | `string`   | yes      | —       | Page-level heading text. Rendered as `<h1>`.                                                                                     |
| `children` | `(opaque)` | no       | —       | Optional trailing actions (buttons, menus, controls). Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
