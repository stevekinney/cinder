<script lang="ts" module>
  /**
   * Screen reader status regions for the chat container.
   *
   * Provides:
   * - A status region showing message count
   * - A polite live region for announcing new messages
   * - An assertive live region for urgent action-required announcements
   */
  export type ChatStatusAnnouncerProps = {
    /** ID for the status element (used by aria-describedby) */
    statusId: string;
    /** Total number of messages in the conversation */
    messageCount: number;
    /** Current screen reader announcement message */
    announcerMessage: string;
    /** Urgent announcement for assertive live region (tool approval, etc.) */
    assertiveMessage?: string;
  };
</script>

<script lang="ts">
  let { statusId, messageCount, announcerMessage, assertiveMessage }: ChatStatusAnnouncerProps =
    $props();
</script>

<!-- Screen reader status -->
<div id={statusId} class="cinder-sr-only">
  {messageCount} messages in conversation
</div>

<!-- Screen reader announcements (polite — does not interrupt current reading) -->
<div class="cinder-sr-only" aria-live="polite" aria-atomic="true">
  {announcerMessage}
</div>

<!-- Assertive announcements — interrupts current reading (tool approval, urgent actions).
     Always rendered so the browser has registered the live region before content
     is injected; mounting with pre-existing text is not reliably announced. -->
<div class="cinder-sr-only" aria-live="assertive" aria-atomic="true">{assertiveMessage ?? ''}</div>
