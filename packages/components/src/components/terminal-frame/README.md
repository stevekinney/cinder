# TerminalFrame

`TerminalFrame` supplies chrome, connection state, recovery UI, and character-cell resize reporting around a consumer-owned real PTY renderer. It does not implement a terminal emulator or own a transport. Resize callbacks receive `{ cols, rows }`.

Use `TerminalOutput` for read-only ANSI streams. Use `TerminalFrame` when the child content is an interactive terminal implementation whose backend needs `{ cols, rows }` resize updates.

## Usage

```svelte
<script lang="ts">
  import { TerminalFrame, type TerminalFrameDimensions } from '@lostgradient/cinder/terminal-frame';

  let dimensions = $state<TerminalFrameDimensions>({ cols: 80, rows: 24 });
</script>

<TerminalFrame
  title="Build shell"
  status="connected"
  onDimensionsChange={(nextDimensions) => (dimensions = nextDimensions)}
>
  <textarea
    aria-label="Interactive shell"
    rows={dimensions.rows}
    cols={dimensions.cols}
    value="$ bun run dev"
  ></textarea>
</TerminalFrame>
```
