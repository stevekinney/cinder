# Typography

Renders text with a named typographic variant mapped to the design token scale.

## Usage

```svelte
<script lang="ts">
  import { Typography } from '@lostgradient/cinder/typography';
</script>
```

## Guidance

### Use When

- Applying a named typographic style (heading, body, caption) with semantic HTML.

### Avoid When

- Rendering inline text inside a paragraph — use a plain `<span>` with CSS.

## Props

<!-- generated:props:start -->

| Prop           | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Required | Default   | Description                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------- | ---------------------------------------------------------------------------- |
| `class`        | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | no       | —         | Additional class names merged with `.cinder-typography`.                     |
| `component`    | `"object"` \| `"h1"` \| `"h2"` \| `"h3"` \| `"h4"` \| `"h5"` \| `"h6"` \| `"caption"` \| `"label"` \| `"a"` \| `"abbr"` \| `"address"` \| `"article"` \| `"aside"` \| `"audio"` \| `"b"` \| `"bdi"` \| `"bdo"` \| `"blockquote"` \| `"body"` \| `"button"` \| `"canvas"` \| `"cite"` \| `"code"` \| `"colgroup"` \| `"data"` \| `"datalist"` \| `"dd"` \| `"del"` \| `"details"` \| `"dfn"` \| `"dialog"` \| `"div"` \| `"dl"` \| `"dt"` \| `"em"` \| `"fieldset"` \| `"figcaption"` \| `"figure"` \| `"footer"` \| `"form"` \| `"head"` \| `"header"` \| `"hgroup"` \| `"html"` \| `"i"` \| `"iframe"` \| `"ins"` \| `"kbd"` \| `"legend"` \| `"li"` \| `"main"` \| `"map"` \| `"mark"` \| `"menu"` \| `"meter"` \| `"nav"` \| `"noscript"` \| `"ol"` \| `"optgroup"` \| `"option"` \| `"output"` \| `"p"` \| `"picture"` \| `"pre"` \| `"progress"` \| `"q"` \| `"rp"` \| `"rt"` \| `"ruby"` \| `"s"` \| `"samp"` \| `"script"` \| `"search"` \| `"section"` \| `"select"` \| `"slot"` \| `"small"` \| `"span"` \| `"strong"` \| `"style"` \| `"sub"` \| `"summary"` \| `"sup"` \| `"table"` \| `"tbody"` \| `"td"` \| `"template"` \| `"textarea"` \| `"tfoot"` \| `"th"` \| `"thead"` \| `"time"` \| `"title"` \| `"tr"` \| `"u"` \| `"ul"` \| `"var"` \| `"video"` | no       | —         | Override the rendered HTML element while keeping the variant's visual style. |
| `gutterBottom` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | no       | `false`   | When true, adds bottom margin using the space scale.                         |
| `noWrap`       | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | no       | `false`   | When true, constrains to a single line with ellipsis overflow.               |
| `variant`      | `"h1"` \| `"h2"` \| `"h3"` \| `"h4"` \| `"h5"` \| `"h6"` \| `"subtitle1"` \| `"subtitle2"` \| `"body1"` \| `"body2"` \| `"caption"` \| `"overline"` \| `"label"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | no       | `"body1"` | Named typographic style to apply.                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
