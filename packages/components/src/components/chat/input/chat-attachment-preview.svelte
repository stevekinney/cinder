<script lang="ts" module>
  import type { ChatAttachment } from './chat-attachment.ts';

  export interface ChatAttachmentPreviewProps {
    attachment: ChatAttachment;
    class?: string;
  }
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import { formatBytes } from '../../../utilities/format-bytes.ts';
  import { FileCode, FileText } from '../../icons/index.ts';

  let { attachment, class: className }: ChatAttachmentPreviewProps = $props();

  const extension = $derived(
    attachment.file.name.includes('.')
      ? attachment.file.name.slice(attachment.file.name.lastIndexOf('.'))
      : '',
  );

  const truncatedName = $derived.by(() => {
    const name = attachment.file.name;
    const maxLength = 18;
    if (name.length <= maxLength) return name;
    const ext = extension;
    const base = name.slice(0, name.length - ext.length);
    const availableLength = maxLength - ext.length - 1; // 1 for ellipsis char
    if (availableLength < 3) return name.slice(0, maxLength - 1) + '\u2026';
    return base.slice(0, availableLength) + '\u2026' + ext;
  });
</script>

<div
  class={classNames('chat-attachment-preview', className)}
  data-kind={attachment.kind}
  data-error={attachment.status === 'error' || undefined}
  data-pending={attachment.status === 'pending' || undefined}
>
  {#if attachment.kind === 'image'}
    <img
      src={attachment.previewUrl}
      alt={attachment.file.name}
      class="chat-attachment-preview-image"
    />
  {:else}
    <div class="chat-attachment-preview-file">
      <div class="chat-attachment-preview-icon">
        {#if attachment.kind === 'code'}
          <FileCode class="icon-sm" />
        {:else}
          <FileText class="icon-sm" />
        {/if}
      </div>
      <div class="chat-attachment-preview-info">
        <span class="chat-attachment-preview-name" title={attachment.file.name}>
          {truncatedName}
        </span>
        <span class="chat-attachment-preview-meta">
          {#if extension}
            <span class="chat-attachment-preview-ext">{extension}</span>
          {/if}
          <span class="chat-attachment-preview-size">{formatBytes(attachment.file.size)}</span>
        </span>
      </div>
    </div>
  {/if}

  {#if attachment.status === 'error'}
    <span
      class="chat-attachment-preview-error-badge"
      aria-label={attachment.error ?? 'Attachment error'}>!</span
    >
  {/if}

  {#if attachment.status === 'pending'}
    <div class="chat-attachment-preview-loading" role="status" aria-label="Reading file">
      <div class="chat-attachment-preview-loading-bar"></div>
    </div>
  {/if}
</div>

<style>
  .chat-attachment-preview {
    position: relative;
    border-radius: var(--cinder-radius-md);
    overflow: hidden;
    border: 1px solid var(--cinder-border);
  }

  /* Image kind: square thumbnail */
  .chat-attachment-preview[data-kind='image'] {
    width: 3.5rem;
    height: 3.5rem;
  }

  .chat-attachment-preview-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Code/document kind: wider card */
  .chat-attachment-preview[data-kind='code'],
  .chat-attachment-preview[data-kind='document'] {
    display: flex;
    align-items: center;
    min-width: 8rem;
    max-width: 14rem;
    height: 3.5rem;
    background: var(--cinder-surface-raised);
  }

  .chat-attachment-preview-file {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-2);
    width: 100%;
    min-width: 0;
  }

  .chat-attachment-preview-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cinder-text-subtle);
  }

  .chat-attachment-preview-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: var(--cinder-space-0-5);
  }

  .chat-attachment-preview-name {
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-attachment-preview-meta {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .chat-attachment-preview-ext {
    padding: 0 var(--cinder-space-1);
    background: var(--cinder-surface-inset);
    border-radius: var(--cinder-radius-sm);
    font-family: var(--cinder-font-mono);
    font-size: 0.625rem;
    line-height: 1.25rem;
  }

  .chat-attachment-preview-size {
    white-space: nowrap;
  }

  /* Error state */
  .chat-attachment-preview[data-error] {
    border-color: var(--cinder-danger);
  }

  .chat-attachment-preview[data-error] .chat-attachment-preview-image {
    opacity: 0.5;
  }

  .chat-attachment-preview[data-error] .chat-attachment-preview-icon {
    color: var(--cinder-danger);
  }

  .chat-attachment-preview-error-badge {
    position: absolute;
    bottom: var(--cinder-space-0-5);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-bold);
    color: white;
    background: var(--cinder-danger);
    border-radius: var(--cinder-radius-full);
  }

  /* Pending/loading state: dim non-text elements only to preserve text contrast */
  .chat-attachment-preview[data-pending] .chat-attachment-preview-icon,
  .chat-attachment-preview[data-pending] .chat-attachment-preview-image {
    opacity: 0.6;
  }

  .chat-attachment-preview-loading {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--cinder-surface-inset);
    overflow: hidden;
  }

  .chat-attachment-preview-loading-bar {
    width: 40%;
    height: 100%;
    background: var(--cinder-accent);
    animation: loading-slide 1.2s ease-in-out infinite;
  }

  @keyframes loading-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(350%);
    }
  }
</style>
