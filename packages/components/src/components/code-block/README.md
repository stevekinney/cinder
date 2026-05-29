# CodeBlock

A CodeBlock component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import CodeBlock from 'cinder/code-block';
</script>

<CodeBlock />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                       |
| ------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`   | no       | —       | Additional class names merged with `.cinder-code-block`.                                                                                                                                                                                                                                                                          |
| `code`        | `string`   | yes      | —       | The code to render.                                                                                                                                                                                                                                                                                                               |
| `copyable`    | `boolean`  | no       | —       | When true, render a copy button in the header.                                                                                                                                                                                                                                                                                    |
| `highlight`   | `boolean`  | no       | —       | Whether to highlight. Defaults to `true` whenever `language` is set. `highlight={false}` is an absolute off switch: it disables ALL highlighting — including an explicit `highlighter` prop — and triggers no Shiki import. The block renders the escaped plain `<pre><code>` fallback while keeping the `language` header label. |
| `language`    | `string`   | no       | —       | Optional language label rendered in the header; also selects the grammar for highlighting.                                                                                                                                                                                                                                        |
| `highlighter` | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
