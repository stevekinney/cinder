# ScrollArea

A bounded scrolling container that constrains overflowing content within a max height or width while keeping the native scrollbar themed and the viewport keyboard-focusable.

## Usage

```svelte
<script lang="ts">
  import ScrollArea from 'cinder/scroll-area';
</script>

<ScrollArea />
```

## Props

<!-- generated:props:start -->

| Prop        | Type                                                                                                               | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabel` | `string`                                                                                                           | no       | —       | Accessible name for the scroll region. When provided on neutral containers, the container also gets `role="region"` so assistive technology treats it as a landmark. Semantic tags keep their native roles. Provide this when the scroll area represents a meaningful section (a chat transcript, a code panel) — omit it for purely decorative scrolling chrome. This is the single source of truth for the accessible name; pass it through this prop rather than the raw `aria-label` HTML attribute so the landmark role and label stay coupled. |
| `as`        | `"article"` \| `"aside"` \| `"div"` \| `"li"` \| `"main"` \| `"nav"` \| `"ol"` \| `"pre"` \| `"section"` \| `"ul"` | no       | —       | Element tag to render. Defaults to `'div'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `class`     | `string`                                                                                                           | no       | —       | Additional classes merged onto the scroll viewport.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `direction` | `"vertical"` \| `"horizontal"` \| `"both"`                                                                         | no       | —       | Axis to allow scrolling on. Defaults to `'vertical'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `maxHeight` | `string`                                                                                                           | no       | —       | Maximum block size of the scroll viewport (any valid CSS length).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `maxWidth`  | `string`                                                                                                           | no       | —       | Maximum inline size of the scroll viewport (any valid CSS length).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tabindex`  | `number`                                                                                                           | no       | —       | Override the default focusable behavior. The component sets `tabindex="0"` by default so keyboard users can scroll the viewport with arrow keys. Pass `tabindex={-1}` to opt out when the scroll area wraps content that is guaranteed not to overflow, or when the container is focused programmatically rather than via tab order.                                                                                                                                                                                                                 |
| `children`  | `(opaque)`                                                                                                         | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
