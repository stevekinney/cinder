# CodeBlock

Renders syntax-highlighted source code with optional copy and line display controls.

## Usage

```svelte
<script lang="ts">
  import CodeBlock from '@lostgradient/cinder/code-block';
</script>

<CodeBlock />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`   | no       | —       | Additional class names merged with `.cinder-code-block`.                                                                                                                                                                                                                                                                                       |
| `code`        | `string`   | yes      | —       | The code to render.                                                                                                                                                                                                                                                                                                                            |
| `copyable`    | `boolean`  | no       | —       | When true, render a copy button in the header.                                                                                                                                                                                                                                                                                                 |
| `highlight`   | `boolean`  | no       | —       | Whether to highlight. Defaults to `true` whenever `language` is set. `highlight={false}` is an absolute off switch: it disables ALL highlighting — including an explicit `highlighter` prop — and triggers no Shiki import. The block renders the escaped plain `<pre><code>` fallback while keeping the `language` header label.              |
| `language`    | `string`   | no       | —       | Optional language label rendered in the header; also selects the grammar for highlighting.                                                                                                                                                                                                                                                     |
| `highlighter` | `(opaque)` | no       | —       | Custom highlighter for this instance, used in place of the bundled Shiki default. Receives `(code, language)` and returns an HTML string (sync or async). When provided, the default highlighter is never imported. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
