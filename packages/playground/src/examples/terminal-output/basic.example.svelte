<script lang="ts" module>
  export const title = 'Basic terminal output';
  export const description = 'Render read-only output with ANSI colors and progress updates.';
</script>

<script lang="ts">
  import { TerminalOutput } from '@lostgradient/cinder/terminal-output';
  const value = '\u001b[32mPASS\u001b[0m build\n\u001b[33mWARN\u001b[0m cache miss';
</script>

<TerminalOutput {value} />
