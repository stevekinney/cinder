# CodeBlock

Renders preformatted source code with optional client-side syntax highlighting and copy controls.
The first paint may be the escaped plain-code fallback; when highlighting resolves, the block keeps
the same layout metrics.

## Usage

```svelte
<script lang="ts">
  import CodeBlock from '@lostgradient/cinder/code-block';
</script>

<CodeBlock />
```

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`             | `string`   | no       | —       | Additional class names merged with `.cinder-code-block`.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `code`              | `string`   | yes      | —       | The code to render.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `copyable`          | `boolean`  | no       | —       | When true, render a copy button in the header.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `highlight`         | `boolean`  | no       | —       | Whether to highlight. Defaults to `true` whenever `language` is set. `highlight={false}` is an absolute off switch: it disables ALL highlighting — including an explicit `highlighter` prop — and triggers no Shiki import. The block renders the escaped plain `<pre><code>` fallback while keeping the `language` header label. When highlighting is enabled, client-side colorization may appear after first paint, but the block keeps stable layout metrics. |
| `language`          | `string`   | no       | —       | Optional language label rendered in the header; also selects the grammar for highlighting.                                                                                                                                                                                                                                                                                                                                                                        |
| `showLanguageLabel` | `boolean`  | no       | —       | Whether to render the language label in the header. Default `true`. Pass `false` to keep `language`-driven highlighting without the visible header chip; with `copyable` also unset, no header renders at all.                                                                                                                                                                                                                                                    |
| `highlighter`       | `(opaque)` | no       | —       | Custom highlighter for this instance, used in place of the bundled Shiki default. Receives `(code, language)` and returns an HTML string (sync or async). When provided, the default highlighter is never imported. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
