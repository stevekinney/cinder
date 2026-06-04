# VisuallyHidden

Hides content visually while keeping it accessible to screen readers; supports skip-link patterns via the `focusable` prop.

## Usage

```svelte
<script lang="ts">
  import VisuallyHidden from '@lostgradient/cinder/visually-hidden';
</script>

<VisuallyHidden>Screen reader only text</VisuallyHidden>
```

## Props

<!-- generated:props:start -->

| Prop        | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Required | Default  | Description                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------------------------------------------------- |
| `as`        | `"object"` \| `"a"` \| `"abbr"` \| `"address"` \| `"article"` \| `"aside"` \| `"audio"` \| `"b"` \| `"bdi"` \| `"bdo"` \| `"blockquote"` \| `"body"` \| `"button"` \| `"canvas"` \| `"caption"` \| `"cite"` \| `"code"` \| `"colgroup"` \| `"data"` \| `"datalist"` \| `"dd"` \| `"del"` \| `"details"` \| `"dfn"` \| `"dialog"` \| `"div"` \| `"dl"` \| `"dt"` \| `"em"` \| `"fieldset"` \| `"figcaption"` \| `"figure"` \| `"footer"` \| `"form"` \| `"h1"` \| `"h2"` \| `"h3"` \| `"h4"` \| `"h5"` \| `"h6"` \| `"head"` \| `"header"` \| `"hgroup"` \| `"html"` \| `"i"` \| `"iframe"` \| `"ins"` \| `"kbd"` \| `"label"` \| `"legend"` \| `"li"` \| `"main"` \| `"map"` \| `"mark"` \| `"menu"` \| `"meter"` \| `"nav"` \| `"noscript"` \| `"ol"` \| `"optgroup"` \| `"option"` \| `"output"` \| `"p"` \| `"picture"` \| `"pre"` \| `"progress"` \| `"q"` \| `"rp"` \| `"rt"` \| `"ruby"` \| `"s"` \| `"samp"` \| `"script"` \| `"search"` \| `"section"` \| `"select"` \| `"slot"` \| `"small"` \| `"span"` \| `"strong"` \| `"style"` \| `"sub"` \| `"summary"` \| `"sup"` \| `"table"` \| `"tbody"` \| `"td"` \| `"template"` \| `"textarea"` \| `"tfoot"` \| `"th"` \| `"thead"` \| `"time"` \| `"title"` \| `"tr"` \| `"u"` \| `"ul"` \| `"var"` \| `"video"` | no       | `"span"` | Element tag to render.                               |
| `class`     | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | no       | —        | Additional classes merged after the utility classes. |
| `focusable` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | no       | `false`  | Reveal the element fully when focused.               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
