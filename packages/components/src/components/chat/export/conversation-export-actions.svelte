<script lang="ts" module>
  import type { Conversation } from 'conversationalist';

  export type ExportFormat = 'markdown' | 'json';

  export interface ConversationExportActionsProps {
    /** Required unique ID for SSR stability and accessibility */
    id: string;
    /** The conversation to export */
    conversation: Conversation;
    /** Called when export succeeds */
    onexported?: (format: ExportFormat) => void;
    /** Called when export fails (clipboard error) */
    onexportfailed?: (format: ExportFormat, error: string) => void;
    /** Additional CSS classes */
    class?: string;
  }
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import { copyToClipboard } from '../../../utilities/clipboard.ts';
  import { stringifyOrNull } from '../../../utilities/stringify.ts';
  import Dropdown from '../../dropdown.svelte';
  import DropdownItem from '../../dropdown-item.svelte';
  import DropdownMenu from '../../dropdown-menu.svelte';
  import DropdownTrigger from '../../dropdown-trigger.svelte';
  import { Check, Copy, FileCode, FileText } from '../../icons/index.ts';
  import { getMessages } from 'conversationalist';
  import { messagesToMarkdown } from '../utilities';

  let {
    id,
    conversation,
    onexported,
    onexportfailed,
    class: className,
  }: ConversationExportActionsProps = $props();

  let copiedFormat = $state<ExportFormat | null>(null);

  /**
   * Exports the conversation as Markdown.
   * Uses browser-compatible messagesToMarkdown (conversationalist/markdown uses Node.js APIs).
   */
  async function handleExportMarkdown(): Promise<void> {
    const messages = getMessages(conversation, { includeHidden: false });
    const markdown = messagesToMarkdown(messages);

    const copied = await copyToClipboard(markdown);
    if (copied) {
      copiedFormat = 'markdown';
      onexported?.('markdown');
    } else {
      onexportfailed?.('markdown', 'Clipboard access denied. Please copy manually.');
    }
  }

  /**
   * Exports the conversation as JSON.
   * Includes schema version and strips transient metadata.
   */
  async function handleExportJSON(): Promise<void> {
    // Get messages without hidden ones, strip transient metadata
    const messages = getMessages(conversation, { includeHidden: false });
    const cleanedMessages = messages.map((message) => {
      // Strip transient metadata (keys starting with _) from message metadata
      if (message.metadata) {
        const cleanedMetadata: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(message.metadata)) {
          if (!key.startsWith('_')) {
            cleanedMetadata[key] = value;
          }
        }
        return {
          ...message,
          metadata: Object.keys(cleanedMetadata).length > 0 ? cleanedMetadata : undefined,
        };
      }
      return message;
    });

    const exportData = {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      conversationId: conversation.id,
      messages: cleanedMessages,
    };

    // Guard against circular references or other JSON serialization failures
    const json = stringifyOrNull(exportData);
    if (json === null) {
      onexportfailed?.('json', 'Failed to serialize conversation data');
      return;
    }

    const copied = await copyToClipboard(json);
    if (copied) {
      copiedFormat = 'json';
      onexported?.('json');
    } else {
      onexportfailed?.('json', 'Clipboard access denied. Please copy manually.');
    }
  }

  // Reset copied state after 2 seconds
  $effect(() => {
    if (!copiedFormat) return;

    const timeout = setTimeout(() => (copiedFormat = null), 2000);
    return () => clearTimeout(timeout);
  });

  const formatLabels: Record<ExportFormat, string> = {
    markdown: 'Markdown',
    json: 'JSON',
  };
</script>

<div class={classNames('conversation-export-actions', className)}>
  <!-- Screen reader announcement for copy success -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {#if copiedFormat}
      Copied as {formatLabels[copiedFormat]}
    {/if}
  </div>

  <Dropdown {id}>
    <DropdownTrigger class="export-trigger" aria-label="Export conversation">
      <Copy class="icon-sm" />
    </DropdownTrigger>
    <DropdownMenu>
      <!-- Markdown export -->
      <DropdownItem onclick={handleExportMarkdown}>
        {#if copiedFormat === 'markdown'}
          <Check class="icon-sm export-icon-success" />
        {:else}
          <FileText class="icon-sm" />
        {/if}
        <span>Copy as {formatLabels.markdown}</span>
        {#if copiedFormat === 'markdown'}
          <span class="copied-label">Copied!</span>
        {/if}
      </DropdownItem>

      <!-- JSON export -->
      <DropdownItem onclick={handleExportJSON}>
        {#if copiedFormat === 'json'}
          <Check class="icon-sm export-icon-success" />
        {:else}
          <FileCode class="icon-sm" />
        {/if}
        <span>Copy as {formatLabels.json}</span>
        {#if copiedFormat === 'json'}
          <span class="copied-label">Copied!</span>
        {/if}
      </DropdownItem>
    </DropdownMenu>
  </Dropdown>
</div>

<style>
  .conversation-export-actions {
    display: flex;
    align-items: center;
  }

  /* Style the DropdownTrigger button as icon-only */
  .conversation-export-actions :global(.export-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--cinder-space-1-5);
    color: var(--cinder-text-muted);
    background: transparent;
    border: none;
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition: background-color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .conversation-export-actions :global(.export-trigger:hover) {
    background: var(--cinder-surface-hover);
  }

  .conversation-export-actions :global(.export-trigger:focus-visible) {
    outline: 2px solid var(--cinder-accent);
    outline-offset: 2px;
  }

  .export-icon-success {
    color: var(--cinder-success);
  }

  .copied-label {
    margin-inline-start: auto;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-success);
    font-weight: var(--cinder-font-medium);
  }
</style>
