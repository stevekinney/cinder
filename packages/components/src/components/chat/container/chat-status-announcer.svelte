<script lang="ts" module>
  /**
   * Screen reader status regions for the chat container.
   *
   * Provides:
   * - A status region showing message count
   * - A live region for announcing new messages
   */
  export type ChatStatusAnnouncerProps = {
    /** ID for the status element (used by aria-describedby) */
    statusId: string;
    /** Total number of messages in the conversation */
    messageCount: number;
    /** Current screen reader announcement message */
    announcerMessage: string;
  };
</script>

<script lang="ts">
  let { statusId, messageCount, announcerMessage }: ChatStatusAnnouncerProps = $props();
</script>

<!-- Screen reader status -->
<div id={statusId} class="sr-only">
  {messageCount} messages in conversation
</div>

<!-- Screen reader announcements -->
<div class="sr-only" aria-live="polite" aria-atomic="true">
  {announcerMessage}
</div>

<style>
  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
