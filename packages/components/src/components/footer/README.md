# Footer

Footer layout primitive for brand text, grouped links, and a legal row.

## Usage

```svelte
<script lang="ts">
  import { Footer } from '@lostgradient/cinder/footer';

  const groups = [
    { id: 'product', title: 'Product', links: [{ id: 'docs', label: 'Docs', href: '/docs' }] },
  ];
</script>

<Footer brand="Acme" {groups} copyright="© 2026 Acme" />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                  |
| ------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `brand`       | `string`   | no       | —       | Optional brand/title text rendered in the first column.                                                                      |
| `class`       | `string`   | no       | —       | Additional classes merged on the root element.                                                                               |
| `copyright`   | `string`   | no       | —       | Copyright text in the legal row.                                                                                             |
| `description` | `string`   | no       | —       | Optional supporting copy rendered under brand.                                                                               |
| `label`       | `string`   | no       | —       | Accessible label for the footer landmark.                                                                                    |
| `groups`      | `(opaque)` | no       | —       | Link groups rendered as columns in the main area. Not expressible in JSON Schema; see the component types for the signature. |
| `legalLinks`  | `(opaque)` | no       | —       | Additional links rendered in the legal row. Not expressible in JSON Schema; see the component types for the signature.       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->
