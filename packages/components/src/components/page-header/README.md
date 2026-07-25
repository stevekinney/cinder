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

| Prop          | Type       | Required | Default | Description                                                                                                                                                           |
| ------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`   | no       | —       | Additional class names merged with `.cinder-page-header`.                                                                                                             |
| `actions`     | `(opaque)` | no       | —       | Optional trailing actions (buttons, menus, controls). Not expressible in JSON Schema; see the component types for the signature.                                      |
| `breadcrumbs` | `(opaque)` | no       | —       | Optional breadcrumb navigation rendered above the heading row. Not expressible in JSON Schema; see the component types for the signature.                             |
| `description` | `(opaque)` | no       | —       | Optional supporting content rendered below the title; snippets must emit phrasing content. Not expressible in JSON Schema; see the component types for the signature. |
| `title`       | `(opaque)` | yes      | —       | Page-level heading content. Rendered inside `<h1>`; snippets must emit phrasing content. Not expressible in JSON Schema; see the component types for the signature.   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
