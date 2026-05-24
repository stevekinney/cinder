# Portal

Moves content into `document.body` or another host element while keeping inline rendering available as an explicit opt-out.

## Usage

```svelte
<script lang="ts">
  import Portal from 'cinder/portal';
</script>

<Portal>
  <div>Portaled content</div>
</Portal>
```

## Props

<!-- generated:props:start -->

| Prop                | Type               | Required | Default | Description |
| ------------------- | ------------------ | -------- | ------- | ----------- |
| `class`             | `string`           | no       | —       |             |
| `disabled`          | `boolean`          | no       | —       |             |
| `inheritAttributes` | `boolean`          | no       | —       |             |
| `target`            | `string` \| `null` | no       | —       |             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
