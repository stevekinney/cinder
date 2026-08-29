# TerminalOutput

Read-only ANSI process output. It supports SGR 16-color foregrounds, bold/reset, carriage-return rewrites, and erase-line control sequences. It does not own a PTY or accept terminal input.

```svelte
<TerminalOutput value={'\u001b[32mready\u001b[0m\n'} />
```
