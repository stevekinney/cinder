<script lang="ts" module>
  export const title = 'Basic terminal frame';
  export const description = 'Frame a connected terminal surface with status chrome.';
</script>

<script lang="ts">
  import { TerminalFrame } from '@lostgradient/cinder/terminal-frame';
</script>

<TerminalFrame title="Build shell" status="connected">
  {#snippet children()}
    <pre style="margin: 0;">$ bun run build
Build complete.</pre>
  {/snippet}
</TerminalFrame>
