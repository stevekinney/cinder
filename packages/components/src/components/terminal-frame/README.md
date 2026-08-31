# TerminalFrame

`TerminalFrame` supplies chrome, connection state, recovery UI, and character-cell resize reporting around a consumer-owned real PTY renderer. It does not implement a terminal emulator or own a transport. Resize callbacks receive `{ cols, rows }`.

Use `TerminalOutput` for read-only ANSI streams. Use `TerminalFrame` when the child content is an interactive terminal implementation whose backend needs `{ cols, rows }` resize updates.

## Usage

```svelte
<script lang="ts">
  import { TerminalFrame } from '@lostgradient/cinder/terminal-frame';
</script>

<TerminalFrame title="Build shell" status="connected">
  <div role="log" aria-label="Interactive shell">$ bun run dev</div>
</TerminalFrame>
```
