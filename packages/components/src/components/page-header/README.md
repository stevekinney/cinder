# PageHeader

Page-level heading with named title, description, breadcrumb, and action regions.

## Usage

```svelte
<script lang="ts">
  import PageHeader from '@lostgradient/cinder/page-header';
</script>

<PageHeader title="Approvals" />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                                   | Required | Default | Description                                                                                                                               |
| -------------- | -------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`                               | no       | —       | Additional class names merged with `.cinder-page-header`.                                                                                 |
| `description`  | `string`                               | no       | —       | Optional supporting text rendered below the title; the runtime API also accepts a template-only snippet.                                  |
| `headingLevel` | `1` \| `2` \| `3` \| `4` \| `5` \| `6` | no       | —       | Heading level for the title element. Default 1.                                                                                           |
| `title`        | `string`                               | yes      | —       | Page-level heading text rendered inside the configured heading level; the runtime API also accepts a template-only snippet.               |
| `actions`      | `(opaque)`                             | no       | —       | Optional trailing actions (buttons, menus, controls). Not expressible in JSON Schema; see the component types for the signature.          |
| `breadcrumbs`  | `(opaque)`                             | no       | —       | Optional breadcrumb navigation rendered above the heading row. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
