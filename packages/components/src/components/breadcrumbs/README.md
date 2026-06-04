# Breadcrumbs

A navigation trail that shows the current page's position in a hierarchy.

## Usage

```svelte
<script lang="ts">
  import Breadcrumbs from '@lostgradient/cinder/breadcrumbs';
</script>

<Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Docs' }]} />
```

## Props

<!-- generated:props:start -->

| Prop        | Type     | Required | Default        | Description                                               |
| ----------- | -------- | -------- | -------------- | --------------------------------------------------------- |
| `class`     | `string` | no       | —              | Additional class names merged with `.cinder-breadcrumbs`. |
| `label`     | `string` | no       | `"Breadcrumb"` | Accessible name for the nav landmark.                     |
| `separator` | `string` | no       | `"/"`          | Custom string separator between entries.                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
