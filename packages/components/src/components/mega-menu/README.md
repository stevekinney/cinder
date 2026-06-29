# MegaMenu

Primary navigation with wide multi-column content panels, optional hover activation, shared viewport, indicator, and nested submenu columns.

## Usage

```svelte
<script lang="ts">
  import { MegaMenu } from '@lostgradient/cinder/mega-menu';

  const items = [
    {
      id: 'products',
      label: 'Products',
      sections: [
        { id: 'all', title: 'Products', links: [{ id: 'ui', label: 'UI kit', href: '/ui' }] },
      ],
    },
  ];
</script>

<MegaMenu {items} openOnHover showViewport showIndicator />
```

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default | Description                                                                                                   |
| --------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `class`         | `string`   | no       | —       | Additional classes merged onto the root element.                                                              |
| `label`         | `string`   | no       | —       | Accessible name for the navigation landmark.                                                                  |
| `openOnHover`   | `boolean`  | no       | —       | Hover opens top-level content instead of click-only mode.                                                     |
| `showIndicator` | `boolean`  | no       | —       | Render an active trigger indicator bar.                                                                       |
| `showViewport`  | `boolean`  | no       | —       | Render the shared content viewport wrapper.                                                                   |
| `items`         | `(opaque)` | yes      | —       | Top-level trigger/content entries. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->
