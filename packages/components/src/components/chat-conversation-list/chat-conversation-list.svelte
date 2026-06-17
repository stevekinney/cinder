<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status domain-suite
   * @purpose Conversation navigation list for switching among Chat transcripts without embedding the list inside Chat.
   * @tag chat
   * @tag conversation
   * @tag navigation
   * @useWhen Rendering a multi-conversation chat sidebar beside one active Chat transcript.
   * @useWhen Showing unread counts and last-message previews for compatible conversation snapshots.
   * @avoidWhen Rendering the message transcript itself — use chat for the active conversation surface.
   * @avoidWhen Building app-wide primary navigation — use side-navigation or navigation-bar.
   * @related chat, chat-conversation-header, side-navigation
   */
  export type { ChatConversationListProps } from './chat-conversation-list.types.ts';
  export type { ConversationSummary } from './conversation-summary.ts';
  export { deriveConversationSummary } from './conversation-summary.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { ChatConversationListProps } from './chat-conversation-list.types.ts';
  import { conversationSummaryTimestamp } from './conversation-summary.ts';

  let {
    conversations,
    activeConversationId = null,
    ariaLabel = 'Conversations',
    emptyText = 'No conversations',
    class: className,
    onselectconversation,
    ...rest
  }: ChatConversationListProps = $props();

  const sortedConversations = $derived.by(() =>
    [...conversations].sort(
      (a, b) => conversationSummaryTimestamp(b) - conversationSummaryTimestamp(a),
    ),
  );

  function preview(summary: (typeof sortedConversations)[number]): string {
    const text = summary.lastMessageText?.trim();
    if (!text) return `${summary.messageCount} messages`;
    return text.length > 96 ? `${text.slice(0, 93)}...` : text;
  }
</script>

<nav
  class={classNames('cinder-chat-conversation-list', className)}
  aria-label={ariaLabel}
  {...rest}
>
  {#if sortedConversations.length === 0}
    <p class="cinder-chat-conversation-list__empty" role="status">{emptyText}</p>
  {:else}
    <ul class="cinder-chat-conversation-list__items">
      {#each sortedConversations as conversation (conversation.id)}
        {@const isActive = conversation.id === activeConversationId}
        <li class="cinder-chat-conversation-list__item">
          {#if onselectconversation}
            <button
              type="button"
              class="cinder-chat-conversation-list__button"
              aria-current={isActive ? 'page' : undefined}
              data-cinder-conversation-item
              data-cinder-conversation-interactive
              data-cinder-conversation-selected={isActive ? '' : undefined}
              onclick={() => onselectconversation(conversation.id)}
            >
              <span class="cinder-chat-conversation-list__title">{conversation.title}</span>
              <span class="cinder-chat-conversation-list__preview">{preview(conversation)}</span>
              {#if conversation.unreadCount > 0}
                <span class="cinder-chat-conversation-list__badge" aria-hidden="true">
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
                <span class="sr-only">, {conversation.unreadCount} unread messages</span>
              {/if}
            </button>
          {:else}
            <div
              class="cinder-chat-conversation-list__button"
              aria-current={isActive ? 'page' : undefined}
              data-cinder-conversation-item
              data-cinder-conversation-static
              data-cinder-conversation-selected={isActive ? '' : undefined}
            >
              <span class="cinder-chat-conversation-list__title">{conversation.title}</span>
              <span class="cinder-chat-conversation-list__preview">{preview(conversation)}</span>
              {#if conversation.unreadCount > 0}
                <span class="cinder-chat-conversation-list__badge" aria-hidden="true">
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
                <span class="sr-only">, {conversation.unreadCount} unread messages</span>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</nav>
