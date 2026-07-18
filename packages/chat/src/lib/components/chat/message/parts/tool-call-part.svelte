<script lang="ts" module>
  import type { ToolCallMessagePart } from '../../utilities/types.ts';

  export type ToolCallPartProps = {
    /** The tool-call render part (call + optional resolved result). */
    part: ToolCallMessagePart;
    /** Whether the tool-call card is expanded. Owned by the message. */
    expanded?: boolean;
    /** Called when the card's disclosure toggle is activated. */
    ontoggle?: (() => void) | undefined;
  };
</script>

<script lang="ts">
  import ToolCallGroup from '../tool-call-group.svelte';

  const noop = (): void => {};

  let { part, expanded = false, ontoggle }: ToolCallPartProps = $props();

  // ToolCallGroup's `ontoggle` is non-optional under exactOptionalPropertyTypes;
  // collapse an omitted handler to a noop so we never forward `undefined`.
  const handleToggle = $derived(ontoggle ?? noop);
</script>

<!--
  A tool invocation paired with its result, if one has arrived. The disclosure
  state stays owned by the message (forwarded through `expanded`/`ontoggle`) so
  the historical "Show more / less" coupling is preserved unchanged.
-->
<ToolCallGroup pair={part.pair} {expanded} ontoggle={handleToggle} />
