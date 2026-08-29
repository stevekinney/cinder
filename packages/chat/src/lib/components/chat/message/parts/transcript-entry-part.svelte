<script lang="ts">
  import type { TranscriptEntryMessagePart } from '../../utilities/types.ts';

  let { part }: { part: TranscriptEntryMessagePart } = $props();

  const labels: Record<TranscriptEntryMessagePart['kind'], string> = {
    interrupted: 'Interrupted',
    redirect: 'Redirected',
    stateChange: 'State changed',
    slashCommand: 'Command',
    turnSummary: 'Turn summary',
  };
</script>

<div class="chat-transcript-entry" data-kind={part.kind} role="status">
  <span class="chat-transcript-entry__label">{labels[part.kind]}</span>
  <span>{part.content}</span>
</div>

<style>
  .chat-transcript-entry {
    display: flex;
    gap: var(--cinder-space-2);
    align-items: baseline;
    color: var(--cinder-text-muted);
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
  }

  .chat-transcript-entry__label {
    flex: none;
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-default);
  }
</style>
