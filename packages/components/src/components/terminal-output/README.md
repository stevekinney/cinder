# TerminalOutput

Read-only ANSI process output. It supports SGR 16-color foregrounds, bold/reset, carriage-return rewrites, and erase-line control sequences. It does not own a PTY or accept terminal input. While `followLatest` is true (the default), appended output stays anchored to the latest line; scrolling away pauses following until the viewport reaches the end again.

```svelte
<TerminalOutput aria-label="Build output" value={'\u001b[32mready\u001b[0m\n'} />
```

## Usage

```svelte
<script lang="ts">
  import { TerminalOutput } from '@lostgradient/cinder/terminal-output';
  const value = '\u001b[32mPASS\u001b[0m build\n\u001b[33mWARN\u001b[0m cache miss';
</script>

<TerminalOutput {value} />
```
