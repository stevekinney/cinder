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
  import { createCopyState } from '../../utilities/use-copy-state.svelte.ts';
  import Dropdown from '@lostgradient/cinder/dropdown';
  import DropdownItem from '@lostgradient/cinder/dropdown-item';
  import DropdownMenu from '@lostgradient/cinder/dropdown-menu';
  import DropdownTrigger from '@lostgradient/cinder/dropdown-trigger';
  import {
    Check,
    Copy,
    FileCode,
    FileText,
    GitBranch,
    MessageSquare,
  } from '@lostgradient/cinder/icons';

  let {
    id,
    onexportcontent,
    onexportsummary,
    onexportjson,
    onexportdiff,
    onexportcomments,
    class: className,
  }: ExportActionsProps = $props();

  type ExportFormat = 'content' | 'summary' | 'json' | 'diff' | 'comments';

  const copyState = createCopyState<ExportFormat>();

  async function handleCopy(format: ExportFormat) {
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

    await copyState.trigger(format, content);
  }

  const formatLabels: Record<ExportFormat, string> = {
    content: 'Content',
    summary: 'Summary (for LLM)',
    json: 'JSON',
    diff: 'Git Diff',
    comments: 'Comments',
  };
</script>

<div class={classNames('export-actions', className)}>
  <!-- Screen reader announcement for copy success -->
  <div class="cinder-sr-only" aria-live="polite" aria-atomic="true">
    {#if copyState.copiedKey}
      Copied {formatLabels[copyState.copiedKey]}
    {/if}
  </div>

  <Dropdown {id}>
    <DropdownTrigger class="export-trigger" aria-label="Copy to clipboard" showCaret={false}>
      <Copy class="cinder-icon-sm" />
      <span class="cinder-sr-only">Copy</span>
    </DropdownTrigger>
    <DropdownMenu>
      <!-- Plain content (current markdown) -->
      {#if onexportcontent}
        <DropdownItem onclick={() => handleCopy('content')}>
          {#if copyState.copiedKey === 'content'}
            <Check class="cinder-icon-sm export-icon-success" />
          {:else}
            <FileText class="cinder-icon-sm" />
          {/if}
          <span>{formatLabels.content}</span>
          {#if copyState.copiedKey === 'content'}
            <span class="copied-label">Copied!</span>
          {/if}
        </DropdownItem>
      {/if}

      <!-- LLM-optimized summary -->
      <DropdownItem onclick={() => handleCopy('summary')}>
        {#if copyState.copiedKey === 'summary'}
          <Check class="cinder-icon-sm export-icon-success" />
        {:else}
          <FileText class="cinder-icon-sm" />
        {/if}
        <span>{formatLabels.summary}</span>
        {#if copyState.copiedKey === 'summary'}
          <span class="copied-label">Copied!</span>
        {/if}
      </DropdownItem>

      <!-- Git diff -->
      <DropdownItem onclick={() => handleCopy('diff')}>
        {#if copyState.copiedKey === 'diff'}
          <Check class="cinder-icon-sm export-icon-success" />
        {:else}
          <GitBranch class="cinder-icon-sm" />
        {/if}
        <span>{formatLabels.diff}</span>
        {#if copyState.copiedKey === 'diff'}
          <span class="copied-label">Copied!</span>
        {/if}
      </DropdownItem>

      <!-- Comments as markdown -->
      {#if onexportcomments}
        <DropdownItem onclick={() => handleCopy('comments')}>
          {#if copyState.copiedKey === 'comments'}
            <Check class="cinder-icon-sm export-icon-success" />
          {:else}
            <MessageSquare class="cinder-icon-sm" />
          {/if}
          <span>{formatLabels.comments}</span>
          {#if copyState.copiedKey === 'comments'}
            <span class="copied-label">Copied!</span>
          {/if}
        </DropdownItem>
      {/if}

      <!-- JSON (full state) -->
      <DropdownItem onclick={() => handleCopy('json')}>
        {#if copyState.copiedKey === 'json'}
          <Check class="cinder-icon-sm export-icon-success" />
        {:else}
          <FileCode class="cinder-icon-sm" />
        {/if}
        <span>{formatLabels.json}</span>
        {#if copyState.copiedKey === 'json'}
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
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .export-actions :global(.export-trigger:focus-visible) {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 3px;
    }
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
