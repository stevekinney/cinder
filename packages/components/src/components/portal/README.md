# Portal

Moves content into `document.body` or another host element while keeping inline rendering available as an explicit opt-out.

## Usage

```svelte
<script lang="ts">
  import Portal from '@lostgradient/cinder/portal';
</script>

<Portal>
  <div>Portaled content</div>
</Portal>
```

## Props

<!-- generated:props:start -->

| Prop                | Type               | Required | Default | Description                                                                                                                        |
| ------------------- | ------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `class`             | `string`           | no       | —       | Additional class applied to the portal wrapper element.                                                                            |
| `disabled`          | `boolean`          | no       | —       | When true, renders the content inline in normal document flow instead of teleporting it to the target.                             |
| `inheritAttributes` | `boolean`          | no       | —       | When true (default), HTML attributes passed to the portal are forwarded onto the wrapper element inside the target.                |
| `target`            | `string` \| `null` | no       | —       | CSS selector string or `null` specifying where the portal content is appended. Defaults to `document.body` when `null` or omitted. |
| `children`          | `(opaque)`         | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.         |

<!-- generated:props:end -->

`target` accepts either a selector string or an `HTMLElement`. If a selector cannot
be resolved after hydration, Portal keeps its children inline and warns in
development.

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
