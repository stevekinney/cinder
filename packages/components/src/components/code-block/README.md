# CodeBlock

Renders preformatted source code with optional client-side syntax highlighting and copy controls. The first paint may be the escaped plain-code fallback; when highlighting resolves, the block keeps the same layout metrics.

CodeBlock imports no highlighter of its own, so a consumer bundle carries only the grammars it chooses. A block highlights with its `highlighter` prop, else with the highlighter an ancestor publishes through `setCodeHighlighterContext`, and renders plain code with neither. Build a highlighter with `shikiHighlighter` over the grammars your application renders, or use `fullShikiHighlighter` for every grammar Shiki ships.

## Usage

```svelte
<script lang="ts">
  import { CodeBlock } from '@lostgradient/cinder';
  const code = `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet('world');`;
</script>

<CodeBlock {code} />
```

## Props

<!-- generated:props:start -->

| Prop                   | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                | `string`   | no       | —       | Additional class names merged with `.cinder-code-block`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `code`                 | `string`   | yes      | —       | The code to render.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `copyable`             | `boolean`  | no       | —       | When true, render a copy button in the header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `highlight`            | `boolean`  | no       | —       | Whether to highlight. Defaults to `true` whenever `language` is set and a highlighter resolves from the `highlighter` prop or from context. `highlight={false}` is an absolute off switch: it disables ALL highlighting — including an explicit `highlighter` prop and a context highlighter. The block renders the escaped plain `<pre><code>` fallback while keeping the `language` header label. When highlighting is enabled, client-side colorization may appear after first paint, but the block keeps stable layout metrics. |
| `language`             | `string`   | no       | —       | Optional language label rendered in the header; also selects the grammar for highlighting.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `languageLabelVisible` | `boolean`  | no       | —       | Whether to render the language label in the header. Default `true`. Pass `false` to keep `language`-driven highlighting without the visible header chip; with `copyable` also unset, no header renders at all.                                                                                                                                                                                                                                                                                                                      |
| `scrollFadeVisible`    | `boolean`  | no       | —       | Show a scroll-driven fade on the horizontal (inline) edges of the code viewport as a long line overflows — signals "this line continues" rather than dimming a wrapped block. Opt-in and presentation-only. The gradient terminates at partial opacity (not fully opaque) so a half-covered glyph still reads as a glyph, not as a hard cutoff. Defaults to `false`.                                                                                                                                                                |
| `highlighter`          | `(opaque)` | no       | —       | Highlighter for this instance. Receives `(code, language)` and returns an HTML string (sync or async). Takes precedence over a highlighter an ancestor published through `setCodeHighlighterContext`; with neither, the block renders unhighlighted. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-code-block-background`
- `--cinder-code-block-font-size`
- `--cinder-code-block-height`
- `--cinder-code-block-line-height`
- `--cinder-code-block-padding`

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
