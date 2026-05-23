<script lang="ts" module>
  export interface ExportActionsProps {
    /** Required unique ID for SSR stability and accessibility */
    id: string;
    /** Callback to get current markdown content (plain) */
    onexportcontent?: () => string;
    /** Callback to get LLM-optimized summary */
    onexportsummary: () => string;
    /** Callback to get JSON content */
    onexportjson: () => string;
    /** Callback to get Git diff content */
    onexportdiff: () => string;
    /** Callback to get comments export content */
    onexportcomments?: () => string;
    class?: string;
  }
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import Dropdown from '../dropdown/dropdown.svelte';
  import DropdownItem from '../dropdown-item/dropdown-item.svelte';
  import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';
  import DropdownTrigger from '../dropdown-trigger/dropdown-trigger.svelte';
  import { Copy, FileText, FileCode, GitBranch, MessageSquare, Check } from '../icons/index.ts';

  let {
    id,
    onexportcontent,
    onexportsummary,
    onexportjson,
    onexportdiff,
    onexportcomments,
    class: className,
  }: ExportActionsProps = $props();

  type ExportFormat = 'content' | 'summary' | 'json' | 'diff' | 'comments' | null;
  let copiedFormat = $state<ExportFormat>(null);

  async function handleCopy(format: ExportFormat) {
    if (!format) return;

    let content: string;
    switch (format) {
      case 'content':
        if (!onexportcontent) return;
        content = onexportcontent();
        break;
      case 'summary':
        content = onexportsummary();
        break;
      case 'json':
        content = onexportjson();
        break;
      case 'diff':
        content = onexportdiff();
        break;
      case 'comments':
        if (!onexportcomments) return;
        content = onexportcomments();
        break;
    }

    const copied = await copyToClipboard(content);
    if (copied) {
      copiedFormat = format;
    }
  }

  $effect(() => {
    if (!copiedFormat) return;

    const timeout = setTimeout(() => (copiedFormat = null), 2000);
    return () => clearTimeout(timeout);
  });

  const formatLabels: Record<ExportFormat & string, string> = {
    content: 'Content',
    summary: 'Summary (for LLM)',
    json: 'JSON',
    diff: 'Git Diff',
    comments: 'Comments',
  };
</script>

<div class={classNames('export-actions', className)}>
  <Dropdown {id}>
    <DropdownTrigger class="export-trigger" aria-label="Copy to clipboard" showCaret={false}>
      <Copy class="icon-sm" />
      <span class="cinder-sr-only">Copy</span>
    </DropdownTrigger>
    <DropdownMenu>
      <!-- Plain content (current markdown) -->
      {#if onexportcontent}
        <DropdownItem onclick={() => handleCopy('content')}>
          {#if copiedFormat === 'content'}
            <Check class="icon-sm export-icon-success" />
          {:else}
            <FileText class="icon-sm" />
          {/if}
          <span>{formatLabels.content}</span>
          {#if copiedFormat === 'content'}
            <span class="copied-label">Copied!</span>
          {/if}
        </DropdownItem>
      {/if}

      <!-- LLM-optimized summary -->
      <DropdownItem onclick={() => handleCopy('summary')}>
        {#if copiedFormat === 'summary'}
          <Check class="icon-sm export-icon-success" />
        {:else}
          <FileText class="icon-sm" />
        {/if}
        <span>{formatLabels.summary}</span>
        {#if copiedFormat === 'summary'}
          <span class="copied-label">Copied!</span>
        {/if}
      </DropdownItem>

      <!-- Git diff -->
      <DropdownItem onclick={() => handleCopy('diff')}>
        {#if copiedFormat === 'diff'}
          <Check class="icon-sm export-icon-success" />
        {:else}
          <GitBranch class="icon-sm" />
        {/if}
        <span>{formatLabels.diff}</span>
        {#if copiedFormat === 'diff'}
          <span class="copied-label">Copied!</span>
        {/if}
      </DropdownItem>

      <!-- Comments as markdown -->
      {#if onexportcomments}
        <DropdownItem onclick={() => handleCopy('comments')}>
          {#if copiedFormat === 'comments'}
            <Check class="icon-sm export-icon-success" />
          {:else}
            <MessageSquare class="icon-sm" />
          {/if}
          <span>{formatLabels.comments}</span>
          {#if copiedFormat === 'comments'}
            <span class="copied-label">Copied!</span>
          {/if}
        </DropdownItem>
      {/if}

      <!-- JSON (full state) -->
      <DropdownItem onclick={() => handleCopy('json')}>
        {#if copiedFormat === 'json'}
          <Check class="icon-sm export-icon-success" />
        {:else}
          <FileCode class="icon-sm" />
        {/if}
        <span>{formatLabels.json}</span>
        {#if copiedFormat === 'json'}
          <span class="copied-label">Copied!</span>
        {/if}
      </DropdownItem>
    </DropdownMenu>
  </Dropdown>
</div>

<style>
  .export-actions {
    display: flex;
    align-items: center;
  }

  /* Style the DropdownTrigger button as icon-only - uses :global() since button is rendered by child component */
  .export-actions :global(.export-trigger) {
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

  @media (hover: hover) {
    .export-actions :global(.export-trigger:hover) {
      background: var(--cinder-surface-hover);
    }
  }

  .export-actions :global(.export-trigger:focus-visible) {
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
