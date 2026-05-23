# AspectRatio

Generic wrapper that preserves a fixed aspect ratio for arbitrary embedded content using the native CSS `aspect-ratio` property.

## Usage

```svelte
<script lang="ts">
  import AspectRatio from 'cinder/aspect-ratio';
</script>

<AspectRatio>
  <div>Media content</div>
</AspectRatio>
```

For iframe and video embeds, make the child fill the positioned wrapper:

```svelte
<AspectRatio ratio="16 / 9">
  <iframe
    title="Example video"
    src="https://example.com/embed"
    style="position: absolute; inset: 0; inline-size: 100%; block-size: 100%; border: 0;"
  ></iframe>
</AspectRatio>
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Required | Default    | Description                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------- |
| `as`       | `"object"` \| `"a"` \| `"abbr"` \| `"address"` \| `"article"` \| `"aside"` \| `"audio"` \| `"b"` \| `"bdi"` \| `"bdo"` \| `"blockquote"` \| `"body"` \| `"button"` \| `"canvas"` \| `"caption"` \| `"cite"` \| `"code"` \| `"colgroup"` \| `"data"` \| `"datalist"` \| `"dd"` \| `"del"` \| `"details"` \| `"dfn"` \| `"dialog"` \| `"div"` \| `"dl"` \| `"dt"` \| `"em"` \| `"fieldset"` \| `"figcaption"` \| `"figure"` \| `"footer"` \| `"form"` \| `"h1"` \| `"h2"` \| `"h3"` \| `"h4"` \| `"h5"` \| `"h6"` \| `"head"` \| `"header"` \| `"hgroup"` \| `"html"` \| `"i"` \| `"iframe"` \| `"ins"` \| `"kbd"` \| `"label"` \| `"legend"` \| `"li"` \| `"main"` \| `"map"` \| `"mark"` \| `"menu"` \| `"meter"` \| `"nav"` \| `"noscript"` \| `"ol"` \| `"optgroup"` \| `"option"` \| `"output"` \| `"p"` \| `"picture"` \| `"pre"` \| `"progress"` \| `"q"` \| `"rp"` \| `"rt"` \| `"ruby"` \| `"s"` \| `"samp"` \| `"script"` \| `"search"` \| `"section"` \| `"select"` \| `"slot"` \| `"small"` \| `"span"` \| `"strong"` \| `"style"` \| `"sub"` \| `"summary"` \| `"sup"` \| `"table"` \| `"tbody"` \| `"td"` \| `"template"` \| `"textarea"` \| `"tfoot"` \| `"th"` \| `"thead"` \| `"time"` \| `"title"` \| `"tr"` \| `"u"` \| `"ul"` \| `"var"` \| `"video"` | no       | `"div"`    | Element tag to render.                                                  |
| `class`    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | no       | —          | Additional classes merged onto the root element.                        |
| `overflow` | `"hidden"` \| `"visible"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | no       | `"hidden"` | Overflow behavior for overflowing content.                              |
| `ratio`    | `string` \| `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | no       | `"16/9"`   | Aspect ratio to apply. Accepts any valid native CSS aspect-ratio value. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
