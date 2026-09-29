<script lang="ts" module>
  import type { ToolCallMessagePart } from '../../utilities/types.ts';

  export type ToolCallPartProps = {
    /** The tool-call render part (call + optional resolved result). */
    part: ToolCallMessagePart;
    /** Owning message occurrence ID, used to avoid duplicated nested timeline IDs. */
    messageId?: string | undefined;
    /** Whether the tool-call card is expanded. Owned by the message. */
    expanded?: boolean;
    /** Called when the card's disclosure toggle is activated. */
    onToggle?: (() => void) | undefined;
    activityActive?: boolean;
  };
</script>

<script lang="ts">
  import ToolCallTimeline from '../tool-call-timeline.svelte';

  let {
    part,
    messageId,
    expanded = false,
    onToggle,
    activityActive = true,
  }: ToolCallPartProps = $props();

  const pairs = $derived([part.pair]);
  const timelineMessageId = $derived(
    messageId === undefined ? part.pair.call.id : `${messageId}-tool-call-${part.pair.call.id}`,
  );
  const describeToolCall = $derived(
    part.presentation === undefined ? undefined : () => part.presentation,
  );
</script>

<!--
  A tool invocation paired with its result, if one has arrived. The timeline
  owns its compact detail disclosure state so all tool activity shares one
  hierarchy.
-->
<ToolCallTimeline
  {pairs}
  messageId={timelineMessageId}
  {...describeToolCall === undefined ? {} : { describeToolCall }}
  {expanded}
  {onToggle}
  {activityActive}
/>
